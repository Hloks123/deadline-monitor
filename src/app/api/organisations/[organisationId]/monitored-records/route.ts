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
  mapMonitoredRecord,
  recordDatabaseInput,
  resolveRecordContact,
} from "@/lib/monitoredRecords/server";
import { parseMonitoredRecordWrite } from "@/lib/monitoredRecords/validation";

export const dynamic = "force-dynamic";

const maximumRecordBodyBytes = 32 * 1024;
const maximumPageSize = 500;

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
  request: Request,
  context: { params: Promise<{ organisationId: string }> },
) {
  const { organisationId } = await context.params;
  const access = await authoriseOrganisationRecordAccess(organisationId);
  if (!access.ok) return access.response;

  const query = new URL(request.url).searchParams;
  const limitValue = query.get("limit");
  const offsetValue = query.get("offset");
  const limit = limitValue === null ? 100 : Number(limitValue);
  const offset = offsetValue === null ? 0 : Number(offsetValue);
  if (
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > maximumPageSize ||
    !Number.isInteger(offset) ||
    offset < 0
  ) {
    return invalidRequest("Choose a valid monitored-record page.");
  }

  const { data, error, count } = await access.supabase
    .from("organisation_records")
    .select("*", { count: "exact" })
    .eq("organisation_id", organisationId)
    .is("deleted_at", null)
    .order("expiry_date", { ascending: true })
    .range(offset, offset + limit - 1);
  if (error) return safeBackendFailure();

  const records = (data ?? []).map((row) =>
    mapMonitoredRecord(row, access.organisation),
  );
  const nextOffset =
    count !== null && offset + records.length < count
      ? offset + records.length
      : null;
  return NextResponse.json(
    { records, nextOffset },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(
  request: Request,
  context: { params: Promise<{ organisationId: string }> },
) {
  const originError = requireSameOrigin(request);
  if (originError) return originError;

  const { organisationId } = await context.params;
  const access = await authoriseOrganisationRecordAccess(organisationId);
  if (!access.ok) return access.response;

  const length = Number(request.headers.get("content-length") || 0);
  if (length > maximumRecordBodyBytes) {
    return invalidRequest("Monitored-record details exceed the request size limit.");
  }
  const body = await readJson(request);
  if (!isRecord(body) || JSON.stringify(body).length > maximumRecordBodyBytes) {
    return invalidRequest("Enter valid monitored-record details.");
  }
  const parsed = parseMonitoredRecordWrite(body);
  if (!parsed.ok) return invalidRequest(parsed.error);
  const resolvedContact = await resolveRecordContact(
    access.supabase,
    organisationId,
    parsed.value.contactId,
  );
  if ("failed" in resolvedContact) return safeBackendFailure();
  if (!resolvedContact.ok) {
    return invalidRequest("Choose an active authorised contact from this organisation.");
  }
  const trustedInput = {
    ...parsed.value,
    contact: resolvedContact.contact?.name || "",
    contactEmail: resolvedContact.contact?.email || "",
  };

  const { data, error } = await access.supabase
    .from("organisation_records")
    .insert(
      recordDatabaseInput(
        organisationId,
        access.userId,
        trustedInput,
      ),
    )
    .select("*")
    .single();
  if (error) return writeFailure(error);

  return NextResponse.json(
    { record: mapMonitoredRecord(data, access.organisation) },
    { status: 201, headers: { "Cache-Control": "no-store" } },
  );
}
