import { NextResponse } from "next/server";
import {
  invalidRequest,
  isRecord,
  readJson,
  requireSameOrigin,
  safeBackendFailure,
} from "@/lib/admin/authorization";
import {
  authoriseOrganisationRecordAccess,
  isUuid,
  mapMonitoredRecord,
  recordDatabasePatch,
  resolveRecordContact,
} from "@/lib/monitoredRecords/server";
import { parseMonitoredRecordWrite } from "@/lib/monitoredRecords/validation";

export const dynamic = "force-dynamic";

const maximumRecordBodyBytes = 32 * 1024;

function writeFailure(error: { code?: string }) {
  if (error.code === "42501") {
    return NextResponse.json({ error: "You are not authorised to update this record." }, { status: 403 });
  }
  if (error.code === "23514" || error.code === "23503") {
    return invalidRequest("The selected record contact must belong to this organisation.");
  }
  if (error.code === "23505") {
    return NextResponse.json({ error: "A conflicting monitored record already exists." }, { status: 409 });
  }
  return safeBackendFailure();
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ organisationId: string; recordId: string }> },
) {
  const { organisationId, recordId } = await context.params;
  const access = await authoriseOrganisationRecordAccess(organisationId);
  if (!access.ok) return access.response;
  if (!isUuid(recordId)) {
    return NextResponse.json({ error: "Monitored record was not found." }, { status: 404 });
  }

  const { data, error } = await access.supabase
    .from("organisation_records")
    .select("*")
    .eq("organisation_id", organisationId)
    .eq("id", recordId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) return safeBackendFailure();
  if (!data) {
    return NextResponse.json({ error: "Monitored record was not found." }, { status: 404 });
  }
  return NextResponse.json(
    { record: mapMonitoredRecord(data, access.organisation) },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ organisationId: string; recordId: string }> },
) {
  const originError = requireSameOrigin(request);
  if (originError) return originError;

  const { organisationId, recordId } = await context.params;
  const access = await authoriseOrganisationRecordAccess(organisationId);
  if (!access.ok) return access.response;
  if (!isUuid(recordId)) {
    return NextResponse.json({ error: "Monitored record was not found." }, { status: 404 });
  }

  const length = Number(request.headers.get("content-length") || 0);
  if (length > maximumRecordBodyBytes) {
    return invalidRequest("Monitored-record details exceed the request size limit.");
  }
  const body = await readJson(request);
  if (
    !isRecord(body) ||
    Object.keys(body).some((key) => key !== "version" && key !== "changes") ||
    JSON.stringify(body).length > maximumRecordBodyBytes ||
    !Number.isInteger(body.version) ||
    (body.version as number) < 1 ||
    !isRecord(body.changes)
  ) {
    return invalidRequest("Enter a record version and valid monitored-record changes.");
  }

  const parsed = parseMonitoredRecordWrite(body.changes, true);
  if (!parsed.ok) return invalidRequest(parsed.error);
  const trustedChanges = { ...parsed.value };
  if ("contactId" in trustedChanges) {
    const resolvedContact = await resolveRecordContact(
      access.supabase,
      organisationId,
      trustedChanges.contactId,
    );
    if ("failed" in resolvedContact) return safeBackendFailure();
    if (!resolvedContact.ok) {
      return invalidRequest("Choose an active authorised contact from this organisation.");
    }
    trustedChanges.contact = resolvedContact.contact?.name || "";
    trustedChanges.contactEmail = resolvedContact.contact?.email || "";
  } else {
    delete trustedChanges.contact;
    delete trustedChanges.contactEmail;
    if (Object.keys(trustedChanges).length === 0) {
      return invalidRequest("Make at least one monitored-record change before saving.");
    }
  }
  const { data, error } = await access.supabase
    .from("organisation_records")
    .update(recordDatabasePatch(access.userId, trustedChanges))
    .eq("organisation_id", organisationId)
    .eq("id", recordId)
    .eq("version", body.version)
    .is("deleted_at", null)
    .select("*")
    .maybeSingle();
  if (error) return writeFailure(error);
  if (data) {
    return NextResponse.json(
      { record: mapMonitoredRecord(data, access.organisation) },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  const { data: current, error: currentError } = await access.supabase
    .from("organisation_records")
    .select("id")
    .eq("organisation_id", organisationId)
    .eq("id", recordId)
    .is("deleted_at", null)
    .maybeSingle();
  if (currentError) return safeBackendFailure();
  if (current) {
    return NextResponse.json(
      { error: "The monitored record changed. Reload it before saving again." },
      { status: 409 },
    );
  }
  return NextResponse.json({ error: "Monitored record was not found." }, { status: 404 });
}
