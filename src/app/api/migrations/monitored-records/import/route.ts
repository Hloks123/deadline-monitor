import { NextResponse } from "next/server";
import {
  invalidRequest,
  isRecord,
  readJson,
  requirePlatformRole,
  requireSameOrigin,
  safeBackendFailure,
} from "@/lib/admin/authorization";
import { defaultRecords } from "@/lib/recordStore";
import { parseMigrationSourceRequest } from "@/lib/monitoredRecords/migrationRequest";
import { normalizeLegacyMigrationPayload } from "@/lib/monitoredRecords/validation";

export const dynamic = "force-dynamic";

const maximumPayloadBytes = 2 * 1024 * 1024;
const checksumPattern = /^[0-9a-f]{64}$/;

export async function POST(request: Request) {
  const originError = requireSameOrigin(request);
  if (originError) return originError;

  const auth = await requirePlatformRole(["main_consultant"]);
  if ("response" in auth) return auth.response;

  const body = await readJson(request);
  if (!isRecord(body) || JSON.stringify(body).length > maximumPayloadBytes) {
    return invalidRequest("Migration import exceeds the request size limit.");
  }
  if (
    Object.keys(body).some(
      (key) =>
        ![
          "organisationId",
          "legacyClientId",
          "sourceDeviceId",
          "includeSuspectedFixtures",
          "contacts",
          "records",
          "communications",
          "auditEvents",
          "runId",
          "sourceChecksum",
        ].includes(key),
    ) ||
    typeof body.runId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.runId) ||
    typeof body.sourceChecksum !== "string" ||
    !checksumPattern.test(body.sourceChecksum)
  ) {
    return invalidRequest("Enter a valid migration run and reviewed source checksum.");
  }
  const sourceBody = Object.fromEntries(
    Object.entries(body).filter(([key]) => key !== "runId" && key !== "sourceChecksum"),
  );
  const requestData = parseMigrationSourceRequest(sourceBody);
  if (!requestData.ok) return invalidRequest(requestData.error);

  const { data: run, error: runError } = await auth.supabase
    .from("data_migration_runs")
    .select("id, organisation_id, initiated_by, source_checksum")
    .eq("id", body.runId)
    .maybeSingle();
  if (runError) return safeBackendFailure();
  if (
    !run ||
    run.organisation_id !== requestData.value.organisationId ||
    run.initiated_by !== auth.access.userId
  ) {
    return NextResponse.json({ error: "Migration preview was not found." }, { status: 404 });
  }

  const normalized = normalizeLegacyMigrationPayload(
    requestData.value,
    new Set(Object.keys(defaultRecords)),
  );
  if (!normalized.ok) return invalidRequest(normalized.error);
  if (
    normalized.value.sourceChecksum !== body.sourceChecksum ||
    normalized.value.sourceChecksum !== run.source_checksum
  ) {
    return NextResponse.json(
      { error: "The local data changed after preview. Run the preview again before importing." },
      { status: 409 },
    );
  }

  const { data, error } = await auth.supabase.rpc(
  "commit_local_record_migration_with_contacts",
    {
      target_run_id: body.runId,
      source_checksum_input: normalized.value.sourceChecksum,
    contacts_input: normalized.value.contacts,
      records_input: normalized.value.records,
      communications_input: normalized.value.communications,
      audit_events_input: normalized.value.auditEvents,
    },
  );
  if (error) {
    if (error.code === "42501") {
      return NextResponse.json({ error: "You are not authorised to import this data." }, { status: 403 });
    }
    if (error.code === "23505" || error.code === "23503") {
      return NextResponse.json(
        { error: "The import conflicts with existing data or an unresolved record link." },
        { status: 409 },
      );
    }
    if (error.code === "22023") {
      return NextResponse.json(
        { error: "Migration data no longer matches the reviewed preview." },
        { status: 409 },
      );
    }
    return safeBackendFailure();
  }

  return NextResponse.json(
    { result: data },
    { headers: { "Cache-Control": "no-store" } },
  );
}
