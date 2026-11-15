import { Document, Footer, HeadingLevel, PageNumber, Packer, Paragraph, ShadingType, Table, TableCell, TableRow, TextRun, WidthType } from "docx";
import jsPDF from "jspdf";
import * as XLSX from "xlsx-js-style";
import {
  businessDateKey,
  clientBusinessToday,
  clientWeekRange,
  ClientWorkspaceSelectors,
  compareClientDateKeys,
  normalizeClientStatus,
  NormalizedClientStatus,
  selectClientWorkspaceData,
  shiftClientDate,
} from "@/lib/clientWorkspaceSelectors";
import type { ClientWorkspaceData } from "@/components/client/useClientWorkspaceData";

export type ClientReportPeriod = "auto" | "today" | "week" | "month" | "7" | "30" | "60" | "90" | "180" | "365" | "custom";
export type ClientReportFormat = "xlsx" | "csv" | "docx" | "pdf";
export type ClientReportRow = {
  id: string;
  organisationId: string;
  type: string;
  status: string;
  normalizedStatus: NormalizedClientStatus;
  dueDate?: string;
  category: string;
  person: string;
  priority: string;
  cells: Record<string, string | number>;
};
export type ClientReportDateRange = { start: string; end: string; label: string };
export type ClientReportDefinition = {
  id: string;
  title: string;
  description: string;
  section: "TODAY" | "THIS WEEK" | "UPCOMING" | "HISTORY";
  dataset: "tasks" | "records" | "notifications";
  automaticPeriod: ClientReportPeriod;
};

export const clientReportSections: ClientReportDefinition[] = [
  { id: "today-task-schedule", title: "Today's Task Schedule", description: "Client-visible tasks and checklist work scheduled today.", section: "TODAY", dataset: "tasks", automaticPeriod: "today" },
  { id: "overdue-work", title: "Overdue Work", description: "Open tasks, checklist actions and expired records.", section: "TODAY", dataset: "tasks", automaticPeriod: "auto" },
  { id: "expired-records", title: "Expired Records", description: "Expired monitored records that still require action.", section: "TODAY", dataset: "records", automaticPeriod: "auto" },
  { id: "weekly-task-schedule", title: "Weekly Task Schedule", description: "Tasks due in the current calendar week.", section: "THIS WEEK", dataset: "tasks", automaticPeriod: "week" },
  { id: "monthly-task-schedule", title: "Monthly Task Schedule", description: "Tasks and checklist work scheduled during the selected month.", section: "THIS WEEK", dataset: "tasks", automaticPeriod: "month" },
  { id: "blocked-work", title: "Blocked Work", description: "Client-visible work currently blocked and requiring attention.", section: "THIS WEEK", dataset: "tasks", automaticPeriod: "auto" },
  { id: "work-by-responsible-person", title: "Work by Responsible Person", description: "Client-visible tasks and checklist work grouped by assignee.", section: "THIS WEEK", dataset: "tasks", automaticPeriod: "auto" },
  { id: "all-client-work", title: "All Client Tasks & Work", description: "Every client-visible recurring, checklist and company-assigned task available to your account.", section: "HISTORY", dataset: "tasks", automaticPeriod: "auto" },
  { id: "expiring-7-days", title: "Records Expiring Within 7 Days", description: "Records reaching expiry in the next 7 days.", section: "THIS WEEK", dataset: "records", automaticPeriod: "7" },
  { id: "expiring-30-days", title: "Records Expiring Within 30 Days", description: "Records reaching expiry in the next 30 days.", section: "UPCOMING", dataset: "records", automaticPeriod: "30" },
  { id: "expiring-60-days", title: "Records Expiring Within 60 Days", description: "Records reaching expiry in the next 60 days.", section: "UPCOMING", dataset: "records", automaticPeriod: "60" },
  { id: "expiring-90-days", title: "Records Expiring Within 90 Days", description: "Records reaching expiry in the next 90 days.", section: "UPCOMING", dataset: "records", automaticPeriod: "90" },
  { id: "expiring-6-months", title: "Records Expiring Within 6 Months", description: "Records reaching expiry in the next six months.", section: "UPCOMING", dataset: "records", automaticPeriod: "180" },
  { id: "expiring-12-months", title: "Records Expiring Within 12 Months", description: "Records reaching expiry in the next twelve months.", section: "UPCOMING", dataset: "records", automaticPeriod: "365" },
  { id: "all-monitored-records", title: "All Monitored Records", description: "Every monitored record available to your organisation, regardless of expiry date.", section: "HISTORY", dataset: "records", automaticPeriod: "auto" },
  { id: "awaiting-confirmation", title: "Awaiting Confirmation", description: "Records and assigned work awaiting client confirmation.", section: "UPCOMING", dataset: "tasks", automaticPeriod: "auto" },
  { id: "monthly-monitoring-summary", title: "Monthly Monitoring Summary", description: "A monthly overview of monitored records and client work.", section: "UPCOMING", dataset: "tasks", automaticPeriod: "month" },
  { id: "completed-tasks", title: "Completed Tasks", description: "Completed client-visible recurring and checklist tasks.", section: "HISTORY", dataset: "tasks", automaticPeriod: "auto" },
  { id: "renewed-records", title: "Renewed Records", description: "Records confirmed or renewed in the selected period.", section: "HISTORY", dataset: "records", automaticPeriod: "auto" },
  { id: "notification-history", title: "Notification History", description: "Approved notifications sent or delivered to this organisation.", section: "HISTORY", dataset: "notifications", automaticPeriod: "auto" },
];

