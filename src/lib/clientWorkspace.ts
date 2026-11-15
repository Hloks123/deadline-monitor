import { getClient } from "@/lib/clientStore";
import {
  addAuditEvent,
  addCommunication,
  calculateEscalation,
  calculateStatus,
  getCommunications,
  getRecord,
  getRecords,
  MonitoredRecord,
  categoryOptions,
  saveRecord,
} from "@/lib/recordStore";
import { getClientWorkspaceState } from "@/lib/clientWorkspaceStore";
import { completeOccurrence, getOccurrences, startOccurrence, skipOccurrence } from "@/lib/recurringTasks/occurrenceService";
import { generateOccurrences, getRecurringTasks, seedDemoRecurringTasksIfEmpty } from "@/lib/recurringTasks/taskStore";
import { RecurringTask, TaskOccurrence } from "@/lib/recurringTasks/types";
import {
  CLIENT_WORKSPACE_ORGANISATION_ID,
  CLIENT_WORKSPACE_USER,
  getAuthenticatedClientOrganisation,
  getClientProfileStorageKey,
} from "@/lib/clientWorkspaceConstants";
export { CLIENT_WORKSPACE_ORGANISATION_ID, CLIENT_WORKSPACE_USER } from "@/lib/clientWorkspaceConstants";

export type ClientNotification = {
  id: string;
  organisationId: string;
  date: string;
  subject: string;
  related: string;
  kind: "Record" | "Task";
  type: "Reminder" | "Follow-up";
  relevantDate?: string;
  daysRemaining?: number;
  deliveryStatus: "Sent" | "Delivered";
};

export type ClientRecord = Pick<
  MonitoredRecord,
  | "id"
  | "name"
  | "organisationId"
  | "organisation"
  | "category"
  | "category2"
  | "issueDate"
  | "expiryDate"
  | "status"
  | "risk"
  | "contact"
  | "followUp"
  | "lastConfirmed"
  | "referenceNumber"
  | "nextAction"
  | "notes"
  | "reminderFrequency"
  | "reminderLeadDays"
  | "clientCreated"
>;

export type ClientTask = Pick<
  RecurringTask,
  | "id"
  | "priority"
  | "organisationId"
  | "name"
  | "linkedRecordId"
  | "ownerId"
  | "startDate"
  | "dueTime"
  | "timezone"
  | "recurrence"
  | "requiresCompletionEvidence"
  | "clientVisible"
  | "clientCanSkip"
  | "status"
  | "nextRunAt"
>;

export type ClientTaskOccurrence = Pick<
  TaskOccurrence,
  | "id"
  | "organisationId"
  | "ownerId"
  | "recurringTaskId"
  | "scheduledFor"
  | "dueAt"
  | "status"
  | "completionEvidence"
  | "completedAt"
  | "skippedReason"
>;

export type ClientWorkspaceOrganisation = {
  id: string;
  company: string;
  reminderPreference: string;
  authorisedUserName: string;
  authorisedUserEmail: string;
  authorisedUserRole: string;
  isSeniorManager: boolean;
};

function isBrowser() {
  return typeof window !== "undefined";
}

export function getClientWorkspaceOrganisation(): ClientWorkspaceOrganisation | undefined {
  const context = getAuthenticatedClientOrganisation();
  const client = CLIENT_WORKSPACE_ORGANISATION_ID
    ? getClient(CLIENT_WORKSPACE_ORGANISATION_ID)
    : undefined;
  if (!context) return undefined;
  return {
    id: client?.id || context.id,
    company: context.name,
    reminderPreference: client?.reminderPreference || "In-app only",
    authorisedUserName: context.userName,
    authorisedUserEmail: context.userEmail,
    authorisedUserRole: context.role.replaceAll("_", " "),
    isSeniorManager: context.isPrimary,
  };
}

function getScopedRecords(): MonitoredRecord[] {
  if (!CLIENT_WORKSPACE_ORGANISATION_ID) return [];
  return Object.values(getRecords()).filter(
    (record) => record.organisationId === CLIENT_WORKSPACE_ORGANISATION_ID
  );
}

