"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import ClientWorkspaceShell from "@/components/client/ClientWorkspaceShell";
import ClientCalendarReports from "@/components/client/ClientCalendarReports";
import useClientWorkspaceData from "@/components/client/useClientWorkspaceData";
import {
  buildClientReportRows,
  clientReportSections,
  type ClientReportFormat,
  type ClientReportPeriod,
  filterClientReportRows,
  getClientReportDateRange,
  reportColumns,
  reportDisclaimer,
} from "@/lib/clientReports";
import { exportClientReport } from "@/lib/clientReports";
import { CLIENT_WORKSPACE_ORGANISATION_ID } from "@/lib/clientWorkspaceConstants";
import { clientBusinessToday, shiftClientDate } from "@/lib/clientWorkspaceSelectors";
import type { ClientCalendarReportType } from "@/lib/clientCalendarReports";

type ReportCategory = "Tasks & Work" | "Records & Expiry" | "Calendar" | "History" | "Management";
type ReportLibraryItem = {
  id: string;
  title: string;
  description: string;
  category: ReportCategory;
  defaultPeriod: string;
  dataset?: "tasks" | "records" | "notifications";
  automaticPeriod?: ClientReportPeriod;
  calendarType?: ClientCalendarReportType;
};

const categoryById: Record<string, ReportCategory> = {
  "today-task-schedule": "Tasks & Work",
  "weekly-task-schedule": "Tasks & Work",
  "monthly-task-schedule": "Tasks & Work",
  "overdue-work": "Tasks & Work",
  "completed-tasks": "Tasks & Work",
  "blocked-work": "Tasks & Work",
  "work-by-responsible-person": "Tasks & Work",
  "all-client-work": "Tasks & Work",
  "expired-records": "Records & Expiry",
  "expiring-7-days": "Records & Expiry",
  "expiring-30-days": "Records & Expiry",
  "expiring-60-days": "Records & Expiry",
  "expiring-90-days": "Records & Expiry",
  "expiring-6-months": "Records & Expiry",
  "expiring-12-months": "Records & Expiry",
  "all-monitored-records": "Records & Expiry",
  "awaiting-confirmation": "Records & Expiry",
  "notification-history": "History",
  "renewed-records": "History",
  "monthly-monitoring-summary": "Management",
};

const reportOrder = [
  "today-task-schedule",
  "weekly-task-schedule",
  "monthly-task-schedule",
  "overdue-work",
  "completed-tasks",
  "blocked-work",
  "work-by-responsible-person",
  "all-client-work",
  "expired-records",
  "expiring-7-days",
  "expiring-30-days",
  "expiring-60-days",
  "expiring-90-days",
  "expiring-6-months",
  "expiring-12-months",
  "all-monitored-records",
  "awaiting-confirmation",
  "calendar-weekly",
  "calendar-monthly",
  "calendar-activity-list",
  "notification-history",
  "renewed-records",
  "monthly-monitoring-summary",
] as const;

const calendarReports: ReportLibraryItem[] = [
  {
    id: "calendar-weekly",
    title: "Weekly Calendar",
    description: "A Monday-to-Sunday view of client-visible activities.",
    category: "Calendar",
    defaultPeriod: "This week",
    calendarType: "weekly_calendar",
  },
  {
    id: "calendar-monthly",
    title: "Monthly Calendar",
    description: "A visual monthly schedule of client-visible activities.",
    category: "Calendar",
    defaultPeriod: "This month",
    calendarType: "monthly_calendar",
  },
  {
    id: "calendar-activity-list",
    title: "Monthly Activity List",
    description: "A dated list of activities scheduled in the selected month.",
    category: "Calendar",
    defaultPeriod: "This month",
    calendarType: "activity_list",
  },
];

