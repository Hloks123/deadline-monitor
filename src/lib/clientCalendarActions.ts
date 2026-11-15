import {
  getClientWorkspaceOrganisation,
  getClientWorkspaceRecords,
  scheduleClientRecordFollowUp,
  saveClientRecord,
  type ClientRecordInput,
} from "@/lib/clientWorkspace";
import {
  getClientWorkspaceState,
  saveChecklistItem,
  saveWorkTracker,
  type TrackerPeriod,
  type WorkPriority,
} from "@/lib/clientWorkspaceStore";
import { CLIENT_WORKSPACE_ORGANISATION_ID, CLIENT_WORKSPACE_USER } from "@/lib/clientWorkspaceConstants";
import { addAuditEvent } from "@/lib/recordStore";
import { generateOccurrences, saveRecurringTask } from "@/lib/recurringTasks/taskStore";
import type { RecurrenceRule, RecurringTaskInput, TaskPriority } from "@/lib/recurringTasks/types";

export type CalendarRecurrenceChoice =
  | "once"
  | "daily"
  | "selected_weekdays"
  | "weekly"
  | "monthly"
  | "quarterly"
  | "annually"
  | "custom";

export function isValidCalendarDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return date.getUTCFullYear() === Number(year) &&
    date.getUTCMonth() === Number(month) - 1 &&
    date.getUTCDate() === Number(day);
}

