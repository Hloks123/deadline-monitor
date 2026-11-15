import Link from "next/link";
import type { ClientActivity } from "@/lib/clientActivities";
import { activityStatusLabel, getActivityAccessibleLabel, getActivityTone } from "./calendarUtils";

type CalendarActivityBadgeProps = {
  activity: ClientActivity;
  today: string;
  compact?: boolean;
};

export default function CalendarActivityBadge({
  activity,
  today,
  compact = false,
}: CalendarActivityBadgeProps) {
  const icon = activity.status === "completed"
    ? "✓"
    : activity.status === "expired" || activity.status === "overdue"
      ? "!"
      : activity.status === "awaiting_confirmation"
        ? "◷"
        : activity.activityType === "record_expiry"
          ? "⌛"
          : activity.activityType === "record_follow_up" || activity.activityType === "follow_up"
            ? "↗"
            : activity.activityType === "recurring_task" || activity.activityType === "assigned_task" || activity.activityType === "checklist_item"
              ? "↻"
              : "•";
  const className = `block min-w-0 rounded border px-1.5 py-1 text-left text-[11px] leading-tight ${getActivityTone(activity, today)} ${
    activity.route ? "cursor-pointer hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-teal-600" : "cursor-default"
  }`;
  const content = (
    <>
      <span className="mr-1 font-bold" aria-hidden="true">{icon}</span>
      {activity.time && <span className="mr-1 font-semibold">{activity.time}</span>}
      <span className="font-semibold">{activity.title}</span>
      {activity.organisationName && (
        <span className="block truncate text-[9px] font-medium opacity-80">{activity.organisationName}</span>
      )}
      <span className={compact ? "sr-only" : "ml-1"}>· {activityStatusLabel(activity)}</span>
    </>
  );

  if (activity.route) {
    return (
      <Link href={activity.route} aria-label={getActivityAccessibleLabel(activity)} className={className}>
        {content}
      </Link>
    );
  }
  return <div aria-label={getActivityAccessibleLabel(activity)} className={className}>{content}</div>;
}
