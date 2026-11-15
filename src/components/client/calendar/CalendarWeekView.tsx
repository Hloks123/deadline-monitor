import Link from "next/link";
import type { ClientActivity } from "@/lib/clientActivities";
import {
  activityStatusLabel,
  formatCalendarDate,
  getActivityAccessibleLabel,
  getActivityTone,
  compareCalendarActivities,
} from "./calendarUtils";

type Props = {
  days: string[];
  today: string;
  activities: ClientActivity[];
};

function ActivityCard({ activity, today }: { activity: ClientActivity; today: string }) {
  const content = (
    <>
      <span className="block break-words font-semibold">{activity.title}</span>
      <span className="mt-1 block text-xs">{activity.time || "All day"} · {activityStatusLabel(activity)}</span>
      <span className="mt-1 block text-xs">Responsible: {activity.responsiblePerson || "Unassigned"}</span>
      <span className="mt-1 block text-xs">
        Priority: {activity.priority ? activity.priority[0].toUpperCase() + activity.priority.slice(1) : "Not set"}
        {activity.relatedName ? ` · Related: ${activity.relatedName}` : ""}
      </span>
    </>
  );
  const className = `block rounded-lg border p-2 text-sm ${getActivityTone(activity, today)} ${
    activity.route ? "cursor-pointer hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-teal-600" : "cursor-default"
  }`;

  if (activity.route) {
    return <Link href={activity.route} aria-label={getActivityAccessibleLabel(activity)} className={className}>{content}</Link>;
  }
  return <div className={className}>{content}</div>;
}

export default function CalendarWeekView({ days, today, activities }: Props) {
  return (
    <div className="grid gap-3 md:grid-cols-7">
      {days.map((date) => {
        const sorted = activities
          .filter((activity) => activity.date === date)
          .slice()
          .sort(compareCalendarActivities);
        const allDay = sorted.filter((activity) => !activity.time);
        const timed = sorted.filter((activity) => Boolean(activity.time));

        return (
          <section key={date} aria-label={formatCalendarDate(date)} className={`min-w-0 rounded-xl border p-3 ${date === today ? "border-teal-400 bg-teal-50/40" : "border-slate-200 bg-white"}`}>
            <h3 className="border-b border-slate-200 pb-2 text-sm font-bold text-slate-900">
              {formatCalendarDate(date, { weekday: "short", day: "numeric", month: "short" })}
              {date === today && <span className="ml-1 rounded bg-teal-700 px-1.5 py-0.5 text-[10px] font-semibold text-white">Today</span>}
            </h3>
            {sorted.length === 0 && <p className="cursor-default py-3 text-xs text-slate-500">No activities</p>}
            {allDay.length > 0 && (
              <div className="mt-2 space-y-2">
                <h4 className="cursor-default text-[11px] font-bold uppercase tracking-wide text-slate-500">All day</h4>
                {allDay.map((activity) => <ActivityCard key={activity.id} activity={activity} today={today} />)}
              </div>
            )}
            {timed.length > 0 && (
              <div className="mt-2 space-y-2">
                {allDay.length > 0 && <h4 className="cursor-default text-[11px] font-bold uppercase tracking-wide text-slate-500">Timed</h4>}
                {timed.map((activity) => <ActivityCard key={activity.id} activity={activity} today={today} />)}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
