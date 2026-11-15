"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import useClientWorkspaceData from "@/components/client/useClientWorkspaceData";
import { useSearchParams } from "next/navigation";
import {
  completeClientTaskOccurrence,
  skipClientTaskOccurrence,
  startClientTaskOccurrence,
  ClientTaskOccurrence,
} from "@/lib/clientWorkspace";
import { ChecklistItem, updateChecklistItem } from "@/lib/clientWorkspaceStore";
import { calculateStatus } from "@/lib/recordStore";

type PeriodFilter = "today" | "week" | "month" | "all";
type StatusFilter = "all" | "overdue" | "due" | "in-progress" | "completed" | "blocked";
type TaskRow = {
  key: string;
  task: string;
  related: string;
  person: string;
  due: string;
  priority: string;
  status: string;
  dueDate: string;
  kind: "occurrence" | "checklist" | "record" | "assigned";
  occurrence?: ClientTaskOccurrence;
  checklist?: ChecklistItem;
  description?: string;
  taskId?: string;
  recordHref?: string;
  nextAction?: string;
};

const periods: [PeriodFilter, string][] = [["today", "Today"], ["week", "This Week"], ["month", "This Month"], ["all", "All"]];
const statuses: [StatusFilter, string][] = [["all", "All statuses"], ["overdue", "Overdue"], ["due", "Due"], ["in-progress", "In Progress"], ["completed", "Completed"], ["blocked", "Blocked"]];

function localDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function addDays(date: Date, count: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + count);
  return localDate(result);
}

function isOpen(status: string) {
  return !["completed", "skipped", "cancelled", "Completed", "Skipped", "Carry Forward"].includes(status);
}

function statusGroup(status: string, dueDate: string, today: string) {
  if (status.toLowerCase().includes("awaiting")) return "awaiting";
  if (status.toLowerCase().includes("block")) return "blocked";
  if (status.toLowerCase().includes("complete")) return "completed";
  if (status.toLowerCase().includes("progress")) return "in-progress";
  if (status.toLowerCase().includes("expired") || status.toLowerCase().includes("overdue") || (dueDate && dueDate < today && isOpen(status))) return "overdue";
  if (status.toLowerCase() === "accepted") return "in-progress";
  if (status.toLowerCase().includes("paused") || status.toLowerCase().includes("cancelled")) return "other";
  if (isOpen(status)) return "due";
  return "other";
}