export const reportDisclaimer = "Deadline-Monitor information is an operational monitoring aid and not a legal, tax or regulatory compliance certification.";

export function getClientReportDateRange(
  period: ClientReportPeriod,
  automaticPeriod: ClientReportPeriod,
  customStart: string,
  customEnd: string,
): ClientReportDateRange {
  const today = clientBusinessToday();
  const selected = period === "auto" ? automaticPeriod : period;
  if (selected === "today") return { start: today, end: today, label: today };
  if (selected === "week") {
    const { start, end } = clientWeekRange(today);
    return { start, end, label: `${start} to ${end}` };
  }
  if (selected === "month") {
    const start = `${today.slice(0, 7)}-01`;
    const monthStart = new Date(`${today}T00:00:00.000Z`);
    const end = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
    return { start, end, label: `${start} to ${end}` };
  }
  if (["7", "30", "60", "90", "365"].includes(selected)) {
    const end = shiftClientDate(today, Number(selected));
    return { start: today, end, label: `${today} to ${end}` };
  }
  if (selected === "180") {
    const parsed = new Date(`${today}T00:00:00.000Z`);
    const targetMonth = parsed.getUTCMonth() + 6;
    const lastDay = new Date(Date.UTC(parsed.getUTCFullYear(), targetMonth + 1, 0)).getUTCDate();
    const end = new Date(Date.UTC(parsed.getUTCFullYear(), targetMonth, Math.min(parsed.getUTCDate(), lastDay))).toISOString().slice(0, 10);
    return { start: today, end, label: `${today} to ${end}` };
  }
  if (selected === "custom") {
    const start = customStart || today;
    const end = customEnd || shiftClientDate(today, 30);
    return { start, end, label: `${start} to ${end}` };
  }
  return { start: "0000-01-01", end: "9999-12-31", label: "All available history" };
}

function within(date: string, range: Pick<ClientReportDateRange, "start" | "end">) {
  return Boolean(date) && compareClientDateKeys(date, range.start) >= 0 && compareClientDateKeys(date, range.end) <= 0;
}

function displayStatus(status: NormalizedClientStatus, rawStatus: string) {
  const labels: Partial<Record<NormalizedClientStatus, string>> = {
    overdue: "Overdue",
    not_started: "Not Started",
    upcoming: "Upcoming",
    in_progress: "In Progress",
    completed: "Completed",
    blocked: "Blocked",
    due_today: "Due today",
    awaiting_confirmation: "Awaiting confirmation",
    cancelled: "Cancelled",
    skipped: "Skipped",
    paused: "Paused",
    current: "Current",
    rejected: "Rejected",
  };
  return labels[status] || rawStatus || "Unknown";
}

