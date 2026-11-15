const approvedFields = {
  category: "Category",
  category2: "Subcategory",
  issueDate: "Issue date",
  expiryDate: "Expiry date",
  status: "Status",
  risk: "Risk",
  escalationLevel: "Escalation level",
  contactId: "Responsible contact",
  contact_id: "Responsible contact",
  followUp: "Follow-up date",
  reminderDays: "Reminder days",
  reminderFrequency: "Reminder frequency",
  reminderLeadDays: "Reminder lead days",
  clientVisible: "Client visibility",
  deletedAt: "Record status",
} as const;

export type MonitoredRecordAuditField = keyof typeof approvedFields;

export type MonitoredRecordAuditChange = {
  field: MonitoredRecordAuditField;
  label: string;
  previousValue: string | null;
  newValue: string | null;
  summary: string;
};

export type MonitoredRecordAuditEvent = {
  id: string;
  recordId: string;
  recordName: string;
  actorLabel: string;
  action: string;
  summary: string;
  date: string;
  dateKind: "timestamp" | "legacy_text";
  changes: MonitoredRecordAuditChange[];
};

export type MonitoredRecordAuditHistory = {
  organisationName: string;
  events: MonitoredRecordAuditEvent[];
  truncated: boolean;
};

export function selectAuditHistorySource<T extends { recordId: string }>(
  selectedRecordId: string,
  localEvents: T[],
  serverEvents: T[],
) {
  return selectedRecordId
    ? serverEvents.filter((event) => event.recordId === selectedRecordId)
    : localEvents;
}

