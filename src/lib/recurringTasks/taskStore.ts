import { addAuditEvent } from "@/lib/recordStore";
import { getClient } from "@/lib/clientStore";
import {
  RecurringTask,
  RecurringTaskInput,
  TaskOccurrence,
} from "./types";
import {
  completeOccurrence,
  createOccurrence,
  createOccurrenceKey,
  failOccurrence,
  getOccurrences,
  markOverdueOccurrences,
} from "./occurrenceService";
import { shouldGenerateOccurrence } from "./recurrenceEngine";
import { getClientProfileStorageKey } from "@/lib/clientWorkspaceConstants";

const TASKS_KEY = "docmon_recurring_tasks_v1";
const DEMO_OWNER = "Prototype Consultant";

function isBrowser() {
  return typeof window !== "undefined";
}

function dispatchUpdate() {
  if (isBrowser()) {
    window.dispatchEvent(new Event("deadline-monitor-updated"));
  }
}

export function getRecurringTasks(): RecurringTask[] {
  if (!isBrowser()) return [];
  try {
    const stored = localStorage.getItem(getClientProfileStorageKey(TASKS_KEY));
    if (!stored) return [];
    const parsed: unknown = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed as RecurringTask[] : [];
  } catch (error) {
    console.error("Could not read recurring tasks from local storage.", error);
    return [];
  }
}

function saveTasks(tasks: RecurringTask[]) {
  if (!isBrowser()) return;
  localStorage.setItem(getClientProfileStorageKey(TASKS_KEY), JSON.stringify(tasks));
  dispatchUpdate();
}

export function getRecurringTask(id: string) {
  return getRecurringTasks().find((task) => task.id === id);
}

