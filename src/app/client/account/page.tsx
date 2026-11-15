"use client";

import { FormEvent, useEffect, useState } from "react";
import ClientWorkspaceShell from "@/components/client/ClientWorkspaceShell";
import AccountSecurityPanel from "@/components/account/AccountSecurityPanel";
import {
  getClientWorkspaceState,
  ReminderCategory,
  ReminderPreference,
  saveReminderPreferences,
  SummaryFrequency,
  validateReminderPreference,
} from "@/lib/clientWorkspaceStore";

const categories: Array<{ value: ReminderCategory; label: string }> = [
  { value: "work-today", label: "Work due today" },
  { value: "work-week", label: "Work due this week" },
  { value: "work-month", label: "Work due this month" },
  { value: "overdue", label: "Overdue work" },
  { value: "blocked", label: "Blocked work" },
  { value: "records-expiring", label: "Records approaching expiry" },
  { value: "incomplete-monthly", label: "Incomplete monthly checklist items" },
];
const defaultPreference: ReminderPreference = {
  delivery: "In-app only",
  summaryFrequency: "Weekly on Monday",
  weekday: "Monday",
  time: "09:00",
  dailySummary: "morning",
  monthlyRule: "last-working-day",
  categories: ["overdue", "work-week", "blocked", "records-expiring"],
  timeZone: "Africa/Johannesburg",
};

