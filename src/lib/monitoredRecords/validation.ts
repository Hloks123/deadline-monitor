import { createHash } from "node:crypto";
import {
  categoryOptions,
  type CategoryOne,
  type EscalationLevel,
  type MonitoredRecord,
  type RecordRisk,
  type RecordStatus,
} from "../recordStore.ts";

export type MonitoredRecordWrite = Pick<
  MonitoredRecord,
  | "name"
  | "category"
  | "category2"
  | "issueDate"
  | "expiryDate"
  | "status"
  | "risk"
  | "escalationLevel"
  | "contactId"
  | "contact"
  | "contactEmail"
  | "followUp"
  | "referenceNumber"
  | "nextAction"
  | "notes"
  | "reminderFrequency"
  | "reminderLeadDays"
  | "clientCreated"
  | "lastConfirmed"
  | "confirmedBy"
  | "confirmationMethod"
  | "dataSource"
  | "reminderDays"
> & {
  clientVisible?: boolean;
};

export type LegacyRecordRow = {
  legacy_id: string;
  checksum: string;
  name: string;
  category: CategoryOne;
  category2: string;
  issue_date: string | null;
  expiry_date: string;
  status: RecordStatus;
  risk: RecordRisk;
  escalation_level: EscalationLevel;
  legacy_contact_id: string | null;
  contact_name: string;
  contact_email: string;
  follow_up: string | null;
  reference_number: string | null;
  next_action: string | null;
  notes: string | null;
  reminder_frequency: "daily" | "weekly" | "monthly" | "custom" | null;
  reminder_lead_days: number | null;
  client_created: boolean;
  last_confirmed: string | null;
  confirmed_by: string | null;
  confirmation_method: string | null;
  data_source: string | null;
  reminder_days: number[];
};

export type LegacyContactRow = {
  legacy_id: string;
  checksum: string;
  name: string;
  email: string | null;
  phone: string | null;
  role_title: string | null;
  authorised: boolean;
  primary_contact: boolean;
};

export type LegacyCommunicationRow = {
  legacy_id: string;
  checksum: string;
  record_legacy_id: string;
  unique_key: string | null;
  communication_type: "Reminder" | "Follow-up";
  recipient: string;
  subject: string;
  message: string;
  outcome: string;
  delivery_status: string;
  next_follow_up: string | null;
  occurred_at: string | null;
  legacy_date_text: string;
  related_task_id: string | null;
  message_version: string | null;
  reviewer: string | null;
  decision: "approved" | "suppressed" | "draft" | null;
  reviewed_at: string | null;
  failure_reason: string | null;
};

export type LegacyAuditEventRow = {
  legacy_id: string;
  checksum: string;
  record_legacy_id: string;
  entity_type: string | null;
  entity_id: string | null;
  entity_name: string | null;
  record_name: string;
  actor_label: string;
  action: string;
  field: string | null;
  previous_value: string | null;
  new_value: string | null;
  values_redacted: boolean;
  occurred_at: string | null;
  legacy_date_text: string;
};

export type MigrationIssue = {
  entity: "contact" | "record" | "communication" | "audit_event";
  index: number;
  legacyId?: string;
  message: string;
};

export type NormalizedMigrationPayload = {
  contacts: LegacyContactRow[];
  records: LegacyRecordRow[];
  communications: LegacyCommunicationRow[];
  auditEvents: LegacyAuditEventRow[];
  sourceChecksum: string;
  sourceCounts: {
    contacts: number;
    records: number;
    communications: number;
    auditEvents: number;
  };
  skippedCounts: {
    contacts: number;
    records: number;
    communications: number;
    auditEvents: number;
  };
  errors: MigrationIssue[];
  warnings: string[];
};

export type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

