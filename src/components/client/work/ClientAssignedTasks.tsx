"use client";

import { FormEvent, useState } from "react";
import useClientWorkspaceData, {
  CLIENT_ASSIGNED_TASKS_UPDATED_EVENT,
  isClientAssignedTask,
  type ClientAssignedTask,
} from "@/components/client/useClientWorkspaceData";

const fieldClass = "min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-slate-900";

export default function ClientAssignedTasks() {
  const { team, userId, assignedTasks: tasks, assignedTasksError } = useClientWorkspaceData();
  const [assignedTo, setAssignedTo] = useState<string[] | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState<ClientAssignedTask["priority"]>("medium");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [rejectionReasons, setRejectionReasons] = useState<Record<string, string>>({});
  const eligibleAssignees = team.filter((member) => member.role === "client_user");
  const selectedAssignees = assignedTo ?? [];

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (selectedAssignees.length === 0) {
      setError("Choose at least one active employee to assign this task to.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/client/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignedTo: selectedAssignees,
          title,
          description,
          dueDate,
          priority,
        }),
      });
      const result: unknown = await response.json();
      if (!response.ok) throw new Error(errorFrom(result, "The task could not be assigned."));
      dispatchTaskRefresh(result);
      setTitle("");
      setDescription("");
      setDueDate("");
      setNotice(`Task assigned to ${selectedAssignees.length} user${selectedAssignees.length === 1 ? "" : "s"}. Each can accept or reject independently.`);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "The task could not be assigned.");
    } finally {
      setBusy(false);
    }
  }

  async function updateTask(task: ClientAssignedTask, action: "accept" | "reject" | "reassign", assignedTo?: string, note?: string) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/client/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId: task.id,
          expectedUpdatedAt: task.updated_at,
          action,
          assignedTo,
          note,
        }),
      });
      const result: unknown = await response.json();
      if (!response.ok) throw new Error(errorFrom(result, "The task could not be updated."));
      dispatchTaskRefresh(result);
      setNotice(action === "reassign" ? "Task reassigned." : `Task ${action}ed.`);
      if (action === "reject") {
        setRejectionReasons((current) => {
          const next = { ...current };
          delete next[task.id];
          return next;
        });
      }
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "The task could not be updated.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-5 rounded-xl border border-slate-200 bg-white p-5">
      <div>
        <h2 className="text-xl font-bold text-slate-950">Company task assignments</h2>
        <p className="mt-1 text-sm text-slate-600">Assign a task to one or more active users. Each person receives an independent assignment; only you and each assigned user can see their copy.</p>
      </div>
      {(error || assignedTasksError) && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error || assignedTasksError}</p>}
      {notice && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
      <form onSubmit={submit} className="grid gap-3 md:grid-cols-2">
        <label className="text-sm font-semibold text-slate-700">Task title
          <input required maxLength={200} value={title} onChange={(event) => setTitle(event.target.value)} className={`${fieldClass} mt-1`} />
        </label>
        <fieldset className="space-y-2 md:col-span-2">
          <legend className="text-sm font-semibold text-slate-700">Assign to (choose one or more active employees)</legend>
          <label className="flex min-h-10 items-center gap-2 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              checked={eligibleAssignees.length > 0 && eligibleAssignees.every((member) => selectedAssignees.includes(member.id))}
              onChange={(event) => setAssignedTo(event.target.checked ? eligibleAssignees.map((member) => member.id) : [])}
              className="size-4 accent-teal-700"
            />
            All active employees
          </label>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {eligibleAssignees.map((member) => (
              <label key={member.id} className="flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={selectedAssignees.includes(member.id)}
                  onChange={(event) => {
                    const checked = event.target.checked;
                    setAssignedTo((current) => {
                      const selected = current ?? [];
                      return checked
                        ? [...new Set([...selected, member.id])]
                        : selected.filter((id) => id !== member.id);
                    });
                  }}
                  className="size-4 accent-teal-700"
                />
                {member.name}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="text-sm font-semibold text-slate-700">Due date
          <input required type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} className={`${fieldClass} mt-1`} />
        </label>
        <label className="text-sm font-semibold text-slate-700">Priority
          <select value={priority} onChange={(event) => setPriority(event.target.value as ClientAssignedTask["priority"])} className={`${fieldClass} mt-1`}>
            <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
          </select>
        </label>
        <label className="text-sm font-semibold text-slate-700 md:col-span-2">Details
          <textarea maxLength={2000} rows={3} value={description} onChange={(event) => setDescription(event.target.value)} className={`${fieldClass} mt-1 py-2`} />
        </label>
        <div><button disabled={busy || eligibleAssignees.length === 0} type="submit" className="min-h-11 rounded-lg bg-teal-700 px-5 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">Assign task</button></div>
      </form>

      <div className="space-y-3">
        {tasks.map((task) => {
          const creator = team.find((member) => member.id === task.created_by);
          const assignee = team.find((member) => member.id === task.assigned_to);
          const assignedToCurrentUser = task.assigned_to === userId;
          const createdByCurrentUser = task.created_by === userId;
          return (
            <article key={task.id} className="rounded-lg border border-slate-200 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-slate-950">{task.title}</h3>
                  {task.description && <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{task.description}</p>}
                  <p className="mt-2 text-xs text-slate-500">
                    From {creator?.name || "Coworker"} · To {assignee?.name || "Coworker"} · {task.due_date || "No due date"} · {task.priority}
                  </p>
                </div>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold capitalize text-slate-700">{task.status.replaceAll("_", " ")}</span>
              </div>
              {task.response_note && <p className="mt-2 text-sm text-slate-600">Response: {task.response_note}</p>}
              {assignedToCurrentUser && task.status === "pending_acceptance" && (
                <div className="mt-3 space-y-2">
                  <label className="block max-w-xl text-sm font-semibold text-slate-700">
                    Reason for rejection (required to reject)
                    <textarea
                      required
                      maxLength={1000}
                      rows={2}
                      value={rejectionReasons[task.id] || ""}
                      onChange={(event) => setRejectionReasons((current) => ({ ...current, [task.id]: event.target.value }))}
                      className={`${fieldClass} mt-1 py-2`}
                    />
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button disabled={busy} type="button" onClick={() => void updateTask(task, "accept")} className="min-h-10 rounded-lg bg-teal-700 px-4 text-sm font-semibold text-white disabled:opacity-50">Accept</button>
                    <button
                      disabled={busy}
                      type="button"
                      onClick={() => {
                        const reason = (rejectionReasons[task.id] || "").trim();
                        if (!reason) {
                          setError("Enter a reason before rejecting this task.");
                          return;
                        }
                        void updateTask(task, "reject", undefined, reason);
                      }}
                      className="min-h-10 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700 disabled:opacity-50"
                    >Reject</button>
                  </div>
                </div>
              )}
              {createdByCurrentUser && !assignedToCurrentUser && (
                <label className="mt-3 block max-w-sm text-sm font-semibold text-slate-700">Reassign to
                  <select disabled={busy} value={task.assigned_to} onChange={(event) => void updateTask(task, "reassign", event.target.value)} className={`${fieldClass} mt-1`}>
                    {eligibleAssignees.filter((member) => member.id !== userId).map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
                  </select>
                </label>
              )}
            </article>
          );
        })}
        {tasks.length === 0 && !error && !assignedTasksError && <p className="text-sm text-slate-500">No company tasks have been assigned to you or created by you.</p>}
      </div>
    </section>
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function errorFrom(value: unknown, fallback: string) {
  return isRecord(value) && typeof value.error === "string" ? value.error : fallback;
}

function dispatchTaskRefresh(value: unknown) {
  const tasks = isRecord(value) && Array.isArray(value.tasks)
    ? value.tasks.filter(isClientAssignedTask)
    : isRecord(value) && isClientAssignedTask(value.task)
      ? [value.task]
      : [];
  window.dispatchEvent(new CustomEvent(CLIENT_ASSIGNED_TASKS_UPDATED_EVENT, { detail: tasks }));
}
