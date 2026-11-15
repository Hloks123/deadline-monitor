import {
  Document,
  Footer,
  HeadingLevel,
  PageNumber,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import jsPDF from "jspdf";
import * as XLSX from "xlsx-js-style";
import type { ClientActivity } from "@/lib/clientActivities";
import {
  activityStatusLabel,
  activityTypeLabel,
  formatCalendarDate,
  getCalendarWeekDays,
} from "@/components/client/calendar/calendarUtils";

export type ClientCalendarReportFormat = "csv" | "xlsx" | "pdf" | "docx";
export type ClientCalendarReportType = "monthly_calendar" | "weekly_calendar" | "activity_list";

export type ClientCalendarSummary = {
  total: number;
  tasksScheduled: number;
  completedTasks: number;
  overdueWork: number;
  recordsExpiring: number;
  expiredRecords: number;
  awaitingConfirmation: number;
};

export const clientCalendarReportDisclaimer =
  "Deadline-Monitor information is an operational monitoring aid and not a legal, tax or regulatory compliance certification. Verify deadlines against the relevant authority and source record. No confidential source documents are included.";

export function summarizeClientCalendarActivities(
  activities: ClientActivity[],
  today: string,
): ClientCalendarSummary {
  return {
    total: activities.length,
    tasksScheduled: activities.filter((activity) =>
      ["recurring_task", "assigned_task"].includes(activity.activityType) && activity.status !== "completed" &&
      activity.status !== "cancelled" && activity.status !== "skipped"
    ).length,
    completedTasks: activities.filter((activity) =>
      ["recurring_task", "assigned_task"].includes(activity.activityType) && activity.status === "completed"
    ).length,
    overdueWork: activities.filter((activity) => activity.status === "overdue").length,
    recordsExpiring: activities.filter((activity) =>
      activity.activityType === "record_expiry" &&
      activity.date >= today &&
      activity.status !== "completed" &&
      activity.status !== "expired"
    ).length,
    expiredRecords: activities.filter((activity) =>
      activity.activityType === "record_expiry" && activity.status === "expired"
    ).length,
    awaitingConfirmation: activities.filter((activity) => activity.status === "awaiting_confirmation").length,
  };
}

function activityValues(activity: ClientActivity): string[] {
  return [
    activity.date,
    activity.time || "All day",
    activity.title,
    activityTypeLabel(activity.activityType),
    activity.relatedName || "",
    activity.responsiblePerson || "",
    activity.priority ? activity.priority[0].toUpperCase() + activity.priority.slice(1) : "",
    activityStatusLabel(activity),
    activity.nextAction || "",
  ];
}

const activityColumns = [
  "Date",
  "Time",
  "Activity",
  "Activity Type",
  "Related Record / Tracker",
  "Responsible Person",
  "Priority",
  "Status",
  "Next Action",
];

function activityRows(activities: ClientActivity[]): string[][] {
  return activities.map(activityValues);
}

function safeFilePart(value: string): string {
  return value.trim().replace(/[^a-z0-9-]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() || "report";
}

function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function generatedAt() {
  return new Intl.DateTimeFormat("en-ZA", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Johannesburg",
  }).format(new Date());
}

function csvEscape(value: string): string {
  const safeValue = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return `"${safeValue.replaceAll('"', '""')}"`;
}

function downloadCsv(activities: ClientActivity[], name: string) {
  const csv = [activityColumns, ...activityRows(activities)]
    .map((row) => row.map(csvEscape).join(","))
    .join("\r\n");
  downloadBlob(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }), name);
}

function statusStyle(status: string) {
  if (status === "Completed") return { fill: "DCFCE7", text: "166534" };
  if (status === "Overdue" || status === "Expired") return { fill: "FEE2E2", text: "991B1B" };
  if (status === "Awaiting confirmation") return { fill: "EDE9FE", text: "5B21B6" };
  if (status === "Paused" || status === "Cancelled" || status === "Skipped") return { fill: "E2E8F0", text: "334155" };
  return { fill: "DBEAFE", text: "1E40AF" };
}

