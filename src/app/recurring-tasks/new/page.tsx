"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import WorkspaceShell from "@/components/workspace/WorkspaceShell";
import { Client, getActiveClients } from "@/lib/clientStore";
import { getRecords, MonitoredRecord } from "@/lib/recordStore";
import { RecurrenceFrequency, RecurrenceRule, RecurringTaskInput, TaskPriority } from "@/lib/recurringTasks/types";
import { saveRecurringTask } from "@/lib/recurringTasks/taskStore";

const fieldClass = "mt-2 min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3 text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100";
const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function today() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export default function NewRecurringTaskPage() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [records, setRecords] = useState<MonitoredRecord[]>([]);
  const [name, setName] = useState("");
  const [organisationId, setOrganisationId] = useState("");
  const [linkedRecordId, setLinkedRecordId] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [reviewerId, setReviewerId] = useState("");
  const [startDate, setStartDate] = useState(today);
  const [dueTime, setDueTime] = useState("17:00");
  const [frequency, setFrequency] = useState<RecurrenceFrequency>("weekly");
  const [selectedWeekdays, setSelectedWeekdays] = useState<number[]>([]);
  const [dayOfMonth, setDayOfMonth] = useState("1");
  const [interval, setInterval] = useState("1");
  const [intervalUnit, setIntervalUnit] = useState<RecurrenceRule["intervalUnit"]>("week");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [escalationEnabled, setEscalationEnabled] = useState(false);
  const [escalationDays, setEscalationDays] = useState("1");
  const [requiresCompletionEvidence, setRequiresCompletionEvidence] = useState(false);
  const [requiresConsultantReview, setRequiresConsultantReview] = useState(false);
  const [clientVisible, setClientVisible] = useState(false);
  const [clientCanSkip, setClientCanSkip] = useState(false);
  const [error, setError] = useState("");
  const relatedRecords = records.filter((record) => record.organisationId === organisationId);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setClients(getActiveClients());
      setRecords(Object.values(getRecords()));
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const intervalNumber = Number(interval);
    if (!name.trim() || !organisationId || !ownerId.trim() || !startDate || !dueTime) {
      setError("Enter the task, organisation, owner, start date and due time.");
      return;
    }
    if (frequency === "weekly" && selectedWeekdays.length === 0) {
      setError("Select at least one weekday for a weekly schedule.");
      return;
    }
    if (frequency === "monthly" && (!Number.isInteger(Number(dayOfMonth)) || Number(dayOfMonth) < 1 || Number(dayOfMonth) > 31)) {
      setError("Choose a day of the month from 1 to 31.");
      return;
    }
    if (frequency === "custom" && (!Number.isInteger(intervalNumber) || intervalNumber < 1 || intervalNumber > 365)) {
      setError("Custom intervals must be whole numbers from 1 to 365.");
      return;
    }

    const client = clients.find((item) => item.id === organisationId);
    const recurrence: RecurrenceRule = { frequency };
    if (frequency === "weekly") recurrence.weekdays = selectedWeekdays;
    if (frequency === "monthly") recurrence.dayOfMonth = Number(dayOfMonth);
    if (frequency === "custom") {
      recurrence.interval = intervalNumber;
      recurrence.intervalUnit = intervalUnit;
    }

    const task: RecurringTaskInput = {
      organisationId,
      name: name.trim(),
      linkedRecordId: linkedRecordId || undefined,
      ownerId: ownerId.trim(),
      reviewerId: reviewerId.trim() || undefined,
      priority,
      startDate,
      dueTime,
      timezone: "Africa/Johannesburg",
      recurrence,
      escalationRule: {
        enabled: escalationEnabled,
        afterDays: Number(escalationDays),
      },
      requiresCompletionEvidence,
      requiresConsultantReview,
      clientVisible,
      clientCanSkip: clientVisible && clientCanSkip,
      status: "active",
    };
    if (!client) {
      setError("Choose an active organisation.");
      return;
    }
    const created = saveRecurringTask(task);
    router.push(`/recurring-tasks/${created.id}`);
  }

  return (
    <WorkspaceShell eyebrow="Task Management" title="New Recurring Task" actions={<Link href="/recurring-tasks" className="rounded-xl border border-slate-300 bg-white px-4 py-3 font-semibold text-slate-700">Cancel</Link>}>
      <form onSubmit={submit} className="mx-auto max-w-4xl space-y-6 p-5 lg:p-8">
        {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 font-medium text-red-800">{error}</p>}
        <section className="grid gap-5 rounded-2xl border border-slate-200 bg-white p-6 sm:grid-cols-2">
          <label className="font-semibold text-slate-700 sm:col-span-2">Task name<input required value={name} onChange={(event) => setName(event.target.value)} className={fieldClass} /></label>
          <label className="font-semibold text-slate-700">Organisation<select required value={organisationId} onChange={(event) => { setOrganisationId(event.target.value); setLinkedRecordId(""); }} className={fieldClass}><option value="">Select organisation</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.company}</option>)}</select></label>
          <label className="font-semibold text-slate-700">Linked record (optional)<select value={linkedRecordId} onChange={(event) => setLinkedRecordId(event.target.value)} className={fieldClass}><option value="">No linked record</option>{relatedRecords.map((record) => <option key={record.id} value={record.id}>{record.name}</option>)}</select></label>
          <label className="font-semibold text-slate-700">Owner<input required value={ownerId} onChange={(event) => setOwnerId(event.target.value)} placeholder="Demo owner name" className={fieldClass} /></label>
          <label className="font-semibold text-slate-700">Reviewer (optional)<input value={reviewerId} onChange={(event) => setReviewerId(event.target.value)} placeholder="Reviewer name" className={fieldClass} /></label>
          <label className="font-semibold text-slate-700">Start date<input type="date" required value={startDate} onChange={(event) => setStartDate(event.target.value)} className={fieldClass} /></label>
          <label className="font-semibold text-slate-700">Due time<input type="time" required value={dueTime} onChange={(event) => setDueTime(event.target.value)} className={fieldClass} /></label>
          <label className="font-semibold text-slate-700">Schedule<select value={frequency} onChange={(event) => setFrequency(event.target.value as RecurrenceFrequency)} className={fieldClass}>{[["daily","Daily"],["weekdays","Every weekday"],["weekly","Selected weekdays"],["monthly","Monthly"],["month_end","Month-end"],["quarterly","Quarterly"],["annually","Annual"],["custom","Custom interval"]].map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          {frequency === "weekly" && <fieldset className="sm:col-span-2"><legend className="font-semibold text-slate-700">Repeat on</legend><div className="mt-2 flex flex-wrap gap-3">{weekdays.map((day,index) => <label key={day} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={selectedWeekdays.includes(index)} onChange={(event) => setSelectedWeekdays((current) => event.target.checked ? [...current,index].sort() : current.filter((value) => value !== index))} />{day}</label>)}</div></fieldset>}
          {frequency === "monthly" && <label className="font-semibold text-slate-700">Day of month<input type="number" min="1" max="31" value={dayOfMonth} onChange={(event) => setDayOfMonth(event.target.value)} className={fieldClass} /></label>}
          {frequency === "custom" && <div className="grid gap-5 sm:col-span-2 sm:grid-cols-2"><label className="font-semibold text-slate-700">Interval<input type="number" min="1" max="365" value={interval} onChange={(event) => setInterval(event.target.value)} className={fieldClass} /></label><label className="font-semibold text-slate-700">Unit<select value={intervalUnit} onChange={(event) => setIntervalUnit(event.target.value as RecurrenceRule["intervalUnit"])} className={fieldClass}><option value="day">Days</option><option value="week">Weeks</option><option value="month">Months</option><option value="year">Years</option></select></label></div>}
          <label className="font-semibold text-slate-700">Priority<select value={priority} onChange={(event) => setPriority(event.target.value as TaskPriority)} className={fieldClass}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option></select></label>
          <label className="flex items-center gap-2 self-end pb-3 font-medium text-slate-700"><input type="checkbox" checked={escalationEnabled} onChange={(event) => setEscalationEnabled(event.target.checked)} />Enable escalation</label>
          {escalationEnabled && <label className="font-semibold text-slate-700">Escalate after days<input type="number" min="1" max="365" value={escalationDays} onChange={(event) => setEscalationDays(event.target.value)} className={fieldClass} /></label>}
          <label className="flex items-center gap-2 font-medium text-slate-700"><input type="checkbox" checked={requiresCompletionEvidence} onChange={(event) => setRequiresCompletionEvidence(event.target.checked)} />Completion evidence required</label>
          <label className="flex items-center gap-2 font-medium text-slate-700"><input type="checkbox" checked={requiresConsultantReview} onChange={(event) => setRequiresConsultantReview(event.target.checked)} />Consultant review required</label>
          <label className="flex items-center gap-2 font-medium text-slate-700"><input type="checkbox" checked={clientVisible} onChange={(event) => { setClientVisible(event.target.checked); if (!event.target.checked) setClientCanSkip(false); }} />Share task and occurrences with the client workspace</label>
          {clientVisible && <label className="flex items-center gap-2 font-medium text-slate-700"><input type="checkbox" checked={clientCanSkip} onChange={(event) => setClientCanSkip(event.target.checked)} />Allow client to skip with a required reason</label>}
        </section>
        <p className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">This is a local prototype. Evidence is captured as text only; do not attach confidential documents. Occurrences do not send reminders.</p>
        <button type="submit" className="min-h-[46px] rounded-xl bg-teal-600 px-6 font-semibold text-white hover:bg-teal-700">Create Task</button>
      </form>
    </WorkspaceShell>
  );
}