const fieldAliases: Record<string, MonitoredRecordAuditField> = {
  category: "category",
  category2: "category2",
  issue_date: "issueDate",
  issueDate: "issueDate",
  expiry_date: "expiryDate",
  expiryDate: "expiryDate",
  status: "status",
  risk: "risk",
  escalation_level: "escalationLevel",
  escalationLevel: "escalationLevel",
  contact_id: "contact_id",
  contactId: "contactId",
  follow_up: "followUp",
  followUp: "followUp",
  reminder_days: "reminderDays",
  reminderDays: "reminderDays",
  reminder_frequency: "reminderFrequency",
  reminderFrequency: "reminderFrequency",
  reminder_lead_days: "reminderLeadDays",
  reminderLeadDays: "reminderLeadDays",
  client_visible: "clientVisible",
  clientVisible: "clientVisible",
  deleted_at: "deletedAt",
  deletedAt: "deletedAt",
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readObject(value: unknown): Record<string, unknown> {
  if (isObject(value)) return value;
  if (typeof value !== "string" || !value) return {};
  try {
    const parsed: unknown = JSON.parse(value);
    return isObject(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function cleanText(value: unknown, maximumLength: number): string {
  if (typeof value !== "string") return "";
  return value.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, maximumLength);
}

function displayValue(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return "Not set";
  if (typeof value === "string") return cleanText(value, 160) || "Not set";
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (
    Array.isArray(value) &&
    value.every((item) => typeof item === "number" && Number.isFinite(item))
  ) {
    return value.join(", ") || "Not set";
  }
  return null;
}

function safeAction(action: unknown) {
  const normalized = cleanText(action, 500).toLowerCase();
  if (normalized.includes("created")) return "Monitored record created";
  if (normalized.includes("deleted")) return "Monitored record deleted";
  if (normalized.includes("restored")) return "Monitored record restored";
  if (normalized.includes("updated") || normalized.includes("changed")) {
    return "Monitored record updated";
  }
  return "Monitored record activity";
}

function sameValue(left: unknown, right: unknown) {
  if (left == null && right == null) return true;
  return JSON.stringify(left) === JSON.stringify(right);
}

export function mapMonitoredRecordAuditRow(
  value: unknown,
  expectedRecordId: string,
): MonitoredRecordAuditEvent | null {
  if (!isObject(value)) return null;
  const id = cleanText(value.id, 100);
  const recordId = cleanText(value.record_id, 100);
  if (!id || recordId !== expectedRecordId) return null;

  const before = readObject(value.previous_value);
  const after = readObject(value.new_value);
  const isCreate = cleanText(value.action, 500).toLowerCase().includes("created");
  const fieldNames = new Set([...Object.keys(before), ...Object.keys(after)]);
  const eventField = typeof value.field === "string"
    ? fieldAliases[value.field]
    : undefined;
  if (eventField) fieldNames.add(eventField);

  const changes: MonitoredRecordAuditChange[] = [];
  const visited = new Set<MonitoredRecordAuditField>();
  for (const rawField of fieldNames) {
    const field = fieldAliases[rawField] ??
      (rawField in approvedFields ? rawField as MonitoredRecordAuditField : undefined);
    if (!field || visited.has(field)) continue;
    visited.add(field);

    const previous = before[rawField] ?? before[field];
    const next = after[rawField] ?? after[field];
    if (sameValue(previous, next)) continue;

    const label = approvedFields[field];
    if (field === "contactId" || field === "contact_id") {
      if (isCreate || (previous == null && next == null)) continue;
      changes.push({
        field,
        label,
        previousValue: null,
        newValue: null,
        summary: "Responsible contact changed",
      });
      continue;
    }

    const previousValue = displayValue(previous);
    const newValue = displayValue(next);
    if (previousValue === null && newValue === null) continue;
    changes.push({
      field,
      label,
      previousValue,
      newValue,
      summary: `${label} changed`,
    });
  }

  const action = safeAction(value.action);
  const summary = changes.length
    ? changes.map((change) => change.summary).join("; ")
    : action;
  const timestamp = cleanText(value.occurred_at, 100);
  return {
    id,
    recordId: expectedRecordId,
    recordName: cleanText(value.record_name, 160),
    actorLabel: cleanText(value.actor_label, 120),
    action,
    summary,
    date: timestamp || cleanText(value.legacy_date_text, 100),
    dateKind: timestamp ? "timestamp" : "legacy_text",
    changes,
  };
}

function parseChange(value: unknown): MonitoredRecordAuditChange | null {
  if (!isObject(value) || typeof value.field !== "string") return null;
  const field = fieldAliases[value.field] ??
    (value.field in approvedFields ? value.field as MonitoredRecordAuditField : undefined);
  if (!field || value.label !== approvedFields[field]) return null;
  if (
    (value.previousValue !== null && typeof value.previousValue !== "string") ||
    (value.newValue !== null && typeof value.newValue !== "string") ||
    typeof value.summary !== "string"
  ) {
    return null;
  }
  return {
    field,
    label: approvedFields[field],
    previousValue: value.previousValue === null
      ? null
      : cleanText(value.previousValue, 160),
    newValue: value.newValue === null
      ? null
      : cleanText(value.newValue, 160),
    summary: cleanText(value.summary, 240),
  };
}

export function parseMonitoredRecordAuditHistory(
  value: unknown,
  expectedRecordId: string,
): MonitoredRecordAuditHistory {
  if (
    !isObject(value) ||
    typeof value.organisationName !== "string" ||
    !Array.isArray(value.events) ||
    typeof value.truncated !== "boolean"
  ) {
    throw new TypeError("The monitored-record audit history response is invalid.");
  }

  const events = value.events.map((event) => {
    if (
      !isObject(event) ||
      typeof event.id !== "string" ||
      event.recordId !== expectedRecordId ||
      typeof event.recordName !== "string" ||
      typeof event.actorLabel !== "string" ||
      typeof event.action !== "string" ||
      typeof event.summary !== "string" ||
      typeof event.date !== "string" ||
      (event.dateKind !== "timestamp" && event.dateKind !== "legacy_text") ||
      !Array.isArray(event.changes)
    ) {
      throw new TypeError("The monitored-record audit history response is invalid.");
    }
    const changes = event.changes.map(parseChange);
    if (changes.some((change) => change === null)) {
      throw new TypeError("The monitored-record audit history response is invalid.");
    }
    const dateKind: MonitoredRecordAuditEvent["dateKind"] =
      event.dateKind === "timestamp" ? "timestamp" : "legacy_text";
    return {
      id: cleanText(event.id, 100),
      recordId: expectedRecordId,
      recordName: cleanText(event.recordName, 160),
      actorLabel: cleanText(event.actorLabel, 120),
      action: cleanText(event.action, 100),
      summary: cleanText(event.summary, 500),
      date: cleanText(event.date, 100),
      dateKind,
      changes: changes as MonitoredRecordAuditChange[],
    };
  });

  return {
    organisationName: cleanText(value.organisationName, 160),
    events,
    truncated: value.truncated,
  };
}
