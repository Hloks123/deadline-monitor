import Link from "next/link";
import type { ClientActivity } from "@/lib/clientActivities";
import {
  activityStatusLabel,
  activityTypeLabel,
  compareCalendarActivities,
  formatCalendarDate,
  getActivityAccessibleLabel,
  getActivityTone,
} from "./calendarUtils";

type Props = {
  month: string;
  today: string;
  activities: ClientActivity[];
};

function labelPriority(priority: ClientActivity["priority"]): string {
  return priority ? priority[0].toUpperCase() + priority.slice(1) : "Not set";
}

function ActivityTitle({ activity, today }: { activity: ClientActivity; today: string }) {
  const className = `font-semibold underline-offset-2 ${getActivityTone(activity, today)} ${
    activity.route ? "cursor-pointer rounded px-1 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600" : "cursor-default"
  }`;
  if (activity.route) {
    return <Link href={activity.route} aria-label={getActivityAccessibleLabel(activity)} className={className}>{activity.title}</Link>;
  }
  return <span className={className}>{activity.title}</span>;
}

export default function CalendarAgendaView({ month, today, activities }: Props) {
  const grouped = new Map<string, ClientActivity[]>();
  for (const activity of activities) {
    const group = grouped.get(activity.date) || [];
    group.push(activity);
    grouped.set(activity.date, group);
  }
  const dates = [...grouped.keys()].sort();

  if (dates.length === 0) {
    return <p className="cursor-default rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-600">No activities match these filters for {month}.</p>;
  }

  return (
    <div className="space-y-4">
      {dates.map((date) => (
        <section key={date} aria-label={formatCalendarDate(date)} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <h3 className={`border-b border-slate-200 px-4 py-3 text-sm font-bold ${date === today ? "bg-teal-50 text-teal-900" : "bg-slate-50 text-slate-900"}`}>
            {formatCalendarDate(date)}
            {date === today && <span className="ml-2 rounded bg-teal-700 px-1.5 py-0.5 text-[10px] font-semibold text-white">Today</span>}
          </h3>
          <div className="divide-y divide-slate-100">
            {[...grouped.get(date)!].sort(compareCalendarActivities).map((activity) => (
                <article key={activity.id} className="grid gap-2 p-3 text-sm md:grid-cols-[6rem_4rem_minmax(9rem,1.5fr)_minmax(6rem,0.8fr)_minmax(7rem,1fr)_minmax(7rem,1fr)_5rem_7rem] md:items-center md:gap-3">
                  <time dateTime={activity.date} className="text-xs font-semibold text-slate-600">
                    {formatCalendarDate(activity.date, { weekday: undefined, day: "numeric", month: "short", year: "numeric" })}
                </time>
                  <time dateTime={`${activity.date}${activity.time ? `T${activity.time}` : ""}`} className="text-xs font-semibold text-slate-600">
                    {activity.time || "All day"}
                  </time>
                <div className="min-w-0 break-words"><ActivityTitle activity={activity} today={today} /></div>
                <span className="text-xs text-slate-600">{activityTypeLabel(activity.activityType)}</span>
                <span className="min-w-0 break-words text-xs text-slate-600" title="Related record or tracker">{activity.relatedName || "—"}</span>
                <span className="min-w-0 break-words text-xs text-slate-600">{activity.responsiblePerson || "Unassigned"}</span>
                <span className="text-xs text-slate-600">Priority: {labelPriority(activity.priority)}</span>
                <span className="text-xs font-semibold text-slate-800">{activityStatusLabel(activity)}</span>
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
