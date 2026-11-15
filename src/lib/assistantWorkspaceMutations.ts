import {
  calculateEscalation,
  calculateStatus,
  categoryOptions,
  type AuditEvent,
  type CategoryOne,
  type MonitoredRecord,
  type RecordRisk,
  type RecordStatus,
} from "./recordStore.ts";
import type { ChecklistItem, ChecklistStatus, WorkPriority } from "@/lib/clientWorkspaceStore";
import type { TaskOccurrence } from "@/lib/recurringTasks/types";
import type { AssistantWorkspaceSnapshot } from "@/lib/assistantWorkspaceTypes";

type RecordFields = Pick<
  MonitoredRecord,
  | "name"
  | "category"
  | "category2"
  | "issueDate"
  | "expiryDate"
  | "risk"
  | "contactId"
  | "followUp"
  | "nextAction"
  | "notes"
>;

type RecordPatch = Partial<RecordFields> & { status?: RecordStatus };

type WorkItemFields = Pick<
  ChecklistItem,
  | "task"
  | "targetDate"
  | "responsiblePersonId"
  | "priority"
  | "status"
  | "progressNotes"
  | "nextAction"
  | "completionEvidence"
  | "blockedReason"
  | "carryForwardReason"
>;

type WorkItemPatch = Partial<WorkItemFields>;

export type AssistantWorkspaceMutation =
  | { type: "create_record"; record: RecordFields }
  | { type: "update_record"; recordId: string; changes: RecordPatch }
  | {
      type: "create_work_item";
      trackerId: string;
      task: string;
      targetDate: string;
      responsiblePersonId: string;
      priority: WorkPriority;
    }
  | { type: "update_work_item"; itemId: string; changes: WorkItemPatch }
  | {
      type: "update_occurrence";
      occurrenceId: string;
      status: TaskOccurrence["status"];
      completionEvidence?: string;
      skippedReason?: string;
      failureReason?: string;
    };

type Result<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

type AssignedOrganisation = { id: string; name: string };

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
const workStatuses: ChecklistStatus[] = [
  "Not Started",
  "In Progress",
  "Scheduled",
  "Awaiting Confirmation",
  "Completed",
  "Skipped",
  "Blocked",
  "Overdue",
  "Carry Forward",
];
const priorities: WorkPriority[] = ["High", "Medium", "Low"];
const occurrenceStatuses: TaskOccurrence["status"][] = [
  "upcoming",
  "due_today",
  "in_progress",
  "completed",
  "skipped",
  "failed",
  "overdue",
  "cancelled",
];

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: string[]) {
  return Object.keys(value).every((key) => allowed.includes(key));
}

