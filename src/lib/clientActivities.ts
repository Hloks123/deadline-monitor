import type { ClientWorkspaceData } from "@/components/client/useClientWorkspaceData";
import {
  businessDateKey,
  businessTimeKey,
  clientBusinessToday,
  clientWeekRange,
  shiftClientDate,
} from "@/lib/clientWorkspaceSelectors";

export type ClientActivityType =
  | "record_expiry"
  | "record_follow_up"
  | "recurring_task"
  | "assigned_task"
  | "checklist_item"
  | "follow_up"
  | "released_notification";

export type ClientActivityStatus =
  | "expired"
  | "overdue"
  | "not_started"
  | "upcoming"
  | "in_progress"
  | "accepted"
  | "completed"
  | "awaiting_confirmation"
  | "paused"
  | "cancelled"
  | "blocked"
  | "due_today"
  | "skipped"
  | "current"
  | "unknown";

export type ClientActivity = {
  id: string;
  organisationId: string;
  organisationName?: string;
  title: string;
  description?: string;
  activityType: ClientActivityType;
  sourceEntityType: "record" | "task" | "checklist" | "tracker" | "follow_up" | "notification";
  sourceEntityId: string;
  relatedName?: string;
  date: string;
  time?: string;
  responsiblePerson?: string;
  priority?: "high" | "medium" | "low";
  status: ClientActivityStatus;
  nextAction?: string;
  route?: string;
};

export type ClientActivityTypeFilter = "all" | "records" | "tasks" | "checklist" | "follow_ups";
export type ClientActivityStatusFilter = "all" | "due" | "overdue" | "completed" | "awaiting" | "paused";

export type ClientActivityFilters = {
  activityType?: ClientActivityTypeFilter;
  status?: ClientActivityStatusFilter;
  responsiblePerson?: string;
};

export function filterClientActivities(
  activities: ClientActivity[],
  filters: ClientActivityFilters,
): ClientActivity[] {
  const activityType = filters.activityType || "all";
  const status = filters.status || "all";
  const responsiblePerson = filters.responsiblePerson || "all";
  return activities.filter((activity) => {
    const matchesType = activityType === "all" ||
      (activityType === "records" && activity.activityType === "record_expiry") ||
      (activityType === "tasks" && ["recurring_task", "assigned_task"].includes(activity.activityType)) ||
      (activityType === "checklist" && activity.activityType === "checklist_item") ||
      (activityType === "follow_ups" && ["record_follow_up", "follow_up", "released_notification"].includes(activity.activityType));
    const matchesStatus = status === "all" ||
      (status === "due" && ["due_today", "upcoming", "not_started", "in_progress", "accepted", "current"].includes(activity.status)) ||
      (status === "overdue" && ["overdue", "expired"].includes(activity.status)) ||
      (status === "completed" && activity.status === "completed") ||
      (status === "awaiting" && activity.status === "awaiting_confirmation") ||
      (status === "paused" && ["paused", "cancelled"].includes(activity.status));
    const matchesPerson = responsiblePerson === "all" || activity.responsiblePerson === responsiblePerson;
    return matchesType && matchesStatus && matchesPerson;
  });
}

const terminalStatuses = new Set<ClientActivityStatus>(["completed", "cancelled", "skipped"]);
const preservedStatuses = new Set<ClientActivityStatus>([
  "completed",
  "paused",
  "cancelled",
  "blocked",
  "in_progress",
  "awaiting_confirmation",
  "skipped",
]);

export function normalizeActivityStatus(value: string): ClientActivityStatus {
  const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (normalized === "expired") return "expired";
  if (["overdue", "failed"].includes(normalized)) return "overdue";
  if (["not_started", "notstart", "not_started_yet"].includes(normalized)) return "not_started";
  if (["upcoming", "scheduled"].includes(normalized)) return "upcoming";
  if (["in_progress", "inprogress"].includes(normalized)) return "in_progress";
  if (normalized === "accepted") return "accepted";
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

function isValidDateKey(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    businessDateKey(value) === value;
}

function scheduledStatus(
  rawStatus: string,
  date: string,
  today: string,
  isRecordExpiry = false,
): ClientActivityStatus {
  const status = normalizeActivityStatus(rawStatus);
  if (status === "accepted") return date.localeCompare(today) < 0 ? "overdue" : "accepted";
  if (preservedStatuses.has(status)) return status;

  const dateComparison = date.localeCompare(today);
  if (status === "expired") return isRecordExpiry ? "expired" : dateComparison < 0 ? "overdue" : "upcoming";
  if (status === "overdue" || dateComparison < 0) return isRecordExpiry ? "expired" : "overdue";
  if (dateComparison === 0) return "due_today";
  if (status === "not_started") return status;
  if (status === "current" && isRecordExpiry) return "current";
  return "upcoming";
}

function priority(value?: string): ClientActivity["priority"] {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "critical" || normalized === "high") return "high";
  if (normalized === "medium") return "medium";
  if (normalized === "low") return "low";
  return undefined;
}

