import type { ClientActivity } from "@/lib/clientActivities";

export const CALENDAR_WEEKDAYS = [
  { long: "Monday", short: "Mon", compact: "M" },
  { long: "Tuesday", short: "Tue", compact: "T" },
  { long: "Wednesday", short: "Wed", compact: "W" },
  { long: "Thursday", short: "Thu", compact: "T" },
  { long: "Friday", short: "Fri", compact: "F" },
  { long: "Saturday", short: "Sat", compact: "S" },
  { long: "Sunday", short: "Sun", compact: "S" },
] as const;

export function getMonthGridDays(month: string): string[] {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return [];
  const [year, monthNumber] = month.split("-").map(Number);
  const firstDay = new Date(Date.UTC(year, monthNumber - 1, 1));
  const mondayOffset = (firstDay.getUTCDay() + 6) % 7;
  const start = new Date(Date.UTC(year, monthNumber - 1, 1 - mondayOffset));
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + index);
    return date.toISOString().slice(0, 10);
  });
}

export function monthKeyFromDate(date: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date.slice(0, 7) : "";
}

export function shiftMonth(month: string, offset: number): string {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || !Number.isInteger(offset)) return month;
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, monthNumber - 1 + offset, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function shiftCalendarDate(dateKey: string, offset: number): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey) || !Number.isInteger(offset)) return dateKey;
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + offset));
  return date.toISOString().slice(0, 10);
}

export function getCalendarWeekDays(dateKey: string): string[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return [];
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const mondayOffset = (date.getUTCDay() + 6) % 7;
  const monday = new Date(Date.UTC(year, month - 1, day - mondayOffset));
  return Array.from({ length: 7 }, (_, index) => {
    const weekday = new Date(monday);
    weekday.setUTCDate(monday.getUTCDate() + index);
    return weekday.toISOString().slice(0, 10);
  });
}

export function compareCalendarActivities(left: ClientActivity, right: ClientActivity): number {
  if (!left.time && right.time) return -1;
  if (left.time && !right.time) return 1;
  return (left.time || "").localeCompare(right.time || "") ||
    left.title.localeCompare(right.title);
}

export function formatCalendarMonth(month: string): string {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return "";
  const [year, monthNumber] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("en-ZA", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, monthNumber - 1, 1)));
}

export function formatCalendarDate(date: string, options?: Intl.DateTimeFormatOptions): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return "";
  const [year, monthNumber, day] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("en-ZA", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
    ...options,
  }).format(new Date(Date.UTC(year, monthNumber - 1, day)));
}

export function getActivityTone(activity: ClientActivity, today: string): string {
  if (activity.status === "expired" || activity.status === "overdue") return "border-red-200 bg-red-50 text-red-900";
  if (activity.status === "completed") return "border-emerald-200 bg-emerald-50 text-emerald-900";
  if (activity.status === "awaiting_confirmation") return "border-violet-200 bg-violet-50 text-violet-900";
  if (activity.status === "paused" || activity.status === "cancelled" || activity.status === "skipped") {
    return "border-slate-200 bg-slate-100 text-slate-700";
  }
  if (activity.activityType === "record_expiry") {
    const daysRemaining = Math.round(
      (Date.parse(`${activity.date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000,
    );
    if (daysRemaining < 0) return "border-red-200 bg-red-50 text-red-900";
    if (daysRemaining >= 0 && daysRemaining <= 7) return "border-orange-200 bg-orange-50 text-orange-900";
    if (daysRemaining >= 0 && daysRemaining <= 30) return "border-amber-200 bg-amber-50 text-amber-950";
    if (activity.status === "current") return "border-emerald-200 bg-emerald-50 text-emerald-900";
    return "border-slate-200 bg-slate-50 text-slate-700";
  }
  if (activity.status === "current") return "border-emerald-200 bg-emerald-50 text-emerald-900";
  if (["record_follow_up", "follow_up"].includes(activity.activityType)) {
    return "border-teal-200 bg-teal-50 text-teal-900";
  }
  if (["recurring_task", "assigned_task", "checklist_item"].includes(activity.activityType)) {
    return "border-blue-200 bg-blue-50 text-blue-900";
  }
  return "border-slate-200 bg-slate-50 text-slate-700";
}

export function activityStatusLabel(activity: ClientActivity): string {
  const labels: Partial<Record<ClientActivity["status"], string>> = {
    expired: "Expired",
    overdue: "Overdue",
    not_started: "Not started",
    upcoming: "Scheduled",
    in_progress: "In progress",
    accepted: "Accepted",
    completed: "Completed",
    awaiting_confirmation: "Awaiting confirmation",
    paused: "Paused",
    cancelled: "Cancelled",
    blocked: "Blocked",
    due_today: "Due today",
    skipped: "Skipped",
    current: "Current",
    unknown: "Scheduled",
  };
  return labels[activity.status] || "Scheduled";
}

export function activityTypeLabel(type: ClientActivity["activityType"]): string {
  if (type === "record_expiry") return "Record expiry";
  if (type === "record_follow_up" || type === "follow_up") return "Follow-up";
  if (type === "recurring_task" || type === "assigned_task") return "Task";
  if (type === "checklist_item") return "Checklist";
  return "Notification";
}

export function getActivityAccessibleLabel(activity: ClientActivity): string {
  return [
    activity.title,
    activity.organisationName,
    activity.time,
    activityTypeLabel(activity.activityType),
    activityStatusLabel(activity),
    activity.responsiblePerson,
  ].filter(Boolean).join(", ");
}