function toClientRecord(record: MonitoredRecord): ClientRecord {
  return {
    id: record.id,
    name: record.name,
    organisationId: record.organisationId,
    organisation: record.organisation,
    category: record.category,
    category2: record.category2,
    issueDate: record.issueDate,
    expiryDate: record.expiryDate,
    status: record.status,
    risk: record.risk,
    contact: record.contact,
    followUp: record.followUp,
    lastConfirmed: record.lastConfirmed,
    referenceNumber: record.referenceNumber,
    nextAction: record.nextAction,
    notes: record.notes,
    reminderFrequency: record.reminderFrequency,
    reminderLeadDays: record.reminderLeadDays,
    clientCreated: record.clientCreated,
  };
}

function getScopedRecord(id: string): MonitoredRecord | undefined {
  if (!CLIENT_WORKSPACE_ORGANISATION_ID) return undefined;
  const record = getRecord(id);
  return record?.organisationId === CLIENT_WORKSPACE_ORGANISATION_ID
    ? record
    : undefined;
}

export function getClientWorkspaceRecords(): ClientRecord[] {
  return getScopedRecords().map(toClientRecord);
}

export type ClientRecordInput = {
  name: string;
  referenceNumber: string;
  category: MonitoredRecord["category"];
  category2: string;
  issueDate: string;
  expiryDate: string;
  status: MonitoredRecord["status"];
  risk: MonitoredRecord["risk"];
  contactId: string;
  followUp: string;
  nextAction: string;
  notes: string;
  reminderFrequency: NonNullable<MonitoredRecord["reminderFrequency"]>;
  reminderLeadDays: number;
};

function isValidDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00`);
  return !Number.isNaN(date.getTime()) &&
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}` === value;
}

function validateClientRecord(input: ClientRecordInput) {
  const workspace = getClientWorkspaceState();
  const person = workspace.people.find((candidate) => candidate.id === input.contactId && candidate.active);
  if (!input.name.trim()) return { message: "Record name is required." };
  if (!input.category || !categoryOptions[input.category]?.includes(input.category2)) return { message: "Choose a valid record category and type." };
  if (!isValidDate(input.expiryDate)) return { message: "Enter a valid expiry date." };
  if (input.issueDate && (!isValidDate(input.issueDate) || input.issueDate > input.expiryDate)) return { message: "Issue date must be valid and not after the expiry date." };
  if (input.followUp && !isValidDate(input.followUp)) return { message: "Enter a valid next follow-up date." };
  if (!person) return { message: "Choose an active authorised contact for this organisation." };
  if (!Number.isInteger(input.reminderLeadDays) || input.reminderLeadDays < 0 || input.reminderLeadDays > 365) return { message: "Reminder lead time must be a whole number from 0 to 365 days." };
  return { person };
}