function isText(value: unknown, maxLength: number, allowEmpty = true): value is string {
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

function parseRecordFields(
  value: unknown,
  partial: boolean,
): Result<RecordPatch> {
  const allowed = [
    "name",
    "category",
    "category2",
    "issueDate",
    "expiryDate",
    "risk",
    "contactId",
    "followUp",
    "nextAction",
    "notes",
    ...(partial ? ["status"] : []),
  ];
  if (!isObject(value) || !hasOnlyKeys(value, allowed)) {
    return { ok: false, error: "The record details are invalid." };
  }
  if (!partial && !["name", "category", "expiryDate", "risk"].every((key) => key in value)) {
    return { ok: false, error: "Enter the required record details." };
  }
  if (!Object.keys(value).length) {
    return { ok: false, error: "Make at least one change before saving." };
  }

  const parsed: RecordPatch = {};
  if ("name" in value) {
    if (!isText(value.name, 200, false)) return { ok: false, error: "Enter a record name of up to 200 characters." };
    parsed.name = value.name.trim();
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
    if (!isText(value.category2, 200)) return { ok: false, error: "Record type must be 200 characters or fewer." };
    parsed.category2 = value.category2.trim();
  }
  if ("issueDate" in value) {
    if (!isDate(value.issueDate, true)) return { ok: false, error: "Enter a valid issue date." };
    parsed.issueDate = value.issueDate;
  }
  if ("expiryDate" in value) {
    if (!isDate(value.expiryDate)) return { ok: false, error: "Enter a valid expiry date." };
    parsed.expiryDate = value.expiryDate;
  }
  if ("risk" in value) {
    if (typeof value.risk !== "string" || !risks.includes(value.risk as RecordRisk)) {
      return { ok: false, error: "Choose a valid record risk." };
    }
    parsed.risk = value.risk as RecordRisk;
  }
  if ("contactId" in value) {
    if (!isText(value.contactId, 100)) return { ok: false, error: "Choose a valid contact." };
    parsed.contactId = value.contactId.trim();
  }
  for (const key of ["followUp", "nextAction", "notes"] as const) {
    if (!(key in value)) continue;
    const fieldValue = value[key];
    if (key === "followUp") {
      if (!isDate(fieldValue, true)) return { ok: false, error: "Enter a valid follow-up date." };
      parsed.followUp = fieldValue;
    } else {
      const maxLength = key === "notes" ? 2000 : 500;
      if (!isText(fieldValue, maxLength)) {
        return { ok: false, error: `${key === "notes" ? "Notes" : "Next action"} must be ${maxLength} characters or fewer.` };
      }
      parsed[key] = fieldValue.trim();
    }
  }
  if ("status" in value) {
    if (typeof value.status !== "string" || !recordStatuses.includes(value.status as RecordStatus)) {
      return { ok: false, error: "Choose a valid record status." };
    }
    parsed.status = value.status as RecordStatus;
  }
  return { ok: true, value: parsed };
}

function parseWorkItemFields(value: unknown, partial: boolean): Result<WorkItemPatch> {
  const allowed = [
    "task",
    "targetDate",
    "responsiblePersonId",
    "priority",
    "status",
    "progressNotes",
    "nextAction",
    "completionEvidence",
    "blockedReason",
    "carryForwardReason",
  ];
  if (!isObject(value) || !hasOnlyKeys(value, allowed)) {
    return { ok: false, error: "The work item details are invalid." };
  }
  if (!partial && !["task", "targetDate", "responsiblePersonId", "priority"].every((key) => key in value)) {
    return { ok: false, error: "Enter the required work item details." };
  }
  if (!Object.keys(value).length) {
    return { ok: false, error: "Make at least one change before saving." };
  }

  const parsed: WorkItemPatch = {};
  for (const key of ["task", "progressNotes", "nextAction", "completionEvidence", "blockedReason", "carryForwardReason"] as const) {
    if (!(key in value)) continue;
    const maxLength = key === "task" ? 300 : 2000;
    const required = key === "task";
    if (!isText(value[key], maxLength, !required)) {
      return { ok: false, error: `${key === "task" ? "Work item" : "Work note"} must be ${maxLength} characters or fewer.` };
    }
    parsed[key] = value[key].trim();
  }
  if ("targetDate" in value) {
    if (!isDate(value.targetDate)) return { ok: false, error: "Enter a valid work due date." };
    parsed.targetDate = value.targetDate;
  }
  if ("responsiblePersonId" in value) {
    if (!isText(value.responsiblePersonId, 100)) return { ok: false, error: "Choose a valid responsible person." };
    parsed.responsiblePersonId = value.responsiblePersonId.trim();
  }
  if ("priority" in value) {
    if (typeof value.priority !== "string" || !priorities.includes(value.priority as WorkPriority)) {
      return { ok: false, error: "Choose a valid work priority." };
    }
    parsed.priority = value.priority as WorkPriority;
  }
  if ("status" in value) {
    if (typeof value.status !== "string" || !workStatuses.includes(value.status as ChecklistStatus)) {
      return { ok: false, error: "Choose a valid work status." };
    }
    parsed.status = value.status as ChecklistStatus;
  }
  return { ok: true, value: parsed };
}

export function parseAssistantWorkspaceMutation(value: unknown): Result<AssistantWorkspaceMutation> {
  if (!isObject(value) || typeof value.type !== "string") {
    return { ok: false, error: "Choose a valid workspace action." };
  }
  if (value.type === "create_record") {
    if (!hasOnlyKeys(value, ["type", "record"])) {
      return { ok: false, error: "The record creation request is invalid." };
    }
    const parsed = parseRecordFields(value.record, false);
    return parsed.ok
      ? { ok: true, value: { type: "create_record", record: parsed.value as RecordFields } }
      : parsed;
  }
  if (value.type === "update_record") {
    if (!hasOnlyKeys(value, ["type", "recordId", "changes"])) {
      return { ok: false, error: "The record update request is invalid." };
    }
    if (!isText(value.recordId, 100, false)) return { ok: false, error: "Choose a valid record." };
    const parsed = parseRecordFields(value.changes, true);
    return parsed.ok
      ? { ok: true, value: { type: "update_record", recordId: value.recordId, changes: parsed.value } }
      : parsed;
  }
  if (value.type === "create_work_item") {
    if (!hasOnlyKeys(value, ["type", "trackerId", "task", "targetDate", "responsiblePersonId", "priority"])) {
      return { ok: false, error: "The work item details are invalid." };
    }
    const fields = parseWorkItemFields(
      {
        task: value.task,
        targetDate: value.targetDate,
        responsiblePersonId: value.responsiblePersonId,
        priority: value.priority,
      },
      false,
    );
    if (!fields.ok) return fields;
    if (!isText(value.trackerId, 100, false)) return { ok: false, error: "Choose an active work tracker." };
    return {
      ok: true,
      value: {
        type: "create_work_item",
        trackerId: value.trackerId,
        task: fields.value.task!,
        targetDate: fields.value.targetDate!,
        responsiblePersonId: fields.value.responsiblePersonId!,
        priority: fields.value.priority!,
      },
    };
  }
  if (value.type === "update_work_item") {
    if (!hasOnlyKeys(value, ["type", "itemId", "changes"])) {
      return { ok: false, error: "The work item update request is invalid." };
    }
    if (!isText(value.itemId, 100, false)) return { ok: false, error: "Choose a valid work item." };
    const parsed = parseWorkItemFields(value.changes, true);
    return parsed.ok
      ? { ok: true, value: { type: "update_work_item", itemId: value.itemId, changes: parsed.value } }
      : parsed;
  }
  if (value.type === "update_occurrence") {
    if (
      !isText(value.occurrenceId, 100, false) ||
      typeof value.status !== "string" ||
      !occurrenceStatuses.includes(value.status as TaskOccurrence["status"])
    ) {
      return { ok: false, error: "Choose a valid recurring work status." };
    }
    const changes: Record<string, unknown> = {
      completionEvidence: value.completionEvidence,
      skippedReason: value.skippedReason,
      failureReason: value.failureReason,
    };
    if (!hasOnlyKeys(value, ["type", "occurrenceId", "status", ...Object.keys(changes)])) {
      return { ok: false, error: "The recurring work update is invalid." };
    }
    for (const fieldValue of Object.values(changes)) {
      if (fieldValue !== undefined && !isText(fieldValue, 2000)) {
        return { ok: false, error: "Recurring work notes must be 2,000 characters or fewer." };
      }
    }
    return {
      ok: true,
      value: {
        type: "update_occurrence",
        occurrenceId: value.occurrenceId,
        status: value.status as TaskOccurrence["status"],
        completionEvidence: typeof value.completionEvidence === "string" ? value.completionEvidence.trim() : undefined,
        skippedReason: typeof value.skippedReason === "string" ? value.skippedReason.trim() : undefined,
        failureReason: typeof value.failureReason === "string" ? value.failureReason.trim() : undefined,
      },
    };
  }
  return { ok: false, error: "Choose a valid workspace action." };
}

function auditValue(value: unknown) {
  if (value === undefined || value === null) return "";
  return typeof value === "string" ? value : JSON.stringify(value);
}

function makeAuditEvent({
  organisation,
  actor,
  now,
  action,
  entityType,
  entityId,
  entityName,
  field,
  previousValue,
  newValue,
  context,
  recordId = "",
}: {
  organisation: AssignedOrganisation;
  actor: string;
  now: string;
  action: string;
  entityType: string;
  entityId: string;
  entityName: string;
  field: string;
  previousValue: unknown;
  newValue: unknown;
  context?: string;
  recordId?: string;
}): AuditEvent {
  return {
    id: crypto.randomUUID(),
    recordId,
    recordName: entityName,
    organisation: organisation.name,
    user: actor,
    action,
    field,
    previousValue: auditValue(previousValue),
    newValue: auditValue(newValue),
    date: now,
    timestamp: now,
    entityType,
    entityId,
    entityName,
    context: context || "Updated in the assigned-client assistant workspace.",
  };
}

function resolveContact(snapshot: AssistantWorkspaceSnapshot, contactId: string) {
  if (!contactId) return undefined;
  return snapshot.client.contacts.find(
    (contact) => contact.id === contactId && contact.authorised,
  );
}

export function applyAssistantWorkspaceMutation(
  snapshot: AssistantWorkspaceSnapshot,
  mutation: AssistantWorkspaceMutation,
  organisation: AssignedOrganisation,
  actor: string,
  now = new Date().toISOString(),
): Result<AssistantWorkspaceSnapshot> {
  const events: AuditEvent[] = [];
  let updated: AssistantWorkspaceSnapshot = snapshot;

  if (mutation.type === "create_record") {
    if (
      mutation.record.issueDate &&
      mutation.record.issueDate > mutation.record.expiryDate
    ) {
      return { ok: false, error: "Issue date cannot be after the expiry date." };
    }
    const contact = resolveContact(snapshot, mutation.record.contactId);
    if (mutation.record.contactId && !contact) {
      return { ok: false, error: "Choose an authorised contact for this client." };
    }
    const record: MonitoredRecord = {
      id: crypto.randomUUID(),
      name: mutation.record.name,
      organisationId: organisation.id,
      organisation: organisation.name,
      category: mutation.record.category,
      category2: mutation.record.category2 || mutation.record.category,
      issueDate: mutation.record.issueDate || "",
      expiryDate: mutation.record.expiryDate,
      status: "Current",
      risk: mutation.record.risk,
      escalationLevel: "Normal",
      contactId: contact?.id || "",
      contact: contact?.name || "",
      contactEmail: contact?.email || "",
      followUp: mutation.record.followUp || "",
      nextAction: mutation.record.nextAction || "",
      notes: mutation.record.notes || "",
      reminderFrequency: "weekly",
      reminderLeadDays: 7,
      clientCreated: false,
      lastConfirmed: "",
      confirmedBy: "",
      confirmationMethod: "",
      dataSource: "Assistant consultant",
      reminderDays: [60, 30, 14, 7, 0],
    };
    record.status = calculateStatus(record);
    record.escalationLevel = calculateEscalation(record);
    events.push(makeAuditEvent({
      organisation, actor, now, action: "Assistant created monitored record",
      entityType: "record", entityId: record.id, entityName: record.name,
      field: "record", previousValue: "", newValue: record.name, recordId: record.id,
    }));
    updated = { ...snapshot, records: [record, ...snapshot.records] };
  } else if (mutation.type === "update_record") {
    const existing = snapshot.records.find(
      (record) => record.id === mutation.recordId && record.organisationId === organisation.id,
    );
    if (!existing) return { ok: false, error: "That record is not in your assigned client workspace." };
    const changes = mutation.changes;
    const issueDate = changes.issueDate ?? existing.issueDate;
    const expiryDate = changes.expiryDate ?? existing.expiryDate;
    if (issueDate && issueDate > expiryDate) {
      return { ok: false, error: "Issue date cannot be after the expiry date." };
    }
    const contactChanged =
      changes.contactId !== undefined && changes.contactId !== existing.contactId;
    const contact = contactChanged
      ? resolveContact(snapshot, changes.contactId || "")
      : undefined;
    if (contactChanged && changes.contactId && !contact) {
      return { ok: false, error: "Choose an authorised contact for this client." };
    }
    const next = {
      ...existing,
      ...changes,
      organisationId: organisation.id,
      organisation: organisation.name,
      contactId: contactChanged ? contact?.id || "" : existing.contactId,
      contact: contactChanged ? contact?.name || "" : existing.contact,
      contactEmail: contactChanged ? contact?.email || "" : existing.contactEmail,
    };
    next.status = calculateStatus(next);
    next.escalationLevel = calculateEscalation(next);
    for (const field of Object.keys(changes) as Array<keyof RecordPatch>) {
      const before = field === "contactId" ? existing.contact : existing[field];
      const after = field === "contactId" ? next.contact : next[field as keyof typeof next];
      if (auditValue(before) !== auditValue(after)) {
        events.push(makeAuditEvent({
          organisation, actor, now, action: "Assistant updated monitored record",
          entityType: "record", entityId: existing.id, entityName: next.name,
          field, previousValue: before, newValue: after, recordId: existing.id,
        }));
      }
    }
    if (existing.status !== next.status && !("status" in changes)) {
      events.push(makeAuditEvent({
        organisation, actor, now, action: "Record status recalculated",
        entityType: "record", entityId: existing.id, entityName: next.name,
        field: "status", previousValue: existing.status, newValue: next.status, recordId: existing.id,
      }));
    }
    updated = {
      ...snapshot,
      records: snapshot.records.map((record) => record.id === existing.id ? next : record),
    };
  } else if (mutation.type === "create_work_item") {
    const tracker = snapshot.trackers.find(
      (candidate) =>
        candidate.id === mutation.trackerId &&
        candidate.organisationId === organisation.id &&
        ["Active", "Draft"].includes(candidate.status),
    );
    if (!tracker) return { ok: false, error: "Choose an active or draft tracker for this client." };
    const person = mutation.responsiblePersonId
      ? snapshot.people.find(
          (candidate) =>
            candidate.id === mutation.responsiblePersonId &&
            candidate.organisationId === organisation.id &&
            candidate.active,
        )
      : undefined;
    if (mutation.responsiblePersonId && !person) {
      return { ok: false, error: "Choose an active responsible person for this client." };
    }
    const item: ChecklistItem = {
      id: crypto.randomUUID(),
      organisationId: organisation.id,
      trackerId: tracker.id,
      task: mutation.task,
      responsiblePersonId: person?.id || "",
      responsiblePersonName: person?.name || "Unassigned",
      responsibleEmail: person?.email,
      targetDate: mutation.targetDate,
      status: "Not Started",
      priority: mutation.priority,
      reminderPreference: tracker.reminderPreference,
      createdAt: now,
      updatedAt: now,
    };
    events.push(makeAuditEvent({
      organisation, actor, now, action: "Assistant created work item",
      entityType: "checklist item", entityId: item.id, entityName: item.task,
      field: "work item", previousValue: "", newValue: item.task,
      context: `Tracker: ${tracker.name}`,
    }));
    updated = { ...snapshot, items: [item, ...snapshot.items] };
  } else if (mutation.type === "update_work_item") {
    const existing = snapshot.items.find(
      (item) => item.id === mutation.itemId && item.organisationId === organisation.id,
    );
    if (!existing) return { ok: false, error: "That work item is not in your assigned client workspace." };
    const tracker = snapshot.trackers.find(
      (candidate) => candidate.id === existing.trackerId && candidate.organisationId === organisation.id,
    );
    if (!tracker || !["Active", "Draft"].includes(tracker.status)) {
      return { ok: false, error: "Work in a completed or archived tracker cannot be changed." };
    }
    const changes = mutation.changes;
    const responsiblePersonChanged =
      changes.responsiblePersonId !== undefined &&
      changes.responsiblePersonId !== existing.responsiblePersonId;
    const person = responsiblePersonChanged && changes.responsiblePersonId
      ? snapshot.people.find(
          (candidate) =>
            candidate.id === changes.responsiblePersonId &&
            candidate.organisationId === organisation.id &&
            candidate.active,
        )
      : undefined;
    if (responsiblePersonChanged && changes.responsiblePersonId && !person) {
      return { ok: false, error: "Choose an active responsible person for this client." };
    }
    const next: ChecklistItem = {
      ...existing,
      ...changes,
      responsiblePersonId: responsiblePersonChanged
        ? person?.id || ""
        : existing.responsiblePersonId,
      responsiblePersonName: responsiblePersonChanged
        ? person?.name || "Unassigned"
        : existing.responsiblePersonName,
      responsibleEmail: responsiblePersonChanged
        ? person?.email
        : existing.responsibleEmail,
      completedDate: changes.status === "Completed"
        ? existing.completedDate || now.slice(0, 10)
        : changes.status
          ? undefined
          : existing.completedDate,
      updatedAt: now,
    };
    if (next.status === "Completed" && !next.completionEvidence?.trim()) {
      return { ok: false, error: "Add completion evidence before completing this work item." };
    }
    if (next.status === "Blocked" && !next.blockedReason?.trim()) {
      return { ok: false, error: "Add a reason before marking this work item blocked." };
    }
    if (next.status === "Skipped" && !next.progressNotes?.trim()) {
      return { ok: false, error: "Add a note before skipping this work item." };
    }
    if (next.status === "Carry Forward" && !next.carryForwardReason?.trim()) {
      return { ok: false, error: "Add a reason before carrying this work item forward." };
    }
    for (const field of Object.keys(changes) as Array<keyof WorkItemPatch>) {
      const before = field === "responsiblePersonId" ? existing.responsiblePersonName : existing[field];
      const after = field === "responsiblePersonId" ? next.responsiblePersonName : next[field];
      if (auditValue(before) !== auditValue(after)) {
        events.push(makeAuditEvent({
          organisation, actor, now, action: "Assistant updated work item",
          entityType: "checklist item", entityId: existing.id, entityName: next.task,
          field, previousValue: before, newValue: after,
          context: `Tracker: ${tracker.name}`,
        }));
      }
    }
    updated = {
      ...snapshot,
      items: snapshot.items.map((item) => item.id === existing.id ? next : item),
    };
  } else {
    const existing = snapshot.occurrences.find(
      (occurrence) =>
        occurrence.id === mutation.occurrenceId &&
        occurrence.organisationId === organisation.id,
    );
    if (!existing) return { ok: false, error: "That recurring work is not in your assigned client workspace." };
    const task = snapshot.tasks.find(
      (candidate) =>
        candidate.id === existing.recurringTaskId &&
        candidate.organisationId === organisation.id,
    );
    if (!task || !["active", "paused"].includes(task.status)) {
      return { ok: false, error: "This recurring work cannot be changed." };
    }
    const completionEvidence = mutation.completionEvidence ?? existing.completionEvidence;
    const skippedReason = mutation.status === "skipped"
      ? mutation.skippedReason ?? existing.skippedReason
      : undefined;
    const failureReason = mutation.status === "failed"
      ? mutation.failureReason ?? existing.failureReason
      : undefined;
    if (mutation.status === "completed" && task.requiresCompletionEvidence && !completionEvidence?.trim()) {
      return { ok: false, error: "Add completion evidence before completing this recurring work." };
    }
    if (mutation.status === "skipped" && !skippedReason?.trim()) {
      return { ok: false, error: "Add a reason before skipping this recurring work." };
    }
    if (mutation.status === "failed" && !failureReason?.trim()) {
      return { ok: false, error: "Add a reason before marking this recurring work failed." };
    }
    const next: TaskOccurrence = {
      ...existing,
      status: mutation.status,
      completionEvidence,
      skippedReason,
      failureReason,
      startedAt: mutation.status === "in_progress" ? existing.startedAt || now : existing.startedAt,
      completedAt: mutation.status === "completed" ? now : undefined,
      updatedAt: now,
    };
    events.push(makeAuditEvent({
      organisation, actor, now, action: "Assistant updated recurring work",
      entityType: "recurring task", entityId: task.id, entityName: task.name,
      field: "status", previousValue: existing.status, newValue: next.status,
      context: `Occurrence ${existing.id}, scheduled ${existing.scheduledFor}`,
    }));
    updated = {
      ...snapshot,
      occurrences: snapshot.occurrences.map((occurrence) =>
        occurrence.id === existing.id ? next : occurrence,
      ),
    };
  }

  return { ok: true, value: { ...updated, auditEvents: [...events, ...snapshot.auditEvents] } };
}