function badgeClass(status: string, dueDate: string, today: string) {
  const normalized = status.toLowerCase();
  if (normalized.includes("awaiting")) return "border-violet-200 bg-violet-50 text-violet-800";
  if (normalized.includes("expired") || normalized.includes("overdue") || (dueDate && dueDate < today)) return "border-red-200 bg-red-50 text-red-800";
  if (normalized.includes("complete")) return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (normalized.includes("block")) return "border-amber-200 bg-amber-50 text-amber-900";
  if (normalized.includes("progress") || normalized === "accepted" || dueDate === today) return "border-blue-200 bg-blue-50 text-blue-800";
  if (normalized.includes("paused") || normalized.includes("cancelled")) return "border-slate-200 bg-slate-100 text-slate-700";
  if (dueDate && dueDate <= addDays(new Date(), 7)) return "border-amber-200 bg-amber-50 text-amber-900";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

export default function ClientTasksView() {
  return (
    <Suspense
      fallback={
        <p
          role="status"
          className="p-6 text-slate-600"
        >
          Loading tasks...
        </p>
      }
    >
      <ClientTasksContent />
    </Suspense>
  );
}

function ClientTasksContent() {
  const searchParams = useSearchParams();
  const filter = searchParams.get("filter");
  const { tasks, assignedTasks, assignedTasksError, occurrences, records, team, userId, workspaceState } = useClientWorkspaceData();
  const [period, setPeriod] = useState<PeriodFilter>(() => filter === "due-today" || filter === "today" ? "today" : filter === "due-week" ? "week" : filter === "due-month" ? "month" : "all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(() => filter === "due-today" || filter === "today" ? "due" : filter === "overdue" ? "overdue" : filter === "blocked" ? "blocked" : filter === "completed" ? "completed" : "all");
  const [search, setSearch] = useState("");
  const [evidence, setEvidence] = useState<Record<string, string>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const today = localDate();
  const weekEnd = localDate(new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate() + 6 - ((new Date().getDay() + 6) % 7)));
  const monthEnd = localDate(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0));
  const taskMap = new Map(tasks.map((task) => [task.id, task]));
  const recordMap = new Map(records.map((record) => [record.id, record]));
  const trackerMap = new Map(workspaceState.trackers.map((tracker) => [tracker.id, tracker]));
  const personMap = new Map(workspaceState.people.map((person) => [person.id, person.name]));

  const rows: TaskRow[] = [
    ...occurrences.map((occurrence) => {
      const task = taskMap.get(occurrence.recurringTaskId);
      const record = task?.linkedRecordId ? recordMap.get(task.linkedRecordId) : undefined;
      return {
        key: `occurrence-${occurrence.id}`,
        task: task?.name || "Client task",
        related: record?.name || "Recurring task",
        person: task ? personMap.get(task.ownerId) || task.ownerId || "Unassigned" : "Unassigned",
        due: `${occurrence.scheduledFor}${occurrence.dueAt.includes("T") ? ` · ${occurrence.dueAt.slice(11, 16)}` : ""}`,
        priority: task?.priority || "Medium",
        status: occurrence.status.replaceAll("_", " "),
        dueDate: occurrence.scheduledFor,
        kind: "occurrence" as const,
        occurrence,
        taskId: task?.id,
        nextAction: occurrence.completionEvidence ? `Completion note: ${occurrence.completionEvidence}` : undefined,
      };
    }),
    ...workspaceState.items.map((item) => ({
      key: `checklist-${item.id}`,
      task: item.task,
      related: trackerMap.get(item.trackerId)?.name || "Work tracker",
      person: item.responsiblePersonName || "Unassigned",
      due: `${item.targetDate}${item.targetTime ? ` · ${item.targetTime}` : ""}`,
      priority: item.priority,
      status: item.status,
      dueDate: item.targetDate,
      kind: "checklist" as const,
      checklist: item,
      nextAction: item.nextAction,
    })),
    ...records.filter((record) => record.followUp || record.expiryDate).map((record) => {
      const status = calculateStatus(record);
      const dueDate = record.followUp || record.expiryDate;
      return {
        key: `record-${record.id}`,
        task: record.nextAction || `Review ${record.name}`,
        related: record.name,
        person: record.contact || "Unassigned",
        due: dueDate,
        priority: record.risk,
        status: status === "Current" ? "Upcoming" : status,
        dueDate,
        kind: "record" as const,
        recordHref: `/client/records/${record.id}`,
        nextAction: record.nextAction,
      };
    }),
    ...assignedTasks
      .filter((task) => task.assigned_to === userId && task.status === "accepted")
      .map((task) => ({
        key: `assigned-${task.id}`,
        task: task.title,
        related: "Company task assignment",
        person: team.find((member) => member.id === task.assigned_to)?.name || "You",
        due: task.due_date || "No due date",
        priority: task.priority[0].toUpperCase() + task.priority.slice(1),
        status: "Accepted",
        dueDate: task.due_date || "",
        kind: "assigned" as const,
        description: task.description || undefined,
      })),
  ];

  const visible = rows.filter((row) => {
    const matchesPeriod = period === "all" || (period === "today" ? row.dueDate === today
      : period === "week" ? Boolean(row.dueDate) && row.dueDate >= today && row.dueDate <= weekEnd
      : Boolean(row.dueDate) && row.dueDate >= today && row.dueDate <= monthEnd);
    const matchesStatus = statusFilter === "all" || statusGroup(row.status, row.dueDate, today) === statusFilter;
    const matchesSearch = `${row.task} ${row.related} ${row.person} ${row.priority} ${row.status}`.toLowerCase().includes(search.trim().toLowerCase());
    return matchesPeriod && matchesStatus && matchesSearch;
  }).sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.due.localeCompare(b.due));

  function reportAction(result: boolean | undefined, success: string) {
    setMessage(result ? success : "This action could not be completed. Refresh the workspace and try again.");
  }

  return (
  <div className="space-y-5">
        <div>
          <h2 className="text-xl font-bold text-slate-950">My work</h2>
          <p className="mt-1 text-sm text-slate-600">Recurring schedules shared with you, organisation checklist items and record follow-ups. Consultant-only tasks are excluded.</p>
        </div>
        {message && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">{message}</p>}
        {assignedTasksError && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{assignedTasksError}</p>}

        <section aria-label="Task filters" className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap gap-2" aria-label="Filter by period">
            {periods.map(([value, label]) => <button key={value} type="button" aria-pressed={period === value} onClick={() => setPeriod(value)} className={`min-h-[40px] cursor-pointer rounded-full border px-4 text-sm font-semibold ${period === value ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 text-slate-700 hover:bg-slate-50"}`}>{label}</button>)}
          </div>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex flex-wrap gap-2" aria-label="Filter by status">
              {statuses.map(([value, label]) => <button key={value} type="button" aria-pressed={statusFilter === value} onClick={() => setStatusFilter(value)} className={`min-h-[38px] cursor-pointer rounded-lg border px-3 text-sm font-semibold ${statusFilter === value ? "border-teal-700 bg-teal-50 text-teal-900" : "border-slate-300 text-slate-700 hover:bg-slate-50"}`}>{label}</button>)}
            </div>
            <label className="text-sm font-semibold text-slate-700 lg:w-80">Search work<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} className="mt-1 min-h-[42px] w-full cursor-text rounded-lg border border-slate-300 px-3" placeholder="Task, record or responsible person" /></label>
          </div>
        </section>

        <section aria-label="Client tasks" className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600"><tr>{["Task", "Related to", "Responsible person", "Due", "Priority", "Status"].map((heading) => <th key={heading} scope="col" className="px-4 py-3 font-bold">{heading}</th>)}</tr></thead>
              <tbody className="divide-y divide-slate-100">
                {visible.map((row) => (
                  <tr key={row.key} className="align-top">
                    <td colSpan={6} className="p-0">
                      <details className="group">
                        <summary className="grid cursor-pointer list-none grid-cols-[2fr_1.5fr_1.3fr_1.2fr_.8fr_1.1fr] items-center gap-3 px-4 py-3 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600 [&::-webkit-details-marker]:hidden">
                          <span className="font-semibold text-slate-950">{row.task}<span className="ml-2 text-xs font-normal text-slate-500">Details +</span></span>
                          <span className="text-slate-700">{row.related}</span><span className="text-slate-700">{row.person}</span><span className="text-slate-700">{row.due}</span><span className="text-slate-700">{row.priority}</span>
                          <span className={`w-fit rounded-full border px-2.5 py-1 text-xs font-bold ${badgeClass(row.status, row.dueDate, today)}`}>{row.status}</span>
                        </summary>
                        <div className="space-y-3 border-t border-slate-100 bg-slate-50 px-4 py-4">
                          {row.description && <p className="whitespace-pre-wrap text-sm text-slate-700">{row.description}</p>}
                          {row.nextAction && <p className="text-sm text-slate-700"><strong>Next action / note:</strong> {row.nextAction}</p>}
                          {row.kind === "record" && row.recordHref && <Link href={row.recordHref} className="inline-flex min-h-[40px] items-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 underline">View related record</Link>}
                          {row.kind === "occurrence" && row.occurrence && (() => {
                            const task = row.taskId ? taskMap.get(row.taskId) : undefined;
                            const occurrence = row.occurrence;
                            return task && isOpen(occurrence.status) ? <div className="space-y-3">
                              {task.requiresCompletionEvidence && <label className="block text-sm font-semibold text-slate-700">Completion evidence (text only)<textarea rows={2} value={evidence[occurrence.id] || ""} onChange={(event) => setEvidence({ ...evidence, [occurrence.id]: event.target.value })} className="mt-1 min-h-[70px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2" placeholder="Brief confirmation; no confidential document contents" /></label>}
                              <div className="flex flex-wrap gap-2">
                                {occurrence.status !== "in_progress" && <button type="button" onClick={() => reportAction(Boolean(startClientTaskOccurrence(occurrence.id)), "Task started and recorded.")} className="min-h-[40px] cursor-pointer rounded-lg border border-slate-300 bg-white px-4 font-semibold text-slate-800">Start</button>}
                                <button type="button" onClick={() => {
                                  if (task.requiresCompletionEvidence && !evidence[occurrence.id]?.trim()) { setMessage("Enter completion evidence before completing this task."); return; }
                                  reportAction(Boolean(completeClientTaskOccurrence(occurrence.id, evidence[occurrence.id]?.trim())), "Task completed and recorded.");
                                }} className="min-h-[40px] cursor-pointer rounded-lg bg-teal-700 px-4 font-semibold text-white">Complete</button>
                                {task.clientCanSkip && <><label className="sr-only" htmlFor={`skip-${occurrence.id}`}>Reason to skip {row.task}</label><input id={`skip-${occurrence.id}`} value={reasons[occurrence.id] || ""} onChange={(event) => setReasons({ ...reasons, [occurrence.id]: event.target.value })} className="min-h-[40px] cursor-text rounded-lg border border-slate-300 bg-white px-3" placeholder="Reason to skip" /><button type="button" onClick={() => {
                                  if (!reasons[occurrence.id]?.trim()) { setMessage("Enter a reason before skipping this task."); return; }
                                  reportAction(Boolean(skipClientTaskOccurrence(occurrence.id, reasons[occurrence.id])), "Task skipped with a reason and recorded.");
                                }} className="min-h-[40px] cursor-pointer rounded-lg border border-amber-300 bg-white px-4 font-semibold text-amber-900">Skip</button></>}
                              </div>
                            </div> : <p className="text-sm text-slate-600">No further actions are available for this schedule.</p>;
                          })()}
                          {row.kind === "checklist" && row.checklist && isOpen(row.checklist.status) && <div className="space-y-3">
                            <label className="block text-sm font-semibold text-slate-700">Completion evidence (text only)<textarea rows={2} value={evidence[row.checklist.id] || ""} onChange={(event) => setEvidence({ ...evidence, [row.checklist!.id]: event.target.value })} className="mt-1 min-h-[70px] w-full cursor-text rounded-lg border border-slate-300 bg-white px-3 py-2" placeholder="Brief operational confirmation, not document contents" /></label>
                            <div className="flex flex-wrap gap-2">
                              <button type="button" onClick={() => { const result = updateChecklistItem(row.checklist!.id, "In Progress"); setMessage(result.success ? "Checklist task started and audited." : result.message || "Checklist task could not be started."); }} className="min-h-[40px] cursor-pointer rounded-lg border border-slate-300 bg-white px-4 font-semibold">Start</button>
                              <button type="button" onClick={() => { const result = updateChecklistItem(row.checklist!.id, "Completed", evidence[row.checklist!.id]); setMessage(result.success ? "Checklist task completed and audited." : result.message || "Checklist task could not be completed."); }} className="min-h-[40px] cursor-pointer rounded-lg bg-teal-700 px-4 font-semibold text-white">Complete</button>
                              {row.checklist.clientCanSkip && <><label className="sr-only" htmlFor={`checklist-skip-${row.checklist.id}`}>Reason to skip {row.task}</label><input id={`checklist-skip-${row.checklist.id}`} value={reasons[row.checklist.id] || ""} onChange={(event) => setReasons({ ...reasons, [row.checklist!.id]: event.target.value })} className="min-h-[40px] cursor-text rounded-lg border border-slate-300 bg-white px-3" placeholder="Reason to skip" /><button type="button" onClick={() => { const result = updateChecklistItem(row.checklist!.id, "Skipped", reasons[row.checklist!.id]); setMessage(result.success ? "Checklist item skipped and audited." : result.message || "Checklist item could not be skipped."); }} className="min-h-[40px] cursor-pointer rounded-lg border border-amber-300 bg-white px-4 font-semibold text-amber-900">Skip</button></>}
                            </div>
                          </div>}
                        </div>
                      </details>
                    </td>
                  </tr>
                ))}
                {visible.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">No work matches this period, status and search.</td></tr>}
              </tbody>
            </table>
          </div>
          <p className="border-t border-slate-100 px-4 py-3 text-xs text-slate-500">Select a task row to view its actions and any client-visible completion evidence. No document file upload is available.</p>
        </section>
      </div>
      );
}
