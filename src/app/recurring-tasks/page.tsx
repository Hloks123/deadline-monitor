"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import WorkspaceShell from "@/components/workspace/WorkspaceShell";
import { getClient } from "@/lib/clientStore";
import { getRecords, MonitoredRecord } from "@/lib/recordStore";
import { getOccurrences } from "@/lib/recurringTasks/occurrenceService";
import { generateOccurrences, getRecurringTasks, seedDemoRecurringTasksIfEmpty, setRecurringTaskStatus } from "@/lib/recurringTasks/taskStore";
import { OccurrenceStatus, RecurringTask, TaskOccurrence } from "@/lib/recurringTasks/types";

type Filter = "all" | "today" | "overdue" | "failed" | "paused";

const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

const labels: Record<OccurrenceStatus, string> = {
  upcoming: "Upcoming",
  due_today: "Due today",
  in_progress: "In progress",
  completed: "Completed",
  skipped: "Skipped",
  failed: "Failed",
  overdue: "Overdue",
  cancelled: "Cancelled",
};

const scheduleLabels: Record<RecurringTask["recurrence"]["frequency"], string> = {
  once: "Does not repeat",
  daily: "Daily",
  weekdays: "Weekdays",
  weekly: "Selected weekdays",
  monthly: "Monthly",
  month_end: "Month-end",
  quarterly: "Quarterly",
  annually: "Annual",
  custom: "Custom interval",
};

function isActionable(occurrence: TaskOccurrence) {
  return !["completed", "skipped", "cancelled"].includes(occurrence.status);
}

