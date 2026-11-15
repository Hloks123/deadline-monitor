import { NextResponse } from "next/server";
import { getWorkspaceAccess } from "@/lib/auth/workspace";
import { safeBackendFailure } from "@/lib/admin/authorization";
import { isUuid, mapMonitoredRecord } from "@/lib/monitoredRecords/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ recordId: string }> },
) {
  const { recordId } = await context.params;
  if (!isUuid(recordId)) {
    return NextResponse.json({ error: "Monitored record was not found." }, { status: 404 });
  }

  const supabase = await createClient();
  const access = await getWorkspaceAccess(supabase);
  if (access.status !== "authorized") {
    return NextResponse.json(
      { error: "You are not authorised to access monitored records." },
      { status: access.status === "unauthenticated" ? 401 : 403 },
    );
  }

  const { data: row, error } = await supabase
    .from("organisation_records")
    .select("*")
    .eq("id", recordId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) return safeBackendFailure();
  if (!row) {
    return NextResponse.json({ error: "Monitored record was not found." }, { status: 404 });
  }

  const { data: organisation, error: organisationError } = await supabase
    .from("organisations")
    .select("id, name")
    .eq("id", row.organisation_id)
    .eq("status", "active")
    .maybeSingle();
  if (organisationError) return safeBackendFailure();
  if (!organisation) {
    return NextResponse.json({ error: "Monitored record was not found." }, { status: 404 });
  }

  const canAccess = access.platformRoles.includes("main_consultant") ||
    access.memberships.some(
      (membership) =>
        membership.organisationId === row.organisation_id &&
        membership.role === "assistant_consultant",
    );
  if (!canAccess) {
    return NextResponse.json({ error: "Monitored record was not found." }, { status: 404 });
  }

  return NextResponse.json(
    { record: mapMonitoredRecord(row, organisation) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