const recordStatuses: RecordStatus[] = [
  "Current",
  "Due soon",
  "Expired",
  "Awaiting client",
  "Awaiting confirmation",
  "Completed",
  "Paused",
];
const risks: RecordRisk[] = ["Low", "Medium", "High"];
const escalationLevels: EscalationLevel[] = [
  "Normal",
  "Follow-up required",
  "Escalated",
  "Critical",
];
const deliveryStatuses = [
  "Draft",
  "Approved",
  "Sent",
  "Delivered",
  "Failed",
  "Bounced",
  "Suppressed",
];
const recordDateFields = [
  "issueDate",
  "expiryDate",
  "followUp",
  "lastConfirmed",
] as const;
const safeAuditFields = new Set([
  "status",
  "risk",
  "category",
  "category2",
  "issueDate",
  "expiryDate",
  "followUp",
  "escalationLevel",
]);
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type TemporalNormalization = {
  status: "valid" | "ambiguous" | "invalid";
  sourceValue: string;
  normalizedValue?: string;
  interpretation?: string;
  warning?: string;
};

export function normalizeLegacyTemporalValue(
  value: unknown,
  kind: "date" | "timestamp",
): TemporalNormalization {
  const sourceValue = value == null ? "" : String(value).trim();
  if (!sourceValue) {
    return {
      status: "valid",
      sourceValue,
      normalizedValue: "",
      interpretation: "empty value",
    };
  }

  if (kind === "date" && /^\d{4}-\d{2}-\d{2}$/.test(sourceValue)) {
    const parsed = new Date(`${sourceValue}T00:00:00.000Z`);
    if (
      Number.isNaN(parsed.getTime()) ||
      parsed.toISOString().slice(0, 10) !== sourceValue
    ) {
      return {
        status: "invalid",
        sourceValue,
        warning: "The ISO date is not a real calendar date.",
      };
    }
    return {
      status: "valid",
      sourceValue,
      normalizedValue: sourceValue,
      interpretation: "ISO date-only value; no timezone conversion",
    };
  }

  if (
    kind === "timestamp" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/i.test(
      sourceValue,
    )
  ) {
    const parsed = new Date(sourceValue);
    if (Number.isNaN(parsed.getTime())) {
      return {
        status: "invalid",
        sourceValue,
        warning: "The ISO timestamp is invalid.",
      };
    }
    return {
      status: "valid",
      sourceValue,
      normalizedValue: parsed.toISOString(),
      interpretation: "ISO timestamp with explicit timezone",
    };
  }

  if (
    /^(?:\d{1,2}[/-]){1,2}\d{2,4}(?:\D|$)/.test(sourceValue) ||
    /^\d{1,2}:\d{2}/.test(sourceValue)
  ) {
    return {
      status: "ambiguous",
      sourceValue,
      warning: "The legacy locale date/time format and timezone are not established.",
    };
  }

  return {
    status: "invalid",
    sourceValue,
    warning: `The ${kind} format is unsupported.`,
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isText(
  value: unknown,
  maxLength: number,
  allowEmpty = true,
): value is string {
  return (
    typeof value === "string" &&
    value.trim().length <= maxLength &&
    (allowEmpty || value.trim().length > 0)
  );
}

function isDate(value: unknown, allowEmpty = false): value is string {
  if (typeof value !== "string") return false;
  if (allowEmpty && value === "") return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function dateOrNull(value: string) {
  return value || null;
}

function hash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function normalizedText(
  value: unknown,
  maxLength: number,
  allowEmpty = true,
) {
  if (!isText(value, maxLength, allowEmpty)) return null;
  return value.trim();
}

export function parseMonitoredRecordWrite(
  value: unknown,
  partial = false,
): ParseResult<Partial<MonitoredRecordWrite>> {
  const allowedFields = [
    "name",
    "category",
    "category2",
    "issueDate",
    "expiryDate",
    "status",
    "risk",
    "escalationLevel",
    "contactId",
    "contact",
    "contactEmail",
    "followUp",
    "referenceNumber",
    "nextAction",
    "notes",
    "reminderFrequency",
    "reminderLeadDays",
    "clientCreated",
    "clientVisible",
    "lastConfirmed",
    "confirmedBy",
    "confirmationMethod",
    "dataSource",
    "reminderDays",
  ];
  if (
    !isObject(value) ||
    Object.keys(value).some((key) => !allowedFields.includes(key))
  ) {
    return { ok: false, error: "The monitored-record details are invalid." };
  }
  if (
    !partial &&
    ![
      "name",
      "category",
      "category2",
      "expiryDate",
      "status",
      "risk",
      "escalationLevel",
    ].every((key) => key in value)
  ) {
    return { ok: false, error: "Enter the required monitored-record details." };
  }
  if (partial && Object.keys(value).length === 0) {
    return { ok: false, error: "Make at least one change before saving." };
  }

  const parsed: Partial<MonitoredRecordWrite> = {};
  if ("name" in value) {
    const name = normalizedText(value.name, 200, false);
    if (name === null) return { ok: false, error: "Enter a record name of up to 200 characters." };
    parsed.name = name;
  }
  if ("category" in value) {
    if (
      typeof value.category !== "string" ||
      !Object.prototype.hasOwnProperty.call(categoryOptions, value.category)
    ) {
      return { ok: false, error: "Choose a valid record category." };
    }
    parsed.category = value.category as CategoryOne;
  }
  if ("category2" in value) {
    const category2 = normalizedText(value.category2, 200);
    if (category2 === null) return { ok: false, error: "Record type must be 200 characters or fewer." };
    parsed.category2 = category2;
  }
  for (const field of recordDateFields) {
    if (!(field in value)) continue;
    const date = value[field];
    if (!isDate(date, field !== "expiryDate")) {
      return { ok: false, error: `Enter a valid ${field} date.` };
    }
    parsed[field] = date;
  }
  if ("status" in value) {
    if (typeof value.status !== "string" || !recordStatuses.includes(value.status as RecordStatus)) {
      return { ok: false, error: "Choose a valid record status." };
    }
    parsed.status = value.status as RecordStatus;
  }
  if ("risk" in value) {
    if (typeof value.risk !== "string" || !risks.includes(value.risk as RecordRisk)) {
      return { ok: false, error: "Choose a valid record risk." };
    }
    parsed.risk = value.risk as RecordRisk;
  }
  if ("escalationLevel" in value) {
    if (
      typeof value.escalationLevel !== "string" ||
      !escalationLevels.includes(value.escalationLevel as EscalationLevel)
    ) {
      return { ok: false, error: "Choose a valid escalation level." };
    }
    parsed.escalationLevel = value.escalationLevel as EscalationLevel;
  }
  if ("contactId" in value) {
    if (
      !isText(value.contactId, 100) ||
      (value.contactId.trim() !== "" && !uuidPattern.test(value.contactId))
    ) {
      return { ok: false, error: "Choose a valid organisation contact." };
    }
    parsed.contactId = value.contactId.trim();
  }
  for (const [field, maxLength] of [
    ["contact", 200],
    ["contactEmail", 320],
    ["referenceNumber", 200],
    ["nextAction", 500],
    ["notes", 2000],
    ["confirmedBy", 200],
    ["confirmationMethod", 100],
    ["dataSource", 200],
  ] as const) {
    if (!(field in value)) continue;
    const text = normalizedText(value[field], maxLength);
    if (text === null) return { ok: false, error: `${field} must be ${maxLength} characters or fewer.` };
    parsed[field] = text;
  }
  if ("reminderFrequency" in value) {
    const frequency = value.reminderFrequency;
    if (
      frequency !== undefined &&
      frequency !== "daily" &&
      frequency !== "weekly" &&
      frequency !== "monthly" &&
      frequency !== "custom"
    ) {
      return { ok: false, error: "Choose a valid reminder frequency." };
    }
    parsed.reminderFrequency = frequency;
  }
  if ("reminderLeadDays" in value) {
    const leadDays = value.reminderLeadDays;
    if (
      leadDays !== undefined &&
      (!Number.isInteger(leadDays) || (leadDays as number) < 0 || (leadDays as number) > 365)
    ) {
      return { ok: false, error: "Reminder lead days must be between 0 and 365." };
    }
    parsed.reminderLeadDays = leadDays as number | undefined;
  }
  for (const field of ["clientCreated", "clientVisible"] as const) {
    if (field in value && typeof value[field] !== "boolean") {
      return { ok: false, error: `${field} must be true or false.` };
    }
    if (field === "clientCreated" && field in value) {
      parsed.clientCreated = value.clientCreated as boolean;
    }
    if (field === "clientVisible" && field in value) {
      parsed.clientVisible = value.clientVisible as boolean;
    }
  }
  if ("reminderDays" in value) {
    const days = value.reminderDays;
    if (
      !Array.isArray(days) ||
      days.length > 12 ||
      days.some((day) => !Number.isInteger(day) || day < 0 || day > 365) ||
      new Set(days).size !== days.length
    ) {
      return { ok: false, error: "Reminder days must be unique whole numbers between 0 and 365." };
    }
    parsed.reminderDays = [...days];
  }
  return { ok: true, value: parsed };
}

function parseLegacyRecord(
  value: unknown,
  legacyClientId: string,
  index: number,
): ParseResult<LegacyRecordRow> {
  if (!isObject(value)) {
    return { ok: false, error: "Record must be an object." };
  }
  const legacyId = normalizedText(value.id, 200, false);
  if (!legacyId) return { ok: false, error: "Record ID is missing or invalid." };
  if (value.organisationId !== legacyClientId) {
    return { ok: false, error: "Record does not belong to the selected legacy client." };
  }
  const allowedFields = new Set([
    "id",
    "name",
    "organisationId",
    "organisation",
    "category",
    "category2",
    "issueDate",
    "expiryDate",
    "status",
    "risk",
    "escalationLevel",
    "contactId",
    "contact",
    "contactEmail",
    "followUp",
    "referenceNumber",
    "nextAction",
    "notes",
    "reminderFrequency",
    "reminderLeadDays",
    "clientCreated",
    "lastConfirmed",
    "confirmedBy",
    "confirmationMethod",
    "dataSource",
    "reminderDays",
  ]);
  if (Object.keys(value).some((key) => !allowedFields.has(key))) {
    return { ok: false, error: "Record contains unsupported fields." };
  }
  if (
    !["name", "category", "category2", "expiryDate", "status", "risk", "escalationLevel"]
      .every((field) => field in value)
  ) {
    return { ok: false, error: "Record is missing required monitored-record fields." };
  }
  const recordInput: Record<string, unknown> = {
    contactId: "",
  };
  for (const field of [
    "name",
    "category",
    "category2",
    "issueDate",
    "expiryDate",
    "status",
    "risk",
    "escalationLevel",
    "contact",
    "contactEmail",
    "followUp",
    "referenceNumber",
    "nextAction",
    "notes",
    "reminderFrequency",
    "reminderLeadDays",
    "clientCreated",
    "lastConfirmed",
    "confirmedBy",
    "confirmationMethod",
    "dataSource",
    "reminderDays",
  ]) {
    if (value[field] !== undefined) recordInput[field] = value[field];
  }
  for (const field of recordDateFields) {
    const normalized = normalizeLegacyTemporalValue(value[field], "date");
    if (normalized.status !== "valid") {
      return {
        ok: false,
        error: normalized.status === "ambiguous"
          ? `${field} is ambiguous and must be reviewed manually.`
          : `${field} is invalid and cannot be imported.`,
      };
    }
    recordInput[field] = normalized.normalizedValue || "";
  }
  const write = parseMonitoredRecordWrite(recordInput);
  if (!write.ok) return write;
  const row: Omit<LegacyRecordRow, "checksum"> = {
    legacy_id: legacyId,
    name: write.value.name!,
    category: write.value.category!,
    category2: write.value.category2!,
    issue_date: dateOrNull(write.value.issueDate || ""),
    expiry_date: write.value.expiryDate!,
    status: write.value.status!,
    risk: write.value.risk!,
    escalation_level: write.value.escalationLevel!,
    legacy_contact_id: normalizedText(value.contactId, 200) || null,
    contact_name: write.value.contact || "",
    contact_email: write.value.contactEmail || "",
    follow_up: dateOrNull(write.value.followUp || ""),
    reference_number: write.value.referenceNumber || null,
    next_action: write.value.nextAction || null,
    notes: write.value.notes || null,
    reminder_frequency: write.value.reminderFrequency || null,
    reminder_lead_days: write.value.reminderLeadDays ?? null,
    client_created: write.value.clientCreated === true,
    last_confirmed: dateOrNull(write.value.lastConfirmed || ""),
    confirmed_by: write.value.confirmedBy || null,
    confirmation_method: write.value.confirmationMethod || null,
    data_source: write.value.dataSource || null,
    reminder_days: write.value.reminderDays || [60, 30, 14, 7, 0],
  };
  void index;
  return { ok: true, value: { ...row, checksum: hash(row) } };
}

function parseTimestamp(value: unknown) {
  const normalized = normalizeLegacyTemporalValue(value, "timestamp");
  return normalized.status === "valid" && normalized.normalizedValue
    ? normalized.normalizedValue
    : null;
}

function parseLegacyContact(
  value: unknown,
): ParseResult<LegacyContactRow> {
  if (!isObject(value)) {
    return { ok: false, error: "Contact must be an object." };
  }
  const allowedFields = new Set([
    "id",
    "name",
    "role",
    "email",
    "phone",
    "primary",
    "authorised",
  ]);
  if (Object.keys(value).some((key) => !allowedFields.has(key))) {
    return { ok: false, error: "Contact contains unsupported fields." };
  }
  const legacyId = normalizedText(value.id, 200, false);
  const name = normalizedText(value.name, 120, false);
  const emailValue = normalizedText(value.email, 320) || "";
  const phone = normalizedText(value.phone, 80) || null;
  const roleTitle = normalizedText(value.role, 120) || null;
  if (!legacyId || !name) {
    return { ok: false, error: "Contact ID and display name are required." };
  }
  if (
    emailValue &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue)
  ) {
    return { ok: false, error: "Contact email is invalid." };
  }
  const row: Omit<LegacyContactRow, "checksum"> = {
    legacy_id: legacyId,
    name,
    email: emailValue ? emailValue.toLocaleLowerCase("en-US") : null,
    phone,
    role_title: roleTitle,
    authorised: value.authorised === true && Boolean(emailValue),
    primary_contact: value.primary === true,
  };
  return { ok: true, value: { ...row, checksum: hash(row) } };
}

function parseLegacyCommunication(
  value: unknown,
  index: number,
): ParseResult<LegacyCommunicationRow> {
  if (!isObject(value)) return { ok: false, error: "Communication must be an object." };
  const allowedFields = new Set([
    "id",
    "uniqueKey",
    "recordId",
    "type",
    "recipient",
    "subject",
    "message",
    "outcome",
    "deliveryStatus",
    "nextFollowUp",
    "date",
    "organisation",
    "relatedTaskId",
    "messageVersion",
    "reviewer",
    "decision",
    "reviewedAt",
    "failureReason",
  ]);
  if (Object.keys(value).some((key) => !allowedFields.has(key))) {
    return { ok: false, error: "Communication contains unsupported fields." };
  }
  const legacyId = normalizedText(value.id, 200, false);
  const recordId = normalizedText(value.recordId, 200, false);
  if (!legacyId || !recordId) {
    return { ok: false, error: "Communication ID or record ID is missing." };
  }
  if (value.type !== "Reminder" && value.type !== "Follow-up") {
    return { ok: false, error: "Communication type is invalid." };
  }
  if (typeof value.deliveryStatus !== "string" || !deliveryStatuses.includes(value.deliveryStatus)) {
    return { ok: false, error: "Communication delivery status is invalid." };
  }
  const nextFollowUp = value.nextFollowUp ?? "";
  if (!isDate(nextFollowUp, true)) {
    return { ok: false, error: "Communication follow-up date is invalid." };
  }
  for (const [field, maxLength] of [
    ["recipient", 500],
    ["subject", 500],
    ["message", 10000],
    ["outcome", 2000],
    ["uniqueKey", 500],
    ["relatedTaskId", 200],
    ["messageVersion", 100],
    ["reviewer", 200],
    ["failureReason", 1000],
  ] as const) {
    if (value[field] !== undefined && !isText(value[field], maxLength)) {
      return { ok: false, error: `Communication ${field} is too long or invalid.` };
    }
  }
  const decision = value.decision;
  if (
    decision !== undefined &&
    decision !== null &&
    decision !== "approved" &&
    decision !== "suppressed" &&
    decision !== "draft"
  ) {
    return { ok: false, error: "Communication review decision is invalid." };
  }
  const legacyDate = normalizedText(value.date, 100) || "";
  const occurredAt = parseTimestamp(legacyDate);
  const reviewedAt = parseTimestamp(value.reviewedAt);
  const row: Omit<LegacyCommunicationRow, "checksum"> = {
    legacy_id: legacyId,
    record_legacy_id: recordId,
    unique_key: normalizedText(value.uniqueKey, 500) || null,
    communication_type: value.type,
    recipient: normalizedText(value.recipient, 500) || "",
    subject: normalizedText(value.subject, 500) || "",
    message: normalizedText(value.message, 10000) || "",
    outcome: normalizedText(value.outcome, 2000) || "",
    delivery_status: value.deliveryStatus,
    next_follow_up: nextFollowUp || null,
    occurred_at: occurredAt,
    legacy_date_text: legacyDate,
    related_task_id: normalizedText(value.relatedTaskId, 200) || null,
    message_version: normalizedText(value.messageVersion, 100) || null,
    reviewer: normalizedText(value.reviewer, 200) || null,
    decision: decision || null,
    reviewed_at: reviewedAt,
    failure_reason: normalizedText(value.failureReason, 1000) || null,
  };
  void index;
  return { ok: true, value: { ...row, checksum: hash(row) } };
}

function safeAuditValue(value: unknown, field: string | null) {
  if (value === undefined || value === null || value === "") {
    return { value: null, redacted: false };
  }
  if (!field || !safeAuditFields.has(field)) {
    return { value: null, redacted: true };
  }
  let normalized: unknown = value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (isObject(parsed)) normalized = parsed[field];
    } catch {
      normalized = value;
    }
  }
  if (
    typeof normalized !== "string" &&
    typeof normalized !== "number" &&
    typeof normalized !== "boolean"
  ) {
    return { value: null, redacted: true };
  }
  const text = String(normalized);
  return text.length <= 2000
    ? { value: text, redacted: false }
    : { value: null, redacted: true };
}

