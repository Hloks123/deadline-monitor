import type { ClientWorkspaceData } from "@/components/client/useClientWorkspaceData";
import type { ClientNotification, ClientRecord, ClientTask, ClientTaskOccurrence } from "@/lib/clientWorkspace";
import type { ChecklistItem } from "@/lib/clientWorkspaceStore";

export const CLIENT_BUSINESS_TIME_ZONE = "Africa/Johannesburg";

export type NormalizedClientStatus =
  | "overdue"
  | "not_started"
  | "upcoming"
  | "in_progress"
  | "completed"
  | "blocked"
  | "due_today"
  | "awaiting_confirmation"
  | "rejected"
  | "cancelled"
  | "skipped"
  | "paused"
  | "current"
  | "unknown";

export type ClientReportWorkItem = {
  id: string;
  organisationId: string;
  kind: "recurring_task" | "checklist_item" | "assigned_task" | "record_action" | "expired_record";
  sourceId: string;
  name: string;
  related: string;
  dueDate: string;
  dueTime: string;
  completionDate: string;
  responsiblePerson: string;
  priority: string;
  rawStatus: string;
  status: NormalizedClientStatus;
  nextAction: string;
  recordId?: string;
  evidence?: string;
  risk?: string;
};

export type ClientRenewal = {
  id: string;
  organisationId: string;
  recordId: string;
  recordName: string;
  renewalDate: string;
  responsiblePerson: string;
  previousExpiryDate: string;
  replacementExpiryDate: string;
};

export type ClientWorkspaceSelectors = {
  organisationId: string;
  clientRecords: ClientRecord[];
  clientRecurringTasks: ClientTask[];
  clientChecklistItems: ChecklistItem[];
  clientWorkItems: ClientReportWorkItem[];
  clientNotifications: ClientNotification[];
  clientRenewals: ClientRenewal[];
};