const baseReportMap = new Map(clientReportSections.map((report) => [report.id, report]));
const reportCatalog: ReportLibraryItem[] = reportOrder.flatMap((id) => {
  const calendarReport = calendarReports.find((report) => report.id === id);
  if (calendarReport) return [calendarReport];
  const report = baseReportMap.get(id);
  const category = categoryById[id];
  if (!report || !category) return [];
  return [{
    id: report.id,
    title: report.title,
    description: report.description,
    category,
    dataset: report.dataset,
    automaticPeriod: report.automaticPeriod,
    defaultPeriod: periodLabel(report.automaticPeriod),
  }];
});

const categories = ["All Reports", "Tasks & Work", "Records & Expiry", "Calendar", "History", "Management"] as const;
const periodOptions: Array<[ClientReportPeriod, string]> = [
  ["auto", "Report default"],
  ["today", "Today"],
  ["week", "This week"],
  ["month", "This month"],
  ["7", "Next 7 days"],
  ["30", "Next 30 days"],
  ["60", "Next 60 days"],
  ["90", "Next 90 days"],
  ["180", "Next 6 months"],
  ["365", "Next 12 months"],
  ["custom", "Custom dates"],
];
const formats: Array<[ClientReportFormat, string]> = [
  ["xlsx", "Excel (.xlsx)"],
  ["csv", "CSV (.csv)"],
  ["docx", "Word (.docx)"],
  ["pdf", "PDF (.pdf)"],
];
function getFavoriteStorageKey() {
  return `docmon_client_report_favorites_${CLIENT_WORKSPACE_ORGANISATION_ID}_v1`;
}
const favoriteUpdatedEvent = "docmon-client-report-favorites-updated";
const focusableSelector = "button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex='-1'])";

function getFavoriteSnapshot() {
  try {
    return localStorage.getItem(getFavoriteStorageKey()) || "[]";
  } catch (error) {
    console.error("Could not read report favourites from prototype storage.", error);
    return "[]";
  }
}

function subscribeToFavoriteChanges(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(favoriteUpdatedEvent, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(favoriteUpdatedEvent, onChange);
  };
}

function periodLabel(period: ClientReportPeriod) {
  if (period === "auto") return "All available";
  if (period === "today") return "Today";
  if (period === "week") return "This week";
  if (period === "month") return "This month";
  if (period === "custom") return "Custom dates";
  if (period === "180") return "Next 6 months";
  if (period === "365") return "Next 12 months";
  return `Next ${period} days`;
}

function currentDate() {
  return clientBusinessToday();
}

function addDays(date: string, count: number) {
  return shiftClientDate(date, count);
}

function filterOptions(rows: string[], selected: string) {
  return [...new Set([...rows, ...(selected === "all" ? [] : [selected])].filter(Boolean))]
    .sort((left, right) => left.localeCompare(right));
}

function categoryColor(category: ReportCategory, reportId: string) {
  if (reportId === "overdue-work") return "border-red-200 bg-red-50 text-red-800";
  if (category === "Tasks & Work") return "border-blue-200 bg-blue-50 text-blue-800";
  if (category === "Records & Expiry") return "border-orange-200 bg-orange-50 text-orange-900";
  if (category === "Calendar") return "border-violet-200 bg-violet-50 text-violet-800";
  if (category === "History") return "border-green-200 bg-green-50 text-green-800";
  return "border-teal-200 bg-teal-50 text-teal-800";
}

