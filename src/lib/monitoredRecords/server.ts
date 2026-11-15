import "server-only";

import { NextResponse } from "next/server";
import type { MonitoredRecord } from "@/lib/recordStore";
import { getWorkspaceAccess } from "@/lib/auth/workspace";
import { safeBackendFailure } from "@/lib/admin/authorization";
import { createClient } from "@/lib/supabase/server";
import { canAccessMonitoredRecordOrganisation } from "./access";
import type { MonitoredRecordEntity } from "./repository";
import type { MonitoredRecordWrite } from "./validation";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type OrganisationRecordAccess =
  | {
      ok: true;
      supabase: Awaited<ReturnType<typeof createClient>>;
      userId: string;
      organisation: { id: string; name: string };
    }
  | { ok: false; response: NextResponse };

export function isUuid(value: string) {
  return uuidPattern.test(value);
}

export async function authoriseOrganisationRecordAccess(
  organisationId: string,
): Promise<OrganisationRecordAccess> {
  if (!isUuid(organisationId)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "The organisation ID is invalid." }, { status: 400 }),
    };
  }

  const supabase = await createClient();
  const access = await getWorkspaceAccess(supabase);
  if (access.status !== "authorized") {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "You are not authorised to access monitored records." },
        { status: access.status === "unauthenticated" ? 401 : 403 },
      ),
    };
  }
  if (!canAccessMonitoredRecordOrganisation(
    organisationId,
    access.platformRoles,
    access.memberships,
  )) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "You are not authorised to access monitored records." },
        { status: 403 },
      ),
    };
  }

  const { data: organisation, error } = await supabase
    .from("organisations")
    .select("id, name")
    .eq("id", organisationId)
    .eq("status", "active")
    .maybeSingle();
  if (error) {
    return { ok: false, response: safeBackendFailure() };
  }
  if (!organisation) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Organisation was not found." }, { status: 404 }),
    };
  }

  return {
    ok: true,
    supabase,
    userId: access.userId,
    organisation,
  };
}

export function mapMonitoredRecord(
  row: Record<string, unknown>,
  organisation: { id: string; name: string },
): MonitoredRecordEntity {
  const date = (value: unknown) =>
    typeof value === "string" ? value.slice(0, 10) : "";
  const text = (value: unknown) => (typeof value === "string" ? value : "");
  const nullableText = (value: unknown) =>
    typeof value === "string" ? value : "";
  return {
    id: text(row.id),
    name: text(row.name),
    organisationId: organisation.id,
    organisation: organisation.name,
    category: text(row.category) as MonitoredRecord["category"],
    category2: text(row.category2),
    issueDate: date(row.issue_date),
    expiryDate: date(row.expiry_date),
    status: text(row.status) as MonitoredRecord["status"],
    risk: text(row.risk) as MonitoredRecord["risk"],
    escalationLevel: text(row.escalation_level) as MonitoredRecord["escalationLevel"],
    contactId: text(row.contact_id),
    contact: text(row.contact_name),
    contactEmail: text(row.contact_email),
    followUp: date(row.follow_up),
    referenceNumber: nullableText(row.reference_number),
    nextAction: nullableText(row.next_action),
    notes: nullableText(row.notes),
    reminderFrequency: row.reminder_frequency as MonitoredRecord["reminderFrequency"],
    reminderLeadDays:
      typeof row.reminder_lead_days === "number" ? row.reminder_lead_days : undefined,
    clientCreated: row.client_created === true,
    lastConfirmed: date(row.last_confirmed),
    confirmedBy: text(row.confirmed_by),
    confirmationMethod: text(row.confirmation_method),
    dataSource: text(row.data_source),
    reminderDays: Array.isArray(row.reminder_days)
      ? row.reminder_days.filter(
          (day): day is number => typeof day === "number" && Number.isInteger(day),
        )
      : [],
    version: typeof row.version === "number" ? row.version : 1,
    deletedAt: typeof row.deleted_at === "string" ? row.deleted_at : null,
  };
}

export function recordDatabaseInput(
  organisationId: string,
  userId: string,
  input: Partial<MonitoredRecordWrite>,
) {
  return {
    organisation_id: organisationId,
    name: input.name,
    category: input.category,
    category2: input.category2,
    issue_date: input.issueDate || null,
    expiry_date: input.expiryDate,
    status: input.status,
    risk: input.risk,
    escalation_level: input.escalationLevel,
    contact_id: input.contactId || null,
    contact_name: input.contact || "",
    contact_email: input.contactEmail || "",
    follow_up: input.followUp || null,
    reference_number: input.referenceNumber || null,
    next_action: input.nextAction || null,
    notes: input.notes || null,
    reminder_frequency: input.reminderFrequency || null,
    reminder_lead_days: input.reminderLeadDays ?? null,
    client_created: input.clientCreated === true,
    client_visible: input.clientVisible !== false,
    last_confirmed: input.lastConfirmed || null,
    confirmed_by: input.confirmedBy || null,
    confirmation_method: input.confirmationMethod || null,
    data_source: input.dataSource || null,
    reminder_days: input.reminderDays || [60, 30, 14, 7, 0],
    created_by: userId,
    updated_by: userId,
  };
}

export async function resolveRecordContact(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organisationId: string,
  contactId: string | undefined,
) {
  if (!contactId) {
    return { ok: true as const, contact: null };
  }
  if (!isUuid(contactId)) {
    return { ok: false as const };
  }
  const { data, error } = await supabase
    .from("organisation_contacts")
    .select("id, name, email")
    .eq("id", contactId)
    .eq("organisation_id", organisationId)
    .eq("active", true)
    .eq("authorised", true)
    .maybeSingle();
  if (error) {
    return { ok: false as const, failed: true as const };
  }
  return data
    ? { ok: true as const, contact: data }
    : { ok: false as const };
}

export function recordDatabasePatch(
  userId: string,
  input: Partial<MonitoredRecordWrite>,
) {
  const fields: Record<keyof MonitoredRecordWrite, string> = {
    name: "name",
    category: "category",
    category2: "category2",
    issueDate: "issue_date",
    expiryDate: "expiry_date",
    status: "status",
    risk: "risk",
    escalationLevel: "escalation_level",
    contactId: "contact_id",
    contact: "contact_name",
    contactEmail: "contact_email",
    followUp: "follow_up",
    referenceNumber: "reference_number",
    nextAction: "next_action",
    notes: "notes",
    reminderFrequency: "reminder_frequency",
    reminderLeadDays: "reminder_lead_days",
    clientCreated: "client_created",
    lastConfirmed: "last_confirmed",
    confirmedBy: "confirmed_by",
    confirmationMethod: "confirmation_method",
    dataSource: "data_source",
    reminderDays: "reminder_days",
    clientVisible: "client_visible",
  };
  const result: Record<string, unknown> = { updated_by: userId };
  for (const [field, databaseField] of Object.entries(fields)) {
    if (!(field in input)) continue;
    const value = input[field as keyof MonitoredRecordWrite];
    if (field === "issueDate" || field === "followUp" || field === "lastConfirmed") {
      result[databaseField] = value || null;
    } else if (field === "contactId") {
      result[databaseField] = value || null;
    } else if (
      field === "referenceNumber" ||
      field === "nextAction" ||
      field === "notes" ||
      field === "reminderFrequency" ||
      field === "reminderLeadDays" ||
      field === "confirmedBy" ||
      field === "confirmationMethod" ||
      field === "dataSource"
    ) {
      result[databaseField] = value || null;
    } else {
      result[databaseField] = value;
    }
  }
  return result;
}