function calendarSheet(month: string, activities: ClientActivity[], organisation: string) {
  const monthGridDays = (() => {
    const [year, monthNumber] = month.split("-").map(Number);
    const first = new Date(Date.UTC(year, monthNumber - 1, 1));
    const offset = (first.getUTCDay() + 6) % 7;
    const start = new Date(Date.UTC(year, monthNumber - 1, 1 - offset));
    return Array.from({ length: 42 }, (_, index) => {
      const current = new Date(start);
      current.setUTCDate(start.getUTCDate() + index);
      return current.toISOString().slice(0, 10);
    });
  })();
  const rows: Array<Array<string | { v: string; s: object }>> = [
    ["Deadline-Monitor"],
    ["Organisation", organisation],
    ["Monthly Monitoring Calendar", month],
    ["Generated", generatedAt()],
    [],
  ];
  rows.push(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]);
  for (let week = 0; week < 6; week += 1) {
    rows.push(monthGridDays.slice(week * 7, week * 7 + 7).map((date) => {
      const dayNumber = String(Number(date.slice(-2)));
      const dayActivities = activities.filter((activity) => activity.date === date);
      const content = [dayNumber, ...dayActivities.map((activity) =>
        `${activity.status === "completed" ? "✓" : activity.status === "overdue" || activity.status === "expired" ? "!" : "•"} ${activity.title} [${activityStatusLabel(activity)}]`
      )].join("\n");
      const tone = dayActivities[0] ? statusStyle(activityStatusLabel(dayActivities[0])) : undefined;
      return {
        v: content,
        s: {
          alignment: { vertical: "top", wrapText: true },
          fill: { fgColor: { rgb: tone?.fill || (date.startsWith(`${month}-`) ? "FFFFFF" : "F1F5F9") } },
          font: { color: { rgb: "0F172A" } },
        },
      };
    }));
  }
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet["!cols"] = Array.from({ length: 7 }, () => ({ wch: 28 }));
  sheet["!rows"] = [{ hpt: 26 }, { hpt: 22 }, { hpt: 22 }, { hpt: 22 }, { hpt: 8 }, { hpt: 24 }, ...Array.from({ length: 6 }, () => ({ hpt: 82 }))];
  return sheet;
}

function weekSheet(activities: ClientActivity[]) {
  const firstActivityDate = activities[0]?.date;
  const days = firstActivityDate ? getCalendarWeekDays(firstActivityDate) : [];
  const rows: Array<Array<string | { v: string; s: object }>> = [
    ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
    days.map((date) => {
      const dayActivities = activities.filter((activity) => activity.date === date);
      return {
        v: [formatCalendarDate(date, { day: "numeric", month: "short" }), ...dayActivities.map((activity) =>
          `${activity.time ? `${activity.time} ` : ""}${activity.title} [${activityStatusLabel(activity)}]`
        )].join("\n"),
        s: { alignment: { vertical: "top", wrapText: true }, fill: { fgColor: { rgb: "FFFFFF" } } },
      };
    }),
  ];
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet["!cols"] = Array.from({ length: 7 }, () => ({ wch: 28 }));
  sheet["!rows"] = [{ hpt: 24 }, ...Array.from({ length: 1 }, () => ({ hpt: 160 }))];
  return sheet;
}