export default function ClientReportsPage() {
  const data = useClientWorkspaceData();
  const today = currentDate();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<(typeof categories)[number]>("All Reports");
  const [selectedId, setSelectedId] = useState("");
  const favoriteSnapshot = useSyncExternalStore(subscribeToFavoriteChanges, getFavoriteSnapshot, () => "[]");
  const [favoriteStorageError, setFavoriteStorageError] = useState("");
  const [period, setPeriod] = useState<ClientReportPeriod>("auto");
  const [customStart, setCustomStart] = useState(today);
  const [customEnd, setCustomEnd] = useState(addDays(today, 30));
  const [status, setStatus] = useState("all");
  const [recordCategory, setRecordCategory] = useState("all");
  const [person, setPerson] = useState("all");
  const [priority, setPriority] = useState("all");
  const [type, setType] = useState("all");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const [printActive, setPrintActive] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const favoriteIds = useMemo(() => {
    try {
      const parsed: unknown = JSON.parse(favoriteSnapshot);
      return Array.isArray(parsed)
        ? parsed.filter((id): id is string =>
          typeof id === "string" && reportCatalog.some((report) => report.id === id)
        )
        : [];
    } catch (error) {
      console.error("Could not parse report favourites from prototype storage.", error);
      return [];
    }
  }, [favoriteSnapshot]);

  const selectedReport = reportCatalog.find((report) => report.id === selectedId);
  const baseReport = selectedReport?.automaticPeriod
    ? baseReportMap.get(selectedReport.id)
    : undefined;
  const dateRange = useMemo(() => selectedReport && baseReport
    ? getClientReportDateRange(period, baseReport.automaticPeriod, customStart, customEnd)
    : null, [selectedReport, baseReport, period, customStart, customEnd]);
  const dateRangeError = period === "custom" && customStart > customEnd
    ? "The custom start date must be on or before the end date."
    : "";
  const allRows = useMemo(() => selectedReport && dateRange
    ? buildClientReportRows(selectedReport.id, data, dateRange)
    : [], [selectedReport, data, dateRange]);
  const rows = useMemo(() => filterClientReportRows(allRows, {
    status,
    category: recordCategory,
    person,
    priority,
    type,
  }), [allRows, status, recordCategory, person, priority, type]);
  const columns = selectedReport ? reportColumns(rows, selectedReport.id) : [];
  const organisation = data.organisation?.company || "Client organisation";
  const periodName = dateRange?.label || "";
  const dateError = Boolean(dateRangeError);
  const assignedDataRequired = selectedReport?.dataset === "tasks" || Boolean(selectedReport?.calendarType);
  const reportDataLoading = !data.ready || (assignedDataRequired && !data.assignedTasksReady);
  const reportDataError = data.error || (assignedDataRequired ? data.assignedTasksError : undefined);
  const allDataReport = selectedReport?.id === "all-client-work" || selectedReport?.id === "all-monitored-records";

  const matchingReports = useMemo(() => reportCatalog.filter((report) => {
    const matchesCategory = category === "All Reports" || report.category === category;
    const searchText = `${report.title} ${report.description} ${report.category}`.toLocaleLowerCase();
    const searchTerms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    return matchesCategory && searchTerms.every((term) => searchText.includes(term));
  }), [category, query]);
  const matchingFavorites = matchingReports.filter((report) => favoriteIds.includes(report.id));

  const filters = useMemo(() => {
    if (!selectedReport || !baseReport) return [];
    const taskReport = selectedReport.category === "Tasks & Work";
    const recordReport = selectedReport.category === "Records & Expiry";
    const mixedReport = ["overdue-work", "monthly-monitoring-summary"].includes(selectedReport.id);
    const options = [
      ...(selectedReport.id !== "expired-records" && selectedReport.id !== "overdue-work"
        ? [{ key: "status", label: "Status", value: status, set: setStatus, options: filterOptions(allRows.map((row) => row.status), status) }]
        : []),
      ...(recordReport || selectedReport.id === "monthly-monitoring-summary"
        ? [{ key: "recordCategory", label: "Record category", value: recordCategory, set: setRecordCategory, options: filterOptions(allRows.map((row) => row.category), recordCategory) }]
        : []),
      ...(taskReport || recordReport || selectedReport.id === "monthly-monitoring-summary"
        ? [{ key: "person", label: "Responsible person", value: person, set: setPerson, options: filterOptions(allRows.map((row) => row.person), person) }]
        : []),
      ...(taskReport || recordReport || selectedReport.id === "monthly-monitoring-summary"
        ? [{ key: "priority", label: "Priority", value: priority, set: setPriority, options: filterOptions(allRows.map((row) => row.priority), priority) }]
        : []),
      ...(mixedReport
        ? [{ key: "type", label: "Activity type", value: type, set: setType, options: filterOptions(allRows.map((row) => row.type), type) }]
        : []),
    ];
    return options;
  }, [selectedReport, baseReport, status, recordCategory, person, priority, type, allRows]);

  useEffect(() => {
    if (!selectedReport) return;
    closeButtonRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setSelectedId("");
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>(focusableSelector)];
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [selectedReport]);

  function chooseReport(id: string) {
    setSelectedId(id);
    setPeriod("auto");
    setCustomStart(today);
    setCustomEnd(addDays(today, 30));
    setStatus("all");
    setRecordCategory("all");
    setPerson("all");
    setPriority("all");
    setType("all");
    setExportError("");
  }

  function toggleFavorite(id: string) {
    const updated = favoriteIds.includes(id)
      ? favoriteIds.filter((favoriteId) => favoriteId !== id)
      : [...favoriteIds, id];
    try {
      localStorage.setItem(getFavoriteStorageKey(), JSON.stringify(updated));
      window.dispatchEvent(new Event(favoriteUpdatedEvent));
      setFavoriteStorageError("");
    } catch (error) {
      console.error("Could not save report favourites to prototype storage.", error);
      setFavoriteStorageError("Report favourites could not be saved in this browser.");
    }
  }

  async function download(format: ClientReportFormat) {
    if (!selectedReport || dateError || reportDataLoading || reportDataError || exporting || rows.length === 0) return;
    setExporting(true);
    setExportError("");
    try {
      await exportClientReport({
        format,
        organisation,
        reportTitle: selectedReport.title,
        periodLabel: periodName,
        columns,
        rows,
      });
    } catch (error) {
      console.error("Could not export the selected client report.", error);
      setExportError("The report could not be downloaded. Please try again.");
    } finally {
      setExporting(false);
    }
  }

  function printReport() {
    setPrintActive(true);
    document.body.classList.add("client-report-print-active");
    window.addEventListener("afterprint", () => {
      document.body.classList.remove("client-report-print-active");
      setPrintActive(false);
    }, { once: true });
    window.print();
    window.setTimeout(() => {
      document.body.classList.remove("client-report-print-active");
      setPrintActive(false);
    }, 1000);
  }

  function renderTable(reports: ReportLibraryItem[], sectionName: string) {
    return (
      <section aria-labelledby={`report-list-${sectionName}`} className="space-y-2">
        <h2 id={`report-list-${sectionName}`} className="text-sm font-bold uppercase tracking-wide text-slate-600">{sectionName}</h2>
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[760px] border-collapse text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
              <tr>
                <th scope="col" className="px-4 py-3">Report</th>
                <th scope="col" className="px-4 py-3">Description</th>
                <th scope="col" className="px-4 py-3">Category</th>
                <th scope="col" className="px-4 py-3">Default Period</th>
                <th scope="col" className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {reports.map((report) => (
                <tr key={report.id} className="cursor-default">
                  <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-950">
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => chooseReport(report.id)} className="cursor-pointer text-left hover:text-teal-800 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-700">{report.title}</button>
                      <button
                        type="button"
                        aria-label={`${favoriteIds.includes(report.id) ? "Remove" : "Add"} ${report.title} ${favoriteIds.includes(report.id) ? "from" : "to"} favourites`}
                        aria-pressed={favoriteIds.includes(report.id)}
                        title={favoriteIds.includes(report.id) ? "Remove from favourites" : "Add to favourites"}
                        onClick={() => toggleFavorite(report.id)}
                        className="cursor-pointer rounded p-1 text-lg leading-none text-amber-600 hover:bg-amber-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-700"
                      >{favoriteIds.includes(report.id) ? "★" : "☆"}</button>
                    </div>
                  </td>
                  <td className="max-w-md px-4 py-3 text-slate-600">{report.description}</td>
                  <td className="whitespace-nowrap px-4 py-3"><span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${categoryColor(report.category, report.id)}`}>{report.category}</span></td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-700">{report.defaultPeriod}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <button type="button" onClick={() => chooseReport(report.id)} className="min-h-9 cursor-pointer rounded-lg border border-teal-700 px-3 font-semibold text-teal-900 hover:bg-teal-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700">Select</button>
                  </td>
                </tr>
              ))}
              {reports.length === 0 && <tr><td colSpan={5} className="cursor-default px-4 py-8 text-center text-slate-600">No reports match your search and category.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    );
  }

  return (
    <ClientWorkspaceShell title="Reports">
      <main className="mx-auto w-full max-w-[1500px] space-y-5 p-4 sm:p-6 lg:p-8">
        <header>
          <h2 className="text-2xl font-bold text-slate-950">Reports</h2>
          <p className="mt-1 text-sm text-slate-600">Choose a report, select the required period or filters, then print or download it.</p>
        </header>

        <div className="grid gap-3 lg:grid-cols-[minmax(16rem,1fr)_auto] lg:items-end">
          <label className="block text-sm font-semibold text-slate-700">
            <span className="sr-only">Search reports</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search reports..."
              className="min-h-11 w-full cursor-text rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-700"
            />
          </label>
          <nav aria-label="Report categories" className="flex flex-wrap gap-2">
            {categories.map((item) => (
              <button key={item} type="button" aria-pressed={category === item} onClick={() => setCategory(item)} className={`min-h-10 cursor-pointer rounded-full border px-3 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-700 ${category === item ? "border-teal-700 bg-teal-50 text-teal-950" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"}`}>{item}</button>
            ))}
          </nav>
        </div>

        {favoriteStorageError && <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{favoriteStorageError}</p>}
        {matchingFavorites.length > 0 && renderTable(matchingFavorites, "Favourites")}
        {renderTable(matchingReports, "All Reports")}
      </main>

      {selectedReport && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/50 p-2 sm:p-6" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setSelectedId("");
        }}>
          <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="selected-report-title" aria-describedby="selected-report-description" className="my-2 w-full max-w-6xl rounded-2xl bg-white shadow-2xl sm:my-6">
            <header className="flex items-start gap-4 border-b border-slate-200 p-4 sm:p-6">
              <div className="min-w-0 flex-1">
                <h2 id="selected-report-title" className="text-xl font-bold text-slate-950">{selectedReport.title}</h2>
                <p id="selected-report-description" className="mt-1 text-sm text-slate-600">{selectedReport.description}</p>
              </div>
              <button ref={closeButtonRef} type="button" onClick={() => setSelectedId("")} aria-label="Close report" className="min-h-10 cursor-pointer rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-700">Close</button>
            </header>

            {selectedReport.calendarType ? (
              <div className="max-h-[calc(100vh-7rem)] overflow-y-auto p-4 sm:p-6">
                {reportDataError
                  ? <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{reportDataError}</p>
                  : reportDataLoading
                    ? <p role="status" className="p-5 text-sm text-slate-600">Loading organisation records and tasks…</p>
                    : <ClientCalendarReports key={selectedReport.id} data={data} initialType={selectedReport.calendarType} />}
              </div>
            ) : (
              <div className="space-y-5 p-4 sm:p-6">
                <section aria-label="Report parameters" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {!allDataReport && <label className="text-sm font-semibold text-slate-700">Reporting period
                    <select value={period} onChange={(event) => setPeriod(event.target.value as ClientReportPeriod)} className="mt-1 min-h-11 w-full cursor-pointer rounded-lg border border-slate-300 bg-white px-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-700">
                      {periodOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </label>}
                  {!allDataReport && period === "custom" && <>
                    <label className="text-sm font-semibold text-slate-700">Start date
                      <input type="date" value={customStart} onChange={(event) => setCustomStart(event.target.value)} className="mt-1 min-h-11 w-full cursor-text rounded-lg border border-slate-300 bg-white px-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-700" />
                    </label>
                    <label className="text-sm font-semibold text-slate-700">End date
                      <input type="date" value={customEnd} onChange={(event) => setCustomEnd(event.target.value)} className="mt-1 min-h-11 w-full cursor-text rounded-lg border border-slate-300 bg-white px-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-700" />
                    </label>
                  </>}
                  {filters.map((filter) => (
                    <label key={filter.key} className="text-sm font-semibold text-slate-700">{filter.label}
                      <select value={filter.value} onChange={(event) => filter.set(event.target.value)} className="mt-1 min-h-11 w-full cursor-pointer rounded-lg border border-slate-300 bg-white px-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-700">
                        <option value="all">All</option>
                        {filter.options.map((option) => <option key={option} value={option}>{option}</option>)}
                      </select>
                    </label>
                  ))}
                </section>

                {dateRangeError && <p role="alert" className="text-sm font-semibold text-red-800">{dateRangeError}</p>}
                {reportDataError && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{reportDataError}</p>}
                {!reportDataError && reportDataLoading && <p role="status" className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">Loading organisation records and tasks…</p>}
                {exportError && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{exportError}</p>}

                <section aria-label="Selected report preview" className="space-y-4 rounded-xl border border-slate-200 bg-white p-3 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-bold text-slate-950">{selectedReport.title}</h3>
                      <p className="text-sm text-slate-600">{organisation} · {periodName} · {rows.length} item{rows.length === 1 ? "" : "s"}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {formats.map(([format, label]) => (
                        <button key={format} type="button" disabled={exporting || dateError || reportDataLoading || Boolean(reportDataError) || rows.length === 0} onClick={() => void download(format)} className="min-h-10 cursor-pointer rounded-lg border border-teal-700 px-3 text-sm font-semibold text-teal-900 hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-50">{label}</button>
                      ))}
                      <button type="button" disabled={printActive || dateError || reportDataLoading || Boolean(reportDataError) || rows.length === 0} onClick={printReport} className="min-h-10 cursor-pointer rounded-lg bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50">Print</button>
                    </div>
                  </div>

                  {reportDataError ? (
                    <p role="status" className="rounded-lg border border-slate-200 bg-slate-50 p-5 text-center text-sm text-slate-600">Report data could not be loaded.</p>
                  ) : reportDataLoading ? (
                    <p role="status" className="rounded-lg border border-slate-200 bg-slate-50 p-5 text-center text-sm text-slate-600">Loading report data…</p>
                  ) : rows.length === 0 ? (
                    <p role="status" className="cursor-default rounded-lg border border-amber-200 bg-amber-50 p-5 text-center text-sm font-semibold text-amber-950">No items match this report.</p>
                  ) : (
                    <div id="client-report-print-root" className="overflow-x-auto">
                      <header className="client-report-print-heading hidden">
                        <p className="text-lg font-bold">Deadline-Monitor</p>
                        <p>{organisation}</p>
                        <h2 className="text-xl font-bold">{selectedReport.title}</h2>
                        <p>{periodName} · {rows.length} item{rows.length === 1 ? "" : "s"}</p>
                        <p>Generated {new Intl.DateTimeFormat("en-ZA", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Johannesburg" }).format(new Date())}</p>
                      </header>
                      <table className="w-full min-w-[680px] border-collapse text-left text-sm">
                        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600"><tr>{columns.map((column) => <th key={column} scope="col" className="border-b border-slate-200 px-3 py-2">{column}</th>)}</tr></thead>
                        <tbody className="divide-y divide-slate-100">
                          {rows.map((row) => <tr key={`${row.organisationId}-${row.id}`}>{columns.map((column) => <td key={column} className="border-b border-slate-100 px-3 py-2 text-slate-700">{row.cells[column] ?? ""}</td>)}</tr>)}
                        </tbody>
                      </table>
                      <p className="client-report-print-disclaimer hidden mt-4 text-xs text-slate-600">{reportDisclaimer} Reports include only client-visible information belonging to this organisation. No confidential source documents or consultant-only details are included.</p>
                    </div>
                  )}
                  {exporting && <p role="status" className="text-sm text-slate-600">Preparing download…</p>}
                </section>
              </div>
            )}
          </section>
        </div>
      )}
    </ClientWorkspaceShell>
  );
}
