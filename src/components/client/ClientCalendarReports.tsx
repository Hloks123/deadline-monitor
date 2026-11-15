"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ClientWorkspaceData } from "@/components/client/useClientWorkspaceData";
import {
  filterClientActivities,
  getActivitiesForMonth,
  getActivitiesForWeek,
  getClientActivities,
  type ClientActivityStatusFilter,
  type ClientActivityTypeFilter,
} from "@/lib/clientActivities";
import {
  clientCalendarReportDisclaimer,
  exportClientCalendarReport,
  summarizeClientCalendarActivities,
  type ClientCalendarReportFormat,
  type ClientCalendarReportType,
} from "@/lib/clientCalendarReports";
import { clientBusinessToday } from "@/lib/clientWorkspaceSelectors";
import CalendarAgendaView from "@/components/client/calendar/CalendarAgendaView";
import CalendarMonthView from "@/components/client/calendar/CalendarMonthView";
import CalendarWeekView from "@/components/client/calendar/CalendarWeekView";
import {
  formatCalendarDate,
  formatCalendarMonth,
  getCalendarWeekDays,
  getMonthGridDays,
  shiftCalendarDate,
  shiftMonth,
} from "@/components/client/calendar/calendarUtils";

type Props = {
  data: ClientWorkspaceData;
  initialType?: ClientCalendarReportType;
};

const fieldClass = "mt-1 min-h-[42px] w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-700";

function reportTitle(type: ClientCalendarReportType) {
  if (type === "monthly_calendar") return "Monthly Calendar";
  if (type === "weekly_calendar") return "Weekly Calendar";
  return "Monthly Activity List";
}

