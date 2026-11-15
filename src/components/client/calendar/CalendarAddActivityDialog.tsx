"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import ClientRecordForm from "@/components/client/ClientRecordForm";
import type { ClientRecord, ClientRecordInput } from "@/lib/clientWorkspace";
import {
  buildCalendarRecurrence,
  createCalendarChecklistItem,
  createCalendarFollowUp,
  createCalendarRecord,
  createCalendarTask,
  type CalendarRecurrenceChoice,
} from "@/lib/clientCalendarActions";
import type { ClientWorkspaceData } from "@/components/client/useClientWorkspaceData";
import type { TrackerPeriod, WorkPriority } from "@/lib/clientWorkspaceStore";
import type { RecurrenceRule, TaskPriority } from "@/lib/recurringTasks/types";

type ActivityKind = "task" | "record" | "checklist" | "follow_up";

type Props = {
  date: string;
  workspaceData: ClientWorkspaceData;
  onClose: () => void;
  onCreated: (message: string) => void;
};

const fieldClass = "mt-1 min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3 text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100";
const weekdays = [
  { label: "Sunday", value: 0 },
  { label: "Monday", value: 1 },
  { label: "Tuesday", value: 2 },
  { label: "Wednesday", value: 3 },
  { label: "Thursday", value: 4 },
  { label: "Friday", value: 5 },
  { label: "Saturday", value: 6 },
];

function messageFromError(error: unknown): string {
  return error instanceof Error ? error.message : "The activity could not be saved. Please try again.";
}

