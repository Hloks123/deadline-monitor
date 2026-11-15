import { NextResponse } from "next/server";
import {
  requirePlatformRole,
  safeBackendFailure,
} from "@/lib/admin/authorization";

export const dynamic = "force-dynamic";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(
  _request: Request,
  context: { params: Promise<{ runId: string }> },
) {
  const { runId } = await context.params;
  if (!uuidPattern.test(runId)) {
    return NextResponse.json({ error: "Migration run was not found." }, { status: 404 });
  }

  const auth = await requirePlatformRole(["main_consultant"]);
  if ("response" in auth) return auth.response;

  const { data: run, error: runError } = await auth.supabase
    .from("data_migration_runs")
    .select(
      "id, organisation_id, initiated_by, status, source_counts, imported_counts, skipped_counts, failed_counts, validation_summary, reconciliation_summary, started_at, completed_at, reconciled_at",
    )
    .eq("id", runId)
    .maybeSingle();
  if (runError) return safeBackendFailure();
  if (!run || run.initiated_by !== auth.access.userId) {
    return NextResponse.json({ error: "Migration run was not found." }, { status: 404 });
  }

  if (run.status === "completed" || run.status === "reconciled" || run.status === "reconciliation_required") {
    const { error: reconciliationError } = await auth.supabase.rpc(
      "reconcile_local_record_migration",
      { target_run_id: runId },
    );
    if (reconciliationError) return safeBackendFailure();
  }

  const { data: reconciledRun, error: reconciledRunError } = await auth.supabase
    .from("data_migration_runs")
    .select(
      "id, organisation_id, status, source_counts, imported_counts, skipped_counts, failed_counts, validation_summary, reconciliation_summary, started_at, completed_at, reconciled_at",
    )
    .eq("id", runId)
    .single();
  if (reconciledRunError || !reconciledRun) return safeBackendFailure();

  return NextResponse.json(
    { run: reconciledRun },
    { headers: { "Cache-Control": "no-store" } },
  );
}
