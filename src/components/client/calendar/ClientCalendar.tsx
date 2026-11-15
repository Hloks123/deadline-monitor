"use client";

import { useCallback, useMemo, useState } from "react";
import useClientWorkspaceData from "@/components/client/useClientWorkspaceData";
import {
  filterClientActivities,
  getActivitiesForDate,
  getActivitiesForMonth,
  getActivitiesForWeek,
  getClientActivities,
  type ClientActivityStatusFilter,
  type ClientActivityTypeFilter,
} from "@/lib/clientActivities";
import { clientBusinessToday } from "@/lib/clientWorkspaceSelectors";
import CalendarDayPanel from "./CalendarDayPanel";
import CalendarAddActivityDialog from "./CalendarAddActivityDialog";
import CalendarAgendaView from "./CalendarAgendaView";
import CalendarMonthView from "./CalendarMonthView";
import CalendarWeekView from "./CalendarWeekView";
import {
  getCalendarWeekDays,
  formatCalendarDate,
  formatCalendarMonth,
  getMonthGridDays,
  monthKeyFromDate,
  shiftCalendarDate,
  shiftMonth,
} from "./calendarUtils";

type CalendarView = "month" | "week" | "agenda";

export default function ClientCalendar() {
  const workspaceData = useClientWorkspaceData();
  const today = clientBusinessToday();
  const [view, setView] = useState<CalendarView>("month");
  const [month, setMonth] = useState(() => today.slice(0, 7));
  const [selectedDate, setSelectedDate] = useState(today);
  const [typeFilter, setTypeFilter] = useState<ClientActivityTypeFilter>("all");
  const [statusFilter, setStatusFilter] = useState<ClientActivityStatusFilter>("all");
  const [personFilter, setPersonFilter] = useState("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [dayPanelOpen, setDayPanelOpen] = useState(false);
  const [addActivityOpen, setAddActivityOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  const closeAddActivity = useCallback(() => setAddActivityOpen(false), []);
  const announceActivityCreated = useCallback((message: string) => {
    setSuccessMessage(message);
    setAddActivityOpen(false);
  }, []);

  const allActivities = useMemo(() => getClientActivities(workspaceData, today), [workspaceData, today]);
  const people = useMemo(
    () => [...new Set(workspaceData.workspaceState.people
      .filter((person) => person.organisationId === workspaceData.workspaceState.organisationId && person.active)
      .map((person) => person.name)
      .filter(Boolean))].sort(),
    [workspaceData.workspaceState.organisationId, workspaceData.workspaceState.people],
  );
  const filteredActivities = useMemo(
    () => filterClientActivities(allActivities, {
      activityType: typeFilter,
      status: statusFilter,
      responsiblePerson: personFilter,
    }),
    [allActivities, typeFilter, statusFilter, personFilter],
  );
  const monthActivities = useMemo(() => getActivitiesForMonth(filteredActivities, month), [filteredActivities, month]);
  const weekActivities = useMemo(() => getActivitiesForWeek(filteredActivities, selectedDate), [filteredActivities, selectedDate]);
  const weekDays = useMemo(() => getCalendarWeekDays(selectedDate), [selectedDate]);
  const days = useMemo(() => getMonthGridDays(month), [month]);
  const selectedActivities = useMemo(() => getActivitiesForDate(filteredActivities, selectedDate), [filteredActivities, selectedDate]);
  const organisationName = workspaceData.organisation?.company || "Client organisation";
  const heading = view === "week"
    ? `${formatCalendarDate(weekDays[0], { weekday: "short", day: "numeric", month: "short" })} – ${formatCalendarDate(weekDays[6], { weekday: "short", day: "numeric", month: "short", year: "numeric" })}`
    : formatCalendarMonth(month);
  const visibleActivityCount = view === "week" ? weekActivities.length : monthActivities.length;

  function navigatePeriod(offset: number) {
    if (view === "week") {
      const nextDate = shiftCalendarDate(selectedDate, offset * 7);
      setSelectedDate(nextDate);
      setMonth(monthKeyFromDate(nextDate));
      return;
    }
    const nextMonth = shiftMonth(month, offset);
    setMonth(nextMonth);
    setSelectedDate(`${nextMonth}-01`);
  }

  function goToToday() {
    setMonth(today.slice(0, 7));
    setSelectedDate(today);
  }

  function selectDate(date: string) {
    setSelectedDate(date);
    if (monthKeyFromDate(date) !== month) setMonth(monthKeyFromDate(date));
    setDayPanelOpen(true);
  }

  function printMonth() {
    const cleanup = () => document.body.classList.remove("calendar-print-active");
    document.body.classList.add("calendar-print-active");
    window.addEventListener("afterprint", cleanup, { once: true });
    window.print();
    window.setTimeout(cleanup, 1000);
  }

  return (
    <div id="client-calendar-print-root" className="mx-auto max-w-[1600px] space-y-4 p-3 sm:space-y-5 sm:p-6">
      <div className="calendar-print-heading hidden">
        <p className="text-lg font-bold">Deadline-Monitor</p>
        <p>{organisationName}</p>
        <h1 className="text-2xl font-bold">Monthly Monitoring Calendar · {formatCalendarMonth(month)}</h1>
        <p>Generated {new Intl.DateTimeFormat("en-ZA", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Johannesburg" }).format(new Date())}</p>
      </div>

      <section aria-label="Calendar controls" className="calendar-print-hide rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={goToToday} className="cursor-pointer rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600">
            Today
          </button>
          <button type="button" aria-label={`Previous ${view === "week" ? "week" : "month"}`} onClick={() => navigatePeriod(-1)} className="cursor-pointer rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600">
            <span aria-hidden="true">←</span><span className="sr-only">Previous {view === "week" ? "week" : "month"}</span>
          </button>
          <button type="button" aria-label={`Next ${view === "week" ? "week" : "month"}`} onClick={() => navigatePeriod(1)} className="cursor-pointer rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600">
            <span aria-hidden="true">→</span><span className="sr-only">Next {view === "week" ? "week" : "month"}</span>
          </button>
          <h2 className="order-first w-full text-xl font-bold text-slate-950 sm:order-none sm:ml-2 sm:w-auto sm:text-2xl">{heading}</h2>
          <div className="ml-auto flex items-center gap-1 rounded-lg bg-slate-100 p-1" role="group" aria-label="Calendar view">
            {(["month", "week", "agenda"] as const).map((calendarView) => (
              <button
                key={calendarView}
                type="button"
                aria-pressed={view === calendarView}
                onClick={() => setView(calendarView)}
                className={`cursor-pointer rounded-md px-3 py-1.5 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600 ${
                  view === calendarView ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:bg-white/70"
                }`}
              >
                {calendarView[0].toUpperCase() + calendarView.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
          <button type="button" aria-expanded={filtersOpen} aria-controls="calendar-filters" onClick={() => setFiltersOpen(!filtersOpen)} className="cursor-pointer rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600">
            Filters
          </button>
          <button id="calendar-toolbar-add-activity" type="button" onClick={() => setAddActivityOpen(true)} className="cursor-pointer rounded-lg bg-teal-700 px-3 py-2 text-sm font-semibold text-white hover:bg-teal-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600">
            + Add Activity
          </button>
          <button type="button" onClick={printMonth} disabled={view !== "month"} title={view === "month" ? "Print the selected month" : "Switch to Month view to print"} className={`rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600 ${view === "month" ? "cursor-pointer text-slate-700 hover:bg-slate-50" : "cursor-not-allowed text-slate-400"}`}>
            Print Month
          </button>
          <span className="ml-auto cursor-default text-xs text-slate-500">{visibleActivityCount} activities {view === "week" ? "this week" : "this month"}</span>
        </div>
        {filtersOpen && (
          <div id="calendar-filters" className="mt-3 grid gap-3 border-t border-slate-100 pt-3 sm:grid-cols-3">
            <label className="grid gap-1 text-xs font-semibold text-slate-600">
              Activity type
              <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as ClientActivityTypeFilter)} className="cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600">
                <option value="all">All</option><option value="records">Records</option><option value="tasks">Tasks</option><option value="checklist">Checklist</option><option value="follow_ups">Follow-ups</option>
              </select>
            </label>
            <label className="grid gap-1 text-xs font-semibold text-slate-600">
              Status
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as ClientActivityStatusFilter)} className="cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600">
                <option value="all">All</option><option value="due">Due</option><option value="overdue">Overdue</option><option value="completed">Completed</option><option value="awaiting">Awaiting</option><option value="paused">Paused</option>
              </select>
            </label>
            <label className="grid gap-1 text-xs font-semibold text-slate-600">
              Responsible person
              <select value={personFilter} onChange={(event) => setPersonFilter(event.target.value)} className="cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600">
                <option value="all">Everyone</option>
                {people.map((person) => <option key={person} value={person}>{person}</option>)}
              </select>
            </label>
          </div>
        )}
      </section>

      <section aria-label={`${heading} ${view} view`} className="calendar-print-area">
        {workspaceData.assignedTasksError && (
          <p role="alert" className="mb-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {workspaceData.assignedTasksError}
          </p>
        )}
        {view === "month" && (
          <>
            <CalendarMonthView
              days={days}
              month={month}
              today={today}
              selectedDate={selectedDate}
              activities={filteredActivities}
              onSelectDate={selectDate}
            />
            <div className="mt-3 grid gap-2 text-[11px] text-slate-600 sm:grid-cols-2 lg:grid-cols-5" aria-label="Calendar legend">
              {[
                ["bg-emerald-500", "Completed"],
                ["bg-blue-500", "Scheduled task"],
                ["bg-orange-500", "Expiring soon"],
                ["bg-red-500", "Overdue / Expired"],
                ["bg-violet-500", "Awaiting confirmation"],
              ].map(([color, label]) => (
                <span key={label} className="flex cursor-default items-center gap-2"><span aria-hidden="true" className={`h-2.5 w-2.5 rounded-full ${color}`} />{label}</span>
              ))}
            </div>
            <p className="calendar-print-disclaimer mt-3 hidden text-xs text-slate-600">Operational planning information only. Verify deadlines against the relevant authority and source record. No confidential source documents are included.</p>
          </>
        )}
        {view === "week" && <CalendarWeekView days={weekDays} today={today} activities={weekActivities} />}
        {view === "agenda" && <CalendarAgendaView month={month} today={today} activities={monthActivities} />}
      </section>

      <div className="calendar-print-hide cursor-default text-xs text-slate-500">
        Week starts Monday. Dates and activity counts use your organisation workspace.
      </div>
      <p role="status" aria-live="polite" className="sr-only">{successMessage}</p>

      {dayPanelOpen && (
        <CalendarDayPanel
          date={selectedDate}
          activities={selectedActivities}
          today={today}
          onClose={() => setDayPanelOpen(false)}
          onAddActivity={() => {
            setDayPanelOpen(false);
            setAddActivityOpen(true);
          }}
        />
      )}

      {addActivityOpen && (
        <CalendarAddActivityDialog
          date={selectedDate}
          workspaceData={workspaceData}
          onClose={closeAddActivity}
          onCreated={announceActivityCreated}
        />
      )}
    </div>
  );
}