export default function ClientCalendarReports({ data, initialType = "monthly_calendar" }: Props) {
  const today = clientBusinessToday();
  const [type, setType] = useState<ClientCalendarReportType>(initialType);
  const [month, setMonth] = useState(today.slice(0, 7));
  const [weekDate, setWeekDate] = useState(today);
  const [previewSelectedDate, setPreviewSelectedDate] = useState(today);
  const [activityType, setActivityType] = useState<ClientActivityTypeFilter>("all");
  const [status, setStatus] = useState<ClientActivityStatusFilter>("all");
  const [responsiblePerson, setResponsiblePerson] = useState("all");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const generatedLabelRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!generatedLabelRef.current) return;
    generatedLabelRef.current.textContent = new Intl.DateTimeFormat("en-ZA", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Africa/Johannesburg",
    }).format(new Date());
  }, []);

  const allActivities = useMemo(() => getClientActivities(data, today), [data, today]);
  const filteredActivities = useMemo(() => filterClientActivities(allActivities, {
    activityType,
    status,
    responsiblePerson,
  }), [allActivities, activityType, status, responsiblePerson]);
  const monthActivities = useMemo(
    () => getActivitiesForMonth(filteredActivities, month),
    [filteredActivities, month],
  );
  const weekActivities = useMemo(
    () => getActivitiesForWeek(filteredActivities, weekDate),
    [filteredActivities, weekDate],
  );
  const weekDays = useMemo(() => getCalendarWeekDays(weekDate), [weekDate]);
  const monthDays = useMemo(() => getMonthGridDays(month), [month]);
  const activities = type === "weekly_calendar" ? weekActivities : monthActivities;
  const summary = useMemo(
    () => summarizeClientCalendarActivities(type === "weekly_calendar" ? weekActivities : monthActivities, today),
    [monthActivities, today, type, weekActivities],
  );
  const people = useMemo(() => data.workspaceState.people
    .filter((person) => person.organisationId === data.workspaceState.organisationId && person.active)
    .map((person) => person.name)
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right)), [
    data.workspaceState.organisationId,
    data.workspaceState.people,
  ]);
  const organisation = data.organisation?.company || "Client organisation";
  const monthLabel = formatCalendarMonth(month);
  const reportPeriod = type === "weekly_calendar"
    ? `${formatCalendarDate(weekDays[0], { day: "numeric", month: "short" })} – ${formatCalendarDate(weekDays[6], { day: "numeric", month: "short", year: "numeric" })}`
    : monthLabel;
  const emptyLabel = type === "weekly_calendar"
    ? "No activities match the selected week and filters."
    : "No activities match the selected month and filters.";

  function updateMonth(value: string) {
    if (!/^\d{4}-\d{2}$/.test(value)) return;
    setMonth(value);
    setPreviewSelectedDate(`${value}-01`);
  }

  function changeMonth(offset: number) {
    const nextMonth = shiftMonth(month, offset);
    setMonth(nextMonth);
    setPreviewSelectedDate(`${nextMonth}-01`);
  }

  function printReport() {
    document.body.classList.add("calendar-print-active");
    window.addEventListener("afterprint", () => document.body.classList.remove("calendar-print-active"), { once: true });
    window.print();
    window.setTimeout(() => document.body.classList.remove("calendar-print-active"), 1000);
  }

  async function download(format: ClientCalendarReportFormat) {
    if (activities.length === 0 || exporting) return;
    setExporting(true);
    setExportError("");
    try {
      await exportClientCalendarReport({
        format,
        type,
        month,
        periodLabel: reportPeriod,
        organisation,
        activities,
        summary,
      });
    } catch (error) {
      console.error("Could not export the client Calendar report.", error);
      setExportError("The Calendar report could not be downloaded. Please try again.");
    } finally {
      setExporting(false);
    }
  }

  const exportFormats: Array<[ClientCalendarReportFormat, string]> = type === "activity_list"
    ? [["csv", "CSV"], ["xlsx", "Excel"], ["pdf", "PDF"], ["docx", "Word"]]
    : [["pdf", "PDF"], ["xlsx", "Excel"], ["docx", "Word"]];

  return (
    <section aria-labelledby="calendar-reports-heading" className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
      <header>
        <h2 id="calendar-reports-heading" className="text-lg font-bold text-slate-950">Calendar Reports</h2>
        <p className="mt-1 text-sm text-slate-600">Calendar reports use the same client activity selector and filters as the Client Calendar.</p>
      </header>

      <nav aria-label="Calendar report type" className="grid gap-2 sm:grid-cols-3">
        {([
          ["monthly_calendar", "Monthly Calendar"],
          ["weekly_calendar", "Weekly Calendar"],
          ["activity_list", "Monthly Activity List"],
        ] as const).map(([value, label]) => (
          <button key={value} type="button" aria-pressed={type === value} onClick={() => { setType(value); setExportError(""); }} className={`cursor-pointer rounded-xl border p-3 text-left text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-700 ${type === value ? "border-teal-600 bg-teal-50 text-teal-950" : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"}`}>
            {label}
          </button>
        ))}
      </nav>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-sm font-semibold text-slate-700">Month and year
          <input type="month" value={month} onChange={(event) => updateMonth(event.target.value)} className={`${fieldClass} cursor-text`} />
        </label>
        {type === "weekly_calendar" && (
          <label className="text-sm font-semibold text-slate-700">Week containing
            <input type="date" value={weekDate} onChange={(event) => setWeekDate(event.target.value)} className={`${fieldClass} cursor-text`} />
          </label>
        )}
        <label className="text-sm font-semibold text-slate-700">Activity type
          <select value={activityType} onChange={(event) => setActivityType(event.target.value as ClientActivityTypeFilter)} className={`${fieldClass} cursor-pointer`}>
            <option value="all">All</option><option value="records">Records</option><option value="tasks">Tasks</option><option value="checklist">Checklist</option><option value="follow_ups">Follow-ups</option>
          </select>
        </label>
        <label className="text-sm font-semibold text-slate-700">Status
          <select value={status} onChange={(event) => setStatus(event.target.value as ClientActivityStatusFilter)} className={`${fieldClass} cursor-pointer`}>
            <option value="all">All</option><option value="due">Due</option><option value="overdue">Overdue</option><option value="completed">Completed</option><option value="awaiting">Awaiting</option><option value="paused">Paused</option>
          </select>
        </label>
        <label className="text-sm font-semibold text-slate-700">Responsible person
          <select value={responsiblePerson} onChange={(event) => setResponsiblePerson(event.target.value)} className={`${fieldClass} cursor-pointer`}>
            <option value="all">Everyone</option>
            {people.map((person) => <option key={person} value={person}>{person}</option>)}
          </select>
        </label>
      </div>

      {exportError && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{exportError}</p>}

      <div id="client-calendar-report-print-root" className="space-y-4 rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
        <header className="calendar-report-print-heading hidden">
          <p className="text-lg font-bold">Deadline-Monitor</p>
          <p>{organisation}</p>
          <h2 className="text-xl font-bold">{reportTitle(type)} · {reportPeriod}</h2>
          <p>Generated <span ref={generatedLabelRef} /></p>
        </header>

        <div className="calendar-report-print-hide flex flex-wrap items-center gap-2">
          {type !== "weekly_calendar" && (
            <>
              <button type="button" aria-label="Previous month" onClick={() => changeMonth(-1)} className="cursor-pointer rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-700">Previous</button>
              <button type="button" aria-label="Next month" onClick={() => changeMonth(1)} className="cursor-pointer rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-700">Next</button>
            </>
          )}
          {type === "weekly_calendar" && (
            <>
              <button type="button" onClick={() => setWeekDate(shiftCalendarDate(weekDate, -7))} className="cursor-pointer rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-700">Previous week</button>
              <button type="button" onClick={() => setWeekDate(shiftCalendarDate(weekDate, 7))} className="cursor-pointer rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-700">Next week</button>
            </>
          )}
          <h3 className="mr-auto text-base font-bold text-slate-900">{reportTitle(type)} · {reportPeriod}</h3>
          <button type="button" disabled={activities.length === 0} onClick={printReport} className="min-h-[40px] cursor-pointer rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">Print</button>
          {exportFormats.map(([format, label]) => (
            <button key={format} type="button" disabled={exporting || activities.length === 0} onClick={() => void download(format)} className="min-h-[40px] cursor-pointer rounded-lg bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50">
              Download {label}
            </button>
          ))}
        </div>

        {activities.length === 0 ? (
          <p role="status" className="cursor-default rounded-xl border border-amber-200 bg-amber-50 p-5 text-center text-sm font-semibold text-amber-950">{emptyLabel}</p>
        ) : (
          <>
            {type === "monthly_calendar" && (
              <>
                <section aria-label="Monthly Calendar summary" className="calendar-report-print-hide grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">
                  {[
                    ["Total activities", summary.total],
                    ["Tasks scheduled", summary.tasksScheduled],
                    ["Completed tasks", summary.completedTasks],
                    ["Overdue work", summary.overdueWork],
                    ["Records expiring", summary.recordsExpiring],
                    ["Expired records", summary.expiredRecords],
                    ["Awaiting confirmation", summary.awaitingConfirmation],
                  ].map(([label, count]) => <div key={String(label)} className="rounded-lg border border-slate-200 bg-slate-50 p-3"><span className="block text-xs font-semibold text-slate-600">{label}</span><strong className="mt-1 block text-xl text-slate-950">{count}</strong></div>)}
                </section>
                <h3 className="calendar-report-print-hide text-base font-bold text-slate-900">Preview Calendar</h3>
                <div className="calendar-print-area">
                  <CalendarMonthView
                    days={monthDays}
                    month={month}
                    today={today}
                    selectedDate={previewSelectedDate}
                    activities={monthActivities}
                    onSelectDate={setPreviewSelectedDate}
                  />
                </div>
                <div className="flex flex-wrap gap-3 text-xs text-slate-600" aria-label="Calendar legend">
                  <span className="cursor-default"><strong>✓</strong> Completed</span>
                  <span className="cursor-default"><strong>•</strong> Scheduled task</span>
                  <span className="cursor-default"><strong>⌛</strong> Expiring soon</span>
                  <span className="cursor-default"><strong>!</strong> Overdue / Expired</span>
                  <span className="cursor-default"><strong>◷</strong> Awaiting confirmation</span>
                </div>
              </>
            )}
            {type === "weekly_calendar" && <CalendarWeekView days={weekDays} today={today} activities={weekActivities} />}
            {type === "activity_list" && <CalendarAgendaView month={month} today={today} activities={monthActivities} />}
          </>
        )}

        <p className="calendar-report-print-disclaimer hidden text-xs text-slate-600">{clientCalendarReportDisclaimer}</p>
      </div>
    </section>
  );
}