function exportExcel(
  type: ClientCalendarReportType,
  month: string,
  activities: ClientActivity[],
  organisation: string,
  name: string,
) {
  const book = XLSX.utils.book_new();
  if (type !== "activity_list") {
    const sheet = type === "weekly_calendar" ? weekSheet(activities) : calendarSheet(month, activities, organisation);
    XLSX.utils.book_append_sheet(book, sheet, type === "weekly_calendar" ? "Week View" : "Calendar");
  }
  const activitySheet = XLSX.utils.aoa_to_sheet([activityColumns, ...activityRows(activities)]);
  activitySheet["!cols"] = activityColumns.map((column) => ({ wch: Math.min(34, Math.max(14, column.length + 4)) }));
  activitySheet["!freeze"] = { xSplit: 0, ySplit: 1 };
  activitySheet["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: activities.length, c: activityColumns.length - 1 } }) };
  activities.forEach((activity, index) => {
    const cell = activitySheet[XLSX.utils.encode_cell({ r: index + 1, c: 7 })];
    if (cell) {
      const color = statusStyle(activityStatusLabel(activity));
      cell.s = { font: { bold: true, color: { rgb: color.text } }, fill: { fgColor: { rgb: color.fill } } };
    }
  });
  XLSX.utils.book_append_sheet(book, activitySheet, "Activity List");
  XLSX.writeFile(book, name);
}

function exportPdf(
  type: ClientCalendarReportType,
  month: string,
  periodLabel: string,
  organisation: string,
  activities: ClientActivity[],
  name: string,
) {
  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 10;
  const generated = generatedAt();
  const title = type === "monthly_calendar" ? "Monthly Monitoring Calendar"
    : type === "weekly_calendar" ? "Weekly Monitoring Calendar" : "Monthly Activity List";
  pdf.setFillColor(2, 6, 23);
  pdf.rect(0, 0, pageWidth, 27, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(18);
  pdf.text("Deadline-Monitor", margin, 12);
  pdf.setFontSize(11);
  pdf.text(`${title} · ${periodLabel}`, margin, 21);
  pdf.setTextColor(15, 23, 42);
  pdf.setFontSize(8);
  pdf.text(`Organisation: ${organisation}`, margin, 33);
  pdf.text(`Generated: ${generated}`, margin, 39);
  let contentEndY = 45;

  if (type === "monthly_calendar") {
    const [year, monthNumber] = month.split("-").map(Number);
    const first = new Date(Date.UTC(year, monthNumber - 1, 1));
    const offset = (first.getUTCDay() + 6) % 7;
    const start = new Date(Date.UTC(year, monthNumber - 1, 1 - offset));
    const days = Array.from({ length: 42 }, (_, index) => {
      const current = new Date(start);
      current.setUTCDate(start.getUTCDate() + index);
      return current.toISOString().slice(0, 10);
    });
    const top = 45;
    const weekdayHeight = 7;
    const gridHeight = 116;
    const cellWidth = (pageWidth - margin * 2) / 7;
    const cellHeight = gridHeight / 6;
    pdf.setFontSize(7);
    ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].forEach((day, index) => {
      pdf.setFillColor(15, 118, 110);
      pdf.rect(margin + index * cellWidth, top, cellWidth, weekdayHeight, "F");
      pdf.setTextColor(255, 255, 255);
      pdf.setFont("helvetica", "bold");
      pdf.text(day, margin + index * cellWidth + 1.5, top + 5);
    });
    days.forEach((date, index) => {
      const col = index % 7;
      const row = Math.floor(index / 7);
      const x = margin + col * cellWidth;
      const y = top + weekdayHeight + row * cellHeight;
      const inMonth = date.startsWith(`${month}-`);
      pdf.setFillColor(inMonth ? 255 : 241, inMonth ? 255 : 245, inMonth ? 255 : 249);
      pdf.rect(x, y, cellWidth, cellHeight, "FD");
      pdf.setTextColor(inMonth ? 15 : 148, inMonth ? 23 : 163, inMonth ? 42 : 184);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(7);
      pdf.text(String(Number(date.slice(-2))), x + 1.5, y + 4);
      const dayActivities = activities.filter((activity) => activity.date === date);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(5.5);
      dayActivities.slice(0, 3).forEach((activity, activityIndex) => {
        const status = activityStatusLabel(activity);
        const mark = activity.status === "completed" ? "✓" : activity.status === "overdue" || activity.status === "expired" ? "!" : "•";
        const text = pdf.splitTextToSize(`${mark} ${activity.time ? `${activity.time} ` : ""}${activity.title} · ${status}`, cellWidth - 3)[0] || "";
        pdf.setTextColor(51, 65, 85);
        pdf.text(text, x + 1.5, y + 9 + activityIndex * 5);
      });
      if (dayActivities.length > 3) {
        pdf.setFontSize(5);
        pdf.text(`+${dayActivities.length - 3} more`, x + 1.5, y + 25);
      }
    });
    contentEndY = top + weekdayHeight + gridHeight;
  } else {
    const columns = activityColumns;
    const tableWidth = pageWidth - margin * 2;
    const columnWidth = tableWidth / columns.length;
    let y = 48;
    pdf.setFillColor(15, 118, 110);
    pdf.rect(margin, y, tableWidth, 7, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(6);
    pdf.setTextColor(255, 255, 255);
    columns.forEach((column, index) => pdf.text(column, margin + index * columnWidth + 1, y + 4.7));
    y += 7;
    activities.forEach((activity) => {
      const values = activityValues(activity);
      const wrapped = values.map((value) => pdf.splitTextToSize(value, columnWidth - 2));
      const lineCount = Math.max(1, ...wrapped.map((lines) => lines.length));
      const height = Math.max(7, lineCount * 3 + 2);
      if (y + height > pageHeight - 14) {
        pdf.addPage();
        y = 14;
      }
      values.forEach((value, index) => {
        pdf.setTextColor(51, 65, 85);
        pdf.setFontSize(5.5);
        pdf.text(pdf.splitTextToSize(value, columnWidth - 2).slice(0, Math.floor((height - 1) / 3)), margin + index * columnWidth + 1, y + 3.5);
      });
      pdf.setDrawColor(226, 232, 240);
      pdf.rect(margin, y, tableWidth, height);
      y += height;
    });
    contentEndY = y;
  }

  const needsLegendPage = contentEndY + 24 > pageHeight - 8;
  if (needsLegendPage) pdf.addPage();
  const legendY = needsLegendPage ? 18 : contentEndY + 5;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(7);
  pdf.setTextColor(15, 23, 42);
  pdf.text("Legend: ✓ Completed  • Scheduled task  ! Overdue / Expired  ◷ Awaiting confirmation  Expiring soon", margin, legendY);
  pdf.setFont("helvetica", "italic");
  pdf.setFontSize(6.5);
  pdf.setTextColor(71, 85, 105);
  pdf.text(pdf.splitTextToSize(clientCalendarReportDisclaimer, pageWidth - margin * 2), margin, legendY + 5);
  for (let page = 1; page <= pdf.getNumberOfPages(); page += 1) {
    pdf.setPage(page);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7);
    pdf.setTextColor(100, 116, 139);
    pdf.text(`Page ${page} of ${pdf.getNumberOfPages()}`, pageWidth - margin, pageHeight - 5, { align: "right" });
  }
  downloadBlob(pdf.output("blob"), name);
}

async function exportWord(
  type: ClientCalendarReportType,
  month: string,
  periodLabel: string,
  organisation: string,
  activities: ClientActivity[],
  summary: ClientCalendarSummary,
  name: string,
) {
  const grouped = new Map<string, ClientActivity[]>();
  for (const activity of activities) {
    const day = grouped.get(activity.date) || [];
    day.push(activity);
    grouped.set(activity.date, day);
  }
  const schedule = [...grouped.entries()].sort(([left], [right]) => left.localeCompare(right)).flatMap(([date, dayActivities]) => [
    new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun(formatCalendarDate(date))] }),
    ...dayActivities.map((activity) => new Paragraph({
      bullet: { level: 0 },
      children: [new TextRun(`${activity.time ? `${activity.time} · ` : "All day · "}${activity.title} · ${activityTypeLabel(activity.activityType)} · ${activityStatusLabel(activity)} · ${activity.responsiblePerson || "Unassigned"}`)],
    })),
  ]);
  const tableRows = [
    new TableRow({ children: activityColumns.map((column) => new TableCell({
      shading: { type: ShadingType.SOLID, color: "0F766E" },
      children: [new Paragraph({ children: [new TextRun({ text: column, bold: true, color: "FFFFFF" })] })],
    })) }),
    ...activities.map((activity) => new TableRow({ children: activityValues(activity).map((value, index) => {
      const status = statusStyle(activityStatusLabel(activity));
      return new TableCell({
        shading: index === 7 ? { type: ShadingType.SOLID, color: status.fill } : undefined,
        children: [new Paragraph({ children: [new TextRun({ text: value, color: index === 7 ? status.text : undefined })] })],
      });
    }) })),
  ];
  const title = type === "monthly_calendar" ? "Monthly Monitoring Calendar"
    : type === "weekly_calendar" ? "Weekly Monitoring Calendar" : "Monthly Activity List";
  const document = new Document({
    sections: [{
      properties: { page: { size: { orientation: "landscape" } } },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: "right", children: [new TextRun("Page "), new TextRun({ children: [PageNumber.CURRENT] })] })] }) },
      children: [
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: "Deadline-Monitor", bold: true })] }),
        new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(`${title} · ${periodLabel}`)] }),
        new Paragraph({ children: [new TextRun({ text: "Organisation: ", bold: true }), new TextRun(organisation)] }),
        new Paragraph({ children: [new TextRun({ text: "Generated: ", bold: true }), new TextRun(generatedAt())] }),
        new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun(type === "weekly_calendar" ? "Weekly summary" : "Monthly summary")] }),
        new Paragraph({ children: [new TextRun(`Total activities: ${summary.total}  |  Tasks scheduled: ${summary.tasksScheduled}  |  Completed tasks: ${summary.completedTasks}  |  Overdue work: ${summary.overdueWork}  |  Records expiring: ${summary.recordsExpiring}  |  Expired records: ${summary.expiredRecords}  |  Awaiting confirmation: ${summary.awaitingConfirmation}`)] }),
        ...(type === "activity_list" ? [] : [
          new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun(type === "weekly_calendar" ? "Grouped schedule" : "Monthly grouped schedule")] }),
          ...schedule,
        ]),
        new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun("Activity table")] }),
        new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: tableRows }),
        new Paragraph({ spacing: { before: 240 }, children: [new TextRun({ text: "Legend: Completed · Scheduled task · Expiring soon · Overdue / Expired · Awaiting confirmation", italics: true, color: "475569" })] }),
        new Paragraph({ spacing: { before: 120 }, children: [new TextRun({ text: clientCalendarReportDisclaimer, italics: true, color: "475569" })] }),
      ],
    }],
  });
  downloadBlob(await Packer.toBlob(document), name);
}

export async function exportClientCalendarReport(input: {
  format: ClientCalendarReportFormat;
  type: ClientCalendarReportType;
  month: string;
  periodLabel: string;
  organisation: string;
  activities: ClientActivity[];
  summary: ClientCalendarSummary;
}) {
  if (!input.activities.length) throw new Error("Cannot export an empty Calendar report.");
  if (input.format === "csv" && input.type !== "activity_list") {
    throw new Error("CSV is available for Monthly Activity List only.");
  }
  const base = `deadline-monitor-${safeFilePart(input.type)}-${input.month}`;
  if (input.format === "csv") {
    downloadCsv(input.activities, `${base}.csv`);
    return;
  }
  if (input.format === "xlsx") {
    exportExcel(input.type, input.month, input.activities, input.organisation, `${base}.xlsx`);
    return;
  }
  if (input.format === "pdf") {
    exportPdf(input.type, input.month, input.periodLabel, input.organisation, input.activities, `${base}.pdf`);
    return;
  }
  await exportWord(input.type, input.month, input.periodLabel, input.organisation, input.activities, input.summary, `${base}.docx`);
}
