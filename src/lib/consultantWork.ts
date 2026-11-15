import { getActiveClients, type Client } from "@/lib/clientStore";
import { getAuditEvents, getRecords, type AuditEvent, type MonitoredRecord } from "@/lib/recordStore";
import { businessDateKey, clientBusinessToday, compareClientDateKeys } from "@/lib/clientWorkspaceSelectors";
import { getAllClientWorkspaceEntries, type ChecklistItem, type WorkTracker } from "@/lib/clientWorkspaceStore";
import { getOccurrences } from "@/lib/recurringTasks/occurrenceService";
import { getRecurringTasks } from "@/lib/recurringTasks/taskStore";
import type { RecurringTask, TaskOccurrence } from "@/lib/recurringTasks/types";

export type ConsultantWorkItem = {
  id: string;
  organisationId: string;
  organisation: string;
  task: string;
  related: string;
  responsible: string;
  dueDate: string;
  dueTime: string;
  priority: string;
  status: string;
  source: string;
  kind: "recurring" | "checklist" | "record";
  completedDate: string;
  completionEvidence: string;
  nextAction: string;
  occurrence?: TaskOccurrence;
};

export type ConsultantChecklist = WorkTracker & {
  organisation: string;
  owner: string;
  items: ChecklistItem[];
  completedCount: number;
  overdueCount: number;
};

export type ConsultantRecurringSchedule = {
  task: RecurringTask;
  organisation: string;
  owner: string;
  related: string;
  repeats: string;
  lastRun: string;
  nextRun: string;
  jobHealth: string;
  lastOccurrence?: TaskOccurrence;
  nextOccurrence?: TaskOccurrence;
};

export type ConsultantException = {
  id: string;
  severity: "Critical" | "High" | "Medium" | "Low";
  organisationId: string;
  organisation: string;
  issue: string;
  related: string;
  responsible: string;
  date: string;
  nextAction: string;
  status: string;
};

export type ConsultantWorkSnapshot = {
  organisations: Array<{ id: string; name: string }>;
  people: Array<{ id: string; organisationId: string; name: string }>;
  tasks: ConsultantWorkItem[];
  checklists: ConsultantChecklist[];
  recurring: ConsultantRecurringSchedule[];
  completed: ConsultantWorkItem[];
  exceptions: ConsultantException[];
};

type Directory = Pick<ReturnType<typeof getAllClientWorkspaceEntries>, "people" | "trackers" | "items">;

function entityKey(organisationId: string, id: string) {
  return `${organisationId}:${id}`;
}

function recurrenceLabel(task: RecurringTask) {
  const { frequency, weekdays, interval, intervalUnit, dayOfMonth } = task.recurrence;
  switch (frequency) {
    case "once": return "Does not repeat";
    case "daily": return "Daily";
    case "weekdays": return "Weekdays";
    case "weekly": return weekdays?.length ? `Weekly · ${weekdays.map((day) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][day]).join(", ")}` : "Weekly";
    case "monthly": return `Monthly · day ${dayOfMonth || "—"}`;
    case "month_end": return "Month-end";
    case "quarterly": return "Quarterly";
    case "annually": return "Annually";
    case "custom": return `Every ${interval || 1} ${intervalUnit || "week"}${(interval || 1) === 1 ? "" : "s"}`;
  }
}

function isClosed(status: TaskOccurrence["status"]) {
  return ["completed", "skipped", "cancelled"].includes(status);
}

function occurrenceStatus(occurrence: TaskOccurrence, today: string) {
  if (!isClosed(occurrence.status) && occurrence.status !== "failed" && occurrence.status !== "overdue" &&
    compareClientDateKeys(businessDateKey(occurrence.scheduledFor || occurrence.dueAt), today) < 0) {
    return "Overdue";
  }
  const labels: Record<TaskOccurrence["status"], string> = {
    upcoming: "Upcoming",
    due_today: "Due today",
    in_progress: "In progress",
    completed: "Completed",
    skipped: "Skipped",
    failed: "Failed",
    overdue: "Overdue",
    cancelled: "Cancelled",
  };
  return labels[occurrence.status];
}

