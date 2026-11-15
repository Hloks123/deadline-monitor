"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { categoryOptions, type CategoryOne, type MonitoredRecord, type RecordRisk, type RecordStatus } from "@/lib/recordStore";
import {
  getActivitiesForDate,
  getActivitiesForMonth,
  getActivitiesForWeek,
  normalizeActivityStatus,
  type ClientActivity,
} from "@/lib/clientActivities";
import type { ChecklistItem, ChecklistStatus, WorkPriority } from "@/lib/clientWorkspaceStore";
import type { TaskOccurrence } from "@/lib/recurringTasks/types";
import type { AssistantWorkspaceMutation } from "@/lib/assistantWorkspaceMutations";
import type { AssistantWorkspaceSnapshotResponse } from "@/lib/assistantWorkspaceTypes";
import type { AssistantWorkspaceSnapshot } from "@/lib/assistantWorkspaceTypes";
import CalendarDayPanel from "@/components/client/calendar/CalendarDayPanel";
import CalendarMonthView from "@/components/client/calendar/CalendarMonthView";
import CalendarWeekView from "@/components/client/calendar/CalendarWeekView";
import {
  formatCalendarDate,
  formatCalendarMonth,
  getCalendarWeekDays,
  getMonthGridDays,
  monthKeyFromDate,
  shiftCalendarDate,
  shiftMonth,
} from "@/components/client/calendar/calendarUtils";
import {
  businessDateKey,
  businessTimeKey,
  clientBusinessToday,
} from "@/lib/clientWorkspaceSelectors";

type AssignedOrganisation =
  AssistantWorkspaceSnapshotResponse["organisations"][number];

type WorkRow = {
  id: string;
  organisationId: string;
  organisation: string;
  title: string;
  kind: string;
  dueDate: string;
  status: string;
  responsible: string;
  priority: string;
  entityType: "checklist" | "occurrence" | "task";
  entityId: string;
};

type CalendarRow = WorkRow & { date: string };
type AssistantCalendarView = "month" | "week";

type WorkspaceEditor =
  | { type: "new_record"; organisationId: string }
  | { type: "record"; organisationId: string; recordId: string }
  | { type: "new_work"; organisationId: string }
  | { type: "work_item"; organisationId: string; itemId: string }
  | { type: "occurrence"; organisationId: string; occurrenceId: string };

function snapshotOf(
  organisation: AssignedOrganisation,
): AssistantWorkspaceSnapshot | null {
  return organisation.snapshot;
}

