"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import WorkspaceShell from "@/components/workspace/WorkspaceShell";
import { getActiveClients, getClient } from "@/lib/clientStore";
import { getRecords } from "@/lib/recordStore";
import { completeOccurrence, failOccurrence, getOccurrences, retryOccurrence, skipOccurrence, startOccurrence } from "@/lib/recurringTasks/occurrenceService";
import { getRecurringTask, generateOccurrences, saveRecurringTask, setRecurringTaskStatus } from "@/lib/recurringTasks/taskStore";
import { OccurrenceStatus, RecurrenceFrequency, RecurringTask, TaskOccurrence, TaskPriority } from "@/lib/recurringTasks/types";

const occurrenceLabels: Record<OccurrenceStatus, string> = {
  upcoming: "Upcoming", due_today: "Due today", in_progress: "In progress",
  completed: "Completed", skipped: "Skipped", failed: "Failed",
  overdue: "Overdue", cancelled: "Cancelled",
};

export default function RecurringTaskDetailPage() {
  const params = useParams<{ id: string }>();
  const id = String(params.id);
  const [task, setTask] = useState<RecurringTask | null>(null);
  const [occurrences, setOccurrences] = useState<TaskOccurrence[]>([]);
  const [evidence, setEvidence] = useState<Record<string, string>>({});
  const [reason, setReason] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const clients = getActiveClients();
  const records = Object.values(getRecords());
  const relatedRecords = records.filter((record) => record.organisationId === task?.organisationId);

  const load = useCallback(() => {
    setTask(getRecurringTask(id) || null);
    setOccurrences(getOccurrences().filter((item) => item.recurringTaskId === id));
  }, [id]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(load);
    window.addEventListener("deadline-monitor-updated", load);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("deadline-monitor-updated", load);
    };
  }, [id, load]);

  if (!task) {
    return <WorkspaceShell eyebrow="Task Management" title="Recurring Task"><div className="p-8"><p className="text-slate-600">Task not found.</p><Link href="/recurring-tasks" className="mt-4 inline-block font-semibold text-teal-700">Back to Recurring Tasks</Link></div></WorkspaceShell>;
  }

  const currentTask = task;
  const client = getClient(currentTask.organisationId);

  function updateTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!currentTask.name.trim() || !currentTask.ownerId.trim()) {
      setError("Task name and owner are required.");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(currentTask.startDate) || Number.isNaN(new Date(`${currentTask.startDate}T00:00:00`).getTime())) {
      setError("Enter a valid start date.");
      return;
    }
    if (currentTask.recurrence.frequency === "weekly" && !currentTask.recurrence.weekdays?.length) {
      setError("Select at least one weekday for a weekly schedule.");
      return;
    }
    if (currentTask.recurrence.frequency === "monthly" && (!Number.isInteger(currentTask.recurrence.dayOfMonth) || (currentTask.recurrence.dayOfMonth || 0) < 1 || (currentTask.recurrence.dayOfMonth || 0) > 31)) {
      setError("Choose a day of the month from 1 to 31.");
      return;
    }
    if (currentTask.recurrence.frequency === "custom" &&
      (!Number.isInteger(currentTask.recurrence.interval) || (currentTask.recurrence.interval || 0) < 1 ||
        (currentTask.recurrence.interval || 0) > 365 || !currentTask.recurrence.intervalUnit)) {
      setError("Enter a valid custom interval from 1 to 365 and select its unit.");
      return;
    }
    saveRecurringTask(currentTask, currentTask.id);
    setError("");
    setNotice("Task schedule saved and audited.");
  }

  function generate() {
    const from = new Date();
    const through = new Date();
    through.setDate(through.getDate() + 60);
    const created = generateOccurrences([currentTask], from, through);
    setNotice(`${created.length} occurrence${created.length === 1 ? "" : "s"} added. Existing occurrences were not duplicated.`);
    load();
  }

  function complete(occurrence: TaskOccurrence) {
    const completionEvidence = evidence[occurrence.id]?.trim();
    if (currentTask.requiresCompletionEvidence && !completionEvidence) {
      setError("Enter completion evidence before completing this task.");
      return;
    }
    completeOccurrence(occurrence.id, completionEvidence);
    setError("");
    setNotice("Occurrence completed.");
    load();
  }

  function skip(occurrence: TaskOccurrence) {
    const skipReason = reason[occurrence.id]?.trim();
    if (!skipReason) {
      setError("Enter a reason before skipping an occurrence.");
      return;
    }
    skipOccurrence(occurrence.id, skipReason);
    setError("");
    setNotice("Occurrence skipped and audited.");
    load();
  }

  function fail(occurrence: TaskOccurrence) {
    const failureReason = reason[occurrence.id]?.trim();
    if (!failureReason) {
      setError("Enter a failure reason before marking an occurrence failed.");
      return;
    }
    failOccurrence(occurrence.id, failureReason);
    setError("");
    setNotice("Occurrence marked failed and audited.");
    load();
  }

  const inputClass = "min-h-[42px] w-full rounded-lg border border-slate-300 px-3";
  const taskOccurrences = occurrences;
  const lastOccurrence = [...taskOccurrences].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  const nextOccurrence = taskOccurrences
    .filter((occurrence) => !["completed", "skipped", "cancelled"].includes(occurrence.status))
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt))[0];
  const updateRecurrence = (frequency: RecurrenceFrequency) => setTask({
    ...currentTask,
    recurrence: {
      frequency,
      ...(frequency === "weekly" ? { weekdays: currentTask.recurrence.weekdays || [] } : {}),
      ...(frequency === "monthly" ? { dayOfMonth: currentTask.recurrence.dayOfMonth || 1 } : {}),
      ...(frequency === "custom" ? {
        interval: currentTask.recurrence.interval || 1,
        intervalUnit: currentTask.recurrence.intervalUnit || "week",
      } : {}),
    },
  });
  const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  return (
    <WorkspaceShell eyebrow="Task Management" title={task.name} actions={<Link href="/recurring-tasks" className="rounded-xl border border-slate-300 bg-white px-4 py-3 font-semibold text-slate-700">Back to Tasks</Link>}>
      <div className="space-y-6 p-5 lg:p-7">
        {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">{error}</p>}
        {notice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">{notice}</p>}
        <section aria-label="Task monitoring" className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-5 sm:grid-cols-2 lg:grid-cols-4">
          <p className="text-sm text-slate-600"><strong>Last run:</strong> {lastOccurrence ? new Date(lastOccurrence.updatedAt).toLocaleString("en-ZA") : task.lastRunAt || "Not run"}</p>
          <p className="text-sm text-slate-600"><strong>Next run:</strong> {nextOccurrence ? `${nextOccurrence.scheduledFor} ${nextOccurrence.dueAt.slice(11, 16)}` : task.nextRunAt || "Not generated"}</p>
          <p className="text-sm text-slate-600"><strong>Missed occurrence:</strong> {taskOccurrences.some((item) => item.status === "overdue") ? "Yes" : "No"}</p>
          <p className="text-sm text-slate-600"><strong>Job health:</strong> {lastOccurrence?.status === "failed" ? `Failed (${lastOccurrence.retryCount} retries)` : lastOccurrence?.status === "overdue" ? "Missed occurrence" : task.status === "paused" ? "Paused" : "Healthy"}</p>
          {lastOccurrence?.failureReason && <p className="text-sm text-red-700 sm:col-span-2 lg:col-span-4"><strong>Exception:</strong> {lastOccurrence.failureReason}</p>}
        </section>
        <form onSubmit={updateTask} className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-6 sm:grid-cols-2">
          <label className="font-semibold text-slate-700">Task name<input required value={task.name} onChange={(event) => setTask({ ...task, name: event.target.value })} className={`${inputClass} mt-2`} /></label>
          <label className="font-semibold text-slate-700">Organisation<select value={task.organisationId} onChange={(event) => setTask({ ...task, organisationId: event.target.value, linkedRecordId: undefined })} className={`${inputClass} mt-2`}>{clients.map((item) => <option key={item.id} value={item.id}>{item.company}</option>)}{!client && <option value={task.organisationId}>{task.organisationId}</option>}</select></label>
          <label className="font-semibold text-slate-700">Linked record (optional)<select value={task.linkedRecordId || ""} onChange={(event) => setTask({ ...task, linkedRecordId: event.target.value || undefined })} className={`${inputClass} mt-2`}><option value="">No linked record</option>{relatedRecords.map((record) => <option key={record.id} value={record.id}>{record.name}</option>)}</select></label>
          <label className="font-semibold text-slate-700">Owner<input required value={task.ownerId} onChange={(event) => setTask({ ...task, ownerId: event.target.value })} className={`${inputClass} mt-2`} /></label>
          <label className="font-semibold text-slate-700">Reviewer<input value={task.reviewerId || ""} onChange={(event) => setTask({ ...task, reviewerId: event.target.value || undefined })} className={`${inputClass} mt-2`} /></label>
          <label className="font-semibold text-slate-700">Priority<select value={task.priority} onChange={(event) => setTask({ ...task, priority: event.target.value as TaskPriority })} className={`${inputClass} mt-2`}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option></select></label>
          <label className="font-semibold text-slate-700">Start date<input type="date" required value={task.startDate} onChange={(event) => setTask({ ...task, startDate: event.target.value })} className={`${inputClass} mt-2`} /></label>
          <label className="font-semibold text-slate-700">Due time<input type="time" required value={task.dueTime || "17:00"} onChange={(event) => setTask({ ...task, dueTime: event.target.value })} className={`${inputClass} mt-2`} /></label>
          <label className="font-semibold text-slate-700">Recurrence<select value={task.recurrence.frequency} onChange={(event) => updateRecurrence(event.target.value as RecurrenceFrequency)} className={`${inputClass} mt-2`}>{[["daily","Daily"],["weekdays","Every weekday"],["weekly","Selected weekdays"],["monthly","Monthly"],["month_end","Month-end"],["quarterly","Quarterly"],["annually","Annual"],["custom","Custom interval"]].map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          {task.recurrence.frequency === "weekly" && <fieldset className="sm:col-span-2"><legend className="font-semibold text-slate-700">Repeat on</legend><div className="mt-2 flex flex-wrap gap-3">{weekdays.map((day,index) => <label key={day} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={task.recurrence.weekdays?.includes(index) || false} onChange={(event) => setTask({ ...task, recurrence: { ...task.recurrence, weekdays: event.target.checked ? [...new Set([...(task.recurrence.weekdays || []), index])].sort() : (task.recurrence.weekdays || []).filter((value) => value !== index) } })} />{day}</label>)}</div></fieldset>}
          {task.recurrence.frequency === "monthly" && <label className="font-semibold text-slate-700">Day of month<input type="number" min="1" max="31" value={task.recurrence.dayOfMonth || 1} onChange={(event) => setTask({ ...task, recurrence: { ...task.recurrence, dayOfMonth: Number(event.target.value) } })} className={`${inputClass} mt-2`} /></label>}
          {task.recurrence.frequency === "custom" && <div className="grid gap-4 sm:col-span-2 sm:grid-cols-2"><label className="font-semibold text-slate-700">Repeat every<input type="number" min="1" max="365" value={task.recurrence.interval || 1} onChange={(event) => setTask({ ...task, recurrence: { ...task.recurrence, interval: Number(event.target.value) } })} className={`${inputClass} mt-2`} /></label><label className="font-semibold text-slate-700">Interval unit<select value={task.recurrence.intervalUnit || "week"} onChange={(event) => setTask({ ...task, recurrence: { ...task.recurrence, intervalUnit: event.target.value as NonNullable<RecurringTask["recurrence"]["intervalUnit"]> } })} className={`${inputClass} mt-2`}><option value="day">Days</option><option value="week">Weeks</option><option value="month">Months</option><option value="year">Years</option></select></label></div>}
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700"><input type="checkbox" checked={task.escalationRule?.enabled || false} onChange={(event) => setTask({ ...task, escalationRule: { enabled: event.target.checked, afterDays: task.escalationRule?.afterDays || 1, escalateToUserId: task.escalationRule?.escalateToUserId } })} />Enable escalation</label>
          <label className="font-semibold text-slate-700">Escalate after days<input type="number" min="1" max="365" value={task.escalationRule?.afterDays || 1} onChange={(event) => setTask({ ...task, escalationRule: { enabled: task.escalationRule?.enabled || false, afterDays: Number(event.target.value), escalateToUserId: task.escalationRule?.escalateToUserId } })} className={`${inputClass} mt-2`} /></label>
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700"><input type="checkbox" checked={task.requiresCompletionEvidence} onChange={(event) => setTask({ ...task, requiresCompletionEvidence: event.target.checked })} />Require text completion evidence</label>
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700"><input type="checkbox" checked={task.requiresConsultantReview} onChange={(event) => setTask({ ...task, requiresConsultantReview: event.target.checked })} />Require consultant review</label>
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700"><input type="checkbox" checked={task.clientVisible || false} onChange={(event) => setTask({ ...task, clientVisible: event.target.checked, clientCanSkip: event.target.checked ? task.clientCanSkip : false })} />Share task and occurrences with the client workspace</label>
          {task.clientVisible && <label className="flex items-center gap-2 text-sm font-semibold text-slate-700"><input type="checkbox" checked={task.clientCanSkip || false} onChange={(event) => setTask({ ...task, clientCanSkip: event.target.checked })} />Allow client to skip with a required reason</label>}
          <p className="text-sm text-slate-500 sm:col-span-2">Status {task.status} · Time zone {task.timezone}</p>
          <button type="submit" className="min-h-[44px] rounded-xl bg-teal-600 px-5 font-semibold text-white">Save Task</button>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => { const updated = setRecurringTaskStatus(task.id, task.status === "active" ? "paused" : "active"); if (updated) setTask(updated); }} className="min-h-[44px] rounded-xl border border-slate-300 px-4 font-semibold text-slate-700">{task.status === "active" ? "Pause" : "Resume"}</button>
            {task.status !== "cancelled" && <button type="button" onClick={() => { const updated = setRecurringTaskStatus(task.id, "cancelled"); if (updated) setTask(updated); }} className="min-h-[44px] rounded-xl border border-red-300 px-4 font-semibold text-red-700">Cancel Task</button>}
          </div>
        </form>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 p-5">
            <div><h2 className="text-xl font-bold text-slate-950">Occurrences</h2><p className="mt-1 text-sm text-slate-500">Completion evidence is text-only; do not attach confidential files.</p></div>
            <button type="button" disabled={task.status !== "active"} onClick={generate} className="min-h-[42px] rounded-xl bg-slate-950 px-4 font-semibold text-white disabled:opacity-50">Generate next 60 days</button>
          </div>
          <div className="divide-y divide-slate-200">
            {[...occurrences].sort((a,b) => b.scheduledFor.localeCompare(a.scheduledFor)).map((occurrence) => {
              const closed = ["completed","skipped","cancelled"].includes(occurrence.status);
              return <article key={occurrence.id} className="space-y-3 p-5">
                <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold text-slate-900">{occurrence.scheduledFor} · {occurrence.dueAt.slice(11,16)}</p><span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">{occurrenceLabels[occurrence.status]}</span></div>
                {occurrence.completionEvidence && <p className="text-sm text-slate-600">Evidence: {occurrence.completionEvidence}</p>}
                {occurrence.skippedReason && <p className="text-sm text-slate-600">Skipped: {occurrence.skippedReason}</p>}
                {occurrence.failureReason && <p className="text-sm text-red-700">Failure: {occurrence.failureReason}</p>}
                {!closed && <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                  {task.requiresCompletionEvidence && <label className="text-sm font-semibold text-slate-700">Completion evidence<input value={evidence[occurrence.id] || ""} onChange={(event) => setEvidence({ ...evidence, [occurrence.id]: event.target.value })} className={`${inputClass} mt-1`} /></label>}
                  <div className="flex flex-wrap gap-2">
                    {occurrence.status !== "in_progress" && <button type="button" onClick={() => startOccurrence(occurrence.id)} className="min-h-[40px] rounded-lg border border-slate-300 px-3 font-semibold">Start</button>}
                    <button type="button" onClick={() => complete(occurrence)} className="min-h-[40px] rounded-lg bg-emerald-700 px-3 font-semibold text-white">Complete</button>
                  </div>
                  <label className="text-sm font-semibold text-slate-700">Skip/failure reason<input value={reason[occurrence.id] || ""} onChange={(event) => setReason({ ...reason, [occurrence.id]: event.target.value })} className={`${inputClass} mt-1`} /></label>
                  <div className="flex gap-2"><button type="button" onClick={() => skip(occurrence)} className="min-h-[40px] rounded-lg border border-amber-300 px-3 font-semibold text-amber-800">Skip</button><button type="button" onClick={() => fail(occurrence)} className="min-h-[40px] rounded-lg border border-red-300 px-3 font-semibold text-red-700">Mark Failed</button></div>
                </div>}
                {occurrence.status === "failed" && <button type="button" onClick={() => { retryOccurrence(occurrence.id); setNotice("Occurrence retry started."); load(); }} className="min-h-[40px] rounded-lg border border-slate-300 px-3 font-semibold">Retry</button>}
              </article>;
            })}
            {occurrences.length === 0 && <p className="p-8 text-center text-slate-500">No occurrences generated yet.</p>}
          </div>
        </section>
      </div>
    </WorkspaceShell>
  );
}