export function saveRecurringTask(input: RecurringTaskInput, id?: string) {
  const tasks = getRecurringTasks();
  const existing = id ? tasks.find((task) => task.id === id) : undefined;
  const now = new Date().toISOString();
  const task: RecurringTask = {
    ...input,
    id: existing?.id ?? `task-${crypto.randomUUID()}`,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  saveTasks(existing
    ? tasks.map((item) => item.id === task.id ? task : item)
    : [...tasks, task]);

  const organisation = getClient(task.organisationId)?.company || task.organisationId;
  const log = (action: string, field: string, previousValue: string, newValue: string) => {
    addAuditEvent({
      recordId: "",
      recordName: task.name,
      organisation,
      user: DEMO_OWNER,
      action,
      field,
      previousValue,
      newValue,
      entityType: "recurring task",
      entityId: task.id,
      entityName: task.name,
      context: `Organisation ID: ${task.organisationId}`,
    });
  };

  if (!existing) {
    log("Recurring task created", "task", "", JSON.stringify(task));
  } else {
    log("Recurring task edited", "task", JSON.stringify(existing), JSON.stringify(task));
    if (JSON.stringify(existing.recurrence) !== JSON.stringify(task.recurrence) ||
      existing.startDate !== task.startDate || existing.dueTime !== task.dueTime ||
      existing.timezone !== task.timezone) {
      log("Recurring task schedule changed", "schedule",
        JSON.stringify({ startDate: existing.startDate, dueTime: existing.dueTime, timezone: existing.timezone, recurrence: existing.recurrence }),
        JSON.stringify({ startDate: task.startDate, dueTime: task.dueTime, timezone: task.timezone, recurrence: task.recurrence }));
    }
    if (existing.ownerId !== task.ownerId) {
      log("Recurring task owner changed", "owner", existing.ownerId, task.ownerId);
    }
    if (existing.reviewerId !== task.reviewerId) {
      log("Recurring task reviewer changed", "reviewer", existing.reviewerId || "", task.reviewerId || "");
    }
  }
  return task;
}

export function setRecurringTaskStatus(
  id: string,
  status: RecurringTask["status"]
) {
  const task = getRecurringTask(id);
  if (!task) return undefined;
  const updated = { ...task, status, updatedAt: new Date().toISOString() };
  saveTasks(getRecurringTasks().map((item) => item.id === id ? updated : item));
  addAuditEvent({
    recordId: "",
    recordName: task.name,
    organisation: getClient(task.organisationId)?.company || task.organisationId,
    user: "Prototype Consultant",
    action: status === "active"
      ? "Recurring task resumed"
      : status === "paused"
        ? "Recurring task paused"
        : "Recurring task cancelled",
    field: "status",
    previousValue: task.status,
    newValue: status,
    entityType: "recurring task",
    entityId: task.id,
    entityName: task.name,
    context: `Organisation ID: ${task.organisationId}`,
  });
  return updated;
}

function localDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function seedDemoRecurringTasksIfEmpty(): void {
  if (!isBrowser()) return;

  const stored = localStorage.getItem(TASKS_KEY);
  if (stored) {
    try {
      const parsed: unknown = JSON.parse(stored);
      if (!Array.isArray(parsed) || parsed.length > 0) return;
    } catch (error) {
      console.error("Could not read recurring tasks; demo tasks were not seeded.", error);
      return;
    }
  }
  if (getRecurringTasks().length > 0) return;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const todayKey = localDateKey(today);
  const yesterdayKey = localDateKey(yesterday);
  const tomorrowKey = localDateKey(tomorrow);

  const base = {
    ownerId: "Demo task owner",
    reviewerId: "Demo task reviewer",
    priority: "medium" as const,
    dueTime: "17:00",
    timezone: "Africa/Johannesburg",
    escalationRule: { enabled: true, afterDays: 2 },
    requiresCompletionEvidence: false,
    requiresConsultantReview: true,
    status: "active" as const,
  };
  const tasks = [
    saveRecurringTask({
      ...base,
      organisationId: "demo-construction",
      name: "Monthly CIPC status review",
      startDate: todayKey,
      recurrence: { frequency: "monthly", dayOfMonth: tomorrow.getDate() },
      clientVisible: true,
      clientCanSkip: true,
      requiresCompletionEvidence: true,
    }),
    saveRecurringTask({
      ...base,
      organisationId: "sample-logistics",
      name: "Outstanding client follow-up",
      startDate: todayKey,
      recurrence: { frequency: "weekly", weekdays: [today.getDay()] },
    }),
    saveRecurringTask({
      ...base,
      organisationId: "example-property",
      name: "Annual insurance review",
      startDate: yesterdayKey,
      recurrence: { frequency: "annually" },
    }),
    saveRecurringTask({
      ...base,
      dueTime: "23:59",
      organisationId: "example-services",
      name: "Daily failed-notification review",
      startDate: yesterdayKey,
      recurrence: { frequency: "daily" },
    }),
  ];

  createOccurrence(tasks[0], tomorrowKey);
  const followUp = createOccurrence(tasks[1], todayKey);
  completeOccurrence(followUp.id, "Prototype follow-up completed.");
  createOccurrence(tasks[2], yesterdayKey);
  setRecurringTaskStatus(tasks[2].id, "paused");
  const notificationYesterday = createOccurrence(tasks[3], yesterdayKey);
  failOccurrence(notificationYesterday.id, "Fictional prototype notification failure.");
  createOccurrence(tasks[3], todayKey);
}

export function generateOccurrences(
  tasks: RecurringTask[],
  from: Date,
  through: Date
): TaskOccurrence[] {
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const end = new Date(through.getFullYear(), through.getMonth(), through.getDate());
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    throw new Error("Occurrence range is invalid.");
  }

  const generated: TaskOccurrence[] = [];
  const existingKeys = new Set(
    getOccurrences().map((occurrence) => occurrence.uniqueKey)
  );
  for (const task of tasks) {
    if (task.status !== "active") continue;
    for (const date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
      if (!shouldGenerateOccurrence(task, date)) continue;
      const scheduledFor = [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, "0"),
        String(date.getDate()).padStart(2, "0"),
      ].join("-");
      const uniqueKey = createOccurrenceKey(task.organisationId, task.id, scheduledFor);
      if (existingKeys.has(uniqueKey)) continue;
      generated.push(createOccurrence(task, scheduledFor));
      existingKeys.add(uniqueKey);
    }
  }
  markOverdueOccurrences();
  return generated;
}