export function isValidCalendarTime(value: string): boolean {
  return value === "" || /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function buildCalendarRecurrence(
  choice: CalendarRecurrenceChoice,
  date: string,
  weekdays: number[],
  customInterval: number,
  customUnit: NonNullable<RecurrenceRule["intervalUnit"]>,
): RecurrenceRule | undefined {
  if (!isValidCalendarDate(date)) return undefined;
  const day = Number(date.slice(-2));
  switch (choice) {
    case "once":
      return { frequency: "once" };
    case "daily":
      return { frequency: "daily" };
    case "selected_weekdays": {
      const uniqueDays = [...new Set(weekdays)];
      if (!uniqueDays.length || uniqueDays.some((weekday) => !Number.isInteger(weekday) || weekday < 0 || weekday > 6)) return undefined;
      return { frequency: "weekly", weekdays: uniqueDays.sort((left, right) => left - right) };
    }
    case "weekly": {
      const [year, month] = date.split("-").map(Number);
      const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
      return { frequency: "weekly", weekdays: [weekday] };
    }
    case "monthly":
      return { frequency: "monthly", dayOfMonth: day };
    case "quarterly":
      return { frequency: "quarterly" };
    case "annually":
      return { frequency: "annually" };
    case "custom":
      if (!Number.isInteger(customInterval) || customInterval < 1 || customInterval > 365) return undefined;
      return { frequency: "custom", interval: customInterval, intervalUnit: customUnit };
  }
}

function isValidRecurrenceRule(rule: RecurrenceRule, date: string): boolean {
  if (!isValidCalendarDate(date)) return false;
  switch (rule.frequency) {
    case "once":
    case "daily":
    case "weekdays":
    case "quarterly":
    case "annually":
    case "month_end":
      return true;
    case "weekly":
      return Array.isArray(rule.weekdays) &&
        rule.weekdays.length > 0 &&
        rule.weekdays.every((weekday) => Number.isInteger(weekday) && weekday >= 0 && weekday <= 6) &&
        new Set(rule.weekdays).size === rule.weekdays.length;
    case "monthly":
      return Number.isInteger(rule.dayOfMonth) && (rule.dayOfMonth || 0) >= 1 && (rule.dayOfMonth || 0) <= 31;
    case "custom":
      return Number.isInteger(rule.interval) &&
        (rule.interval || 0) >= 1 &&
        (rule.interval || 0) <= 365 &&
        ["day", "week", "month", "year"].includes(rule.intervalUnit || "");
  }
}

function auditCalendarCreation(
  action: string,
  entityType: string,
  entityId: string,
  entityName: string,
  value: unknown,
  recordId = "",
) {
  addAuditEvent({
    recordId,
    recordName: entityName,
    organisation: getClientWorkspaceOrganisation()?.company || CLIENT_WORKSPACE_ORGANISATION_ID,
    user: CLIENT_WORKSPACE_USER,
    action,
    field: "",
    previousValue: "",
    newValue: JSON.stringify(value),
    entityType,
    entityId,
    entityName,
    context: "Created from the Client Calendar using the existing canonical workspace entity.",
  });
}

export type CalendarTaskInput = {
  name: string;
  responsiblePersonId: string;
  date: string;
  time: string;
  priority: TaskPriority;
  relatedRecordId: string;
  recurrence: RecurrenceRule;
  notes: string;
  requiresCompletionEvidence: boolean;
};

export function createCalendarTask(input: CalendarTaskInput) {
  const state = getClientWorkspaceState();
  const person = state.people.find((candidate) =>
    candidate.id === input.responsiblePersonId &&
    candidate.organisationId === CLIENT_WORKSPACE_ORGANISATION_ID &&
    candidate.active,
  );
  const relatedRecord = input.relatedRecordId
    ? getClientWorkspaceRecords().find((record) => record.id === input.relatedRecordId)
    : undefined;

  if (!input.name.trim() || input.name.trim().length > 120) return { success: false as const, message: "Enter a task name up to 120 characters." };
  if (!isValidCalendarDate(input.date)) return { success: false as const, message: "Choose a valid task date." };
  if (!isValidCalendarTime(input.time)) return { success: false as const, message: "Enter a valid time in 24-hour HH:MM format." };
  if (!person) return { success: false as const, message: "Choose an active responsible person in this organisation." };
  if (input.relatedRecordId && !relatedRecord) return { success: false as const, message: "Choose a monitored record from this organisation." };
  if (!isValidRecurrenceRule(input.recurrence, input.date)) return { success: false as const, message: "Choose a valid recurrence rule." };
  if (input.notes.length > 500) return { success: false as const, message: "Notes must be 500 characters or fewer." };
  if (!["low", "medium", "high", "critical"].includes(input.priority)) return { success: false as const, message: "Choose a valid task priority." };

  const taskInput: RecurringTaskInput = {
    organisationId: CLIENT_WORKSPACE_ORGANISATION_ID,
    name: input.name.trim(),
    description: input.notes.trim() || undefined,
    linkedRecordId: relatedRecord?.id,
    ownerId: person.id,
    priority: input.priority,
    startDate: input.date,
    dueTime: input.time || undefined,
    timezone: "Africa/Johannesburg",
    recurrence: input.recurrence,
    escalationRule: { enabled: false, afterDays: 2 },
    requiresCompletionEvidence: input.requiresCompletionEvidence,
    requiresConsultantReview: false,
    clientVisible: true,
    clientCanSkip: false,
    status: "active",
  };
  const task = saveRecurringTask(taskInput);
  const occurrenceStart = new Date(`${input.date}T00:00:00`);
  const occurrenceEnd = new Date(occurrenceStart);
  occurrenceEnd.setDate(occurrenceEnd.getDate() + 30);
  const occurrences = generateOccurrences([task], occurrenceStart, occurrenceEnd);
  auditCalendarCreation("Task created from Calendar", "recurring task", task.id, task.name, {
    task,
    occurrenceIds: occurrences.map((occurrence) => occurrence.id),
  });
  return { success: true as const, task, occurrences };
}

export function createCalendarRecord(input: ClientRecordInput) {
  const result = saveClientRecord(input);
  if (!result.success) return result;
  auditCalendarCreation(
    "Record created from Calendar",
    "record",
    result.record.id,
    result.record.name,
    result.record,
    result.record.id,
  );
  return result;
}

export type CalendarChecklistInput = {
  name: string;
  responsiblePersonId: string;
  date: string;
  time: string;
  priority: WorkPriority;
  trackerId: string;
  newTrackerName: string;
  newTrackerPeriod: TrackerPeriod;
  trackerStartDate: string;
  trackerEndDate: string;
  notes: string;
  nextAction: string;
};

export function createCalendarChecklistItem(input: CalendarChecklistInput) {
  const state = getClientWorkspaceState();
  const person = state.people.find((candidate) =>
    candidate.id === input.responsiblePersonId &&
    candidate.organisationId === CLIENT_WORKSPACE_ORGANISATION_ID &&
    candidate.active,
  );
  if (!input.name.trim() || input.name.trim().length > 120) return { success: false as const, message: "Enter a checklist item name up to 120 characters." };
  if (!isValidCalendarDate(input.date)) return { success: false as const, message: "Choose a valid checklist date." };
  if (!isValidCalendarTime(input.time)) return { success: false as const, message: "Enter a valid time in 24-hour HH:MM format." };
  if (!person) return { success: false as const, message: "Choose an active responsible person in this organisation." };
  if (input.notes.length > 500) return { success: false as const, message: "Notes must be 500 characters or fewer." };

  let trackerId = input.trackerId;
  if (trackerId) {
    if (!state.trackers.some((tracker) => tracker.id === trackerId && tracker.organisationId === CLIENT_WORKSPACE_ORGANISATION_ID && tracker.status !== "Archived")) {
      return { success: false as const, message: "Choose an active tracker in this organisation." };
    }
  } else {
    if (!input.newTrackerName.trim()) return { success: false as const, message: "Select a tracker or enter a name to create one." };
    if (!isValidCalendarDate(input.trackerStartDate) || !isValidCalendarDate(input.trackerEndDate) || input.trackerStartDate > input.trackerEndDate) {
      return { success: false as const, message: "Choose valid tracker dates where the start is not after the end." };
    }
    const trackerResult = saveWorkTracker({
      name: input.newTrackerName.trim(),
      description: "Created from the Client Calendar.",
      periodType: input.newTrackerPeriod,
      startDate: input.trackerStartDate,
      endDate: input.trackerEndDate,
      ownerId: person.id,
      reminderPreference: "In-app only",
      status: "Active",
    });
    if (!trackerResult.success) return trackerResult;
    trackerId = trackerResult.tracker.id;
  }

  const result = saveChecklistItem({
    trackerId,
    task: input.name.trim(),
    responsiblePersonId: person.id,
    targetDate: input.date,
    targetTime: input.time || undefined,
    status: "Not Started",
    priority: input.priority,
    progressNotes: input.notes.trim() || undefined,
    nextAction: input.nextAction.trim() || undefined,
    completionEvidence: undefined,
    reminderPreference: "In-app only",
    clientCanSkip: false,
  });
  if (!result.success) return result;
  auditCalendarCreation("Checklist item created from Calendar", "checklist item", result.item.id, result.item.task, result.item);
  return result;
}

export function createCalendarFollowUp(input: {
  recordId: string;
  title: string;
  date: string;
}) {
  if (!isValidCalendarDate(input.date)) return { success: false as const, message: "Choose a valid follow-up date." };
  if (!input.title.trim() || input.title.trim().length > 160) return { success: false as const, message: "Enter a follow-up name up to 160 characters." };
  return scheduleClientRecordFollowUp({
    recordId: input.recordId,
    date: input.date,
    title: input.title.trim(),
  });
}
