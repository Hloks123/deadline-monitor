import {
  RecurringTask,
  TaskOccurrence,
} from "./types";
import { addAuditEvent } from "@/lib/recordStore";
import { getClient } from "@/lib/clientStore";
import { getClientProfileStorageKey } from "@/lib/clientWorkspaceConstants";

const OCCURRENCES_KEY = "docmon_recurring_occurrences_v1";

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function createId(): string {
  return `occ_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 9)}`;
}

export function createOccurrenceKey(
  organisationId: string,
  recurringTaskId: string,
  scheduledFor: string
): string {
  return [
    organisationId,
    recurringTaskId,
    scheduledFor,
  ].join(":");
}

export function getOccurrences(): TaskOccurrence[] {
  if (!isBrowser()) {
    return [];
  }

  try {
    const stored = localStorage.getItem(getClientProfileStorageKey(OCCURRENCES_KEY));

    if (!stored) {
      return [];
    }

    const parsed = JSON.parse(stored);

    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveOccurrences(
  occurrences: TaskOccurrence[]
): void {
  if (!isBrowser()) {
    return;
  }

  localStorage.setItem(
    getClientProfileStorageKey(OCCURRENCES_KEY),
    JSON.stringify(occurrences)
  );
  window.dispatchEvent(new Event("deadline-monitor-updated"));
}

function logOccurrenceChange(
  occurrence: TaskOccurrence,
  action: string,
  previousValue: string,
  newValue: string,
  actor = "Prototype Consultant"
) {
  addAuditEvent({
    recordId: "",
    recordName: occurrence.recurringTaskName || occurrence.recurringTaskId,
    organisation: getClient(occurrence.organisationId)?.company || occurrence.organisationId,
    user: actor,
    action,
    field: "occurrence status",
    previousValue,
    newValue,
    entityType: "recurring task",
    entityId: occurrence.recurringTaskId,
    entityName: occurrence.recurringTaskName || occurrence.recurringTaskId,
    context: `Occurrence ${occurrence.id}, scheduled ${occurrence.scheduledFor}${occurrence.skippedReason ? `; reason: ${occurrence.skippedReason}` : ""}${occurrence.failureReason ? `; exception: ${occurrence.failureReason}` : ""}`,
  });
}

function occurrenceAction(status: TaskOccurrence["status"]) {
  switch (status) {
    case "in_progress": return "Recurring task started";
    case "completed": return "Recurring task completed";
    case "skipped": return "Recurring task skipped";
    case "failed": return "Recurring task failed";
    case "overdue": return "Recurring task occurrence overdue";
    default: return "Recurring task occurrence status changed";
  }
}

export function getOccurrenceById(
  id: string
): TaskOccurrence | undefined {
  return getOccurrences().find(
    (occurrence) => occurrence.id === id
  );
}

export function findOccurrenceByUniqueKey(
  uniqueKey: string
): TaskOccurrence | undefined {
  return getOccurrences().find(
    (occurrence) =>
      occurrence.uniqueKey === uniqueKey
  );
}

export function createOccurrence(
  task: RecurringTask,
  scheduledFor: string
): TaskOccurrence {
  const occurrences = getOccurrences();

  const uniqueKey = createOccurrenceKey(
    task.organisationId,
    task.id,
    scheduledFor
  );

  const existing = occurrences.find(
    (occurrence) =>
      occurrence.uniqueKey === uniqueKey
  );

  if (existing) {
    return existing;
  }

  const now = new Date().toISOString();

  const occurrence: TaskOccurrence = {
    id: createId(),

    recurringTaskId: task.id,
    recurringTaskName: task.name,

    organisationId: task.organisationId,

    scheduledFor,

    dueAt: createDueAt(
      scheduledFor,
      task.dueTime
    ),

    status: getInitialOccurrenceStatus(
      scheduledFor
    ),

    ownerId: task.ownerId,

    uniqueKey,

    retryCount: 0,

    createdAt: now,

    updatedAt: now,
  };

  occurrences.push(occurrence);

  saveOccurrences(occurrences);

  return occurrence;
}

function createDueAt(
  scheduledFor: string,
  dueTime?: string
): string {
  const time = dueTime || "17:00";

  return `${scheduledFor}T${time}:00`;
}

function getInitialOccurrenceStatus(
  scheduledFor: string
): TaskOccurrence["status"] {
  const date = new Date();
  const today = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

  if (scheduledFor === today) {
    return "due_today";
  }

  if (scheduledFor < today) {
    return "overdue";
  }

  return "upcoming";
}export function updateOccurrenceStatus(
  occurrenceId: string,
  status: TaskOccurrence["status"]
): TaskOccurrence | undefined {
  const occurrences = getOccurrences();

  const index = occurrences.findIndex(
    (occurrence) =>
      occurrence.id === occurrenceId
  );

  if (index === -1) {
    return undefined;
  }

  const existing = occurrences[index];

  const updated: TaskOccurrence = {
    ...existing,
    status,
    updatedAt: new Date().toISOString(),
  };

  occurrences[index] = updated;

  saveOccurrences(occurrences);
  logOccurrenceChange(updated, occurrenceAction(status), existing.status, status);

  return updated;
}export function startOccurrence(
  occurrenceId: string,
  actor?: string
): TaskOccurrence | undefined {
  const occurrences = getOccurrences();

  const index = occurrences.findIndex(
    (occurrence) =>
      occurrence.id === occurrenceId
  );

  if (index === -1) {
    return undefined;
  }

  const current = occurrences[index];
  const now = new Date().toISOString();

  const updated: TaskOccurrence = {
    ...current,
    status: "in_progress",
    startedAt: now,
    updatedAt: now,
  };

  occurrences[index] = updated;

  saveOccurrences(occurrences);
  logOccurrenceChange(updated, "Recurring task started", current.status, "in_progress", actor);

  return updated;
}

export function completeOccurrence(
  occurrenceId: string,
  completionEvidence?: string,
  actor?: string
): TaskOccurrence | undefined {
  const occurrences = getOccurrences();

  const index = occurrences.findIndex(
    (occurrence) =>
      occurrence.id === occurrenceId
  );

  if (index === -1) {
    return undefined;
  }

  const current = occurrences[index];
  const now = new Date().toISOString();

  const updated: TaskOccurrence = {
    ...current,
    status: "completed",
    completedAt: now,
    completionEvidence,
    updatedAt: now,
  };

  occurrences[index] = updated;

  saveOccurrences(occurrences);
  logOccurrenceChange(updated, "Recurring task completed", current.status, "completed", actor);

  return updated;
}

export function skipOccurrence(
  occurrenceId: string,
  reason: string,
  actor?: string
): TaskOccurrence | undefined {
  const occurrences = getOccurrences();

  const index = occurrences.findIndex(
    (occurrence) =>
      occurrence.id === occurrenceId
  );

  if (index === -1) {
    return undefined;
  }

  const current = occurrences[index];
  const updated: TaskOccurrence = {
    ...current,
    status: "skipped",
    skippedReason: reason,
    updatedAt: new Date().toISOString(),
  };

  occurrences[index] = updated;

  saveOccurrences(occurrences);
  logOccurrenceChange(updated, "Recurring task skipped", current.status, `skipped: ${reason}`, actor);

  return updated;
}

export function failOccurrence(
  occurrenceId: string,
  reason: string
): TaskOccurrence | undefined {
  const occurrences = getOccurrences();

  const index = occurrences.findIndex(
    (occurrence) =>
      occurrence.id === occurrenceId
  );

  if (index === -1) {
    return undefined;
  }

  const current = occurrences[index];

  const updated: TaskOccurrence = {
    ...current,
    status: "failed",
    failureReason: reason,
    updatedAt: new Date().toISOString(),
  };

  occurrences[index] = updated;

  saveOccurrences(occurrences);
  logOccurrenceChange(updated, "Recurring task failed", current.status, `failed: ${reason}`);

  return updated;
}

export function markOverdueOccurrences(): TaskOccurrence[] {
  const occurrences = getOccurrences();

  const now = new Date();

  const updatedOccurrences = occurrences.map(
    (occurrence) => {
      const dueDate = new Date(occurrence.dueAt);

      const shouldBeOverdue =
        dueDate < now &&
        occurrence.status !== "overdue" &&
        occurrence.status !== "completed" &&
        occurrence.status !== "skipped" &&
        occurrence.status !== "cancelled" &&
        occurrence.status !== "failed";

      if (!shouldBeOverdue) {
        return occurrence;
      }

      const updated = {
        ...occurrence,
        status: "overdue" as const,
        updatedAt: now.toISOString(),
      };
      logOccurrenceChange(updated, occurrenceAction("overdue"), occurrence.status, "overdue");
      return updated;
    }
  );

  saveOccurrences(updatedOccurrences);

  return updatedOccurrences;
}

export function retryOccurrence(
  occurrenceId: string
): TaskOccurrence | undefined {
  const occurrences = getOccurrences();

  const index = occurrences.findIndex(
    (occurrence) =>
      occurrence.id === occurrenceId
  );

  if (index === -1) {
    return undefined;
  }

  const current = occurrences[index];

  if (current.status !== "failed") {
    return current;
  }

  const updated: TaskOccurrence = {
    ...current,
    status: "in_progress",
    failureReason: undefined,
    retryCount: current.retryCount + 1,
    updatedAt: new Date().toISOString(),
  };

  occurrences[index] = updated;

  saveOccurrences(occurrences);

  logOccurrenceChange(updated, "Recurring task started", current.status, "in_progress");
  return updated;
}