function validDateKey(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function parseClientDate(value?: string): Date | null {
  if (!value) return null;
  const dateKey = businessDateKey(value);
  if (!dateKey || !validDateKey(dateKey)) return null;
  return new Date(`${dateKey}T00:00:00.000Z`);
}

export function businessDateKey(value?: string | null): string {
  if (!value) return "";
  const trimmed = value.trim();
  const dateOnly = /^(\d{4}-\d{2}-\d{2})$/.exec(trimmed);
  if (dateOnly) return validDateKey(dateOnly[1]) ? dateOnly[1] : "";
  const localWallTime = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?$/.exec(trimmed);
  if (localWallTime) {
    const [, date, hour, minute, second = "0"] = localWallTime;
    if (!validDateKey(date) || Number(hour) > 23 || Number(minute) > 59 || Number(second) > 59) return "";
    return date;
  }
  const instant = new Date(trimmed);
  if (Number.isNaN(instant.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: CLIENT_BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value || "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function businessTimeKey(value?: string | null): string {
  if (!value) return "";
  const trimmed = value.trim();
  if (!businessDateKey(trimmed)) return "";
  const localWallTime = /^\d{4}-\d{2}-\d{2}T(\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/.exec(trimmed);
  if (localWallTime) return `${localWallTime[1]}:${localWallTime[2]}`;

  const instant = new Date(trimmed);
  if (Number.isNaN(instant.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: CLIENT_BUSINESS_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value || "";
  return `${part("hour")}:${part("minute")}`;
}

export function clientBusinessToday(now = new Date()): string {
  return businessDateKey(now.toISOString());
}

export function compareClientDateKeys(left: string, right: string): number {
  const leftDate = parseClientDate(left);
  const rightDate = parseClientDate(right);
  if (!leftDate || !rightDate) return 0;
  return Math.sign(leftDate.getTime() - rightDate.getTime());
}

export function shiftClientDate(value: string, days: number): string {
  const date = parseClientDate(value);
  if (!date) return "";
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function clientWeekRange(today = clientBusinessToday()) {
  const parsed = parseClientDate(today);
  if (!parsed) return { start: "", end: "" };
  const weekday = (parsed.getUTCDay() + 6) % 7;
  const start = shiftClientDate(today, -weekday);
  return { start, end: shiftClientDate(start, 6) };
}

export function normalizeClientStatus(value: string): NormalizedClientStatus {
  const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (normalized === "pending_acceptance") return "awaiting_confirmation";
  if (normalized === "accepted") return "in_progress";
  if (normalized === "rejected") return "rejected";
  if (["expired", "overdue", "failed"].includes(normalized)) return "overdue";
  if (["not_started", "notstart", "not_started_yet"].includes(normalized)) return "not_started";
  if (["upcoming", "scheduled"].includes(normalized)) return "upcoming";
  if (["in_progress", "inprogress"].includes(normalized)) return "in_progress";
  if (["complete", "completed", "renewed"].includes(normalized)) return "completed";
  if (normalized === "blocked") return "blocked";
  if (["due_today", "duetoday"].includes(normalized)) return "due_today";
  if (["awaiting_confirmation", "awaiting_client"].includes(normalized)) return "awaiting_confirmation";
  if (["cancelled", "canceled", "archived"].includes(normalized)) return "cancelled";
  if (normalized === "skipped") return "skipped";
  if (normalized === "paused") return "paused";
  if (normalized === "current") return "current";
  return "unknown";
}

function normalizedWorkStatus(rawStatus: string, dueDate: string, today: string): NormalizedClientStatus {
  const status = normalizeClientStatus(rawStatus);
  if (["completed", "cancelled", "skipped", "blocked", "in_progress", "awaiting_confirmation", "rejected", "paused"].includes(status)) return status;
  const comparison = dueDate ? compareClientDateKeys(dueDate, today) : 1;
  if (status === "overdue" || comparison < 0) return "overdue";
  if (comparison === 0) return "due_today";
  if (status === "not_started") return status;
  return "upcoming";
}

function isClosed(status: NormalizedClientStatus) {
  return ["completed", "cancelled", "skipped", "rejected"].includes(status);
}

function statusOfRecord(record: ClientRecord, today: string): NormalizedClientStatus {
  const lifecycleStatus = normalizeClientStatus(record.status);
  if (["completed", "paused", "cancelled", "awaiting_confirmation"].includes(lifecycleStatus)) return lifecycleStatus;
  const expiryDate = businessDateKey(record.expiryDate);
  if (expiryDate) {
    const comparison = compareClientDateKeys(expiryDate, today);
    if (comparison < 0) return "overdue";
    if (comparison === 0) return "due_today";
    const remaining = Math.round((Date.parse(`${expiryDate}T00:00:00.000Z`) - Date.parse(`${today}T00:00:00.000Z`)) / 86400000);
    if (remaining <= 30) return "upcoming";
  }
  return "current";
}

function recordActionItems(records: ClientRecord[], today: string): ClientReportWorkItem[] {
  return records.flatMap<ClientReportWorkItem>((record) => {
    const status = statusOfRecord(record, today);
    if (status === "completed" || status === "paused" || status === "cancelled") return [];
    if (status === "overdue") {
      return [{
        id: `expired-record-${record.id}`,
        organisationId: record.organisationId,
        kind: "expired_record" as const,
        sourceId: record.id,
        name: record.name,
        related: record.name,
        dueDate: businessDateKey(record.expiryDate),
        dueTime: "",
        completionDate: "",
        responsiblePerson: record.contact || "Unassigned",
        priority: record.risk || "—",
        rawStatus: record.status,
        status: "overdue" as const,
        nextAction: record.nextAction || "Provide replacement expiry",
        recordId: record.id,
        risk: record.risk,
      }];
    }
    const dates = [...new Set([businessDateKey(record.followUp), businessDateKey(record.expiryDate)].filter(Boolean))];
    return dates.map((dueDate) => ({
      id: `record-action-${record.id}-${dueDate}`,
      organisationId: record.organisationId,
      kind: "record_action" as const,
      sourceId: record.id,
      name: record.nextAction || `Review ${record.name}`,
      related: record.name,
      dueDate,
      dueTime: "",
      completionDate: "",
      responsiblePerson: record.contact || "Unassigned",
      priority: record.risk || "—",
      rawStatus: record.status,
      status: normalizedWorkStatus(record.status, dueDate, today),
      nextAction: record.nextAction || "Review monitored record",
      recordId: record.id,
      risk: record.risk,
    }));
  });
}

function selectWorkItems(
  organisationIds: Set<string>,
  organisationId: string,
  records: ClientRecord[],
  tasks: ClientTask[],
  occurrences: ClientTaskOccurrence[],
  checklistItems: ChecklistItem[],
  data: ClientWorkspaceData,
  today: string,
): ClientReportWorkItem[] {
  const taskMap = new Map(tasks.map((task) => [task.id, task]));
  const recordMap = new Map(records.map((record) => [record.id, record]));
  const trackerMap = new Map(data.workspaceState.trackers
    .filter((tracker) => organisationIds.has(tracker.organisationId))
    .map((tracker) => [tracker.id, tracker]));
  const personMap = new Map(data.workspaceState.people
    .filter((person) => organisationIds.has(person.organisationId))
    .map((person) => [person.id, person.name]));

  const recurringItems = occurrences.flatMap((occurrence) => {
    if (!organisationIds.has(occurrence.organisationId)) return [];
    const task = taskMap.get(occurrence.recurringTaskId);
    if (!task || !organisationIds.has(task.organisationId) || task.organisationId !== occurrence.organisationId || task.clientVisible !== true || task.status !== "active") return [];
    const dueDate = businessDateKey(occurrence.scheduledFor || occurrence.dueAt);
    const status = normalizedWorkStatus(occurrence.status, dueDate, today);
    if (isClosed(status)) {
      return [{
        id: occurrence.id,
        organisationId,
        kind: "recurring_task" as const,
        sourceId: task.id,
        name: task.name,
        related: task.linkedRecordId ? recordMap.get(task.linkedRecordId)?.name || "Related record" : "Recurring task",
        dueDate,
        dueTime: occurrence.dueAt.includes("T") ? occurrence.dueAt.slice(11, 16) : task.dueTime || "",
        completionDate: businessDateKey(occurrence.completedAt),
        responsiblePerson: personMap.get(occurrence.ownerId || task.ownerId) || occurrence.ownerId || task.ownerId || "Unassigned",
        priority: task.priority || "Medium",
        rawStatus: occurrence.status,
        status,
        nextAction: status === "completed" ? "Completed" : status === "skipped" ? occurrence.skippedReason || "Skipped" : "Cancelled",
        recordId: task.linkedRecordId && recordMap.has(task.linkedRecordId) ? task.linkedRecordId : undefined,
        evidence: occurrence.completionEvidence,
      }];
    }
    return [{
      id: occurrence.id,
      organisationId,
      kind: "recurring_task" as const,
      sourceId: task.id,
      name: task.name,
      related: task.linkedRecordId ? recordMap.get(task.linkedRecordId)?.name || "Related record" : "Recurring task",
      dueDate,
      dueTime: occurrence.dueAt.includes("T") ? occurrence.dueAt.slice(11, 16) : task.dueTime || "",
      completionDate: "",
      responsiblePerson: personMap.get(occurrence.ownerId || task.ownerId) || occurrence.ownerId || task.ownerId || "Unassigned",
      priority: task.priority || "Medium",
      rawStatus: occurrence.status,
      status,
      nextAction: occurrence.status === "overdue" ? "Complete overdue task" : "Complete scheduled task",
      recordId: task.linkedRecordId && recordMap.has(task.linkedRecordId) ? task.linkedRecordId : undefined,
      evidence: occurrence.completionEvidence,
    }];
  });

  const checklistWork = checklistItems.filter((item) => organisationIds.has(item.organisationId)).map((item) => {
    const dueDate = businessDateKey(item.targetDate);
    const status = normalizedWorkStatus(item.status, dueDate, today);
    return {
      id: item.id,
      organisationId,
      kind: "checklist_item" as const,
      sourceId: item.id,
      name: item.task,
      related: trackerMap.get(item.trackerId)?.name || "Work tracker",
      dueDate,
      dueTime: item.targetTime || "",
      completionDate: businessDateKey(item.completedDate),
      responsiblePerson: item.responsiblePersonName || "Unassigned",
      priority: item.priority,
      rawStatus: item.status,
      status,
      nextAction: item.nextAction || (status === "completed" ? "Completed" : "Complete checklist item"),
      evidence: item.completionEvidence,
    };
  });

  const assignedWork = data.assignedTasks
    .filter((task) =>
      organisationIds.has(task.organisation_id) &&
      (task.created_by === data.userId || task.assigned_to === data.userId)
    )
    .map<ClientReportWorkItem>((task) => {
      const dueDate = businessDateKey(task.due_date);
      return {
        id: `assigned-task:${task.id}`,
        organisationId: task.organisation_id,
        kind: "assigned_task",
        sourceId: task.id,
        name: task.title,
        related: "Company task assignment",
        dueDate,
        dueTime: "",
        completionDate: "",
        responsiblePerson: data.team.find((member) => member.id === task.assigned_to)?.name || "Unassigned",
        priority: `${task.priority[0].toUpperCase()}${task.priority.slice(1)}`,
        rawStatus: task.status,
        status: normalizedWorkStatus(task.status, dueDate, today),
        nextAction: task.response_note || (task.status === "rejected" ? "Review rejection reason" : "Review assigned work"),
        evidence: task.response_note || "",
      };
    });

  const workItems = [...recurringItems, ...checklistWork, ...assignedWork];
  const recordItems = recordActionItems(records, today);
  return [...workItems, ...recordItems].filter((item) => organisationIds.has(item.organisationId));
}

function selectRenewals(data: ClientWorkspaceData, records: ClientRecord[], organisationIds: Set<string>, organisationId: string): ClientRenewal[] {
  const recordMap = new Map(records.map((record) => [record.id, record]));
  return data.auditEvents.flatMap((event) => {
    if (event.action !== "Client replacement date confirmed" ||
      event.organisation !== data.organisation?.company ||
      event.entityType !== "record") return [];
    const record = recordMap.get(event.entityId || event.recordId);
    if (!record || !organisationIds.has(record.organisationId)) return [];
    let previousExpiryDate = "";
    let replacementExpiryDate = "";
    try {
      const previous = JSON.parse(event.previousValue) as { expiryDate?: string };
      const replacement = JSON.parse(event.newValue) as { expiryDate?: string };
      previousExpiryDate = businessDateKey(previous.expiryDate);
      replacementExpiryDate = businessDateKey(replacement.expiryDate);
    } catch (error) {
      console.error("Could not read replacement confirmation history for client report.", error);
      return [];
    }
    if (!replacementExpiryDate || replacementExpiryDate === previousExpiryDate) return [];
    return [{
      id: event.id,
      organisationId,
      recordId: record.id,
      recordName: record.name,
      renewalDate: businessDateKey(event.timestamp || event.date),
      responsiblePerson: event.user || record.contact || "Unassigned",
      previousExpiryDate,
      replacementExpiryDate,
    }];
  });
}

export function selectClientWorkspaceData(data: ClientWorkspaceData, today = clientBusinessToday()): ClientWorkspaceSelectors {
  const organisationId = data.organisation?.id || data.workspaceState.organisationId || data.authOrganisationId;
  const organisationIds = new Set([organisationId, data.authOrganisationId].filter(Boolean));
  if (!organisationId) {
    return { organisationId: "", clientRecords: [], clientRecurringTasks: [], clientChecklistItems: [], clientWorkItems: [], clientNotifications: [], clientRenewals: [] };
  }
  const clientRecords = data.records.filter((record) => organisationIds.has(record.organisationId));
  const clientRecurringTasks = data.tasks.filter((task) => organisationIds.has(task.organisationId) && task.clientVisible === true);
  const clientChecklistItems = data.workspaceState.items.filter((item) => organisationIds.has(item.organisationId));
  const clientNotifications = data.notifications.filter((notification) => organisationIds.has(notification.organisationId));
  return {
    organisationId,
    clientRecords,
    clientRecurringTasks,
    clientChecklistItems,
    clientWorkItems: selectWorkItems(organisationIds, organisationId, clientRecords, clientRecurringTasks, data.occurrences, clientChecklistItems, data, today),
    clientNotifications,
    clientRenewals: selectRenewals(data, clientRecords, organisationIds, organisationId),
  };
}
