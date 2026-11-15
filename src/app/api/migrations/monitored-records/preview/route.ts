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
import { planLegacyContactMappings } from "@/lib/monitoredRecords/contactReconciliation";
import { normalizeLegacyMigrationPayload } from "@/lib/monitoredRecords/validation";

export const dynamic = "force-dynamic";

const maximumPayloadBytes = 2 * 1024 * 1024;
const legacySource = "doc-monitor-localstorage-v1";

export async function POST(request: Request) {
  const originError = requireSameOrigin(request);
  if (originError) return originError;

  const auth = await requirePlatformRole(["main_consultant"]);
  if ("response" in auth) return auth.response;

  const body = await readJson(request);
  if (
    !isRecord(body) ||
    JSON.stringify(body).length > maximumPayloadBytes
  ) {
    return invalidRequest("Migration preview exceeds the request size limit.");
  }
  const requestData = parseMigrationSourceRequest(body);
  if (!requestData.ok) return invalidRequest(requestData.error);

  const { data: organisation, error: organisationError } = await auth.supabase
    .from("organisations")
    .select("id")
    .eq("id", requestData.value.organisationId)
    .eq("status", "active")
    .maybeSingle();
  if (organisationError) return safeBackendFailure();
  if (!organisation) {
    return NextResponse.json({ error: "Choose an active organisation." }, { status: 404 });
  }

  const fixtureIds = new Set(Object.keys(defaultRecords));
  const normalized = normalizeLegacyMigrationPayload(
    requestData.value,
    fixtureIds,
  );
  if (!normalized.ok) return invalidRequest(normalized.error);

  const { data: canonicalContacts, error: contactError } = await auth.supabase
    .from("organisation_contacts")
    .select("id, name, email, phone")
    .eq("organisation_id", requestData.value.organisationId)
    .eq("active", true);
  if (contactError) return safeBackendFailure();

  const { data: previousContactMappings, error: mappingError } = await auth.supabase
    .from("data_migration_items")
    .select("legacy_id, target_id, status, target_table")
    .eq("organisation_id", requestData.value.organisationId)
    .eq("entity_type", "contact")
    .in("legacy_id", normalized.value.contacts.map((contact) => contact.legacy_id));
  if (mappingError) return safeBackendFailure();

  const contactPlan = planLegacyContactMappings(
    normalized.value.contacts,
    canonicalContacts ?? [],
    previousContactMappings ?? [],
  );
  const contactCounts = {
    found: normalized.value.contacts.length,
    automaticallyMatched: contactPlan.filter(
      (item) => item.targetId && item.method !== "create",
    ).length,
    newlyCreated: contactPlan.filter((item) => item.method === "create").length,
    ambiguous: contactPlan.filter((item) => item.method === "ambiguous").length,
    unresolved: contactPlan.filter((item) => item.method === "unresolved").length,
    duplicates: contactPlan.filter((item) => item.method === "ambiguous").length,
  };
  const mappedContactIds = new Set(
    contactPlan.filter((item) => item.targetId).map((item) => item.legacyId),
  );
  const unresolvedRecordContacts = normalized.value.records.filter(
    (record) =>
      record.legacy_contact_id &&
      (!normalized.value.contacts.some(
        (contact) => contact.legacy_id === record.legacy_contact_id,
      ) ||
        !mappedContactIds.has(record.legacy_contact_id)),
  ).length;
  const contactWarnings = contactPlan.flatMap((item) =>
    item.warning
      ? [`Legacy contact ${item.legacyId}: ${item.warning}`]
      : [],
  );

  const conflicts: Array<{ entity: string; legacyId: string }> = [];
  const recordIds = normalized.value.records.map((record) => record.legacy_id);
  const communicationIds = normalized.value.communications.map(
    (communication) => communication.legacy_id,
  );
  const auditIds = normalized.value.auditEvents.map((event) => event.legacy_id);

  if (recordIds.length) {
    const { data, error } = await auth.supabase
      .from("organisation_records")
      .select("legacy_id, legacy_checksum")
      .eq("organisation_id", requestData.value.organisationId)
      .eq("legacy_source", legacySource)
      .in("legacy_id", recordIds);
    if (error) return safeBackendFailure();
    for (const existing of data ?? []) {
      const current = normalized.value.records.find(
        (record) => record.legacy_id === existing.legacy_id,
      );
      if (current && current.checksum !== existing.legacy_checksum) {
        conflicts.push({ entity: "record", legacyId: current.legacy_id });
      }
    }
  }

  if (communicationIds.length) {
    const { data, error } = await auth.supabase
      .from("organisation_communications")
      .select("legacy_id, legacy_checksum")
      .eq("organisation_id", requestData.value.organisationId)
      .eq("legacy_source", legacySource)
      .in("legacy_id", communicationIds);
    if (error) return safeBackendFailure();
    for (const existing of data ?? []) {
      const current = normalized.value.communications.find(
        (communication) => communication.legacy_id === existing.legacy_id,
      );
      if (current && current.checksum !== existing.legacy_checksum) {
        conflicts.push({ entity: "communication", legacyId: current.legacy_id });
      }
    }
  }

  if (auditIds.length) {
    const { data, error } = await auth.supabase
      .from("organisation_audit_events")
      .select("legacy_id, legacy_checksum")
      .eq("organisation_id", requestData.value.organisationId)
      .eq("legacy_source", legacySource)
      .in("legacy_id", auditIds);
    if (error) return safeBackendFailure();
    for (const existing of data ?? []) {
      const current = normalized.value.auditEvents.find(
        (event) => event.legacy_id === existing.legacy_id,
      );
      if (current && current.checksum !== existing.legacy_checksum) {
        conflicts.push({ entity: "audit_event", legacyId: current.legacy_id });
      }
    }
  }

  if (conflicts.length) {
    return NextResponse.json(
      {
        error: "Some legacy IDs already exist with different content. Review them before importing.",
        conflicts,
      },
      { status: 409 },
    );
  }

  const includedFixtures = requestData.value.includeSuspectedFixtures
    ? normalized.value.records
        .filter((record) => fixtureIds.has(record.legacy_id))
        .map((record) => record.legacy_id)
    : [];
  const warnings = [...normalized.value.warnings];
  if (includedFixtures.length) {
    warnings.push(
      `Built-in demo records explicitly included: ${includedFixtures.join(", ")}.`,
    );
  }

  const validationSummary = {
    rawCounts: {
      records: requestData.value.records.length,
      communications: requestData.value.communications.length,
      auditEvents: requestData.value.auditEvents.length,
    },
    errors: normalized.value.errors,
    warnings: [...warnings, ...contactWarnings],
    includedFixtures,
    contacts: contactCounts,
    recordsReferencingUnresolvedContacts: unresolvedRecordContacts,
  };
  const { data: run, error: runError } = await auth.supabase
    .from("data_migration_runs")
    .insert({
      organisation_id: requestData.value.organisationId,
      initiated_by: auth.access.userId,
      source_type: "browser_local_storage",
      source_legacy_client_id: requestData.value.legacyClientId,
      source_device_id: requestData.value.sourceDeviceId || null,
      source_checksum: normalized.value.sourceChecksum,
      source_counts: normalized.value.sourceCounts,
      skipped_counts: normalized.value.skippedCounts,
      validation_summary: validationSummary,
      error_summary: normalized.value.errors,
    })
    .select("id, status")
    .single();
  if (runError || !run) return safeBackendFailure();

  return NextResponse.json(
    {
      runId: run.id,
      status: run.status,
      sourceChecksum: normalized.value.sourceChecksum,
      rawCounts: validationSummary.rawCounts,
      validCounts: normalized.value.sourceCounts,
      skippedCounts: normalized.value.skippedCounts,
      errors: normalized.value.errors,
      warnings: [...warnings, ...contactWarnings],
      contactCounts,
      recordsReferencingUnresolvedContacts: unresolvedRecordContacts,
      includedFixtures,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
