import { NextResponse } from "next/server";
import type {
  AuditEvent,
  CommunicationEvent,
} from "@/lib/recordStore";
import {
  authoriseOrganisationRecordAccess,
  isUuid,
} from "@/lib/monitoredRecords/server";
import { mapMonitoredRecordAuditRow } from "@/lib/monitoredRecords/auditHistory";
import { safeBackendFailure } from "@/lib/admin/authorization";

export const dynamic = "force-dynamic";
const maximumHistoryRows = 500;

function historyDate(occurredAt: unknown, legacyDateText: unknown) {
  if (typeof occurredAt === "string") return occurredAt;
  return typeof legacyDateText === "string" ? legacyDateText : "";
}

export async function GET(
  request: Request,
  context: { params: Promise<{ organisationId: string; recordId: string }> },
) {
  const { organisationId, recordId } = await context.params;
  const auditOnly = new URL(request.url).searchParams.get("scope") === "audit";
  const access = await authoriseOrganisationRecordAccess(organisationId);
  if (!access.ok) return access.response;
  if (!isUuid(recordId)) {
    return NextResponse.json({ error: "Monitored record was not found." }, { status: 404 });
  }

  const { data: record, error: recordError } = await access.supabase
    .from("organisation_records")
    .select("id")
    .eq("organisation_id", organisationId)
    .eq("id", recordId)
    .is("deleted_at", null)
    .maybeSingle();
  if (recordError) return safeBackendFailure();
  if (!record) {
    return NextResponse.json({ error: "Monitored record was not found." }, { status: 404 });
  }

  const auditEventsResult = await access.supabase
    .from("organisation_audit_events")
    .select(
      "id, record_id, record_name, actor_label, action, field, previous_value, new_value, occurred_at, legacy_date_text, entity_type, entity_id, entity_name, context",
    )
    .eq("organisation_id", organisationId)
    .eq("record_id", recordId)
    .order("occurred_at", { ascending: false, nullsFirst: false })
    .limit(maximumHistoryRows);
  if (auditEventsResult.error) {
    return safeBackendFailure();
  }

  const safeAuditEvents = (auditEventsResult.data ?? []).flatMap((row) => {
    const event = mapMonitoredRecordAuditRow(row, recordId);
    return event ? [event] : [];
  });
  const auditTruncated =
    (auditEventsResult.data?.length ?? 0) === maximumHistoryRows;

  if (auditOnly) {
    return NextResponse.json(
      {
        organisationName: access.organisation.name,
        events: safeAuditEvents,
        truncated: auditTruncated,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  const communicationsResult = await access.supabase
    .from("organisation_communications")
    .select(
      "id, unique_key, record_id, communication_type, recipient, subject, message, outcome, delivery_status, next_follow_up, occurred_at, legacy_date_text, related_task_id, message_version, reviewer, decision, reviewed_at, failure_reason",
    )
    .eq("organisation_id", organisationId)
    .eq("record_id", recordId)
    .order("occurred_at", { ascending: false, nullsFirst: false })
    .limit(maximumHistoryRows);
  if (communicationsResult.error) return safeBackendFailure();

  const communications: CommunicationEvent[] = (communicationsResult.data ?? []).map(
    (row) => ({
      id: row.id,
      uniqueKey: row.unique_key || "",
      recordId: row.record_id,
      type: row.communication_type as CommunicationEvent["type"],
      recipient: row.recipient,
      subject: row.subject,
      message: row.message,
      outcome: row.outcome,
      deliveryStatus: row.delivery_status as CommunicationEvent["deliveryStatus"],
      nextFollowUp: row.next_follow_up || "",
      date: historyDate(row.occurred_at, row.legacy_date_text),
      organisation: access.organisation.name,
      relatedTaskId: row.related_task_id || undefined,
      messageVersion: row.message_version || undefined,
      reviewer: row.reviewer || undefined,
      decision: row.decision as CommunicationEvent["decision"],
      reviewedAt: row.reviewed_at || undefined,
      failureReason: row.failure_reason || undefined,
    }),
  );
  const auditEvents: AuditEvent[] = (auditEventsResult.data ?? []).map((row) => ({
    id: row.id,
    recordId: row.record_id || recordId,
    recordName: row.record_name,
    organisation: access.organisation.name,
    user: row.actor_label,
    action: row.action,
    field: row.field || undefined,
    previousValue: row.previous_value || "",
    newValue: row.new_value || "",
    date: historyDate(row.occurred_at, row.legacy_date_text),
    timestamp: row.occurred_at || undefined,
    entityType: row.entity_type || undefined,
    entityId: row.entity_id || undefined,
    entityName: row.entity_name || undefined,
    context: row.context || undefined,
  }));
  return NextResponse.json(
    {
      communications,
      auditEvents,
      truncated:
        (communicationsResult.data?.length ?? 0) === maximumHistoryRows ||
        auditTruncated,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