function checklistItemStatus(item: ChecklistItem, today: string) {
  if (["Completed", "Skipped", "Carry Forward", "Blocked", "Awaiting Confirmation", "In Progress"].includes(item.status)) return item.status;
  if (compareClientDateKeys(businessDateKey(item.targetDate), today) < 0) return "Overdue";
  return item.status;
}

function ownerName(
  organisationId: string,
  ownerId: string,
  people: Array<{ id: string; organisationId: string; name: string }>,
) {
  return people.find((person) => person.id === ownerId && person.organisationId === organisationId)?.name || ownerId || "Unassigned";
}

function rowForOccurrence(
  occurrence: TaskOccurrence,
  task: RecurringTask,
  organisation: string,
  record: MonitoredRecord | undefined,
  people: Array<{ id: string; organisationId: string; name: string }>,
  source: string,
  today: string,
): ConsultantWorkItem {
  const dueDate = businessDateKey(occurrence.scheduledFor || occurrence.dueAt);
  return {
    id: `occurrence:${entityKey(occurrence.organisationId, occurrence.id)}`,
    organisationId: occurrence.organisationId,
    organisation,
    task: task.name,
    related: record?.name || "—",
    responsible: ownerName(task.organisationId, occurrence.ownerId || task.ownerId, people),
    dueDate,
    dueTime: occurrence.dueAt.includes("T") ? occurrence.dueAt.slice(11, 16) : task.dueTime || "",
    priority: task.priority,
    status: occurrenceStatus(occurrence, today),
    source,
    kind: "recurring",
    completedDate: businessDateKey(occurrence.completedAt),
    completionEvidence: occurrence.completionEvidence || "",
    nextAction: occurrence.failureReason || occurrence.skippedReason || (occurrence.status === "failed" ? "Review failed occurrence" : ""),
    occurrence,
  };
}

function recordActionRows(records: MonitoredRecord[], organisationNames: Map<string, string>, today: string): ConsultantWorkItem[] {
  return records.flatMap((record) => {
    const expiry = businessDateKey(record.expiryDate);
    const expired = (record.status === "Expired" || Boolean(expiry && compareClientDateKeys(expiry, today) < 0)) &&
      !["Completed", "Paused"].includes(record.status);
    const followUp = businessDateKey(record.followUp);
    if (!expired && !followUp) return [];
    const dueDate = expired ? expiry : followUp;
    return [{
      id: `record:${entityKey(record.organisationId, record.id)}:${dueDate}`,
      organisationId: record.organisationId,
      organisation: organisationNames.get(record.organisationId) || record.organisation || record.organisationId,
      task: expired ? `Expired record: ${record.name}` : record.nextAction || `Follow up: ${record.name}`,
      related: record.name,
      responsible: record.contact || "Unassigned",
      dueDate,
      dueTime: "",
      priority: record.risk,
      status: expired ? "Overdue" : compareClientDateKeys(dueDate, today) < 0 ? "Overdue" : "Upcoming",
      source: "Record action",
      kind: "record" as const,
      completedDate: "",
      completionEvidence: "",
      nextAction: record.nextAction || (expired ? "Review expired monitored record" : "Review record follow-up"),
    }];
  });
}

function exception(
  id: string,
  severity: ConsultantException["severity"],
  organisationId: string,
  organisation: string,
  issue: string,
  related: string,
  responsible: string,
  date: string,
  nextAction: string,
  status: string,
): ConsultantException {
  return { id, severity, organisationId, organisation, issue, related, responsible, date, nextAction, status };
}