export default function ClientAccountPage() {
  const [preference, setPreference] = useState<ReminderPreference>(defaultPreference);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const load = () => setPreference(getClientWorkspaceState().reminderPreference);
    const timer = window.setTimeout(load, 0);
    window.addEventListener("deadline-monitor-updated", load);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("deadline-monitor-updated", load);
    };
  }, []);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validation = validateReminderPreference(preference);
    if (validation) { setError(validation); setNotice(""); return; }
    const result = saveReminderPreferences(preference);
    if (!result.success) { setError(result.message); setNotice(""); return; }
    setError("");
    setNotice("Reminder preferences saved to this browser and added to prototype audit history.");
  }

  function toggleCategory(category: ReminderCategory) {
    const next = preference.categories.includes(category)
      ? preference.categories.filter((item) => item !== category)
      : [...preference.categories, category];
    setPreference({ ...preference, categories: next });
  }

  return (
    <ClientWorkspaceShell title="Account">
      <div className="space-y-5 p-4 sm:p-6 lg:p-8">
        <AccountSecurityPanel />

        <form onSubmit={submit} className="max-w-3xl space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <div><h2 className="text-xl font-bold text-slate-950">Reminder preferences</h2><p className="mt-1 text-sm text-slate-600">These settings control prototype in-app summaries only. Selecting email does not send anything.</p></div>
          {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-red-800">{error}</p>}
          {notice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-emerald-800">{notice}</p>}
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-semibold text-slate-700">Preferred delivery<select value={preference.delivery} onChange={(event) => setPreference({ ...preference, delivery: event.target.value as ReminderPreference["delivery"] })} className="mt-1 min-h-[44px] w-full rounded-lg border border-slate-300 px-3"><option>In-app only</option><option>Email and in-app</option><option>No reminder</option></select></label>
            <label className="text-sm font-semibold text-slate-700">Summary frequency<select value={preference.summaryFrequency} onChange={(event) => setPreference({ ...preference, summaryFrequency: event.target.value as SummaryFrequency })} className="mt-1 min-h-[44px] w-full rounded-lg border border-slate-300 px-3"><option>Daily</option><option>Weekly on Monday</option><option>Weekly on selected weekday</option><option>Monthly</option><option>Custom</option></select></label>
            {preference.summaryFrequency === "Weekly on selected weekday" && <label className="text-sm font-semibold text-slate-700">Weekday<select value={preference.weekday || ""} onChange={(event) => setPreference({ ...preference, weekday: event.target.value as NonNullable<ReminderPreference["weekday"]> })} className="mt-1 min-h-[44px] w-full rounded-lg border border-slate-300 px-3"><option value="">Select a weekday</option>{(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"] as const).map((day) => <option key={day}>{day}</option>)}</select></label>}
            <label className="text-sm font-semibold text-slate-700">Preferred time<input type="time" required value={preference.time} onChange={(event) => setPreference({ ...preference, time: event.target.value })} className="mt-1 min-h-[44px] w-full rounded-lg border border-slate-300 px-3" /></label>
            <label className="text-sm font-semibold text-slate-700">Daily summary timing<select value={preference.dailySummary} onChange={(event) => setPreference({ ...preference, dailySummary: event.target.value as ReminderPreference["dailySummary"] })} className="mt-1 min-h-[44px] w-full rounded-lg border border-slate-300 px-3"><option value="morning">Morning</option><option value="end-of-day">End of day</option><option value="selected-time">Selected time</option></select></label>
            <label className="text-sm font-semibold text-slate-700">Monthly rule<select value={preference.monthlyRule} onChange={(event) => setPreference({ ...preference, monthlyRule: event.target.value as ReminderPreference["monthlyRule"] })} className="mt-1 min-h-[44px] w-full rounded-lg border border-slate-300 px-3"><option value="first-working-day">First working day</option><option value="last-working-day">Last working day</option><option value="selected-day">Selected day of month</option></select></label>
            {preference.summaryFrequency === "Monthly" && preference.monthlyRule === "selected-day" && <label className="text-sm font-semibold text-slate-700">Day of month<input type="number" min={1} max={31} value={preference.monthlyDay || ""} onChange={(event) => setPreference({ ...preference, monthlyDay: Number(event.target.value) })} className="mt-1 min-h-[44px] w-full rounded-lg border border-slate-300 px-3" /></label>}
          </div>
          {preference.summaryFrequency === "Custom" && <fieldset className="grid gap-3 rounded-xl border border-slate-200 p-4 sm:grid-cols-2"><legend className="px-1 text-sm font-bold">Custom schedule</legend><label className="text-sm font-semibold">Repeat every<input type="number" min={1} max={365} value={preference.customInterval || ""} onChange={(event) => setPreference({ ...preference, customInterval: Number(event.target.value) })} className="mt-1 min-h-[42px] w-full rounded-lg border border-slate-300 px-3" /></label><label className="text-sm font-semibold">Unit<select value={preference.customFrequency || ""} onChange={(event) => setPreference({ ...preference, customFrequency: event.target.value as NonNullable<ReminderPreference["customFrequency"]> })} className="mt-1 min-h-[42px] w-full rounded-lg border border-slate-300 px-3"><option value="">Choose a unit</option><option value="day">Day(s)</option><option value="week">Week(s)</option><option value="month">Month(s)</option></select></label><label className="text-sm font-semibold">Start date<input type="date" value={preference.startDate || ""} onChange={(event) => setPreference({ ...preference, startDate: event.target.value })} className="mt-1 min-h-[42px] w-full rounded-lg border border-slate-300 px-3" /></label><label className="text-sm font-semibold">End date (optional)<input type="date" value={preference.endDate || ""} onChange={(event) => setPreference({ ...preference, endDate: event.target.value })} className="mt-1 min-h-[42px] w-full rounded-lg border border-slate-300 px-3" /></label>{preference.customFrequency === "week" && <fieldset className="sm:col-span-2"><legend className="mb-2 text-sm font-semibold">Weekdays</legend><div className="flex flex-wrap gap-3">{(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"] as const).map((day, index) => <label key={day} className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={preference.customWeekdays?.includes(index + 1) || false} onChange={(event) => { const selected = new Set(preference.customWeekdays || []); if (event.target.checked) selected.add(index + 1); else selected.delete(index + 1); setPreference({ ...preference, customWeekdays: [...selected] }); }} />{day}</label>)}</div></fieldset>}</fieldset>}
          <fieldset><legend className="mb-2 text-sm font-bold text-slate-800">Include in summaries</legend><div className="grid gap-2 sm:grid-cols-2">{categories.map((category) => <label key={category.value} className="flex min-h-[40px] items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={preference.categories.includes(category.value)} onChange={() => toggleCategory(category.value)} className="h-4 w-4" />{category.label}</label>)}</div></fieldset>
          <div><button type="submit" className="min-h-[44px] rounded-xl bg-teal-600 px-5 font-semibold text-white hover:bg-teal-700">Save reminder preferences</button></div>
        </form>

        <section className="max-w-3xl rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-950 sm:p-7">
          <p className="font-semibold">Prototype security limits</p>
          <p className="mt-1 text-sm">Reminder preferences are private to this profile and this browser; email delivery is inactive. Senior Managers can update or suspend existing profiles from Manage users, but cannot invite or create accounts. Email changes require the verified account process.</p>
        </section>
      </div>
    </ClientWorkspaceShell>
  );
}