function daysFrom(today: string, days: number): string {
  return shiftClientDate(today, days);
}

export function getClientActivities(
  data: ClientWorkspaceData,
  today = clientBusinessToday(),
): ClientActivity[] {
  const organisationId = data.organisation?.id || data.workspaceState.organisationId || data.authOrganisationId;
  if (!organisationId || !isValidDateKey(today)) return [];
  const organisationIds = new Set([organisationId, data.authOrganisationId].filter(Boolean));

  const records = data.records.filter((record) => organisationIds.has(record.organisationId));
  const recordById = new Map(records.map((record) => [record.id, record]));
  const people = new Map(data.workspaceState.people
    .filter((person) => organisationIds.has(person.organisationId))
    .map((person) => [person.id, person.name]));
  const trackers = new Map(data.workspaceState.trackers
    .filter((tracker) => organisationIds.has(tracker.organisationId))
    .map((tracker) => [tracker.id, tracker]));
  const tasks = new Map(data.tasks
    .filter((task) => organisationIds.has(task.organisationId) && task.clientVisible === true && task.status !== "archived")
    .map((task) => [task.id, task]));
  const activities: ClientActivity[] = [];

  for (const record of records) {
    const expiryDate = businessDateKey(record.expiryDate);
    if (expiryDate) {
      activities.push({
        id: `record-expiry:${record.id}`,
        organisationId,
        title: `Expiry: ${record.name}`,
        activityType: "record_expiry",
        sourceEntityType: "record",
        sourceEntityId: record.id,
        relatedName: record.name,
        date: expiryDate,
        responsiblePerson: record.contact || undefined,
        priority: priority(record.risk),
        status: scheduledStatus(record.status, expiryDate, today, true),
        nextAction: record.nextAction || "Review record expiry",
        route: `/client/records/${record.id}`,
      });
    }

    const followUpDate = businessDateKey(record.followUp);
    if (followUpDate) {
      activities.push({
        id: `record-follow-up:${record.id}`,
        organisationId,
        title: record.nextAction || `Follow up: ${record.name}`,
        activityType: "record_follow_up",
        sourceEntityType: "record",
        sourceEntityId: record.id,
        relatedName: record.name,
        date: followUpDate,
        responsiblePerson: record.contact || undefined,
        priority: priority(record.risk),
        status: scheduledStatus(record.status, followUpDate, today),
        nextAction: record.nextAction || "Follow up on this record",
        route: `/client/records/${record.id}`,
      });
    }
  }

  for (const occurrence of data.occurrences) {
    if (!organisationIds.has(occurrence.organisationId)) continue;
    const task = tasks.get(occurrence.recurringTaskId);
    if (!task) continue;
    const date = businessDateKey(occurrence.scheduledFor || occurrence.dueAt);
    if (!date) continue;
    const relatedRecord = task.linkedRecordId ? recordById.get(task.linkedRecordId) : undefined;
    const occurrenceStatus = scheduledStatus(occurrence.status, date, today);
    const taskStatus = terminalStatuses.has(occurrenceStatus)
      ? occurrenceStatus
      : task.status === "paused" || task.status === "cancelled"
        ? normalizeActivityStatus(task.status)
        : occurrenceStatus;
    activities.push({
      id: `occurrence:${occurrence.id}`,
      organisationId,
      title: task.name,
      activityType: "recurring_task",
      sourceEntityType: "task",
      sourceEntityId: task.id,
      relatedName: relatedRecord?.name,
      date,
      time: businessTimeKey(occurrence.dueAt) || task.dueTime || undefined,
      responsiblePerson: people.get(occurrence.ownerId || task.ownerId) || occurrence.ownerId || task.ownerId || undefined,
      priority: priority(task.priority),
      status: taskStatus,
      nextAction: taskStatus === "completed" ? "Completed" : taskStatus === "overdue" ? "Complete overdue task" : "Complete scheduled task",
      route: "/client/tasks",
    });
  }

  for (const task of data.assignedTasks) {
    if (
      !organisationIds.has(task.organisation_id) ||
      task.assigned_to !== data.userId ||
      task.status !== "accepted"
    ) continue;
    const date = businessDateKey(task.due_date || "");
    if (!date) continue;
    activities.push({
      id: `assigned-task:${task.id}`,
      organisationId,
      title: task.title,
      description: task.description || undefined,
      activityType: "assigned_task",
      sourceEntityType: "task",
      sourceEntityId: task.id,
      relatedName: "Company task assignment",
      date,
      responsiblePerson: data.team.find((member) => member.id === task.assigned_to)?.name || "You",
      priority: priority(task.priority),
      status: scheduledStatus(task.status, date, today),
      nextAction: task.response_note || "Accepted company assignment",
      route: "/client/work",
    });
  }

  for (const item of data.workspaceState.items) {
    if (!organisationIds.has(item.organisationId) || !trackers.has(item.trackerId)) continue;
    const date = businessDateKey(item.targetDate);
    if (!date) continue;
    const status = scheduledStatus(item.status, date, today);
    activities.push({
      id: `checklist:${item.id}`,
      organisationId,
      title: item.task,
      activityType: "checklist_item",
      sourceEntityType: "checklist",
      sourceEntityId: item.id,
      relatedName: trackers.get(item.trackerId)?.name,
      date,
      time: item.targetTime || undefined,
      responsiblePerson: item.responsiblePersonName || people.get(item.responsiblePersonId) || undefined,
      priority: priority(item.priority),
      status,
      nextAction: item.nextAction || (status === "completed" ? "Completed" : "Complete checklist item"),
      route: "/client/work-tracker",
    });
  }

  for (const notification of data.notifications) {
    if (!organisationIds.has(notification.organisationId) ||
      !["Sent", "Delivered"].includes(notification.deliveryStatus)) continue;
    const date = businessDateKey(notification.relevantDate);
    if (!date) continue;
    activities.push({
      id: `released-notification:${notification.id}`,
      organisationId,
      title: notification.subject,
      description: `${notification.deliveryStatus} client notification`,
      activityType: notification.type === "Follow-up" ? "follow_up" : "released_notification",
      sourceEntityType: "notification",
      sourceEntityId: notification.id,
      relatedName: notification.related,
      date,
      status: scheduledStatus("upcoming", date, today),
      nextAction: "Review notification",
      route: "/client/notifications",
    });
  }

  return activities.filter((activity) =>
    activity.organisationId === organisationId && isValidDateKey(activity.date)
  );
}