function parseLegacyAuditEvent(
  value: unknown,
  index: number,
): ParseResult<LegacyAuditEventRow> {
  if (!isObject(value)) return { ok: false, error: "Audit event must be an object." };
  const allowedFields = new Set([
    "id",
    "recordId",
    "recordName",
    "organisation",
    "user",
    "action",
    "field",
    "previousValue",
    "newValue",
    "date",
    "timestamp",
    "entityType",
    "entityId",
    "entityName",
    "context",
  ]);
  if (Object.keys(value).some((key) => !allowedFields.has(key))) {
    return { ok: false, error: "Audit event contains unsupported fields." };
  }
  const legacyId = normalizedText(value.id, 200, false);
  const recordId = normalizedText(value.recordId, 200, false);
  const action = normalizedText(value.action, 500, false);
  if (!legacyId || !recordId || !action) {
    return { ok: false, error: "Audit event ID, record ID or action is missing." };
  }
  const field = normalizedText(value.field, 100) || null;
  const previous = safeAuditValue(value.previousValue, field);
  const next = safeAuditValue(value.newValue, field);
  const legacyDate =
    normalizedText(value.timestamp, 100) ||
    normalizedText(value.date, 100) ||
    "";
  const row: Omit<LegacyAuditEventRow, "checksum"> = {
    legacy_id: legacyId,
    record_legacy_id: recordId,
    entity_type: normalizedText(value.entityType, 100) || "record",
    entity_id: normalizedText(value.entityId, 200) || recordId,
    entity_name: normalizedText(value.entityName, 200) || null,
    record_name: normalizedText(value.recordName, 200) || "",
    actor_label: normalizedText(value.user, 200) || "",
    action,
    field,
    previous_value: previous.value,
    new_value: next.value,
    values_redacted: previous.redacted || next.redacted,
    occurred_at: parseTimestamp(legacyDate),
    legacy_date_text: legacyDate,
  };
  void index;
  return { ok: true, value: { ...row, checksum: hash(row) } };
}