function recordRow(record: ClientWorkspaceSelectors["clientRecords"][number], today: string): ClientReportRow {
  const expiryDate = businessDateKey(record.expiryDate);
  const remaining = expiryDate ? compareClientDateKeys(expiryDate, today) === 0 ? 0 : Math.round((Date.parse(`${expiryDate}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000) : null;
  const baseStatus = normalizeClientStatus(record.status);
  const normalizedStatus = ["completed", "paused", "awaiting_confirmation"].includes(baseStatus)
    ? baseStatus
    : remaining !== null && remaining < 0 ? "overdue" : remaining === 0 ? "due_today" : remaining !== null && remaining <= 30 ? "upcoming" : "current";
  const status = normalizedStatus === "overdue" ? "Expired" : displayStatus(normalizedStatus, record.status);
  const nextAction = record.nextAction || (normalizedStatus === "overdue" ? "Provide replacement expiry" : normalizedStatus === "upcoming" ? "Review upcoming expiry" : "No action due");
  return {
    id: record.id,
    organisationId: record.organisationId,
    type: "Record",
    status,
    normalizedStatus,
    dueDate: expiryDate,
    category: `${record.category} · ${record.category2}`,
    person: record.contact || "Unassigned",
    priority: record.risk,
    cells: {
      Record: record.name,
      Category: `${record.category} · ${record.category2}`,
      "Issue Date": businessDateKey(record.issueDate) || "—",
      "Expiry Date": expiryDate || "—",
      "Days Remaining": remaining === null ? "Not set" : remaining < 0 ? `Expired ${Math.abs(remaining)} days ago` : remaining === 0 ? "Due today" : `${remaining} days remaining`,
      Risk: record.risk,
      "Responsible Person": record.contact || "Unassigned",
      Status: status,
      "Next Action": nextAction,
      _daysRemaining: remaining ?? "",
    },
  };
}

function workRow(item: ClientWorkspaceSelectors["clientWorkItems"][number]): ClientReportRow {
  const type = item.kind === "recurring_task" ? "Recurring task"
    : item.kind === "checklist_item" ? "Checklist task"
    : item.kind === "assigned_task" ? "Assigned task"
    : item.kind === "expired_record" ? "Expired record" : "Record action";
  const status = item.kind === "expired_record" ? "Expired" : displayStatus(item.status, item.rawStatus);
  return {
    id: item.id,
    organisationId: item.organisationId,
    type,
    status,
    normalizedStatus: item.status,
    dueDate: item.dueDate,
    category: type,
    person: item.responsiblePerson || "Unassigned",
    priority: item.priority,
    cells: {
      Task: item.name,
      "Tracker / Related Record": item.related,
      "Responsible Person": item.responsiblePerson || "Unassigned",
      "Due Date": item.dueDate || "—",
      "Due Time": item.dueTime || "—",
      Priority: item.priority || "—",
      Status: status,
      "Next Action": item.nextAction || "Review assigned work",
      "Completion Date": item.completionDate || "—",
      Evidence: item.evidence || "—",
      "Response / Evidence": item.evidence || "—",
    },
  };
}

function notificationRow(item: ClientWorkspaceSelectors["clientNotifications"][number]): ClientReportRow {
  const status = item.deliveryStatus || "Unknown";
  return {
    id: item.id,
    organisationId: item.organisationId,
    type: item.kind,
    status,
    normalizedStatus: normalizeClientStatus(status),
    dueDate: businessDateKey(item.date),
    category: item.kind,
    person: "",
    priority: "",
    cells: {
      Date: item.date,
      Subject: item.subject,
      "Related Record / Task": item.related,
      "Relevant Due / Expiry Date": item.relevantDate ? businessDateKey(item.relevantDate) : "—",
      "Days Remaining": item.daysRemaining === undefined ? "—" : item.daysRemaining < 0 ? `Expired ${Math.abs(item.daysRemaining)} days ago` : `${item.daysRemaining} days remaining`,
      "Delivery / Status": status,
    },
  };
}

function rowsForReport(reportId: string, selectors: ClientWorkspaceSelectors, range: ClientReportDateRange): ClientReportRow[] {
  const today = clientBusinessToday();
  const tasks = selectors.clientWorkItems.filter((item) =>
    item.kind === "recurring_task" || item.kind === "checklist_item" || item.kind === "assigned_task"
  );
  const openTasks = tasks.filter((item) => !["completed", "cancelled", "skipped", "rejected"].includes(item.status));
  const records = selectors.clientRecords;
  if (reportId === "all-monitored-records") {
    return records.map((record) => recordRow(record, today));
  }
  if (reportId.startsWith("expiring-")) {
    return records.filter((record) => {
      const expiry = businessDateKey(record.expiryDate);
      return expiry && compareClientDateKeys(expiry, today) > 0 && within(expiry, range);
    }).map((record) => recordRow(record, today));
  }
  if (reportId === "expired-records") {
    return records.filter((record) => recordRow(record, today).normalizedStatus === "overdue").map((record) => recordRow(record, today));
  }
  if (reportId === "renewed-records") {
    return selectors.clientRenewals.filter((renewal) => within(businessDateKey(renewal.renewalDate), range)).map((renewal) => ({
      id: renewal.id,
      organisationId: renewal.organisationId,
      type: "Renewed record",
      status: "Renewed",
      normalizedStatus: "completed",
      dueDate: businessDateKey(renewal.renewalDate),
      category: "Renewed record",
      person: renewal.responsiblePerson || "Unassigned",
      priority: "",
      cells: {
        Record: renewal.recordName,
        Category: "Renewed record",
        "Issue Date": "—",
        "Expiry Date": renewal.replacementExpiryDate || "—",
        "Previous Expiry Date": renewal.previousExpiryDate || "—",
        "Renewal Date": businessDateKey(renewal.renewalDate),
        "Days Remaining": "—",
        Risk: "—",
        "Responsible Person": renewal.responsiblePerson || "Unassigned",
        Status: "Renewed",
        "Next Action": "Continue monitoring the confirmed record",
      },
    }));
  }
  if (reportId === "notification-history") {
    return selectors.clientNotifications.filter((item) => within(businessDateKey(item.date), range)).map(notificationRow);
  }

  const allTasks = tasks.map(workRow);
  const openTaskRows = openTasks.map(workRow);
  const recordActions = selectors.clientWorkItems.filter((item) => item.kind === "record_action").map(workRow);
  const expiredRecords = selectors.clientWorkItems.filter((item) => item.kind === "expired_record").map(workRow);
  const allWorkRows = [...allTasks, ...recordActions];
  if (reportId === "all-client-work") return allTasks;
  if (reportId === "monthly-task-schedule") {
    return openTaskRows.filter((row) => within(row.dueDate || "", range));
  }
  if (reportId === "blocked-work") {
    return allTasks.filter((row) => row.normalizedStatus === "blocked");
  }
  if (reportId === "work-by-responsible-person") {
    return allWorkRows.filter((row) => within(row.dueDate || "", range));
  }
  if (reportId === "awaiting-confirmation") {
    const awaitingWork = allWorkRows.filter((row) => row.normalizedStatus === "awaiting_confirmation");
    const awaitingRecords = records
      .filter((record) => normalizeClientStatus(record.status) === "awaiting_confirmation")
      .map((record) => recordRow(record, today));
    return [...awaitingRecords, ...awaitingWork];
  }
  if (reportId === "monthly-monitoring-summary") {
    const scheduledWork = allWorkRows.filter((row) => within(row.dueDate || "", range));
    const expiringRecords = records.filter((record) => {
      const expiry = businessDateKey(record.expiryDate);
      return expiry && within(expiry, range);
    }).map((record) => recordRow(record, today));
    return [...expiringRecords, ...scheduledWork];
  }
  if (reportId === "today-task-schedule") return openTaskRows.filter((row) => row.dueDate === today);
  if (reportId === "overdue-work") return [...openTaskRows.filter((row) => row.normalizedStatus === "overdue"), ...expiredRecords];
  if (reportId === "weekly-task-schedule") {
    const week = clientWeekRange(today);
    return [...openTaskRows, ...recordActions].filter((row) => within(row.dueDate || "", week));
  }
  if (reportId === "work-due-week") {
    const week = clientWeekRange(today);
    const dueThisWeek = [...openTaskRows, ...recordActions].filter((row) => within(row.dueDate || "", week));
    return [...openTaskRows.filter((row) => row.normalizedStatus === "overdue"), ...expiredRecords, ...dueThisWeek];
  }
  if (reportId === "completed-tasks") {
    return allTasks.filter((row) => row.normalizedStatus === "completed" && within(String(row.cells["Completion Date"] === "—" ? row.dueDate : row.cells["Completion Date"]), range));
  }
  return [];
}

export function buildClientReportRows(reportId: string, data: ClientWorkspaceData, range: ClientReportDateRange): ClientReportRow[] {
  if (!clientReportSections.some((item) => item.id === reportId)) return [];
  return rowsForReport(reportId, selectClientWorkspaceData(data), range);
}

export function filterClientReportRows(
  rows: ClientReportRow[],
  filters: { status: string; category: string; person: string; priority: string; type: string },
): ClientReportRow[] {
  const selectedStatus = filters.status === "all" ? "all" : normalizeClientStatus(filters.status);
  return rows.filter((row) =>
    (selectedStatus === "all" || row.normalizedStatus === selectedStatus) &&
    (filters.category === "all" || row.category === filters.category) &&
    (filters.person === "all" || row.person === filters.person) &&
    (filters.priority === "all" || row.priority === filters.priority) &&
    (filters.type === "all" || row.type === filters.type)
  );
}

export function reportColumns(rows: ClientReportRow[], reportId: string): string[] {
  if (reportId.startsWith("expiring-") || reportId === "expired-records" || reportId === "all-monitored-records") {
    return ["Record", "Category", "Issue Date", "Expiry Date", "Days Remaining", "Risk", "Responsible Person", "Status", "Next Action"];
  }
  if (reportId === "renewed-records") {
    return ["Record", "Category", "Previous Expiry Date", "Expiry Date", "Renewal Date", "Responsible Person", "Status", "Next Action"];
  }
  if (reportId === "completed-tasks") {
    return ["Task", "Tracker / Related Record", "Responsible Person", "Due Date", "Completion Date", "Priority", "Status", "Next Action"];
  }
  if (reportId === "all-client-work") {
    return ["Task", "Tracker / Related Record", "Responsible Person", "Due Date", "Due Time", "Priority", "Status", "Next Action", "Response / Evidence"];
  }
  if (reportId === "notification-history") {
    return ["Date", "Subject", "Related Record / Task", "Relevant Due / Expiry Date", "Days Remaining", "Delivery / Status"];
  }
  if (rows.some((row) => row.type === "Record action") && rows.some((row) => row.type !== "Record action")) {
    return ["Task", "Tracker / Related Record", "Responsible Person", "Due Date", "Due Time", "Priority", "Status", "Next Action"];
  }
  return ["Task", "Tracker / Related Record", "Responsible Person", "Due Date", "Due Time", "Priority", "Status", "Next Action"];
}

export function reportSummary(rows: ClientReportRow[]) {
  return {
    total: rows.length,
    overdue: rows.filter((row) => ["Overdue", "Expired"].includes(row.status)).length,
    dueSoon: rows.filter((row) => {
      const days = row.cells._daysRemaining;
      return typeof days === "number" && days >= 0 && days <= 30;
    }).length,
    completed: rows.filter((row) => row.status.toLowerCase().includes("completed")).length,
    awaiting: rows.filter((row) => row.status.toLowerCase().includes("awaiting")).length,
  };
}

function cleanFilePart(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function fileName(reportTitle: string, extension: ClientReportFormat) {
  return `deadline-monitor-${cleanFilePart(reportTitle)}-${clientBusinessToday()}.${extension}`;
}

function statusColor(row: ClientReportRow): { fill: string; text: string } {
  const status = row.status.toLowerCase();
  const dueDate = row.dueDate || "";
  const days = dueDate ? Math.round((Date.parse(`${dueDate}T00:00:00.000Z`) - Date.parse(`${clientBusinessToday()}T00:00:00.000Z`)) / 86400000) : Number.POSITIVE_INFINITY;
  if (status.includes("awaiting")) return { fill: "EDE9FE", text: "5B21B6" };
  if (status.includes("expired") || status.includes("overdue") || status.includes("failed")) return { fill: "FEE2E2", text: "991B1B" };
  if (status.includes("completed")) return { fill: "D1FAE5", text: "065F46" };
  if (days < 0) return { fill: "FEE2E2", text: "991B1B" };
  if (status.includes("due today") || days === 0) return { fill: "DBEAFE", text: "1D4ED8" };
  if (typeof days === "number" && days >= 0 && days <= 7) return { fill: "FFEDD5", text: "9A3412" };
  if (typeof days === "number" && days >= 0 && days <= 30) return { fill: "FEF3C7", text: "92400E" };
  if (typeof days === "number" && days >= 0 && days <= 90) return { fill: "FEF9C3", text: "854D0E" };
  if (status.includes("sent") || status.includes("delivered")) return { fill: "D1FAE5", text: "065F46" };
  if (status.includes("current") || status.includes("confirmed")) return { fill: "D1FAE5", text: "065F46" };
  return { fill: "F1F5F9", text: "334155" };
}

function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function csvEscape(value: string | number) {
  let text = String(value ?? "");
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

function exportCsv(
  organisation: string,
  reportTitle: string,
  periodLabel: string,
  columns: string[],
  rows: ClientReportRow[],
  name: string,
) {
  const generated = new Date().toLocaleString();
  const exportColumns = ["Organisation", "Report", "Report Period", "Generated", ...columns, "Operational Disclaimer"];
  const exportRows = rows.map((row) => [
    organisation,
    reportTitle,
    periodLabel,
    generated,
    ...columns.map((column) => row.cells[column] ?? ""),
    reportDisclaimer,
  ]);
  const csv = [
    exportColumns.map(csvEscape).join(","),
    ...exportRows.map((row) => row.map(csvEscape).join(",")),
  ].join("\r\n");
  downloadBlob(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }), name);
}

function exportExcel(
  organisation: string,
  reportTitle: string,
  periodLabel: string,
  columns: string[],
  rows: ClientReportRow[],
  summary: ReturnType<typeof reportSummary>,
  name: string,
) {
  const generated = new Date().toLocaleString();
  const table = XLSX.utils.aoa_to_sheet([
    ["Deadline-Monitor"],
    ["Organisation", organisation],
    ["Report", reportTitle],
    ["Report period", periodLabel],
    ["Generated", generated],
    [],
    columns,
    ...rows.map((row) => columns.map((column) => row.cells[column] ?? "")),
  ]);
  table["A1"].s = { font: { bold: true, sz: 18, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "020617" } } };
  for (let rowIndex = 0; rowIndex < 5; rowIndex += 1) {
    const cell = table[XLSX.utils.encode_cell({ r: rowIndex, c: 0 })];
    if (cell) cell.s = { font: { bold: true, color: { rgb: "0F172A" } } };
  }
  const headerRow = 6;
  columns.forEach((_, columnIndex) => {
    const cell = table[XLSX.utils.encode_cell({ r: headerRow, c: columnIndex })];
    if (cell) cell.s = { font: { bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "0F766E" } }, alignment: { wrapText: true, vertical: "center" } };
  });
  rows.forEach((row, rowIndex) => {
    const color = statusColor(row);
    const statusColumn = columns.indexOf(columns.includes("Status") ? "Status" : "Delivery / Status");
    const statusCell = statusColumn >= 0 ? table[XLSX.utils.encode_cell({ r: headerRow + 1 + rowIndex, c: statusColumn })] : undefined;
    if (statusCell) statusCell.s = { font: { bold: true, color: { rgb: color.text } }, fill: { fgColor: { rgb: color.fill } } };
  });
  table["!cols"] = columns.map((column) => ({ wch: Math.min(34, Math.max(14, column.length + 4)) }));
  table["!freeze"] = { xSplit: 0, ySplit: headerRow + 1 };
  table["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: headerRow, c: 0 }, e: { r: headerRow + rows.length, c: columns.length - 1 } }) };
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, table, "Report");
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([
    ["Deadline-Monitor", "Operational Summary"],
    ["Organisation", organisation],
    ["Report", reportTitle],
    ["Report period", periodLabel],
    ["Generated", generated],
    ["Total items", summary.total],
    ["Overdue / expired", summary.overdue],
    ["Due within 30 days", summary.dueSoon],
    ["Completed", summary.completed],
    ["Awaiting confirmation", summary.awaiting],
    ["Disclaimer", reportDisclaimer],
  ]), "Summary");
  XLSX.writeFile(book, name);
}

function statusParagraphColor(status: string) {
  const row: ClientReportRow = { id: "", organisationId: "", type: "", status, normalizedStatus: normalizeClientStatus(status), category: "", person: "", priority: "", cells: {} };
  return statusColor(row);
}

async function exportWord(
  organisation: string,
  reportTitle: string,
  periodLabel: string,
  columns: string[],
  rows: ClientReportRow[],
  summary: ReturnType<typeof reportSummary>,
  name: string,
) {
  const generated = new Date().toLocaleString();
  const tableRows = [
    new TableRow({ children: columns.map((column) => new TableCell({ shading: { type: ShadingType.SOLID, color: "0F766E" }, children: [new Paragraph({ children: [new TextRun({ text: column, bold: true, color: "FFFFFF" })] })] })) }),
    ...rows.map((row) => new TableRow({ children: columns.map((column) => {
      const color = column === "Status" || column === "Delivery / Status" ? statusParagraphColor(row.status) : undefined;
      return new TableCell({
        shading: color ? { type: ShadingType.SOLID, color: color.fill } : undefined,
        children: [new Paragraph({ children: [new TextRun({ text: String(row.cells[column] ?? ""), color: color?.text })] })],
      });
    }) })),
  ];
  const document = new Document({
    sections: [{
      properties: { page: { size: { orientation: columns.length > 6 ? "landscape" : "portrait" } } },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: "right", children: [new TextRun("Page "), new TextRun({ children: [PageNumber.CURRENT] })] })] }) },
      children: [
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: "Deadline-Monitor", color: "020617", bold: true })] }),
        new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(reportTitle)] }),
        new Paragraph({ children: [new TextRun({ text: "Organisation: ", bold: true }), new TextRun(organisation)] }),
        new Paragraph({ children: [new TextRun({ text: "Reporting period: ", bold: true }), new TextRun(periodLabel)] }),
        new Paragraph({ children: [new TextRun({ text: "Generated: ", bold: true }), new TextRun(generated)] }),
        new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun("Summary metrics")] }),
        new Paragraph({ children: [new TextRun(`Items: ${summary.total}  |  Overdue / expired: ${summary.overdue}  |  Due within 30 days: ${summary.dueSoon}  |  Completed: ${summary.completed}  |  Awaiting confirmation: ${summary.awaiting}`)] }),
        new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun("Detailed report")] }),
        new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: tableRows }),
        new Paragraph({ spacing: { before: 240 }, children: [new TextRun({ text: reportDisclaimer, italics: true, color: "475569" })] }),
      ],
    }],
  });
  downloadBlob(await Packer.toBlob(document), name);
}

function exportPdf(
  organisation: string,
  reportTitle: string,
  periodLabel: string,
  columns: string[],
  rows: ClientReportRow[],
  summary: ReturnType<typeof reportSummary>,
  name: string,
) {
  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 12;
  const tableWidth = pageWidth - margin * 2;
  const columnWidth = tableWidth / columns.length;
  const generated = new Date().toLocaleString();
  pdf.setFillColor(2, 6, 23);
  pdf.rect(0, 0, pageWidth, 30, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(18);
  pdf.text("Deadline-Monitor", margin, 13);
  pdf.setFontSize(11);
  pdf.text(reportTitle, margin, 22);
  pdf.setTextColor(15, 23, 42);
  pdf.setFontSize(9);
  pdf.text(`Organisation: ${organisation}`, margin, 37);
  pdf.text(`Period: ${periodLabel}`, margin, 43);
  pdf.text(`Generated: ${generated}`, margin, 49);
  pdf.text(`Items ${summary.total}  |  Overdue / expired ${summary.overdue}  |  Due within 30 days ${summary.dueSoon}  |  Completed ${summary.completed}  |  Awaiting ${summary.awaiting}`, margin, 56);
  let y = 64;

  function drawHeader() {
    pdf.setFillColor(15, 118, 110);
    pdf.rect(margin, y, tableWidth, 8, "F");
    pdf.setTextColor(255, 255, 255);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(Math.min(8, 70 / columns.length));
    columns.forEach((column, index) => pdf.text(pdf.splitTextToSize(column, columnWidth - 2)[0] || "", margin + index * columnWidth + 1, y + 5.3));
    y += 8;
  }

  drawHeader();
  rows.forEach((row) => {
    const color = statusColor(row);
    const values = columns.map((column) => String(row.cells[column] ?? ""));
    const wrapped = values.map((value) => pdf.splitTextToSize(value, columnWidth - 2));
    const lineCount = Math.max(1, ...wrapped.map((lines) => lines.length));
    const height = Math.max(8, lineCount * 3.6 + 3);
    if (y + height > pageHeight - 22) {
      pdf.addPage();
      y = 14;
      drawHeader();
    }
    columns.forEach((column, index) => {
      const isStatus = column === "Status" || column === "Delivery / Status";
      if (isStatus) {
        pdf.setFillColor(parseInt(color.fill.slice(0, 2), 16), parseInt(color.fill.slice(2, 4), 16), parseInt(color.fill.slice(4, 6), 16));
        pdf.rect(margin + index * columnWidth, y, columnWidth, height, "F");
      }
      pdf.setTextColor(isStatus ? parseInt(color.text.slice(0, 2), 16) : 51, isStatus ? parseInt(color.text.slice(2, 4), 16) : 65, isStatus ? parseInt(color.text.slice(4, 6), 16) : 85);
      pdf.setFont("helvetica", isStatus ? "bold" : "normal");
      pdf.setFontSize(Math.min(7.5, 65 / columns.length));
      pdf.text(wrapped[index].slice(0, Math.floor((height - 2) / 3.6)), margin + index * columnWidth + 1, y + 4);
    });
    pdf.setDrawColor(226, 232, 240);
    pdf.rect(margin, y, tableWidth, height);
    y += height;
    pdf.setTextColor(51, 65, 85);
  });
  const disclaimerLines = pdf.splitTextToSize(reportDisclaimer, tableWidth);
  if (y + disclaimerLines.length * 4 + 8 > pageHeight - 12) {
    pdf.addPage();
    y = 14;
  }
  pdf.setFont("helvetica", "italic");
  pdf.setFontSize(8);
  pdf.text(disclaimerLines, margin, y + 5);
  for (let page = 1; page <= pdf.getNumberOfPages(); page += 1) {
    pdf.setPage(page);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(100, 116, 139);
    pdf.text(`Page ${page} of ${pdf.getNumberOfPages()}`, pageWidth - margin, pageHeight - 6, { align: "right" });
  }
  downloadBlob(pdf.output("blob"), name);
}

export async function exportClientReport(input: {
  format: ClientReportFormat;
  organisation: string;
  reportTitle: string;
  periodLabel: string;
  columns: string[];
  rows: ClientReportRow[];
}) {
  if (input.rows.length === 0) return;
  const name = fileName(input.reportTitle, input.format);
  const summary = reportSummary(input.rows);
  if (input.format === "csv") return exportCsv(input.organisation, input.reportTitle, input.periodLabel, input.columns, input.rows, name);
  if (input.format === "xlsx") return exportExcel(input.organisation, input.reportTitle, input.periodLabel, input.columns, input.rows, summary, name);
  if (input.format === "docx") return exportWord(input.organisation, input.reportTitle, input.periodLabel, input.columns, input.rows, summary, name);
  return exportPdf(input.organisation, input.reportTitle, input.periodLabel, input.columns, input.rows, summary, name);
}