function csvCell(value: unknown) {
  let text = String(value ?? "");
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

function downloadCsv(filename: string, rows: unknown[][]) {
  const contents = rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
  const blob = new Blob([`\uFEFF${contents}`], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function displayDate(value: string) {
  if (!value) return "—";
  const date = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("en-ZA", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
}

function tableRows(headers: string[], rows: ReactNode[][]) {
  if (!rows.length) {
    return (
      <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-600">
        No assigned-client data is available for this view.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="w-full min-w-[720px] border-collapse text-left text-sm">
        <thead className="bg-slate-100 text-xs font-semibold uppercase tracking-wide text-slate-600">
          <tr>{headers.map((header) => <th key={header} scope="col" className="px-4 py-3">{header}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row, index) => (
            <tr key={index}>
              {row.map((cell, cellIndex) => (
                <td
                  key={cellIndex}
                  className={`px-4 py-3 ${
                    cellIndex === 0
                      ? "font-semibold text-slate-900"
                      : "text-slate-700"
                  }`}
                >
                  {cell || "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SectionHeading({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h2 className="text-xl font-bold text-slate-950">{title}</h2>
        <p className="mt-1 text-sm text-slate-600">{description}</p>
      </div>
      {children}
    </div>
  );
}

const fieldClass = "mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900";

function RecordEditor({
  record,
  organisation,
  onSave,
  onCancel,
}: {
  record?: MonitoredRecord;
  organisation: AssignedOrganisation;
  onSave: (mutation: AssistantWorkspaceMutation) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(record?.name || "");
  const [category, setCategory] = useState<CategoryOne>(record?.category || "Other");
  const [category2, setCategory2] = useState(record?.category2 || "");
  const [issueDate, setIssueDate] = useState(record?.issueDate || "");
  const [expiryDate, setExpiryDate] = useState(record?.expiryDate || "");
  const [status, setStatus] = useState<RecordStatus>(record?.status || "Current");
  const [risk, setRisk] = useState<RecordRisk>(record?.risk || "Medium");
  const [contactId, setContactId] = useState(record?.contactId || "");
  const [followUp, setFollowUp] = useState(record?.followUp || "");
  const [nextAction, setNextAction] = useState(record?.nextAction || "");
  const [notes, setNotes] = useState(record?.notes || "");
  const contacts = organisation.snapshot?.client.contacts.filter((contact) => contact.authorised) ?? [];

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const recordData = {
      name,
      category,
      category2,
      issueDate,
      expiryDate,
      risk,
      contactId,
      followUp,
      nextAction,
      notes,
    };
    const mutation: AssistantWorkspaceMutation = record
      ? {
          type: "update_record",
          recordId: record.id,
          changes: { ...recordData, status },
        }
      : { type: "create_record", record: recordData };
    void onSave(mutation);
  }

  return (
    <form onSubmit={submit} className="grid gap-3 rounded-xl border border-teal-200 bg-teal-50/40 p-4 sm:grid-cols-2">
      <h3 className="text-base font-bold text-slate-900 sm:col-span-2">{record ? "Edit monitored record" : `Add record for ${organisation.name}`}</h3>
      <label className="text-sm font-semibold text-slate-700">Record name<input required maxLength={200} value={name} onChange={(event) => setName(event.target.value)} className={fieldClass} /></label>
      <label className="text-sm font-semibold text-slate-700">Category<select value={category} onChange={(event) => setCategory(event.target.value as CategoryOne)} className={fieldClass}>{Object.keys(categoryOptions).map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
      <label className="text-sm font-semibold text-slate-700">Record type<input maxLength={200} value={category2} onChange={(event) => setCategory2(event.target.value)} className={fieldClass} /></label>
      <label className="text-sm font-semibold text-slate-700">Risk<select value={risk} onChange={(event) => setRisk(event.target.value as RecordRisk)} className={fieldClass}><option>Low</option><option>Medium</option><option>High</option></select></label>
      <label className="text-sm font-semibold text-slate-700">Issue date<input type="date" value={issueDate} onChange={(event) => setIssueDate(event.target.value)} className={fieldClass} /></label>
      <label className="text-sm font-semibold text-slate-700">Expiry date<input required type="date" value={expiryDate} onChange={(event) => setExpiryDate(event.target.value)} className={fieldClass} /></label>
      {record && <label className="text-sm font-semibold text-slate-700">Status<select value={status} onChange={(event) => setStatus(event.target.value as RecordStatus)} className={fieldClass}><option>Current</option><option>Due soon</option><option>Expired</option><option>Awaiting client</option><option>Awaiting confirmation</option><option>Completed</option><option>Paused</option></select></label>}
      <label className="text-sm font-semibold text-slate-700">Responsible contact<select value={contactId} onChange={(event) => setContactId(event.target.value)} className={fieldClass}><option value="">Unassigned</option>{contacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.name}</option>)}</select></label>
      <label className="text-sm font-semibold text-slate-700">Follow-up date<input type="date" value={followUp} onChange={(event) => setFollowUp(event.target.value)} className={fieldClass} /></label>
      <label className="text-sm font-semibold text-slate-700">Next action<input maxLength={500} value={nextAction} onChange={(event) => setNextAction(event.target.value)} className={fieldClass} /></label>
      <label className="text-sm font-semibold text-slate-700 sm:col-span-2">Operational notes<textarea maxLength={2000} rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} className={`${fieldClass} py-2`} /></label>
      <div className="flex gap-2 sm:col-span-2">
        <button type="submit" className="min-h-10 rounded-lg bg-teal-700 px-4 text-sm font-semibold text-white">{record ? "Save record" : "Create record"}</button>
        <button type="button" onClick={onCancel} className="min-h-10 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700">Cancel</button>
      </div>
    </form>
  );
}

function WorkItemEditor({
  item,
  organisation,
  onSave,
  onCancel,
}: {
  item?: ChecklistItem;
  organisation: AssignedOrganisation;
  onSave: (mutation: AssistantWorkspaceMutation) => Promise<void>;
  onCancel: () => void;
}) {
  const snapshot = organisation.snapshot!;
  const trackers = snapshot.trackers.filter((tracker) => ["Active", "Draft"].includes(tracker.status));
  const people = snapshot.people.filter((person) => person.active);
  const [trackerId, setTrackerId] = useState(item?.trackerId || trackers[0]?.id || "");
  const [task, setTask] = useState(item?.task || "");
  const [targetDate, setTargetDate] = useState(item?.targetDate || "");
  const [responsiblePersonId, setResponsiblePersonId] = useState(item?.responsiblePersonId || "");
  const [priority, setPriority] = useState<WorkPriority>(item?.priority || "Medium");
  const [status, setStatus] = useState<ChecklistStatus>(item?.status || "Not Started");
  const [progressNotes, setProgressNotes] = useState(item?.progressNotes || "");
  const [nextAction, setNextAction] = useState(item?.nextAction || "");
  const [completionEvidence, setCompletionEvidence] = useState(item?.completionEvidence || "");
  const [blockedReason, setBlockedReason] = useState(item?.blockedReason || "");
  const [carryForwardReason, setCarryForwardReason] = useState(item?.carryForwardReason || "");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const mutation: AssistantWorkspaceMutation = item
      ? {
          type: "update_work_item",
          itemId: item.id,
          changes: {
            task,
            targetDate,
            responsiblePersonId,
            priority,
            status,
            progressNotes,
            nextAction,
            completionEvidence,
            blockedReason,
            carryForwardReason,
          },
        }
      : { type: "create_work_item", trackerId, task, targetDate, responsiblePersonId, priority };
    void onSave(mutation);
  }

  return (
    <form onSubmit={submit} className="grid gap-3 rounded-xl border border-teal-200 bg-teal-50/40 p-4 sm:grid-cols-2">
      <h3 className="text-base font-bold text-slate-900 sm:col-span-2">{item ? "Update work item" : `Add work for ${organisation.name}`}</h3>
      {!item && trackers.length === 0 && <p className="text-sm text-amber-900 sm:col-span-2">Ask your main consultant to set up a work tracker before adding work.</p>}
      {!item && trackers.length > 0 && <label className="text-sm font-semibold text-slate-700">Work tracker<select required value={trackerId} onChange={(event) => setTrackerId(event.target.value)} className={fieldClass}>{trackers.map((tracker) => <option key={tracker.id} value={tracker.id}>{tracker.name}</option>)}</select></label>}
      <label className="text-sm font-semibold text-slate-700 sm:col-span-2">Work item<input required maxLength={300} value={task} onChange={(event) => setTask(event.target.value)} className={fieldClass} /></label>
      <label className="text-sm font-semibold text-slate-700">Due date<input required type="date" value={targetDate} onChange={(event) => setTargetDate(event.target.value)} className={fieldClass} /></label>
      <label className="text-sm font-semibold text-slate-700">Responsible person<select value={responsiblePersonId} onChange={(event) => setResponsiblePersonId(event.target.value)} className={fieldClass}><option value="">Unassigned</option>{people.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label>
      <label className="text-sm font-semibold text-slate-700">Priority<select value={priority} onChange={(event) => setPriority(event.target.value as WorkPriority)} className={fieldClass}><option>High</option><option>Medium</option><option>Low</option></select></label>
      {item && <label className="text-sm font-semibold text-slate-700">Status<select value={status} onChange={(event) => setStatus(event.target.value as ChecklistStatus)} className={fieldClass}>{["Not Started", "In Progress", "Scheduled", "Awaiting Confirmation", "Completed", "Skipped", "Blocked", "Overdue", "Carry Forward"].map((value) => <option key={value}>{value}</option>)}</select></label>}
      {item && <>
        <label className="text-sm font-semibold text-slate-700">Progress notes<textarea maxLength={2000} rows={2} value={progressNotes} onChange={(event) => setProgressNotes(event.target.value)} className={`${fieldClass} py-2`} /></label>
        <label className="text-sm font-semibold text-slate-700">Next action<input maxLength={2000} value={nextAction} onChange={(event) => setNextAction(event.target.value)} className={fieldClass} /></label>
        <label className="text-sm font-semibold text-slate-700">Completion evidence<textarea maxLength={2000} rows={2} value={completionEvidence} onChange={(event) => setCompletionEvidence(event.target.value)} className={`${fieldClass} py-2`} /></label>
        <label className="text-sm font-semibold text-slate-700">Blocked reason<input maxLength={2000} value={blockedReason} onChange={(event) => setBlockedReason(event.target.value)} className={fieldClass} /></label>
        <label className="text-sm font-semibold text-slate-700">Carry-forward reason<input maxLength={2000} value={carryForwardReason} onChange={(event) => setCarryForwardReason(event.target.value)} className={fieldClass} /></label>
      </>}
      <div className="flex gap-2 sm:col-span-2">
        <button type="submit" disabled={!item && trackers.length === 0} className="min-h-10 rounded-lg bg-teal-700 px-4 text-sm font-semibold text-white disabled:opacity-50">{item ? "Save work item" : "Create work item"}</button>
        <button type="button" onClick={onCancel} className="min-h-10 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700">Cancel</button>
      </div>
    </form>
  );
}

function OccurrenceEditor({
  occurrence,
  onSave,
  onCancel,
}: {
  occurrence: TaskOccurrence;
  onSave: (mutation: AssistantWorkspaceMutation) => Promise<void>;
  onCancel: () => void;
}) {
  const [status, setStatus] = useState<TaskOccurrence["status"]>(occurrence.status);
  const [completionEvidence, setCompletionEvidence] = useState(occurrence.completionEvidence || "");
  const [skippedReason, setSkippedReason] = useState(occurrence.skippedReason || "");
  const [failureReason, setFailureReason] = useState(occurrence.failureReason || "");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void onSave({
      type: "update_occurrence",
      occurrenceId: occurrence.id,
      status,
      completionEvidence,
      skippedReason,
      failureReason,
    });
  }

  return (
    <form onSubmit={submit} className="grid gap-3 rounded-xl border border-teal-200 bg-teal-50/40 p-4 sm:grid-cols-2">
      <h3 className="text-base font-bold text-slate-900 sm:col-span-2">Update recurring work</h3>
      <label className="text-sm font-semibold text-slate-700">Status<select value={status} onChange={(event) => setStatus(event.target.value as TaskOccurrence["status"])} className={fieldClass}>{["upcoming", "due_today", "in_progress", "completed", "skipped", "failed", "overdue", "cancelled"].map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select></label>
      <label className="text-sm font-semibold text-slate-700">Completion evidence<textarea maxLength={2000} rows={2} value={completionEvidence} onChange={(event) => setCompletionEvidence(event.target.value)} className={`${fieldClass} py-2`} /></label>
      <label className="text-sm font-semibold text-slate-700">Skip reason<input maxLength={2000} value={skippedReason} onChange={(event) => setSkippedReason(event.target.value)} className={fieldClass} /></label>
      <label className="text-sm font-semibold text-slate-700">Failure reason<input maxLength={2000} value={failureReason} onChange={(event) => setFailureReason(event.target.value)} className={fieldClass} /></label>
      <div className="flex gap-2 sm:col-span-2">
        <button type="submit" className="min-h-10 rounded-lg bg-teal-700 px-4 text-sm font-semibold text-white">Save status</button>
        <button type="button" onClick={onCancel} className="min-h-10 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700">Cancel</button>
      </div>
    </form>
  );
}

function buildWorkRows(
  organisations: AssignedOrganisation[],
): WorkRow[] {
  const rows: WorkRow[] = [];
  for (const organisation of organisations) {
    const snapshot = snapshotOf(organisation);
    if (!snapshot) continue;

    const tasksWithOccurrences = new Set(
      snapshot.occurrences.map((occurrence) => occurrence.recurringTaskId),
    );
    for (const occurrence of snapshot.occurrences) {
      const task = snapshot.tasks.find(
        (candidate) =>
          candidate.id === occurrence.recurringTaskId &&
          candidate.organisationId === organisation.id,
      );
      rows.push({
        id: `${organisation.id}:${occurrence.id}`,
        organisationId: organisation.id,
        organisation: organisation.name,
        title: task?.name || occurrence.recurringTaskName || "Recurring task",
        kind: "Recurring",
        dueDate: occurrence.dueAt || occurrence.scheduledFor,
        status: occurrence.status.replaceAll("_", " "),
        responsible: occurrence.ownerId || task?.ownerId || "",
        priority: task?.priority || "",
        entityType: "occurrence",
        entityId: occurrence.id,
      });
    }
    for (const task of snapshot.tasks) {
      if (tasksWithOccurrences.has(task.id)) continue;
      rows.push({
        id: `${organisation.id}:${task.id}`,
        organisationId: organisation.id,
        organisation: organisation.name,
        title: task.name,
        kind: "Recurring schedule",
        dueDate: task.nextRunAt || task.startDate,
        status: task.status,
        responsible: task.ownerId,
        priority: task.priority,
        entityType: "task",
        entityId: task.id,
      });
    }
    const trackerNames = new Map(
      snapshot.trackers.map((tracker) => [tracker.id, tracker.name]),
    );
    for (const item of snapshot.items) {
      rows.push({
        id: `${organisation.id}:${item.id}`,
        organisationId: organisation.id,
        organisation: organisation.name,
        title: item.task,
        kind: trackerNames.get(item.trackerId) || "Checklist",
        dueDate: item.targetDate,
        status: item.status,
        responsible: item.responsiblePersonName || item.responsiblePersonId,
        priority: item.priority,
        entityType: "checklist",
        entityId: item.id,
      });
    }
  }
  return rows.sort((left, right) => left.dueDate.localeCompare(right.dueDate));
}

function buildCalendarRows(
  organisations: AssignedOrganisation[],
  workRows: WorkRow[],
): CalendarRow[] {
  const rows: CalendarRow[] = workRows
    .filter((row) => row.dueDate)
    .map((row) => ({ ...row, date: row.dueDate }));
  for (const organisation of organisations) {
    const snapshot = snapshotOf(organisation);
    if (!snapshot) continue;
    for (const record of snapshot.records) {
      if (record.expiryDate) {
        rows.push({
          id: `${organisation.id}:${record.id}:expiry`,
          organisationId: organisation.id,
          organisation: organisation.name,
          title: `${record.name} expiry`,
          kind: "Monitored record",
          dueDate: record.expiryDate,
          date: record.expiryDate,
          status: record.status,
          responsible: record.contact,
          priority: record.risk,
          entityType: "task",
          entityId: record.id,
        });
      }
      if (record.followUp && record.followUp !== record.expiryDate) {
        rows.push({
          id: `${organisation.id}:${record.id}:follow-up`,
          organisationId: organisation.id,
          organisation: organisation.name,
          title: `${record.name} follow-up`,
          kind: "Follow-up",
          dueDate: record.followUp,
          date: record.followUp,
          status: record.status,
          responsible: record.contact,
          priority: record.risk,
          entityType: "task",
          entityId: record.id,
        });
      }
    }
  }
  return rows.sort((left, right) => left.date.localeCompare(right.date));
}

function buildAssistantCalendarActivities(
  rows: CalendarRow[],
  today: string,
): ClientActivity[] {
  return rows.flatMap((row) => {
    const date = businessDateKey(row.date);
    if (!date) return [];

    const isRecordExpiry = row.kind === "Monitored record";
    const isRecordFollowUp = row.kind === "Follow-up";
    const status = normalizeActivityStatus(row.status);
    const preservedStatuses: ClientActivity["status"][] = [
      "completed",
      "paused",
      "cancelled",
      "blocked",
      "in_progress",
      "awaiting_confirmation",
      "skipped",
      "accepted",
    ];
    const activityStatus = status === "expired"
      ? isRecordExpiry ? "expired" : "overdue"
      : status === "overdue" || (!preservedStatuses.includes(status) && date < today)
        ? isRecordExpiry ? "expired" : "overdue"
        : status === "current" && isRecordExpiry
          ? "current"
          : status === "not_started"
            ? "not_started"
            : date === today
              ? "due_today"
              : preservedStatuses.includes(status)
                ? status
                : "upcoming";
    const activityType = isRecordExpiry
      ? "record_expiry"
      : isRecordFollowUp
        ? "record_follow_up"
        : row.entityType === "checklist"
          ? "checklist_item"
          : "recurring_task";
    const priority = row.priority.trim().toLowerCase();

    return [{
      id: row.id,
      organisationId: row.organisationId,
      organisationName: row.organisation,
      title: row.title,
      activityType,
      sourceEntityType: isRecordExpiry || isRecordFollowUp
        ? "record"
        : row.entityType === "checklist" ? "checklist" : "task",
      sourceEntityId: row.entityId,
      relatedName: row.kind,
      date,
      time: businessTimeKey(row.dueDate) || undefined,
      responsiblePerson: row.responsible || undefined,
      priority: priority === "critical" || priority === "high"
        ? "high"
        : priority === "medium" || priority === "low" ? priority : undefined,
      status: activityStatus,
      nextAction: row.status,
      route: isRecordExpiry || isRecordFollowUp
        ? `/monitored-records/${encodeURIComponent(row.entityId)}`
        : "/work",
    }];
  });
}

function reportRows(organisations: AssignedOrganisation[]) {
  const rows: unknown[][] = [
    ["Client", "Record", "Category", "Expiry date", "Status", "Risk"],
  ];
  for (const organisation of organisations) {
    for (const record of snapshotOf(organisation)?.records ?? []) {
      rows.push([
        organisation.name,
        record.name,
        record.category2 || record.category,
        record.expiryDate,
        record.status,
        record.risk,
      ]);
    }
  }
  return rows;
}

function workReportRows(workRows: WorkRow[]) {
  return [
    ["Client", "Work item", "Type", "Due date", "Status", "Responsible", "Priority"],
    ...workRows.map((item) => [
      item.organisation,
      item.title,
      item.kind,
      item.dueDate,
      item.status,
      item.responsible,
      item.priority,
    ]),
  ];
}

function historyRows(organisations: AssignedOrganisation[]) {
  const rows: unknown[][] = [
    ["Date", "Client", "Action", "Entity", "Field", "Previous value", "New value", "User", "Context"],
  ];
  for (const organisation of organisations) {
    for (const event of snapshotOf(organisation)?.auditEvents ?? []) {
      rows.push([
        event.timestamp || event.date,
        organisation.name,
        event.action,
        event.entityName || event.recordName,
        event.field || "",
        event.previousValue,
        event.newValue,
        event.user,
        event.context || "",
      ]);
    }
  }
  return rows;
}

export default function AssistantWorkspaceView() {
  const pathname = usePathname();
  const today = clientBusinessToday();
  const [organisations, setOrganisations] = useState<
    AssistantWorkspaceResponse["organisations"]
  >([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [editor, setEditor] = useState<WorkspaceEditor | null>(null);
  const [mutationError, setMutationError] = useState("");
  const [mutationNotice, setMutationNotice] = useState("");
  const [mutationBusy, setMutationBusy] = useState(false);
  const [calendarView, setCalendarView] = useState<AssistantCalendarView>("month");
  const [calendarMonth, setCalendarMonth] = useState(() => today.slice(0, 7));
  const [calendarSelectedDate, setCalendarSelectedDate] = useState(today);
  const [calendarDayPanelOpen, setCalendarDayPanelOpen] = useState(false);

  useEffect(() => {
    let active = true;
    void fetch("/api/assistant/workspace", { cache: "no-store" })
      .then(async (response) => {
        const result = (await response.json()) as {
          error?: string;
          organisations?: AssistantWorkspaceResponse["organisations"];
        };
        if (!response.ok || !Array.isArray(result.organisations)) {
          throw new Error(
            result.error || "Assigned client data could not be verified.",
          );
        }
        if (!active) return;
        setOrganisations(result.organisations);
        setState("ready");
      })
      .catch((loadError: unknown) => {
        if (!active) return;
        setErrorMessage(
          loadError instanceof Error
            ? loadError.message
            : "Assigned client data could not be verified.",
        );
        setState("error");
      });
    return () => {
      active = false;
    };
  }, []);

  async function saveMutation(
    organisation: AssignedOrganisation,
    mutation: AssistantWorkspaceMutation,
  ) {
    if (mutationBusy) return;
    if (!organisation.updatedAt) {
      setMutationError("This client has no imported workspace version to update.");
      return;
    }
    setMutationBusy(true);
    setMutationError("");
    setMutationNotice("");
    try {
      const response = await fetch("/api/assistant/workspace", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organisationId: organisation.id,
          expectedUpdatedAt: organisation.updatedAt,
          mutation,
        }),
      });
      const result = (await response.json()) as {
        error?: string;
        organisationId?: string;
        snapshot?: AssistantWorkspaceSnapshot;
        updatedAt?: string;
      };
      if (!response.ok || !result.snapshot || !result.updatedAt) {
        setMutationError(result.error || "The workspace update could not be saved.");
        return;
      }
      setOrganisations((current) =>
        current.map((item) =>
          item.id === result.organisationId
            ? { ...item, snapshot: result.snapshot!, updatedAt: result.updatedAt! }
            : item,
        ),
      );
      setEditor(null);
      setMutationNotice("Your change was saved and added to audit history.");
    } catch (saveError: unknown) {
      setMutationError(
        saveError instanceof Error
          ? saveError.message
          : "The workspace update could not be saved.",
      );
    } finally {
      setMutationBusy(false);
    }
  }

  const importedOrganisations = useMemo(
    () => organisations.filter((organisation) => organisation.snapshot),
    [organisations],
  );
  const workRows = useMemo(
    () => buildWorkRows(importedOrganisations),
    [importedOrganisations],
  );
  const calendarRows = useMemo(
    () => buildCalendarRows(importedOrganisations, workRows),
    [importedOrganisations, workRows],
  );
  const calendarActivities = useMemo(
    () => buildAssistantCalendarActivities(calendarRows, today),
    [calendarRows, today],
  );
  const calendarDays = useMemo(
    () => getMonthGridDays(calendarMonth),
    [calendarMonth],
  );
  const calendarWeekDays = useMemo(
    () => getCalendarWeekDays(calendarSelectedDate),
    [calendarSelectedDate],
  );
  const monthActivities = useMemo(
    () => getActivitiesForMonth(calendarActivities, calendarMonth),
    [calendarActivities, calendarMonth],
  );
  const weekActivities = useMemo(
    () => getActivitiesForWeek(calendarActivities, calendarSelectedDate),
    [calendarActivities, calendarSelectedDate],
  );
  const selectedDayActivities = useMemo(
    () => getActivitiesForDate(calendarActivities, calendarSelectedDate),
    [calendarActivities, calendarSelectedDate],
  );
  const calendarHeading = calendarView === "week"
    ? `${formatCalendarDate(calendarWeekDays[0], { weekday: "short", day: "numeric", month: "short" })} – ${formatCalendarDate(calendarWeekDays[6], { weekday: "short", day: "numeric", month: "short", year: "numeric" })}`
    : formatCalendarMonth(calendarMonth);
  const visibleCalendarActivities = calendarView === "week"
    ? weekActivities
    : monthActivities;
  const records = useMemo(
    () =>
      importedOrganisations.flatMap((organisation) =>
        (organisation.snapshot?.records ?? []).map((record) => ({
          organisationId: organisation.id,
          organisation: organisation.name,
          record,
        })),
      ),
    [importedOrganisations],
  );
  const auditEvents = useMemo(
    () =>
      importedOrganisations
        .flatMap((organisation) =>
          (organisation.snapshot?.auditEvents ?? []).map((event) => ({
            ...event,
            organisation: organisation.name,
          })),
        )
        .sort((left, right) =>
          (right.timestamp || right.date).localeCompare(
            left.timestamp || left.date,
          ),
        ),
    [importedOrganisations],
  );

  function navigateCalendarPeriod(offset: number) {
    if (calendarView === "week") {
      const nextDate = shiftCalendarDate(calendarSelectedDate, offset * 7);
      setCalendarSelectedDate(nextDate);
      setCalendarMonth(monthKeyFromDate(nextDate));
      return;
    }

    const nextMonth = shiftMonth(calendarMonth, offset);
    setCalendarMonth(nextMonth);
    setCalendarSelectedDate(`${nextMonth}-01`);
  }

  function goToCalendarToday() {
    setCalendarMonth(today.slice(0, 7));
    setCalendarSelectedDate(today);
  }

  function selectCalendarDate(date: string) {
    setCalendarSelectedDate(date);
    setCalendarMonth(monthKeyFromDate(date));
    setCalendarDayPanelOpen(true);
  }

  if (state === "loading") {
    return (
      <p role="status" className="m-5 rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
        Verifying your assigned client data…
      </p>
    );
  }
  if (state === "error") {
    return (
      <section role="alert" className="m-5 max-w-3xl rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-900">
        {errorMessage} Refresh the page or contact your main consultant.
      </section>
    );
  }

  const clientId = pathname.startsWith("/clients/")
    ? decodeURIComponent(pathname.slice("/clients/".length).split("/")[0])
    : "";
  const recordId = pathname.startsWith("/monitored-records/")
    ? decodeURIComponent(pathname.slice("/monitored-records/".length).split("/")[0])
    : "";
  const selectedClient = organisations.find(
    (organisation) => organisation.id === clientId,
  );
  const selectedRecord = records.find(({ record }) => record.id === recordId);
  const selectedRecordOrganisation = selectedRecord
    ? importedOrganisations.find(
        (organisation) => organisation.id === selectedRecord.organisationId,
      )
    : undefined;
  const hasImportedData = importedOrganisations.length > 0;
  const editorOrganisation = editor
    ? importedOrganisations.find(
        (organisation) => organisation.id === editor.organisationId,
      )
    : undefined;
  const editedRecord =
    editor?.type === "record"
      ? editorOrganisation?.snapshot?.records.find(
          (record) => record.id === editor.recordId,
        )
      : undefined;
  const editedWorkItem =
    editor?.type === "work_item"
      ? editorOrganisation?.snapshot?.items.find(
          (item) => item.id === editor.itemId,
        )
      : undefined;
  const editedOccurrence =
    editor?.type === "occurrence"
      ? editorOrganisation?.snapshot?.occurrences.find(
          (occurrence) => occurrence.id === editor.occurrenceId,
        )
      : undefined;

  return (
    <div className="space-y-6 p-4 sm:p-5 lg:p-6">
      {mutationError && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900">{mutationError}</p>
      )}
      {mutationNotice && (
        <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">{mutationNotice}</p>
      )}
      {mutationBusy && <p role="status" className="text-sm text-slate-600">Saving your change…</p>}
      {!hasImportedData && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          Your client assignments are verified, but no operational data has been
          imported for them yet. Ask your main consultant to import the client
          data from their browser.
        </p>
      )}

      {pathname === "/dashboard" && (
        <>
          <SectionHeading
            title="Your assigned clients"
            description="Workspace data is limited to organisations currently assigned to your account."
          />
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ["Assigned clients", organisations.length],
              ["Monitored records", records.length],
              ["Open work items", workRows.filter((item) => !["completed", "skipped", "cancelled", "archived"].includes(item.status.toLowerCase())).length],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-slate-200 bg-white p-5">
                <p className="text-sm font-semibold text-slate-500">{label}</p>
                <p className="mt-2 text-3xl font-bold text-slate-950">{value}</p>
              </div>
            ))}
          </div>
          {tableRows(
            ["Client", "Records", "Recurring tasks", "Data status"],
            organisations.map((organisation) => [
              organisation.name,
              `${organisation.snapshot?.records.length ?? 0} records`,
              `${organisation.snapshot?.tasks.length ?? 0} recurring tasks`,
              organisation.importedAt
                ? `Imported ${displayDate(organisation.importedAt)}`
                : "Waiting for data import",
            ]),
          )}
        </>
      )}

      {pathname === "/clients" && (
        <>
          <SectionHeading
            title="Assigned clients"
            description="Only active organisations assigned to you are shown."
          />
          {tableRows(
            ["Client", "Primary contact", "Email", "Records"],
            organisations.map((organisation) => {
              const primary =
                organisation.contacts.find((contact) => contact.primary) ||
                organisation.contacts[0];
              return [
                <Link
                  key="name"
                  href={`/clients/${encodeURIComponent(organisation.id)}`}
                  className="text-teal-800 hover:underline"
                >
                  {organisation.name}
                </Link>,
                primary?.name || "No authorised contact",
                primary?.email || "—",
                `${organisation.snapshot?.records.length ?? 0} monitored records`,
              ];
            }),
          )}
        </>
      )}

      {pathname.startsWith("/clients/") && (
        selectedClient ? (
          <section className="space-y-5 rounded-xl border border-slate-200 bg-white p-5">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-teal-700">Assigned client</p>
              <h2 className="mt-2 text-2xl font-bold text-slate-950">{selectedClient.name}</h2>
              <p className="mt-1 text-sm text-slate-600">
                {selectedClient.contacts.map((contact) => contact.name).join(", ") || "No authorised contacts"}
              </p>
            </div>
            <Link href="/clients" className="font-semibold text-teal-800 hover:underline">Back to assigned clients</Link>
            {tableRows(
              ["Record", "Category", "Expiry", "Status"],
              (selectedClient.snapshot?.records ?? []).map((record) => [
                record.name,
                record.category2 || record.category,
                displayDate(record.expiryDate),
                record.status,
              ]),
            )}
          </section>
        ) : (
          <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-900">
            This client is not assigned to your account.
          </p>
        )
      )}

      {pathname === "/monitored-records" && (
        <>
          <SectionHeading
            title="Monitored records"
            description="Create and update records for your assigned clients. Changes are saved to the shared workspace and audit history."
            >
            <button
              type="button"
              onClick={() => {
                setMutationError("");
                setMutationNotice("");
                setEditor({ type: "new_record", organisationId: importedOrganisations[0]?.id || "" });
              }}
              disabled={!hasImportedData}
              className="min-h-10 rounded-lg bg-teal-700 px-4 text-sm font-semibold text-white disabled:opacity-50"
            >
              Add record
            </button>
            <button
              type="button"
              onClick={() =>
                downloadCsv("assigned-client-records.csv", reportRows(importedOrganisations))
              }
              className="min-h-10 rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white"
            >
              Download records
            </button>
          </SectionHeading>
          {editor?.type === "new_record" && editorOrganisation && (
            <div className="space-y-3">
              <label className="block max-w-xl text-sm font-semibold text-slate-700">
                Assigned client
                <select
                  value={editor.organisationId}
                  onChange={(event) => setEditor({ type: "new_record", organisationId: event.target.value })}
                  className={fieldClass}
                >
                  {importedOrganisations.map((organisation) => <option key={organisation.id} value={organisation.id}>{organisation.name}</option>)}
                </select>
              </label>
              <RecordEditor
                organisation={editorOrganisation}
                onSave={(mutation) => saveMutation(editorOrganisation, mutation)}
                onCancel={() => setEditor(null)}
              />
            </div>
          )}
          {tableRows(
            ["Record", "Client", "Category", "Expires", "Status", "Risk", "Action"],
            records.map(({ organisation, record }) => [
              <Link
                key="name"
                href={`/monitored-records/${encodeURIComponent(record.id)}`}
                className="text-teal-800 hover:underline"
              >
                {record.name}
              </Link>,
              organisation,
              record.category2 || record.category,
              displayDate(record.expiryDate),
              record.status,
              record.risk,
              <button
                key="edit"
                type="button"
                onClick={() => {
                  setMutationError("");
                  setMutationNotice("");
                  setEditor({ type: "record", organisationId: record.organisationId, recordId: record.id });
                }}
                className="font-semibold text-teal-800 hover:underline"
              >
                Edit
              </button>,
            ]),
          )}
          {editor?.type === "record" && editorOrganisation && editedRecord && (
            <RecordEditor
              record={editedRecord}
              organisation={editorOrganisation}
              onSave={(mutation) => saveMutation(editorOrganisation, mutation)}
              onCancel={() => setEditor(null)}
            />
          )}
          {tableRows(
            ["Client", "Work item", "Type", "Due date", "Status", "Responsible", "Priority"],
            workRows.map((item) => [
              item.organisation,
              item.title,
              item.kind,
              displayDate(item.dueDate),
              item.status,
              item.responsible,
              item.priority,
            ]),
          )}
        </>
      )}

      {pathname.startsWith("/monitored-records/") && (
        selectedRecord ? (
          <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-bold uppercase tracking-wide text-teal-700">{selectedRecord.organisation}</p>
            <h2 className="text-2xl font-bold text-slate-950">{selectedRecord.record.name}</h2>
            {tableRows(
              ["Field", "Value"],
              [
                ["Category", selectedRecord.record.category2 || selectedRecord.record.category],
                ["Expiry date", displayDate(selectedRecord.record.expiryDate)],
                ["Status", selectedRecord.record.status],
                ["Risk", selectedRecord.record.risk],
                ["Responsible contact", selectedRecord.record.contact],
                ["Next action", selectedRecord.record.nextAction || "—"],
              ],
            )}
            {selectedRecordOrganisation && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setMutationError("");
                    setMutationNotice("");
                    setEditor({
                      type: "record",
                      organisationId: selectedRecordOrganisation.id,
                      recordId: selectedRecord.record.id,
                    });
                  }}
                  className="min-h-10 rounded-lg bg-teal-700 px-4 text-sm font-semibold text-white"
                >
                  Edit record
                </button>
                {editor?.type === "record" && editedRecord && (
                  <RecordEditor
                    record={editedRecord}
                    organisation={selectedRecordOrganisation}
                    onSave={(mutation) => saveMutation(selectedRecordOrganisation, mutation)}
                    onCancel={() => setEditor(null)}
                  />
                )}
              </>
            )}
          </section>
        ) : (
          <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-900">
            This record is not available in your assigned client data.
          </p>
        )
      )}

      {pathname === "/work" && (
        <>
          <SectionHeading
            title="Work"
            description="Create and update checklist work and recurring task occurrences for assigned clients."
          >
            <button
              type="button"
              onClick={() => {
                setMutationError("");
                setMutationNotice("");
                setEditor({ type: "new_work", organisationId: importedOrganisations[0]?.id || "" });
              }}
              disabled={!hasImportedData}
              className="min-h-10 rounded-lg bg-teal-700 px-4 text-sm font-semibold text-white disabled:opacity-50"
            >
              Add work
            </button>
          </SectionHeading>
          {editor?.type === "new_work" && editorOrganisation && (
            <div className="space-y-3">
              <label className="block max-w-xl text-sm font-semibold text-slate-700">
                Assigned client
                <select
                  value={editor.organisationId}
                  onChange={(event) => setEditor({ type: "new_work", organisationId: event.target.value })}
                  className={fieldClass}
                >
                  {importedOrganisations.map((organisation) => <option key={organisation.id} value={organisation.id}>{organisation.name}</option>)}
                </select>
              </label>
              <WorkItemEditor
                organisation={editorOrganisation}
                onSave={(mutation) => saveMutation(editorOrganisation, mutation)}
                onCancel={() => setEditor(null)}
              />
            </div>
          )}
          {tableRows(
            ["Work item", "Client", "Type", "Due", "Status", "Responsible", "Priority", "Action"],
            workRows.map((item) => {
              const organisation = importedOrganisations.find(
                (candidate) => candidate.id === item.organisationId,
              );
              const isEditable = item.entityType === "checklist" || item.entityType === "occurrence";
              return [
                item.title,
                item.organisation,
                item.kind,
                displayDate(item.dueDate),
                item.status,
                item.responsible,
                item.priority,
                isEditable && organisation ? (
                  <button
                    key="edit"
                    type="button"
                    onClick={() => {
                      setMutationError("");
                      setMutationNotice("");
                      setEditor(
                        item.entityType === "checklist"
                          ? { type: "work_item", organisationId: organisation.id, itemId: item.entityId }
                          : { type: "occurrence", organisationId: organisation.id, occurrenceId: item.entityId },
                      );
                    }}
                    className="font-semibold text-teal-800 hover:underline"
                  >
                    Update
                  </button>
                ) : "—",
              ];
            }),
          )}
          {editor?.type === "work_item" && editorOrganisation && editedWorkItem && (
            <WorkItemEditor
              item={editedWorkItem}
              organisation={editorOrganisation}
              onSave={(mutation) => saveMutation(editorOrganisation, mutation)}
              onCancel={() => setEditor(null)}
            />
          )}
          {editor?.type === "occurrence" && editedOccurrence && (
            <OccurrenceEditor
              occurrence={editedOccurrence}
              onSave={(mutation) => editorOrganisation
                ? saveMutation(editorOrganisation, mutation)
                : Promise.resolve()}
              onCancel={() => setEditor(null)}
            />
          )}
        </>
      )}

      {pathname === "/calendar" && (
        <>
          <SectionHeading
            title="Calendar"
            description="Scheduled work and monitored-record expiry dates for your assigned clients."
          />
          <section
            aria-label="Calendar controls"
            className="calendar-print-hide rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4"
          >
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={goToCalendarToday}
                className="cursor-pointer rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600"
              >
                Today
              </button>
              <button
                type="button"
                aria-label={`Previous ${calendarView}`}
                onClick={() => navigateCalendarPeriod(-1)}
                className="cursor-pointer rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
              >
                ←
              </button>
              <button
                type="button"
                aria-label={`Next ${calendarView}`}
                onClick={() => navigateCalendarPeriod(1)}
                className="cursor-pointer rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
              >
                →
              </button>
              <h3 className="order-first w-full text-xl font-bold text-slate-950 sm:order-none sm:ml-2 sm:w-auto sm:text-2xl">
                {calendarHeading}
              </h3>
              <div role="group" aria-label="Calendar view" className="ml-auto flex items-center gap-1 rounded-lg bg-slate-100 p-1">
                {(["month", "week"] as const).map((view) => (
                  <button
                    key={view}
                    type="button"
                    aria-pressed={calendarView === view}
                    onClick={() => setCalendarView(view)}
                    className={`cursor-pointer rounded-md px-3 py-1.5 text-sm font-semibold ${
                      calendarView === view ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:bg-white/70"
                    }`}
                  >
                    {view === "month" ? "Month" : "Week"}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-3 flex items-center border-t border-slate-100 pt-3">
              <span className="ml-auto cursor-default text-xs text-slate-500">
                {visibleCalendarActivities.length} activities {calendarView === "week" ? "this week" : "this month"}
              </span>
            </div>
          </section>

          <section
            aria-label={`Assigned-client calendar ${calendarView} view`}
            className="calendar-print-area"
          >
            {calendarView === "month" ? (
              <>
                <CalendarMonthView
                  days={calendarDays}
                  month={calendarMonth}
                  today={today}
                  selectedDate={calendarSelectedDate}
                  activities={monthActivities}
                  onSelectDate={selectCalendarDate}
                />
                <div aria-label="Calendar legend" className="mt-3 grid gap-2 text-[11px] text-slate-600 sm:grid-cols-2 lg:grid-cols-5">
                  {[
                    ["bg-emerald-500", "Completed"],
                    ["bg-blue-500", "Scheduled work"],
                    ["bg-orange-500", "Expiring soon"],
                    ["bg-red-500", "Overdue / Expired"],
                    ["bg-violet-500", "Awaiting confirmation"],
                  ].map(([colour, label]) => (
                    <span key={label} className="flex cursor-default items-center gap-2">
                      <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-full ${colour}`} />
                      {label}
                    </span>
                  ))}
                </div>
              </>
            ) : (
              <CalendarWeekView
                days={calendarWeekDays}
                today={today}
                activities={weekActivities}
              />
            )}
          </section>
          {calendarDayPanelOpen && (
            <CalendarDayPanel
              date={calendarSelectedDate}
              activities={selectedDayActivities}
              today={today}
              onClose={() => setCalendarDayPanelOpen(false)}
            />
          )}
        </>
      )}

      {pathname === "/reminders" && (
        <>
          <SectionHeading
            title="Reminders"
            description="Records and work requiring attention for your assigned clients."
          />
          {tableRows(
            ["Item", "Client", "Due", "Status", "Next action"],
            [
              ...records
                .filter(({ record }) =>
                  !["Current", "Completed", "Paused"].includes(record.status),
                )
                .map(({ organisation, record }) => [
                record.name,
                organisation,
                displayDate(record.followUp || record.expiryDate),
                record.status,
                record.nextAction || "Review monitored record",
                ]),
              ...workRows
                .filter((item) =>
                  /overdue|failed|blocked|due today/i.test(item.status),
                )
                .map((item) => [
                  item.title,
                  item.organisation,
                  displayDate(item.dueDate),
                  item.status,
                  item.kind,
                ]),
            ],
          )}
        </>
      )}

      {pathname === "/reports" && (
        <>
          <SectionHeading
            title="Reports"
            description="View and download monitored-record summaries for assigned clients."
          >
            <button
              type="button"
              onClick={() =>
                downloadCsv("assigned-client-report.csv", reportRows(importedOrganisations))
              }
              className="min-h-10 rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white"
            >
              Download records report (CSV)
            </button>
            <button
              type="button"
              onClick={() =>
                downloadCsv("assigned-client-work-report.csv", workReportRows(workRows))
              }
              className="min-h-10 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800"
            >
              Download work report (CSV)
            </button>
          </SectionHeading>
          {tableRows(
            ["Client", "Record", "Category", "Expiry", "Status", "Risk"],
            records.map(({ organisation, record }) => [
              organisation,
              record.name,
              record.category2 || record.category,
              displayDate(record.expiryDate),
              record.status,
              record.risk,
            ]),
          )}
        </>
      )}

      {pathname === "/audit-history" && (
        <>
          <SectionHeading
            title="Audit history"
            description="Operational history imported for your assigned clients."
          >
            <button
              type="button"
              onClick={() =>
                downloadCsv("assigned-client-history.csv", historyRows(importedOrganisations))
              }
              className="min-h-10 rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white"
            >
              Download history (CSV)
            </button>
          </SectionHeading>
          {tableRows(
            ["Date", "Client", "Action", "Entity", "Field", "Previous value", "New value", "User", "Context"],
            auditEvents.map((event) => [
              displayDate(event.timestamp || event.date),
              event.organisation,
              event.action,
              event.entityName || event.recordName,
              event.field || "",
              event.previousValue,
              event.newValue,
              event.user,
              event.context || "",
            ]),
          )}
        </>
      )}
    </div>
  );
}

type AssistantWorkspaceResponse = AssistantWorkspaceSnapshotResponse;
