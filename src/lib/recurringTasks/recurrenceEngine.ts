import { RecurringTask } from "./types";

function dateOnly(value: Date | string) {
  const date = typeof value === "string"
    ? new Date(`${value.slice(0, 10)}T00:00:00`)
    : new Date(value.getFullYear(), value.getMonth(), value.getDate());
  date.setHours(0, 0, 0, 0);
  return date;
}

export function shouldGenerateOccurrence(
  task: RecurringTask,
  date: Date
): boolean {
  if (task.status !== "active") {
    return false;
  }

  const candidate = dateOnly(date);
  const start = dateOnly(task.startDate);

  if (Number.isNaN(start.getTime()) || candidate < start) {
    return false;
  }

  const rule = task.recurrence;

  switch (rule.frequency) {
    case "once":
      return candidate.getTime() === start.getTime();

    case "daily":
      return true;

    case "weekdays":
      return candidate.getDay() >= 1 && candidate.getDay() <= 5;

    case "weekly":
      return rule.weekdays?.includes(candidate.getDay()) ?? false;

    case "monthly":
      return candidate.getDate() === Math.min(
        rule.dayOfMonth ?? start.getDate(),
        new Date(candidate.getFullYear(), candidate.getMonth() + 1, 0).getDate()
      );

    case "month_end":
      return candidate.getDate() === new Date(
        candidate.getFullYear(),
        candidate.getMonth() + 1,
        0
      ).getDate();

    case "quarterly":
      return (
        candidate.getDate() === Math.min(
          start.getDate(),
          new Date(candidate.getFullYear(), candidate.getMonth() + 1, 0).getDate()
        ) &&
        ((candidate.getFullYear() - start.getFullYear()) * 12 +
          candidate.getMonth() -
          start.getMonth()) % 3 === 0
      );

    case "annually":
      return (
        candidate.getDate() === Math.min(
          start.getDate(),
          new Date(candidate.getFullYear(), candidate.getMonth() + 1, 0).getDate()
        ) &&
        candidate.getMonth() === start.getMonth()
      );

    case "custom":
      return checkCustomInterval(task, date);

    default:
      return false;
  }
}

function checkCustomInterval(
  task: RecurringTask,
  date: Date
): boolean {
  const { interval, intervalUnit } = task.recurrence;

  if (!interval || !intervalUnit || interval < 1) {
    return false;
  }

  const candidate = dateOnly(date);
  const start = dateOnly(task.startDate);

  if (Number.isNaN(start.getTime()) || candidate < start) {
    return false;
  }

  switch (intervalUnit) {
    case "day": {
      const diffDays = Math.floor(
        (candidate.getTime() - start.getTime()) /
          (1000 * 60 * 60 * 24)
      );

      return diffDays % interval === 0;
    }

    case "week": {
      const diffWeeks = Math.floor(
        (candidate.getTime() - start.getTime()) /
          (1000 * 60 * 60 * 24 * 7)
      );

      return diffWeeks % interval === 0;
    }

    case "month": {
      const diffMonths =
        (candidate.getFullYear() - start.getFullYear()) * 12 +
        (candidate.getMonth() - start.getMonth());

      return (
        diffMonths >= 0 &&
        diffMonths % interval === 0 &&
        candidate.getDate() === Math.min(
          start.getDate(),
          new Date(candidate.getFullYear(), candidate.getMonth() + 1, 0).getDate()
        )
      );
    }

    case "year": {
      const diffYears =
        candidate.getFullYear() - start.getFullYear();

      return (
        diffYears >= 0 &&
        diffYears % interval === 0 &&
        candidate.getMonth() === start.getMonth() &&
        candidate.getDate() === Math.min(
          start.getDate(),
          new Date(candidate.getFullYear(), candidate.getMonth() + 1, 0).getDate()
        )
      );
    }

    default:
      return false;
  }
}