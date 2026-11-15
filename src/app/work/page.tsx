"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import WorkspaceShell from "@/components/workspace/WorkspaceShell";
import {
  loadConsultantWorkSnapshot,
  type ConsultantException,
  type ConsultantWorkItem,
  type ConsultantWorkSnapshot,
} from "@/lib/consultantWork";
import { businessDateKey, businessTimeKey, clientBusinessToday, clientWeekRange } from "@/lib/clientWorkspaceSelectors";
import { setRecurringTaskStatus } from "@/lib/recurringTasks/taskStore";

type WorkTab = "tasks" | "checklists" | "recurring" | "completed" | "exceptions";
type TaskScope = "all" | "today" | "week" | "month" | "overdue" | "blocked" | "completed";

const tabs: Array<{ id: WorkTab; label: string }> = [
  { id: "tasks", label: "Tasks" },
  { id: "checklists", label: "Checklists" },
  { id: "recurring", label: "Recurring" },
  { id: "completed", label: "Completed" },
  { id: "exceptions", label: "Exceptions" },
];
const scopes: Array<{ id: TaskScope; label: string }> = [
  { id: "all", label: "All work" },
  { id: "today", label: "Today" },
  { id: "week", label: "This Week" },
  { id: "month", label: "This Month" },
  { id: "overdue", label: "Overdue" },
  { id: "blocked", label: "Blocked" },
  { id: "completed", label: "Completed" },
];
const emptySnapshot: ConsultantWorkSnapshot = {
  organisations: [],
  people: [],
  tasks: [],
  checklists: [],
  recurring: [],
  completed: [],
  exceptions: [],
};
const inputClass = "min-h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-700";

function statusClass(status: string) {
  const normalized = status.toLowerCase();
  if (normalized.includes("overdue") || normalized.includes("failed") || normalized.includes("expired")) return "border-red-200 bg-red-50 text-red-800";
  if (normalized.includes("completed")) return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (normalized.includes("blocked")) return "border-amber-200 bg-amber-50 text-amber-900";
  if (normalized.includes("awaiting")) return "border-violet-200 bg-violet-50 text-violet-800";
  if (normalized.includes("paused")) return "border-slate-200 bg-slate-100 text-slate-700";
  if (normalized.includes("due today") || normalized.includes("in progress")) return "border-blue-200 bg-blue-50 text-blue-800";
  return "border-teal-200 bg-teal-50 text-teal-800";
}

function severityClass(severity: ConsultantException["severity"]) {
  if (severity === "Critical") return "border-red-300 bg-red-50 text-red-900";
  if (severity === "High") return "border-orange-300 bg-orange-50 text-orange-900";
  if (severity === "Medium") return "border-amber-300 bg-amber-50 text-amber-900";
  return "border-slate-300 bg-slate-50 text-slate-700";
}

function StatusBadge({ children }: { children: string }) {
  return <span className={`inline-flex cursor-default rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass(children)}`}>{children}</span>;
}

function DateText({ value }: { value: string }) {
  return <span className="whitespace-nowrap">{value || "—"}</span>;
}

function dateTimeLabel(value: string) {
  const date = businessDateKey(value);
  if (!date) return "Not generated";
  const time = businessTimeKey(value);
  return time ? `${date} ${time}` : date;
}

function matchesScope(item: ConsultantWorkItem, scope: TaskScope, today: string) {
  if (scope === "all") return true;
  if (scope === "completed") return item.status === "Completed";
  if (scope === "blocked") return item.status === "Blocked";
  if (scope === "overdue") return item.status === "Overdue";
  if (!item.dueDate) return false;
  if (scope === "today") return item.dueDate === today;
  if (scope === "week") {
    const week = clientWeekRange(today);
    return item.dueDate >= week.start && item.dueDate <= week.end;
  }
  return item.dueDate.slice(0, 7) === today.slice(0, 7);
}