function uniqueRows<T extends { legacy_id: string }>(
  rows: T[],
  entity: MigrationIssue["entity"],
  errors: MigrationIssue[],
) {
  const seen = new Set<string>();
  return rows.filter((row, index) => {
    if (seen.has(row.legacy_id)) {
      errors.push({
        entity,
        index,
        legacyId: row.legacy_id,
        message: "Duplicate legacy ID in the selected source.",
      });
      return false;
    }
    seen.add(row.legacy_id);
    return true;
  });
}

export function normalizeLegacyMigrationPayload(
  input: {
    legacyClientId: string;
    contacts?: unknown;
    records: unknown;
    communications: unknown;
    auditEvents: unknown;
    includeSuspectedFixtures: boolean;
  },
  fixtureIds: ReadonlySet<string>,
): ParseResult<NormalizedMigrationPayload> {
  if (
    !normalizedText(input.legacyClientId, 200, false) ||
    (input.contacts !== undefined && !Array.isArray(input.contacts)) ||
    !Array.isArray(input.records) ||
    !Array.isArray(input.communications) ||
    !Array.isArray(input.auditEvents)
  ) {
    return { ok: false, error: "Choose a legacy client and provide valid migration data." };
  }

  const errors: MigrationIssue[] = [];
  const warnings: string[] = [];
  const validContacts: LegacyContactRow[] = [];
  const validRecords: LegacyRecordRow[] = [];
  const validCommunications: LegacyCommunicationRow[] = [];
  const validAuditEvents: LegacyAuditEventRow[] = [];
  let skippedRecordCount = 0;
  let skippedContactCount = 0;
  let skippedCommunicationCount = 0;
  let skippedAuditCount = 0;

  (input.contacts || []).forEach((value, index) => {
    const result = parseLegacyContact(value);
    if (!result.ok) {
      skippedContactCount += 1;
      errors.push({
        entity: "contact",
        index,
        legacyId: isObject(value) && typeof value.id === "string" ? value.id : undefined,
        message: result.error,
      });
      return;
    }
    validContacts.push(result.value);
  });
  const uniqueContacts = uniqueRows(validContacts, "contact", errors);
  skippedContactCount += validContacts.length - uniqueContacts.length;

  input.records.forEach((value, index) => {
    const result = parseLegacyRecord(value, input.legacyClientId, index);
    if (!result.ok) {
      skippedRecordCount += 1;
      errors.push({
        entity: "record",
        index,
        legacyId: isObject(value) && typeof value.id === "string" ? value.id : undefined,
        message: result.error,
      });
      return;
    }
    if (fixtureIds.has(result.value.legacy_id) && !input.includeSuspectedFixtures) {
      skippedRecordCount += 1;
      warnings.push(`Suspected built-in demo record excluded: ${result.value.legacy_id}.`);
      return;
    }
    validRecords.push(result.value);
  });

  const uniqueRecords = uniqueRows(validRecords, "record", errors);
  skippedRecordCount += validRecords.length - uniqueRecords.length;
  const recordIds = new Set(uniqueRecords.map((record) => record.legacy_id));

  input.communications.forEach((value, index) => {
    const result = parseLegacyCommunication(value, index);
    if (!result.ok) {
      skippedCommunicationCount += 1;
      errors.push({
        entity: "communication",
        index,
        legacyId: isObject(value) && typeof value.id === "string" ? value.id : undefined,
        message: result.error,
      });
      return;
    }
    if (!recordIds.has(result.value.record_legacy_id)) {
      skippedCommunicationCount += 1;
      errors.push({
        entity: "communication",
        index,
        legacyId: result.value.legacy_id,
        message: "Communication refers to a record outside the selected import.",
      });
      return;
    }
    if (result.value.legacy_date_text && !result.value.occurred_at) {
      const temporal = normalizeLegacyTemporalValue(result.value.legacy_date_text, "timestamp");
      warnings.push(
        `Communication ${result.value.legacy_id} date is preserved as text (${temporal.status}: ${temporal.warning || "no timestamp was provided"}).`,
      );
    }
    if (value && isObject(value) && value.reviewedAt && !result.value.reviewed_at) {
      const temporal = normalizeLegacyTemporalValue(value.reviewedAt, "timestamp");
      warnings.push(
        `Communication ${result.value.legacy_id} review timestamp is preserved only as source text (${temporal.status}: ${temporal.warning || "unsupported timestamp"}).`,
      );
    }
    validCommunications.push(result.value);
  });

  const uniqueCommunications = uniqueRows(validCommunications, "communication", errors);
  skippedCommunicationCount += validCommunications.length - uniqueCommunications.length;

  input.auditEvents.forEach((value, index) => {
    const result = parseLegacyAuditEvent(value, index);
    if (!result.ok) {
      skippedAuditCount += 1;
      errors.push({
        entity: "audit_event",
        index,
        legacyId: isObject(value) && typeof value.id === "string" ? value.id : undefined,
        message: result.error,
      });
      return;
    }
    if (!recordIds.has(result.value.record_legacy_id)) {
      skippedAuditCount += 1;
      errors.push({
        entity: "audit_event",
        index,
        legacyId: result.value.legacy_id,
        message: "Audit event refers to a record outside the selected import.",
      });
      return;
    }
    if (result.value.legacy_date_text && !result.value.occurred_at) {
      const temporal = normalizeLegacyTemporalValue(result.value.legacy_date_text, "timestamp");
      warnings.push(
        `Audit event ${result.value.legacy_id} date is preserved as text (${temporal.status}: ${temporal.warning || "no timestamp was provided"}).`,
      );
    }
    if (value.context) {
      warnings.push(
        `Audit event ${result.value.legacy_id} context was omitted to avoid importing unrestricted free text.`,
      );
    }
    if (result.value.values_redacted) {
      warnings.push(`Sensitive or unsupported values were redacted from audit event ${result.value.legacy_id}.`);
    }
    validAuditEvents.push(result.value);
  });

  const uniqueAuditEvents = uniqueRows(validAuditEvents, "audit_event", errors);
  skippedAuditCount += validAuditEvents.length - uniqueAuditEvents.length;

  const records = uniqueRecords.sort((a, b) => a.legacy_id.localeCompare(b.legacy_id));
  const communications = uniqueCommunications.sort((a, b) => a.legacy_id.localeCompare(b.legacy_id));
  const auditEvents = uniqueAuditEvents.sort((a, b) => a.legacy_id.localeCompare(b.legacy_id));
  const contacts = uniqueContacts.sort((a, b) => a.legacy_id.localeCompare(b.legacy_id));
  const payload = { contacts, records, communications, auditEvents };
  return {
    ok: true,
    value: {
      ...payload,
      sourceChecksum: hash(payload),
      sourceCounts: {
        contacts: contacts.length,
        records: records.length,
        communications: communications.length,
        auditEvents: auditEvents.length,
      },
      skippedCounts: {
        contacts: skippedContactCount,
        records: skippedRecordCount,
        communications: skippedCommunicationCount,
        auditEvents: skippedAuditCount,
      },
      errors,
      warnings: [...new Set(warnings)],
    },
  };
}