function RecurringTasksContent() {
  const searchParams = useSearchParams();
  const requestedFilter = searchParams.get("filter");
  const filter: Filter = ["today", "overdue", "failed", "paused"].includes(requestedFilter || "")
    ? requestedFilter as Filter
    : "all";
  const [tasks, setTasks] = useState<RecurringTask[]>([]);
  const [occurrences, setOccurrences] = useState<TaskOccurrence[]>([]);
  const [records, setRecords] = useState<MonitoredRecord[]>([]);
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState("");

  function load() {
    setTasks(getRecurringTasks());
    setOccurrences(getOccurrences());
    setRecords(Object.values(getRecords()));
  }

  useEffect(() => {
    seedDemoRecurringTasksIfEmpty();
    const initialTasks = getRecurringTasks();
    const from = new Date();
    const through = new Date(from);
    from.setHours(0, 0, 0, 0);
    through.setDate(through.getDate() + 30);
    generateOccurrences(initialTasks, from, through);
    const frame = window.requestAnimationFrame(load);
    window.addEventListener("deadline-monitor-updated", load);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("deadline-monitor-updated", load);
    };
  }, []);

  const occurrencesByTask = useMemo(() => {
    const grouped = new Map<string, TaskOccurrence[]>();
    for (const occurrence of occurrences) {
      grouped.set(occurrence.recurringTaskId, [
        ...(grouped.get(occurrence.recurringTaskId) || []),
        occurrence,
      ]);
    }
    return grouped;
  }, [occurrences]);

  const filteredTasks = useMemo(() => {
    const query = search.trim().toLowerCase();
    return tasks.filter((task) => {
      const taskOccurrences = occurrencesByTask.get(task.id) || [];
      const matchesFilter = filter === "all" ||
        (filter === "paused" && task.status === "paused") ||
        (filter === "today" && taskOccurrences.some((item) => item.scheduledFor === today() && isActionable(item))) ||
        (filter === "overdue" && taskOccurrences.some((item) => item.status === "overdue")) ||
        (filter === "failed" && taskOccurrences.some((item) => item.status === "failed"));
      const record = records.find((item) => item.id === task.linkedRecordId);
      const organisation = getClient(task.organisationId)?.company || task.organisationId;
      return matchesFilter &&
        `${task.name} ${organisation} ${record?.name || ""} ${task.description || ""}`.toLowerCase().includes(query);
    });
  }, [tasks, search, filter, occurrencesByTask, records]);

  const todayOccurrences = occurrences.filter((item) => item.scheduledFor === today() && isActionable(item));
  const overdueOccurrences = occurrences.filter((item) => item.status === "overdue");
  const failedOccurrences = occurrences.filter((item) => item.status === "failed");
  const pausedTasks = tasks.filter((task) => task.status === "paused");
  const metrics = [
    { label: "Total active tasks", value: tasks.filter((task) => task.status === "active").length, href: "/recurring-tasks" },
    { label: "Due today", value: todayOccurrences.length, href: "/recurring-tasks?filter=today" },
    { label: "Overdue", value: overdueOccurrences.length, href: "/recurring-tasks?filter=overdue" },
    { label: "Failed", value: failedOccurrences.length, href: "/recurring-tasks?filter=failed" },
    { label: "Paused", value: pausedTasks.length, href: "/recurring-tasks?filter=paused" },
  ];

  function generateNextMonth() {
    const start = new Date();
    const through = new Date(start);
    through.setDate(through.getDate() + 30);
    const created = generateOccurrences(tasks, start, through);
    setNotice(`${created.length} occurrence${created.length === 1 ? "" : "s"} generated. Existing occurrences were not duplicated.`);
    load();
  }

  function occurrenceSummary(task: RecurringTask) {
    const taskOccurrences = occurrencesByTask.get(task.id) || [];
    const unresolved = taskOccurrences
      .filter(isActionable)
      .sort((a, b) => a.dueAt.localeCompare(b.dueAt));
    const latest = [...taskOccurrences].sort((a, b) => b.scheduledFor.localeCompare(a.scheduledFor))[0];
    const failed = [...taskOccurrences]
      .filter((occurrence) => occurrence.status === "failed")
      .sort((a, b) => b.scheduledFor.localeCompare(a.scheduledFor))[0];
    const missed = taskOccurrences.some((occurrence) => occurrence.status === "overdue");
    const next = unresolved[0];
    const status = task.status === "paused"
      ? "Paused"
      : task.status === "cancelled"
        ? "Cancelled"
        : failed
          ? "Failed"
          : missed
            ? "Overdue"
            : next
              ? labels[next.status]
              : "Upcoming";
    const health = task.status === "paused"
      ? "Paused"
      : failed
        ? `Failed · ${failed.retryCount} retries`
        : missed
          ? "Missed occurrence"
          : "Healthy";
    const linkedRecord = records.find((record) => record.id === task.linkedRecordId);
    const nextDue = next?.dueAt || task.nextRunAt;
    return {
      status,
      health,
      linkedRecord: linkedRecord?.name || (task.linkedRecordId ? task.linkedRecordId : "—"),
      nextDue: nextDue
        ? `${new Date(nextDue).toLocaleDateString("en-ZA")} ${nextDue.slice(11, 16) || task.dueTime || "17:00"}`
        : task.status === "paused" || task.status === "cancelled" ? "—" : "Not generated",
      lastRun: latest ? new Date(latest.updatedAt).toLocaleString("en-ZA") : task.lastRunAt ? new Date(task.lastRunAt).toLocaleString("en-ZA") : "—",
      missed: missed ? "Yes" : "No",
      retries: failed?.retryCount ?? latest?.retryCount ?? 0,
      exception: failed?.failureReason || "—",
    };
  }

  return (
    <WorkspaceShell
      eyebrow="Task Management"
      title="Recurring Tasks"
      actions={
        <>
          <button type="button" onClick={generateNextMonth} className="inline-flex min-h-[44px] items-center rounded-xl border border-slate-300 bg-white px-4 font-semibold text-slate-700 hover:bg-slate-50">
            Generate next 30 days
          </button>
          <Link href="/recurring-tasks/new" className="inline-flex min-h-[44px] items-center rounded-xl bg-teal-600 px-5 font-semibold text-white hover:bg-teal-700">
            + New Task
          </Link>
        </>
      }
    >
      <div className="space-y-6 p-5 lg:p-7">
        {notice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">{notice}</p>}
        <section aria-label="Recurring task summary" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {metrics.map((metric) => (
            <Link key={metric.label} href={metric.href} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:border-teal-500">
              <p className="text-sm font-semibold text-slate-500">{metric.label}</p>
              <p className="mt-2 text-3xl font-bold text-slate-950">{metric.value}</p>
            </Link>
          ))}
        </section>

        <section id="task-register" className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-200 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-950">Task register</h2>
              <p className="mt-1 text-sm text-slate-500">Prototype schedules and operational health. Client notifications are never sent automatically.</p>
            </div>
            <label className="sm:w-80">
              <span className="sr-only">Search recurring tasks</span>
              <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search task or organisation" className="min-h-[44px] w-full rounded-xl border border-slate-300 px-4" />
            </label>
          </div>
          <div className="divide-y divide-slate-200">
            {filteredTasks.map((task) => {
              const details = occurrenceSummary(task);
              const organisation = getClient(task.organisationId)?.company || task.organisationId;
              return (
                <article key={task.id} className="space-y-4 p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <Link href={`/recurring-tasks/${task.id}`} className="font-bold text-slate-950 hover:text-teal-700">{task.name}</Link>
                      <p className="mt-1 text-sm text-slate-600">{organisation} · {scheduleLabels[task.recurrence.frequency]}</p>
                      <p className="mt-1 text-sm text-slate-600">Linked record: {details.linkedRecord} · Owner: {task.ownerId} · Reviewer: {task.reviewerId || "—"}</p>
                      <p className="mt-1 text-sm text-slate-600">Priority: {task.priority} · Next due: {details.nextDue} · Status: {details.status}</p>
                      <p className="mt-1 text-sm text-slate-600">Job health: {details.health} · Last run: {details.lastRun} · Missed occurrence: {details.missed} · Retries: {details.retries}</p>
                      {details.exception !== "—" && <p className="mt-1 text-sm text-red-700">Exception: {details.exception}</p>}
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <Link href={`/recurring-tasks/${task.id}`} className="inline-flex min-h-[40px] items-center rounded-lg border border-slate-300 px-4 font-semibold text-slate-700">Edit / History</Link>
                      {task.status !== "cancelled" && (
                        <>
                          <button type="button" onClick={() => { setRecurringTaskStatus(task.id, task.status === "active" ? "paused" : "active"); load(); }} className="min-h-[40px] rounded-lg bg-slate-950 px-4 font-semibold text-white">
                            {task.status === "active" ? "Pause" : "Resume"}
                          </button>
                          <button type="button" onClick={() => { setRecurringTaskStatus(task.id, "cancelled"); load(); }} className="min-h-[40px] rounded-lg border border-red-300 px-4 font-semibold text-red-700">Cancel</button>
                        </>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
            {filteredTasks.length === 0 && <p className="p-8 text-center text-slate-500">{tasks.length === 0 ? "No recurring tasks yet. Create a schedule to get started." : "No tasks match this filter or search."}</p>}
          </div>
        </section>

        <section id="occurrence-register" className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-5">
            <h2 className="text-xl font-bold text-slate-950">Occurrence history</h2>
            <p className="mt-1 text-sm text-slate-500">Start, complete, skip with a reason, or record a failure from the task history.</p>
          </div>
          <div className="divide-y divide-slate-200">
            {occurrences
              .filter((item) => filter === "all" || filter === "paused" ||
                (filter === "today" && item.scheduledFor === today() && isActionable(item)) ||
                (filter === "overdue" && item.status === "overdue") ||
                (filter === "failed" && item.status === "failed"))
              .sort((a, b) => b.scheduledFor.localeCompare(a.scheduledFor))
              .slice(0, 30)
              .map((occurrence) => (
                <Link key={occurrence.id} href={`/recurring-tasks/${occurrence.recurringTaskId}`} className="flex flex-wrap items-center justify-between gap-3 p-4 hover:bg-slate-50">
                  <span>
                    <span className="font-semibold text-slate-900">{tasks.find((task) => task.id === occurrence.recurringTaskId)?.name || occurrence.recurringTaskId}</span>
                    <span className="ml-2 text-sm text-slate-500">{occurrence.scheduledFor} · {occurrence.dueAt.slice(11, 16)}</span>
                    <span className="ml-2 text-xs text-slate-500">Retries: {occurrence.retryCount}{occurrence.failureReason ? ` · ${occurrence.failureReason}` : ""}</span>
                  </span>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">{labels[occurrence.status]}</span>
                </Link>
              ))}
            {occurrences.length === 0 && <p className="p-8 text-center text-slate-500">Occurrences appear here after generating a schedule.</p>}
            {occurrences.length > 0 && filter !== "all" && filter !== "paused" &&
              !occurrences.some((item) =>
                (filter === "today" && item.scheduledFor === today() && isActionable(item)) ||
                (filter === "overdue" && item.status === "overdue") ||
                (filter === "failed" && item.status === "failed")
              ) && <p className="p-8 text-center text-slate-500">No occurrences match this filter.</p>}
          </div>
        </section>
      </div>
    </WorkspaceShell>
  );
}

export default function RecurringTasksPage() {
  return (
    <Suspense fallback={<p className="p-8 text-slate-600" role="status">Loading recurring tasks...</p>}>
      <RecurringTasksContent />
    </Suspense>
  );
}