export function getActivitiesForDate(activities: ClientActivity[], date: string): ClientActivity[] {
  const dateKey = businessDateKey(date);
  if (!dateKey) return [];
  return activities.filter((activity) => isValidDateKey(activity.date) && activity.date === dateKey);
}

export function getActivitiesForMonth(
  activities: ClientActivity[],
  yearOrMonth: number | string,
  month?: number,
): ClientActivity[] {
  const monthKey = typeof yearOrMonth === "string"
    ? /^\d{4}-\d{2}$/.test(yearOrMonth) ? yearOrMonth : ""
    : Number.isInteger(month) && month! >= 1 && month! <= 12
      ? `${yearOrMonth}-${String(month).padStart(2, "0")}`
      : "";
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(monthKey)) return [];
  return activities.filter((activity) => isValidDateKey(activity.date) && activity.date.startsWith(`${monthKey}-`));
}

export function getActivitiesForWeek(activities: ClientActivity[], dateInWeek = clientBusinessToday()): ClientActivity[] {
  const dateKey = businessDateKey(dateInWeek);
  if (!dateKey) return [];
  const { start, end } = clientWeekRange(dateKey);
  if (!start || !end) return [];
  return activities.filter((activity) =>
    isValidDateKey(activity.date) && activity.date >= start && activity.date <= end
  );
}

export function getActivitiesForResponsiblePerson(
  activities: ClientActivity[],
  responsiblePerson: string,
): ClientActivity[] {
  const name = responsiblePerson.trim().toLocaleLowerCase();
  if (!name) return [];
  return activities.filter((activity) => activity.responsiblePerson?.trim().toLocaleLowerCase() === name);
}

export function getOverdueActivities(
  activities: ClientActivity[],
  today = clientBusinessToday(),
): ClientActivity[] {
  const todayKey = businessDateKey(today);
  if (!todayKey) return [];
  return activities.filter((activity) =>
    isValidDateKey(activity.date) &&
    activity.date < todayKey &&
    !terminalStatuses.has(activity.status) &&
    (activity.status === "overdue" || activity.status === "expired")
  );
}

export function getUpcomingRecordExpiries(
  activities: ClientActivity[],
  today = clientBusinessToday(),
  withinDays = 30,
): ClientActivity[] {
  const todayKey = businessDateKey(today);
  if (!todayKey || !Number.isInteger(withinDays) || withinDays < 0) return [];
  const endDate = daysFrom(todayKey, withinDays);
  if (!endDate) return [];
  return activities.filter((activity) =>
    activity.activityType === "record_expiry" &&
    isValidDateKey(activity.date) &&
    activity.date >= todayKey &&
    activity.date <= endDate &&
    activity.status !== "paused" &&
    activity.status !== "cancelled" &&
    activity.status !== "completed"
  );
}