export function buildConsultantWorkSnapshot(input: {
  clients: Client[];
  canonicalOrganisations?: Array<{ id: string; name: string }>;
  records: MonitoredRecord[];
  tasks: RecurringTask[];
  occurrences: TaskOccurrence[];
  auditEvents: AuditEvent[];
  directory: Directory;
  today?: string;
}): ConsultantWorkSnapshot {
  const today = input.today || clientBusinessToday();
  const activeClients = input.clients.filter((client) => client.status !== "Suspended");
  const organisations = [
    ...activeClients.map((client) => ({ id: client.id, name: client.company })),
    ...(input.canonicalOrganisations || []),
  ].filter((organisation, index, list) =>
    list.findIndex((other) => other.id === organisation.id) === index,
  );
  const activeIds = new Set(organisations.map((organisation) => organisation.id));
  const organisationNames = new Map(organisations.map((organisation) => [organisation.id, organisation.name]));
  const records = input.records.filter((record) => activeIds.has(record.organisationId));
  const tasks = input.tasks.filter((task) => activeIds.has(task.organisationId));
  const occurrences = input.occurrences.filter((occurrence) => activeIds.has(occurrence.organisationId));
  const clientCreatedTaskKeys = new Set(input.auditEvents.flatMap((event) => {
    if (event.action !== "Task created from Calendar" || event.entityType !== "recurring task" || !event.entityId) return [];
    try {
      const payload = JSON.parse(event.newValue) as { task?: { organisationId?: string } };
      return payload.task?.organisationId
        ? [entityKey(payload.task.organisationId, event.entityId)]
        : [];
    } catch (error) {
      console.error("Could not verify organisation for a client-created task audit event.", error);
      return [];
    }
  }));
  const trackers = input.directory.trackers.filter((tracker) => activeIds.has(tracker.organisationId));
  const checklistItems = input.directory.items.filter((item) => activeIds.has(item.organisationId));
  const people = [
    ...input.directory.people
      .filter((person) => activeIds.has(person.organisationId))
      .map((person) => ({ id: person.id, organisationId: person.organisationId, name: person.name })),
    ...activeClients.flatMap((client) => client.contacts
      .filter((contact) => contact.authorised)
      .map((contact) => ({ id: contact.id, organisationId: client.id, name: contact.name }))),
  ].filter((person, index, list) => list.findIndex((other) =>
    other.id === person.id && other.organisationId === person.organisationId
  ) === index);

  const recordsById = new Map(records.map((record) => [entityKey(record.organisationId, record.id), record]));
  const tasksById = new Map(tasks.map((task) => [entityKey(task.organisationId, task.id), task]));
  const occurrencesByTask = new Map<string, TaskOccurrence[]>();
  for (const occurrence of occurrences) {
    const relatedTask = tasksById.get(entityKey(occurrence.organisationId, occurrence.recurringTaskId));
    if (!relatedTask || relatedTask.organisationId !== occurrence.organisationId) continue;
    const taskKey = entityKey(occurrence.organisationId, occurrence.recurringTaskId);
    occurrencesByTask.set(taskKey, [
      ...(occurrencesByTask.get(taskKey) || []),
      occurrence,
    ]);
  }

  const workRows = occurrences.flatMap((occurrence) => {
    const task = tasksById.get(entityKey(occurrence.organisationId, occurrence.recurringTaskId));
    if (!task || task.organisationId !== occurrence.organisationId) return [];
    const row = rowForOccurrence(
      occurrence,
      task,
      organisationNames.get(task.organisationId) || task.organisationId,
      task.linkedRecordId ? recordsById.get(entityKey(task.organisationId, task.linkedRecordId)) : undefined,
      people,
      clientCreatedTaskKeys.has(entityKey(task.organisationId, task.id)) ? "Client-created" : "Recurring",
      today,
    );
    return [row];
  });

  const trackerNames = new Map(trackers.map((tracker) => [tracker.id, tracker.name]));
  const checklistRows: ConsultantWorkItem[] = checklistItems.map((item) => {
    const status = checklistItemStatus(item, today);
    return {
      id: `checklist:${entityKey(item.organisationId, item.id)}`,
      organisationId: item.organisationId,
      organisation: organisationNames.get(item.organisationId) || item.organisationId,
      task: item.task,
      related: trackerNames.get(item.trackerId) || "Work tracker",
      responsible: item.responsiblePersonName || ownerName(item.organisationId, item.responsiblePersonId, people),
      dueDate: businessDateKey(item.targetDate),
      dueTime: item.targetTime || "",
      priority: item.priority,
      status,
      source: "Checklist",
      kind: "checklist",
      completedDate: businessDateKey(item.completedDate),
      completionEvidence: item.completionEvidence || "",
      nextAction: item.nextAction || "",
    };
  });
  const recordRows = recordActionRows(records, organisationNames, today);
  const work = [...workRows, ...checklistRows, ...recordRows].sort((left, right) =>
    left.dueDate.localeCompare(right.dueDate) || left.dueTime.localeCompare(right.dueTime) || left.task.localeCompare(right.task)
  );
  const completed = work.filter((row) => row.status === "Completed");

  const checklists: ConsultantChecklist[] = trackers.map((tracker) => {
    const items = checklistItems.filter((item) => item.trackerId === tracker.id && item.organisationId === tracker.organisationId);
    return {
      ...tracker,
      organisation: organisationNames.get(tracker.organisationId) || tracker.organisationId,
      owner: ownerName(tracker.organisationId, tracker.ownerId, people),
      items,
      completedCount: items.filter((item) => item.status === "Completed").length,
      overdueCount: items.filter((item) => checklistItemStatus(item, today) === "Overdue").length,
    };
  }).sort((left, right) => left.startDate.localeCompare(right.startDate));

  const recurring = tasks.map((task) => {
    const taskKey = entityKey(task.organisationId, task.id);
    const taskOccurrences = occurrencesByTask.get(taskKey) || [];
    const sorted = [...taskOccurrences].sort((left, right) => left.scheduledFor.localeCompare(right.scheduledFor));
    const lastOccurrence = [...sorted].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];
    const nextOccurrence = sorted.find((occurrence) => !isClosed(occurrence.status) &&
      compareClientDateKeys(businessDateKey(occurrence.scheduledFor || occurrence.dueAt), today) >= 0);
    const health = task.status === "paused" ? "Paused schedule requires review"
      : task.status === "cancelled" ? "Cancelled"
      : lastOccurrence?.status === "failed" ? `Failed · ${lastOccurrence.retryCount} retries`
      : taskOccurrences.some((occurrence) => occurrence.status === "overdue" ||
        (!isClosed(occurrence.status) && compareClientDateKeys(businessDateKey(occurrence.scheduledFor || occurrence.dueAt), today) < 0))
        ? "Missed occurrence"
        : "Healthy";
    return {
      task,
      organisation: organisationNames.get(task.organisationId) || task.organisationId,
      owner: ownerName(task.organisationId, task.ownerId, people),
      related: task.linkedRecordId ? recordsById.get(entityKey(task.organisationId, task.linkedRecordId))?.name || "Related record" : "—",
      repeats: recurrenceLabel(task),
      lastRun: lastOccurrence?.updatedAt || task.lastRunAt || "",
      nextRun: nextOccurrence?.dueAt || task.nextRunAt || "",
      jobHealth: health,
      lastOccurrence,
      nextOccurrence,
    };
  }).sort((left, right) => left.task.name.localeCompare(right.task.name));

  const exceptions: ConsultantException[] = [];
  for (const record of records) {
    const expiry = businessDateKey(record.expiryDate);
    const expired = record.status === "Expired" || Boolean(expiry && compareClientDateKeys(expiry, today) < 0);
    if (record.risk === "High" && expired && !["Completed", "Paused"].includes(record.status)) {
      exceptions.push(exception(
        `record-expired:${record.id}`, "Critical", record.organisationId,
        organisationNames.get(record.organisationId) || record.organisationId,
        "High-risk record has expired", record.name, record.contact || "Unassigned", expiry,
        record.nextAction || "Contact the client and update the monitored record", record.status,
      ));
    }
  }
  for (const row of workRows) {
    if (row.status === "Overdue" && row.priority.toLowerCase() === "high") {
      exceptions.push(exception(
        `overdue-work:${row.id}`, "High", row.organisationId, row.organisation,
        "Overdue high-priority work", row.task, row.responsible, row.dueDate,
        row.nextAction || "Review and reschedule the overdue work", row.status,
      ));
    }
    if (row.status === "Failed") {
      exceptions.push(exception(
        `failed-occurrence:${row.id}`, "High", row.organisationId, row.organisation,
        "Recurring occurrence failed", row.task, row.responsible, row.dueDate,
        row.nextAction || "Review the failure and retry if appropriate", row.status,
      ));
    }
    if (row.status === "Overdue" && row.kind === "recurring") {
      exceptions.push(exception(
        `missed-occurrence:${row.id}`, row.priority.toLowerCase() === "high" ? "High" : "Medium",
        row.organisationId, row.organisation, "Missed recurring occurrence",
        row.task, row.responsible, row.dueDate, "Review and complete the missed occurrence", row.status,
      ));
    }
  }
  for (const item of checklistItems) {
    const tracker = trackers.find((candidate) => candidate.id === item.trackerId && candidate.organisationId === item.organisationId);
    const status = checklistItemStatus(item, today);
    const organisation = organisationNames.get(item.organisationId) || item.organisationId;
    if (item.status === "Blocked") {
      exceptions.push(exception(
        `blocked-checklist:${item.id}`, item.priority === "High" ? "High" : "Medium",
        item.organisationId, organisation, "Checklist item is blocked",
        `${item.task}${tracker ? ` · ${tracker.name}` : ""}`, item.responsiblePersonName || "Unassigned",
        businessDateKey(item.targetDate), item.nextAction || item.blockedReason || "Review the blocker with the client", "Blocked",
      ));
    }
    if (item.status === "Awaiting Confirmation") {
      exceptions.push(exception(
        `awaiting-checklist:${item.id}`, "Low", item.organisationId, organisation,
        "Checklist item awaiting client confirmation", item.task, item.responsiblePersonName || "Unassigned",
        businessDateKey(item.targetDate), item.nextAction || "Confirm completion with the client", status,
      ));
    }
  }
  for (const record of records.filter((candidate) => ["Awaiting confirmation", "Awaiting client"].includes(candidate.status))) {
    exceptions.push(exception(
      `awaiting-record:${record.id}`, "Low", record.organisationId,
      organisationNames.get(record.organisationId) || record.organisationId,
      "Record awaiting client confirmation", record.name, record.contact || "Unassigned",
      businessDateKey(record.followUp || record.expiryDate),
      record.nextAction || "Request or review client confirmation", record.status,
    ));
  }
  for (const schedule of recurring) {
    if (schedule.task.status === "paused") {
      exceptions.push(exception(
        `paused-schedule:${schedule.task.id}`, "Medium", schedule.task.organisationId,
        schedule.organisation, "Recurring schedule is paused", schedule.task.name,
        schedule.owner, businessDateKey(schedule.nextRun), "Review whether this schedule should resume", "Paused",
      ));
    }
  }

  return { organisations, people, tasks: work, checklists, recurring, completed, exceptions };
}

export function loadConsultantWorkSnapshot(
  today = clientBusinessToday(),
  records: MonitoredRecord[] = Object.values(getRecords()),
  canonicalOrganisations: Array<{ id: string; name: string }> = [],
): ConsultantWorkSnapshot {
  return buildConsultantWorkSnapshot({
    clients: getActiveClients(),
    canonicalOrganisations,
    records,
    tasks: getRecurringTasks(),
    occurrences: getOccurrences(),
    auditEvents: getAuditEvents(),
    directory: getAllClientWorkspaceEntries(),
    today,
  });
}