function TaskTable({ items }: { items: ConsultantWorkItem[] }) {
  if (!items.length) return <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-600">No work matches these filters.</p>;
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="w-full min-w-[1050px] border-collapse text-left text-sm">
        <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
          <tr>{["Task", "Organisation", "Related To", "Responsible", "Due", "Priority", "Status", "Source"].map((heading) => <th key={heading} scope="col" className="px-3 py-3">{heading}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {items.map((item) => (
            <tr key={`${item.organisationId}:${item.id}`} className="cursor-default align-top">
              <td className="max-w-xs px-3 py-3 font-semibold text-slate-950">{item.task}</td>
              <td className="px-3 py-3 text-slate-700">{item.organisation}</td>
              <td className="px-3 py-3 text-slate-700">{item.related}</td>
              <td className="px-3 py-3 text-slate-700">{item.responsible}</td>
              <td className="px-3 py-3 text-slate-700"><DateText value={item.dueDate} />{item.dueTime && <span className="ml-1">· {item.dueTime}</span>}</td>
              <td className="px-3 py-3 text-slate-700">{item.priority || "—"}</td>
              <td className="px-3 py-3"><StatusBadge>{item.status}</StatusBadge></td>
              <td className="px-3 py-3 text-slate-700">{item.source}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ConsultantWorkPage() {
  const [snapshot, setSnapshot] = useState(emptySnapshot);
  const [activeTab, setActiveTab] = useState<WorkTab>("tasks");
  const [organisationId, setOrganisationId] = useState("all");
  const [scope, setScope] = useState<TaskScope>("all");
  const [responsible, setResponsible] = useState("all");
  const [status, setStatus] = useState("all");
  const [priority, setPriority] = useState("all");
  const [selectedChecklistId, setSelectedChecklistId] = useState("");
  const [expandedTaskId, setExpandedTaskId] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  function load() {
    setSnapshot(loadConsultantWorkSnapshot());
  }

  useEffect(() => {
    const frame = window.requestAnimationFrame(load);
    window.addEventListener("deadline-monitor-updated", load);
    window.addEventListener("deadline-monitor-clients-updated", load);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("deadline-monitor-updated", load);
      window.removeEventListener("deadline-monitor-clients-updated", load);
    };
  }, []);

  const today = clientBusinessToday();
  const people = useMemo(() => snapshot.people.filter((person) =>
    organisationId === "all" || person.organisationId === organisationId
  ).sort((left, right) => left.name.localeCompare(right.name)), [snapshot.people, organisationId]);
  const visibleTasks = useMemo(() => snapshot.tasks.filter((item) =>
    (organisationId === "all" || item.organisationId === organisationId) &&
    matchesScope(item, scope, today) &&
    (responsible === "all" || item.responsible === responsible) &&
    (status === "all" || item.status === status) &&
    (priority === "all" || item.priority === priority)
  ), [snapshot.tasks, organisationId, scope, today, responsible, status, priority]);
  const visibleChecklists = snapshot.checklists.filter((tracker) =>
    organisationId === "all" || tracker.organisationId === organisationId
  );
  const selectedChecklist = visibleChecklists.find((tracker) => tracker.id === selectedChecklistId);
  const visibleRecurring = snapshot.recurring.filter((schedule) =>
    organisationId === "all" || schedule.task.organisationId === organisationId
  );
  const visibleCompleted = snapshot.completed.filter((item) =>
    organisationId === "all" || item.organisationId === organisationId
  );
  const visibleExceptions = snapshot.exceptions.filter((item) =>
    organisationId === "all" || item.organisationId === organisationId
  );

  function updateRecurringStatus(id: string, nextStatus: "active" | "paused" | "cancelled") {
    const task = snapshot.recurring.find((schedule) => schedule.task.id === id)?.task;
    if (!task) {
      setError("The recurring schedule could not be found.");
      return;
    }
    if (nextStatus === "cancelled" && !window.confirm(`Cancel the recurring schedule "${task.name}"?`)) return;
    const updated = setRecurringTaskStatus(id, nextStatus);
    if (!updated) {
      setError("The recurring schedule status could not be updated.");
      return;
    }
    setError("");
    setNotice(`${task.name} ${nextStatus === "active" ? "resumed" : nextStatus}. The change was audited.`);
    load();
  }

  function handleTabKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const currentIndex = tabs.findIndex((tab) => tab.id === activeTab);
    const nextIndex = event.key === "Home" ? 0
      : event.key === "End" ? tabs.length - 1
      : (currentIndex + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
    setActiveTab(tabs[nextIndex].id);
    document.getElementById(`consultant-work-tab-${tabs[nextIndex].id}`)?.focus();
  }

  return (
    <WorkspaceShell eyebrow="Operations" title="Work">
      <div className="space-y-5 p-4 sm:p-6 lg:p-8">
        <section aria-label="Work organisation filter" className="rounded-xl border border-teal-200 bg-teal-50 p-4 sm:flex sm:items-center sm:gap-4">
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold text-slate-950">Organisation</h2>
            <p className="mt-1 text-sm text-slate-600">Choose all authorised prototype organisations or focus on one client.</p>
          </div>
          <label className="mt-3 block text-sm font-semibold text-slate-700 sm:mt-0 sm:w-80">
            <span className="sr-only">Filter by organisation</span>
            <select value={organisationId} onChange={(event) => {
              setOrganisationId(event.target.value);
              setSelectedChecklistId("");
              setResponsible("all");
            }} className={`${inputClass} w-full cursor-pointer`}>
              <option value="all">All authorised organisations</option>
              {snapshot.organisations.map((organisation) => <option key={organisation.id} value={organisation.id}>{organisation.name}</option>)}
            </select>
          </label>
        </section>

        {notice && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">{notice}</p>}
        {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">{error}</p>}

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div role="tablist" aria-label="Consultant work sections" onKeyDown={handleTabKeyDown} className="flex overflow-x-auto border-b border-slate-200 px-2 sm:px-4">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                id={`consultant-work-tab-${tab.id}`}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                aria-controls="consultant-work-panel"
                tabIndex={activeTab === tab.id ? 0 : -1}
                onClick={() => setActiveTab(tab.id)}
                className={`min-h-12 shrink-0 cursor-pointer border-b-2 px-4 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-600 sm:min-h-14 sm:px-5 ${activeTab === tab.id ? "border-teal-600 text-teal-800" : "border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-950"}`}
              >{tab.label}</button>
            ))}
          </div>

          <div id="consultant-work-panel" role="tabpanel" aria-labelledby={`consultant-work-tab-${activeTab}`} className="space-y-4 p-3 sm:p-5">
            {activeTab === "tasks" && (
              <>
                <div className="flex flex-wrap gap-2" aria-label="Task date and status filters">
                  {scopes.map((option) => (
                    <button key={option.id} type="button" aria-pressed={scope === option.id} onClick={() => setScope(option.id)} className={`min-h-9 cursor-pointer rounded-full border px-3 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-700 ${scope === option.id ? "border-teal-700 bg-teal-50 text-teal-900" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"}`}>{option.label}</button>
                  ))}
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <label className="text-sm font-semibold text-slate-700">Responsible person
                    <select value={responsible} onChange={(event) => setResponsible(event.target.value)} className={`${inputClass} mt-1 w-full cursor-pointer`}>
                      <option value="all">Everyone</option>
                      {[...new Set(people.map((person) => person.name))].map((name) => <option key={name} value={name}>{name}</option>)}
                    </select>
                  </label>
                  <label className="text-sm font-semibold text-slate-700">Status
                    <select value={status} onChange={(event) => setStatus(event.target.value)} className={`${inputClass} mt-1 w-full cursor-pointer`}>
                      <option value="all">All statuses</option>
                      {[...new Set(snapshot.tasks.map((item) => item.status))].sort().map((value) => <option key={value} value={value}>{value}</option>)}
                    </select>
                  </label>
                  <label className="text-sm font-semibold text-slate-700">Priority
                    <select value={priority} onChange={(event) => setPriority(event.target.value)} className={`${inputClass} mt-1 w-full cursor-pointer`}>
                      <option value="all">All priorities</option>
                      {[...new Set(snapshot.tasks.map((item) => item.priority).filter(Boolean))].sort().map((value) => <option key={value} value={value}>{value}</option>)}
                    </select>
                  </label>
                </div>
                <TaskTable items={visibleTasks} />
              </>
            )}

            {activeTab === "checklists" && (
              <>
                {visibleChecklists.length === 0 ? <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-600">No checklists are available for this organisation filter.</p> : (
                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full min-w-[900px] border-collapse text-left text-sm">
                      <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600"><tr>{["Checklist", "Organisation", "Owner", "Period", "Items", "Completed", "Overdue", "Status", "Action"].map((heading) => <th key={heading} scope="col" className="px-3 py-3">{heading}</th>)}</tr></thead>
                      <tbody className="divide-y divide-slate-100">
                        {visibleChecklists.map((tracker) => (
                          <tr key={`${tracker.organisationId}:${tracker.id}`} className="cursor-default">
                            <td className="px-3 py-3 font-semibold text-slate-950">{tracker.name}</td>
                            <td className="px-3 py-3">{tracker.organisation}</td>
                            <td className="px-3 py-3">{tracker.owner}</td>
                            <td className="px-3 py-3">{tracker.periodType}<span className="block text-xs text-slate-500">{tracker.startDate} – {tracker.endDate}</span></td>
                            <td className="px-3 py-3">{tracker.items.length}</td>
                            <td className="px-3 py-3">{tracker.completedCount}</td>
                            <td className="px-3 py-3">{tracker.overdueCount}</td>
                            <td className="px-3 py-3"><StatusBadge>{tracker.status}</StatusBadge></td>
                            <td className="px-3 py-3"><button type="button" aria-pressed={selectedChecklistId === tracker.id} onClick={() => setSelectedChecklistId(selectedChecklistId === tracker.id ? "" : tracker.id)} className="cursor-pointer rounded-lg border border-teal-700 px-3 py-2 text-sm font-semibold text-teal-900 hover:bg-teal-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-700">View items</button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {selectedChecklist && (
                  <section aria-label={`${selectedChecklist.name} checklist items`} className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <h3 className="font-semibold text-slate-950">{selectedChecklist.name} · Items</h3>
                    {selectedChecklist.items.length === 0 ? <p className="text-sm text-slate-600">No items have been added to this checklist.</p> : (
                      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                        <table className="w-full min-w-[820px] border-collapse text-left text-sm">
                          <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600"><tr>{["Task", "Responsible", "Target date/time", "Priority", "Status", "Next action"].map((heading) => <th key={heading} scope="col" className="px-3 py-2">{heading}</th>)}</tr></thead>
                          <tbody className="divide-y divide-slate-100">{selectedChecklist.items.map((item) => {
                            const workItem = snapshot.tasks.find((candidate) => candidate.kind === "checklist" && candidate.id === `checklist:${item.id}`);
                            const itemStatus = workItem?.status || item.status;
                            return <tr key={item.id} className="cursor-default"><td className="px-3 py-3 font-medium">{item.task}</td><td className="px-3 py-3">{item.responsiblePersonName || "Unassigned"}</td><td className="px-3 py-3"><DateText value={item.targetDate} />{item.targetTime && ` ${item.targetTime}`}</td><td className="px-3 py-3">{item.priority}</td><td className="px-3 py-3"><StatusBadge>{itemStatus}</StatusBadge></td><td className="px-3 py-3">{item.nextAction || item.blockedReason || "—"}</td></tr>;
                          })}</tbody>
                        </table>
                      </div>
                    )}
                  </section>
                )}
              </>
            )}

            {activeTab === "recurring" && (
              visibleRecurring.length === 0 ? <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-600">No recurring schedules are available for this organisation filter.</p> : (
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full min-w-[1200px] border-collapse text-left text-sm">
                    <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600"><tr>{["Schedule", "Organisation", "Owner", "Repeats", "Due Time", "Last Run", "Next Run", "Priority", "Status", "Job Health", "Actions"].map((heading) => <th key={heading} scope="col" className="px-3 py-3">{heading}</th>)}</tr></thead>
                    <tbody className="divide-y divide-slate-100">
                      {visibleRecurring.map((schedule) => {
                        const task = schedule.task;
                        const occurrences = snapshot.tasks.filter((row) => row.kind === "recurring" && row.occurrence?.recurringTaskId === task.id);
                        return (
                          <tr key={`${task.organisationId}:${task.id}`} className="cursor-default align-top">
                            <td className="px-3 py-3"><span className="block font-semibold text-slate-950">{task.name}</span><span className="text-xs text-slate-500">{schedule.related}</span></td>
                            <td className="px-3 py-3">{schedule.organisation}</td>
                            <td className="px-3 py-3">{schedule.owner}</td>
                            <td className="px-3 py-3">{schedule.repeats}</td>
                            <td className="px-3 py-3">{task.dueTime || "—"}</td>
                            <td className="px-3 py-3">{schedule.lastRun ? new Date(schedule.lastRun).toLocaleString("en-ZA") : "—"}</td>
                            <td className="px-3 py-3">{dateTimeLabel(schedule.nextRun)}</td>
                            <td className="px-3 py-3">{task.priority}</td>
                            <td className="px-3 py-3"><StatusBadge>{task.status}</StatusBadge></td>
                            <td className="px-3 py-3"><StatusBadge>{schedule.jobHealth}</StatusBadge></td>
                            <td className="px-3 py-3">
                              <div className="flex min-w-48 flex-wrap gap-1">
                                <Link href={`/recurring-tasks/${task.id}`} className="cursor-pointer rounded border border-slate-300 px-2 py-1 text-xs font-semibold text-teal-800 hover:bg-teal-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-700">View / Edit</Link>
                                {task.status === "active"
                                  ? <button type="button" onClick={() => updateRecurringStatus(task.id, "paused")} className="cursor-pointer rounded border border-slate-300 px-2 py-1 text-xs font-semibold hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-700">Pause</button>
                                  : task.status === "paused"
                                    ? <button type="button" onClick={() => updateRecurringStatus(task.id, "active")} className="cursor-pointer rounded border border-slate-300 px-2 py-1 text-xs font-semibold hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-700">Resume</button>
                                    : null}
                                {task.status !== "cancelled" && <button type="button" onClick={() => updateRecurringStatus(task.id, "cancelled")} className="cursor-pointer rounded border border-red-200 px-2 py-1 text-xs font-semibold text-red-800 hover:bg-red-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-700">Cancel</button>}
                                <button type="button" aria-expanded={expandedTaskId === task.id} onClick={() => setExpandedTaskId(expandedTaskId === task.id ? "" : task.id)} className="cursor-pointer rounded border border-slate-300 px-2 py-1 text-xs font-semibold hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-700">View Occurrences ({occurrences.length})</button>
                              </div>
                              {expandedTaskId === task.id && (
                                <ul className="mt-2 space-y-1 text-xs text-slate-700">
                                  {occurrences.length ? occurrences.map((occurrence) => <li key={occurrence.id}>{occurrence.dueDate} {occurrence.dueTime} · {occurrence.status}</li>) : <li>No occurrences are stored for this schedule.</li>}
                                </ul>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )
            )}

            {activeTab === "completed" && (
              visibleCompleted.length === 0 ? <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-600">No completed work is available for this organisation filter.</p> : (
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full min-w-[1000px] border-collapse text-left text-sm">
                    <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600"><tr>{["Work", "Organisation", "Type", "Responsible", "Due", "Completed", "Completion Evidence"].map((heading) => <th key={heading} scope="col" className="px-3 py-3">{heading}</th>)}</tr></thead>
                    <tbody className="divide-y divide-slate-100">{visibleCompleted.map((item) => <tr key={`${item.organisationId}:${item.id}`} className="cursor-default"><td className="px-3 py-3 font-semibold">{item.task}</td><td className="px-3 py-3">{item.organisation}</td><td className="px-3 py-3">{item.source}</td><td className="px-3 py-3">{item.responsible}</td><td className="px-3 py-3">{item.dueDate || "—"}</td><td className="px-3 py-3">{item.completedDate || "—"}</td><td className="max-w-sm px-3 py-3">{item.completionEvidence || "—"}</td></tr>)}</tbody>
                  </table>
                </div>
              )
            )}

            {activeTab === "exceptions" && (
              visibleExceptions.length === 0 ? <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-600">No operational exceptions match this organisation.</p> : (
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full min-w-[1050px] border-collapse text-left text-sm">
                    <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600"><tr>{["Severity", "Organisation", "Issue", "Related Item", "Responsible", "Date", "Next Action", "Status"].map((heading) => <th key={heading} scope="col" className="px-3 py-3">{heading}</th>)}</tr></thead>
                    <tbody className="divide-y divide-slate-100">{visibleExceptions.map((item) => <tr key={`${item.organisationId}:${item.id}`} className="cursor-default"><td className="px-3 py-3"><span className={`inline-flex cursor-default rounded-full border px-2.5 py-1 text-xs font-semibold ${severityClass(item.severity)}`}>{item.severity}</span></td><td className="px-3 py-3">{item.organisation}</td><td className="px-3 py-3 font-medium">{item.issue}</td><td className="px-3 py-3">{item.related}</td><td className="px-3 py-3">{item.responsible}</td><td className="px-3 py-3">{item.date || "—"}</td><td className="px-3 py-3">{item.nextAction}</td><td className="px-3 py-3"><StatusBadge>{item.status}</StatusBadge></td></tr>)}</tbody>
                  </table>
                </div>
              )
            )}
          </div>
        </section>
      </div>
    </WorkspaceShell>
  );
}