export default function CalendarAddActivityDialog({ date, workspaceData, onClose, onCreated }: Props) {
  const [kind, setKind] = useState<ActivityKind | null>(null);
  const [error, setError] = useState("");
  const closeRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab") return;
      const dialog = document.getElementById("calendar-add-activity-dialog");
      const focusable = dialog?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href]');
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      const opener = openerRef.current;
      if (opener?.isConnected) opener.focus();
      else document.getElementById("calendar-toolbar-add-activity")?.focus();
    };
  }, [onClose]);

  useEffect(() => {
    if (!kind) return;
    const firstInput = document.querySelector<HTMLElement>(
      "#calendar-add-activity-dialog form input:not([type=hidden]), #calendar-add-activity-dialog form select, #calendar-add-activity-dialog button",
    );
    firstInput?.focus();
  }, [kind]);

  function created(label: string) {
    onCreated(`${label} added to your workspace.`);
  }

  function submitRecord(input: ClientRecordInput) {
    try {
      const result = createCalendarRecord(input);
      if (!result.success) {
        setError(result.message || "The monitored record could not be saved.");
        return;
      }
      created("Record deadline");
    } catch (caught) {
      setError(messageFromError(caught));
    }
  }

  function submitTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const selectedWeekdays = form.getAll("weekday").map((value) => Number(value));
    const recurrence = buildCalendarRecurrence(
      form.get("recurrence") as CalendarRecurrenceChoice,
      String(form.get("date") || ""),
      selectedWeekdays,
      Number(form.get("customInterval") || 1),
      String(form.get("customUnit") || "week") as NonNullable<RecurrenceRule["intervalUnit"]>,
    );
    if (!recurrence) {
      setError("Choose valid recurrence settings.");
      return;
    }
    try {
      const result = createCalendarTask({
        name: String(form.get("name") || ""),
        responsiblePersonId: String(form.get("responsiblePersonId") || ""),
        date: String(form.get("date") || ""),
        time: String(form.get("time") || ""),
        priority: String(form.get("priority") || "medium") as TaskPriority,
        relatedRecordId: String(form.get("relatedRecordId") || ""),
        recurrence,
        notes: String(form.get("notes") || ""),
        requiresCompletionEvidence: form.get("requiresCompletionEvidence") === "on",
      });
      if (!result.success) {
        setError(result.message);
        return;
      }
      created("Task");
    } catch (caught) {
      setError(messageFromError(caught));
    }
  }

  function submitChecklist(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const result = createCalendarChecklistItem({
        name: String(form.get("name") || ""),
        responsiblePersonId: String(form.get("responsiblePersonId") || ""),
        date: String(form.get("date") || ""),
        time: String(form.get("time") || ""),
        priority: String(form.get("priority") || "Medium") as WorkPriority,
        trackerId: String(form.get("trackerId") || ""),
        newTrackerName: String(form.get("newTrackerName") || ""),
        newTrackerPeriod: String(form.get("newTrackerPeriod") || "Weekly tracker") as TrackerPeriod,
        trackerStartDate: String(form.get("trackerStartDate") || date),
        trackerEndDate: String(form.get("trackerEndDate") || date),
        notes: String(form.get("notes") || ""),
        nextAction: String(form.get("nextAction") || ""),
      });
      if (!result.success) {
        setError(result.message);
        return;
      }
      created("Checklist item");
    } catch (caught) {
      setError(messageFromError(caught));
    }
  }

  function submitFollowUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const result = createCalendarFollowUp({
        recordId: String(form.get("recordId") || ""),
        title: String(form.get("title") || ""),
        date: String(form.get("date") || ""),
      });
      if (!result.success) {
        setError(result.message);
        return;
      }
      created("Follow-up");
    } catch (caught) {
      setError(messageFromError(caught));
    }
  }

  const activePeople = workspaceData.workspaceState.people.filter((person) => person.active);
  const activeTrackers = workspaceData.workspaceState.trackers.filter((tracker) => tracker.status !== "Archived");

  return (
    <div
      className="calendar-print-hide fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/50 p-0 sm:p-4"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <section
        id="calendar-add-activity-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-calendar-activity-heading"
        className="max-h-[100dvh] w-full overflow-y-auto rounded-none bg-white p-4 shadow-xl sm:max-h-[92dvh] sm:max-w-2xl sm:rounded-2xl sm:p-6"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-teal-800">Client Calendar · {date}</p>
            <h2 id="add-calendar-activity-heading" className="mt-1 text-xl font-bold text-slate-950">
              {kind ? `Add ${kind === "follow_up" ? "Follow-up" : kind === "record" ? "Record deadline" : kind === "checklist" ? "Checklist item" : "Task"}` : "What do you want to add?"}
            </h2>
          </div>
          <button ref={closeRef} type="button" aria-label="Close dialog" onClick={onClose} className="cursor-pointer rounded-md px-2 py-1 text-xl text-slate-500 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600">×</button>
        </div>

        {error && <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}

        {!kind && (
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            {([
              ["task", "Task", "Recurring or one-time task"],
              ["record", "Record deadline", "Add monitored record metadata"],
              ["checklist", "Checklist item", "Add work to a tracker"],
              ["follow_up", "Follow-up", "Schedule an action on a record"],
            ] as const).map(([value, label, description]) => (
              <button key={value} type="button" onClick={() => { setError(""); setKind(value); }} className="cursor-pointer rounded-xl border border-slate-200 p-4 text-left hover:border-teal-400 hover:bg-teal-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600">
                <span className="block font-semibold text-slate-900">{label}</span>
                <span className="mt-1 block text-sm text-slate-600">{description}</span>
              </button>
            ))}
          </div>
        )}

        {kind && (
          <button type="button" onClick={() => { setKind(null); setError(""); }} className="mt-4 cursor-pointer text-sm font-semibold text-teal-800 underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600">← Choose a different activity type</button>
        )}

        {kind === "task" && (
          <form onSubmit={submitTask} className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-semibold text-slate-700 sm:col-span-2">Task name<input name="name" required maxLength={120} className={fieldClass} /></label>
            <label className="text-sm font-semibold text-slate-700">Responsible person<select name="responsiblePersonId" required defaultValue="" className={fieldClass}><option value="" disabled>Select a person</option>{activePeople.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label>
            <label className="text-sm font-semibold text-slate-700">Date<input name="date" type="date" required defaultValue={date} className={fieldClass} /></label>
            <label className="text-sm font-semibold text-slate-700">Time (optional)<input name="time" type="time" className={fieldClass} /></label>
            <label className="text-sm font-semibold text-slate-700">Priority<select name="priority" defaultValue="medium" className={fieldClass}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option></select></label>
            <label className="text-sm font-semibold text-slate-700">Related record (optional)<select name="relatedRecordId" defaultValue="" className={fieldClass}><option value="">None</option>{workspaceData.records.map((record) => <option key={record.id} value={record.id}>{record.name}</option>)}</select></label>
            <label className="text-sm font-semibold text-slate-700">Recurrence<select name="recurrence" defaultValue="once" className={fieldClass}><option value="once">Does not repeat</option><option value="daily">Daily</option><option value="selected_weekdays">Selected weekdays</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="annually">Annually</option><option value="custom">Custom</option></select></label>
            <fieldset className="rounded-xl border border-slate-200 p-3 sm:col-span-2">
              <legend className="px-1 text-sm font-semibold text-slate-700">Recurrence options</legend>
              <div className="flex flex-wrap gap-3">
                {weekdays.map((weekday) => <label key={weekday.value} className="flex cursor-pointer items-center gap-1.5 text-sm text-slate-700"><input name="weekday" type="checkbox" value={weekday.value} className="accent-teal-700" />{weekday.label.slice(0, 3)}</label>)}
              </div>
              <div className="mt-3 flex flex-wrap items-end gap-3">
                <label className="text-sm text-slate-700">Custom interval<input name="customInterval" type="number" min={1} max={365} defaultValue={1} className={`${fieldClass} w-28`} /></label>
                <label className="text-sm text-slate-700">Unit<select name="customUnit" defaultValue="week" className={`${fieldClass} w-36`}><option value="day">Day</option><option value="week">Week</option><option value="month">Month</option><option value="year">Year</option></select></label>
              </div>
              <p className="mt-2 text-xs text-slate-500">Weekdays apply to “Selected weekdays”; custom interval applies to “Custom”.</p>
            </fieldset>
            <label className="text-sm font-semibold text-slate-700 sm:col-span-2">Operational notes only<textarea name="notes" maxLength={500} rows={3} className={`${fieldClass} py-3`} placeholder="Do not include confidential source-document contents." /></label>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700 sm:col-span-2"><input name="requiresCompletionEvidence" type="checkbox" className="accent-teal-700" />Require completion evidence</label>
            <button type="submit" className="min-h-[44px] cursor-pointer rounded-xl bg-teal-700 px-5 font-semibold text-white hover:bg-teal-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600 sm:col-span-2">Create task</button>
          </form>
        )}

        {kind === "record" && (
          <div className="mt-4">
            <ClientRecordForm initialExpiryDate={date} onSubmit={submitRecord} />
          </div>
        )}

        {kind === "checklist" && (
          <form onSubmit={submitChecklist} className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-semibold text-slate-700 sm:col-span-2">Checklist item<input name="name" required maxLength={120} className={fieldClass} /></label>
            <label className="text-sm font-semibold text-slate-700">Responsible person<select name="responsiblePersonId" required defaultValue="" className={fieldClass}><option value="" disabled>Select a person</option>{activePeople.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label>
            <label className="text-sm font-semibold text-slate-700">Date<input name="date" type="date" required defaultValue={date} className={fieldClass} /></label>
            <label className="text-sm font-semibold text-slate-700">Time (optional)<input name="time" type="time" className={fieldClass} /></label>
            <label className="text-sm font-semibold text-slate-700">Priority<select name="priority" defaultValue="Medium" className={fieldClass}><option>Low</option><option>Medium</option><option>High</option></select></label>
            <label className="text-sm font-semibold text-slate-700 sm:col-span-2">Work tracker<select name="trackerId" defaultValue={activeTrackers[0]?.id || ""} className={fieldClass}><option value="">Create a new tracker</option>{activeTrackers.map((tracker) => <option key={tracker.id} value={tracker.id}>{tracker.name}</option>)}</select></label>
            <p className="text-xs text-slate-600 sm:col-span-2">If no tracker is selected, enter details for a new tracker.</p>
            <label className="text-sm font-semibold text-slate-700">New tracker name<input name="newTrackerName" maxLength={120} className={fieldClass} /></label>
            <label className="text-sm font-semibold text-slate-700">Tracker type<select name="newTrackerPeriod" defaultValue="Weekly tracker" className={fieldClass}><option>Daily checklist</option><option>Weekly tracker</option><option>Monthly tracker</option><option>Custom tracker</option></select></label>
            <label className="text-sm font-semibold text-slate-700">Tracker start<input name="trackerStartDate" type="date" defaultValue={date} className={fieldClass} /></label>
            <label className="text-sm font-semibold text-slate-700">Tracker end<input name="trackerEndDate" type="date" defaultValue={date} className={fieldClass} /></label>
            <label className="text-sm font-semibold text-slate-700 sm:col-span-2">Operational notes only<textarea name="notes" maxLength={500} rows={3} className={`${fieldClass} py-3`} placeholder="Do not include confidential source-document contents." /></label>
            <label className="text-sm font-semibold text-slate-700 sm:col-span-2">Next action (optional)<input name="nextAction" maxLength={160} className={fieldClass} /></label>
            <button type="submit" className="min-h-[44px] cursor-pointer rounded-xl bg-teal-700 px-5 font-semibold text-white hover:bg-teal-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600 sm:col-span-2">Create checklist item</button>
          </form>
        )}

        {kind === "follow_up" && (
          <form onSubmit={submitFollowUp} className="mt-4 grid gap-4">
            <label className="text-sm font-semibold text-slate-700">Related record<select name="recordId" required defaultValue="" className={fieldClass}><option value="" disabled>Select a monitored record</option>{workspaceData.records.map((record: ClientRecord) => <option key={record.id} value={record.id}>{record.name}</option>)}</select></label>
            <label className="text-sm font-semibold text-slate-700">Follow-up action<input name="title" required maxLength={160} className={fieldClass} placeholder="Confirm renewal plan" /></label>
            <label className="text-sm font-semibold text-slate-700">Date<input name="date" type="date" required defaultValue={date} className={fieldClass} /></label>
            <p className="text-xs text-slate-600">This updates the existing monitored record follow-up date and next action.</p>
            <button type="submit" className="min-h-[44px] cursor-pointer rounded-xl bg-teal-700 px-5 font-semibold text-white hover:bg-teal-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600">Create follow-up</button>
          </form>
        )}
      </section>
    </div>
  );
}