function nextFollowUp(expiryDate: string, leadDays: number) {
  const date = new Date(`${expiryDate}T00:00:00`);
  date.setDate(date.getDate() - leadDays);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (date < today) return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function saveClientRecord(input: ClientRecordInput, recordId?: string) {
  const validation = validateClientRecord(input);
  if ("message" in validation) return { success: false as const, message: validation.message };
  const existing = recordId ? getScopedRecord(recordId) : undefined;
  if (recordId && (!existing || !existing.clientCreated)) return { success: false as const, message: "Only records submitted from this client workspace can be edited here." };
  const contact = validation.person;
  const record: MonitoredRecord = {
    ...(existing || {
      id: `client-record-${crypto.randomUUID()}`,
      organisationId: CLIENT_WORKSPACE_ORGANISATION_ID,
      organisation: getClientWorkspaceOrganisation()?.company || "",
      status: input.status,
      escalationLevel: "Normal" as const,
      lastConfirmed: "",
      confirmedBy: "",
      confirmationMethod: "",
      dataSource: "Client-submitted prototype metadata",
      reminderDays: [input.reminderLeadDays],
    }),
    name: input.name.trim(),
    referenceNumber: input.referenceNumber.trim() || undefined,
    category: input.category,
    category2: input.category2,
    issueDate: input.issueDate,
    expiryDate: input.expiryDate,
    status: input.status,
    risk: input.risk,
    contactId: contact.id,
    contact: contact.name,
    contactEmail: contact.email || "",
    followUp: input.followUp || nextFollowUp(input.expiryDate, input.reminderLeadDays),
    nextAction: input.nextAction.trim() || "Review renewal and confirm updated dates",
    notes: input.notes.trim() || undefined,
    reminderFrequency: input.reminderFrequency,
    reminderLeadDays: input.reminderLeadDays,
    reminderDays: [input.reminderLeadDays],
    clientCreated: true,
  };
  const updated = { ...record, status: calculateStatus(record), escalationLevel: calculateEscalation(record) };
  saveRecord(updated);
  const changed: Array<[string, unknown, unknown]> = [];
  if (existing) {
    const candidates: Array<[string, unknown, unknown]> = [
      ["name", existing.name, updated.name],
      ["referenceNumber", existing.referenceNumber, updated.referenceNumber],
      ["issueDate", existing.issueDate, updated.issueDate],
      ["expiryDate", existing.expiryDate, updated.expiryDate],
      ["status", existing.status, updated.status],
      ["contact", existing.contact, updated.contact],
      ["followUp", existing.followUp, updated.followUp],
      ["risk", existing.risk, updated.risk],
      ["reminderRules", { frequency: existing.reminderFrequency, leadDays: existing.reminderLeadDays }, { frequency: updated.reminderFrequency, leadDays: updated.reminderLeadDays }],
    ];
    for (const candidate of candidates) {
      if (JSON.stringify(candidate[1]) !== JSON.stringify(candidate[2])) changed.push(candidate);
    }
  }
  addAuditEvent({
    recordId: updated.id,
    recordName: updated.name,
    organisation: updated.organisation,
    user: CLIENT_WORKSPACE_USER,
    action: existing ? "Client monitored record edited" : "Client monitored record created",
    field: "",
    previousValue: existing ? JSON.stringify(existing) : "",
    newValue: JSON.stringify(updated),
    entityType: "record",
    entityId: updated.id,
    entityName: updated.name,
    context: "Client-submitted metadata only; no underlying document was uploaded or stored.",
  });
  for (const [field, previousValue, newValue] of changed) {
    addAuditEvent({
      recordId: updated.id,
      recordName: updated.name,
      organisation: updated.organisation,
      user: CLIENT_WORKSPACE_USER,
      action: field === "expiryDate" ? "Expiry date changed" : field === "contact" ? "Responsible contact changed" : "Client record field changed",
      field,
      previousValue: JSON.stringify(previousValue ?? ""),
      newValue: JSON.stringify(newValue ?? ""),
      entityType: "record",
      entityId: updated.id,
      entityName: updated.name,
      context: "Client-submitted metadata update.",
    });
  }
  return { success: true as const, record: toClientRecord(updated) };
}

export function scheduleClientRecordFollowUp(input: {
  recordId: string;
  date: string;
  title: string;
}) {
  const record = getScopedRecord(input.recordId);
  if (!record) return { success: false as const, message: "This record is not available in the client workspace." };
  if (!input.title.trim()) return { success: false as const, message: "Follow-up name is required." };
  if (!isValidDate(input.date)) return { success: false as const, message: "Enter a valid follow-up date." };

  const updated = {
    ...record,
    followUp: input.date,
    nextAction: input.title.trim(),
  };
  saveRecord(updated);
  addAuditEvent({
    recordId: updated.id,
    recordName: updated.name,
    organisation: updated.organisation,
    user: CLIENT_WORKSPACE_USER,
    action: "Follow-up created from Calendar",
    field: "followUp",
    previousValue: JSON.stringify({ followUp: record.followUp, nextAction: record.nextAction || "" }),
    newValue: JSON.stringify({ followUp: updated.followUp, nextAction: updated.nextAction }),
    entityType: "record",
    entityId: updated.id,
    entityName: updated.name,
    context: "Calendar follow-up scheduled using the existing monitored-record follow-up fields.",
  });
  return { success: true as const, record: toClientRecord(updated) };
}

function getScopedTasks(): RecurringTask[] {
  return getRecurringTasks().filter(
    (task) =>
      task.organisationId === CLIENT_WORKSPACE_ORGANISATION_ID &&
      task.clientVisible === true
  );
}

export function getClientWorkspaceTasks(): ClientTask[] {
  return getScopedTasks().map((task) => ({
    id: task.id,
    priority: task.priority,
    organisationId: task.organisationId,
    name: task.name,
    linkedRecordId: task.linkedRecordId,
    ownerId: task.ownerId,
    startDate: task.startDate,
    dueTime: task.dueTime,
    timezone: task.timezone,
    recurrence: task.recurrence,
    requiresCompletionEvidence: task.requiresCompletionEvidence,
    clientVisible: task.clientVisible,
    clientCanSkip: task.clientCanSkip,
    status: task.status,
    nextRunAt: task.nextRunAt,
  }));
}

export function getClientWorkspaceOccurrences(): ClientTaskOccurrence[] {
  const taskIds = new Set(getScopedTasks()
    .filter((task) => task.status !== "archived")
    .map((task) => task.id));
  return getOccurrences().filter(
    (occurrence) =>
      occurrence.organisationId === CLIENT_WORKSPACE_ORGANISATION_ID &&
      taskIds.has(occurrence.recurringTaskId)
  ).map((occurrence) => ({
    id: occurrence.id,
    organisationId: occurrence.organisationId,
    ownerId: occurrence.ownerId,
    recurringTaskId: occurrence.recurringTaskId,
    scheduledFor: occurrence.scheduledFor,
    dueAt: occurrence.dueAt,
    status: occurrence.status,
    completionEvidence: occurrence.completionEvidence,
    completedAt: occurrence.completedAt,
    skippedReason: occurrence.skippedReason,
  }));
}

export function getClientWorkspaceNotifications(): ClientNotification[] {
  const organisation = getClientWorkspaceOrganisation();
  if (!organisation) return [];
  const records = getClientWorkspaceRecords();
  const tasks = getScopedTasks();
  const recordById = new Map(records.map((record) => [record.id, record]));
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const recordNames = new Map(records.map((record) => [record.id, record.name]));
  const taskNames = new Map(tasks.map((task) => [task.id, task.name]));
  const scopedIds = new Set([...recordNames.keys(), ...taskNames.keys()]);

  return getCommunications()
    .filter((communication) =>
      (recordNames.has(communication.recordId) ||
        Boolean(communication.relatedTaskId && taskNames.has(communication.relatedTaskId))) &&
      scopedIds.has(communication.recordId || communication.relatedTaskId || "") &&
      communication.organisation === organisation.company &&
      communication.decision === "approved" &&
      (communication.deliveryStatus === "Sent" || communication.deliveryStatus === "Delivered")
    )
    .map((communication) => {
      const record = recordById.get(communication.recordId);
      const task = communication.relatedTaskId ? taskById.get(communication.relatedTaskId) : undefined;
      const relevantDate = record?.followUp || record?.expiryDate || task?.nextRunAt?.slice(0, 10);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const relevant = relevantDate ? new Date(`${relevantDate}T00:00:00`) : undefined;
      return {
        id: communication.id,
        organisationId: CLIENT_WORKSPACE_ORGANISATION_ID,
        date: communication.date,
        subject: communication.subject,
        related: record?.name || task?.name || "Client notification",
        kind: record ? "Record" as const : "Task" as const,
        type: communication.type,
        relevantDate,
        daysRemaining: relevant && !Number.isNaN(relevant.getTime())
          ? Math.ceil((relevant.getTime() - today.getTime()) / 86400000)
          : undefined,
        deliveryStatus: communication.deliveryStatus as "Sent" | "Delivered",
      };
    });
}

export function ensureClientWorkspaceDemoData(): void {
  if (!isBrowser()) return;

  const existingTasks = localStorage.getItem(
    getClientProfileStorageKey("docmon_recurring_tasks_v1"),
  );
  if (existingTasks) {
    try {
      if (!Array.isArray(JSON.parse(existingTasks))) return;
    } catch (error) {
      console.error("Could not read recurring tasks; client preview data was not seeded.", error);
      return;
    }
  }

  seedDemoRecurringTasksIfEmpty();

  const tasks = getScopedTasks();

  if (tasks.length > 0) {
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    const through = new Date(from);
    through.setDate(through.getDate() + 30);
    generateOccurrences(tasks, from, through);
  }

  if (getClientWorkspaceNotifications().length > 0) return;
  const record = getScopedRecords()[0];
  if (!record) return;

  const followUp = new Date();
  followUp.setDate(followUp.getDate() + 7);
  const nextFollowUp = `${followUp.getFullYear()}-${String(followUp.getMonth() + 1).padStart(2, "0")}-${String(followUp.getDate()).padStart(2, "0")}`;
  addCommunication({
    recordId: record.id,
    type: "Reminder",
    recipient: record.contactEmail ?? "",
    subject: `Prototype reminder: ${record.name}`,
    message: "Fictional delivered notification for the client workspace preview.",
    outcome: "Prototype delivery history only; no message was sent.",
    deliveryStatus: "Delivered",
    nextFollowUp,
    organisation: record.organisation,
    decision: "approved",
    reviewer: "Prototype Consultant",
    reviewedAt: new Date().toISOString(),
    messageVersion: "prototype-client-v1",
  });
}

export function confirmClientReplacement(input: {
  recordId: string;
  issueDate?: string;
  expiryDate: string;
  note: string;
}): { success: true; record: MonitoredRecord } | { success: false; message: string } {
  const record = getScopedRecord(input.recordId);
  if (!record) return { success: false, message: "This record is not available in the client workspace." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.expiryDate) ||
    Number.isNaN(new Date(`${input.expiryDate}T00:00:00`).getTime())) {
    return { success: false, message: "Enter a valid replacement expiry date." };
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const minimum = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  if (input.expiryDate <= minimum || input.expiryDate <= record.expiryDate) {
    return { success: false, message: "The replacement expiry date must be in the future and later than the current expiry date." };
  }
  if (input.issueDate &&
    (!/^\d{4}-\d{2}-\d{2}$/.test(input.issueDate) ||
      Number.isNaN(new Date(`${input.issueDate}T00:00:00`).getTime()) ||
      input.issueDate > input.expiryDate)) {
    return { success: false, message: "Enter a valid issue date that is not after the new expiry date." };
  }
  if (!input.note.trim()) return { success: false, message: "Add a brief confirmation note." };

  const todayKey = minimum;
  const nextFollowUpDate = new Date(`${input.expiryDate}T00:00:00`);
  nextFollowUpDate.setDate(nextFollowUpDate.getDate() - Math.max(0, ...record.reminderDays));
  const nextFollowUpRaw = `${nextFollowUpDate.getFullYear()}-${String(nextFollowUpDate.getMonth() + 1).padStart(2, "0")}-${String(nextFollowUpDate.getDate()).padStart(2, "0")}`;
  const base: MonitoredRecord = {
    ...record,
    issueDate: input.issueDate || record.issueDate,
    expiryDate: input.expiryDate,
    status: "Current",
    followUp: nextFollowUpRaw < todayKey ? todayKey : nextFollowUpRaw,
    lastConfirmed: todayKey,
    confirmedBy: CLIENT_WORKSPACE_USER,
    confirmationMethod: "Client workspace",
  };
  const updated: MonitoredRecord = {
    ...base,
    status: calculateStatus(base),
    escalationLevel: calculateEscalation(base),
  };
  saveRecord(updated);
  addAuditEvent({
    recordId: record.id,
    recordName: record.name,
    organisation: record.organisation,
    user: CLIENT_WORKSPACE_USER,
    action: "Client replacement date confirmed",
    field: "expiryDate",
    previousValue: JSON.stringify({ issueDate: record.issueDate, expiryDate: record.expiryDate }),
    newValue: JSON.stringify({ issueDate: updated.issueDate, expiryDate: updated.expiryDate }),
    entityType: "record",
    entityId: record.id,
    entityName: record.name,
    context: `Client confirmation: ${input.note.trim()}; next monitoring follow-up ${updated.followUp}`,
  });
  return { success: true, record: updated };
}

export function startClientTaskOccurrence(occurrenceId: string) {
  if (!getClientWorkspaceOccurrences().some((occurrence) => occurrence.id === occurrenceId)) return undefined;
  return startOccurrence(occurrenceId, CLIENT_WORKSPACE_USER);
}

export function completeClientTaskOccurrence(occurrenceId: string, evidence?: string) {
  if (!getClientWorkspaceOccurrences().some((occurrence) => occurrence.id === occurrenceId)) return undefined;
  return completeOccurrence(occurrenceId, evidence, CLIENT_WORKSPACE_USER);
}

export function skipClientTaskOccurrence(occurrenceId: string, reason: string) {
  const occurrence = getClientWorkspaceOccurrences().find((item) => item.id === occurrenceId);
  const task = occurrence && getScopedTasks().find((item) => item.id === occurrence.recurringTaskId);
  if (!occurrence || !task?.clientCanSkip || !reason.trim()) return undefined;
  return skipOccurrence(occurrenceId, reason.trim(), CLIENT_WORKSPACE_USER);
}
