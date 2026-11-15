import type { ClientActivity } from "@/lib/clientActivities";
import { getActivitiesForDate } from "@/lib/clientActivities";
import CalendarActivityBadge from "./CalendarActivityBadge";
import { CALENDAR_WEEKDAYS, formatCalendarDate, monthKeyFromDate } from "./calendarUtils";

type CalendarMonthViewProps = {
  days: string[];
  month: string;
  today: string;
  selectedDate: string;
  activities: ClientActivity[];
  onSelectDate: (date: string) => void;
};

export default function CalendarMonthView({
  days,
  month,
  today,
  selectedDate,
  activities,
  onSelectDate,
}: CalendarMonthViewProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
        {CALENDAR_WEEKDAYS.map((day) => (
          <div key={day.long} className="cursor-default px-1 py-2 text-center text-[10px] font-bold uppercase tracking-wide text-slate-500 sm:px-2 sm:text-xs">
            <span className="sm:hidden" aria-hidden="true">{day.compact}</span>
            <span className="hidden sm:inline">{day.short}</span>
            <span className="sr-only sm:hidden">{day.long}</span>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((date) => {
          const dateActivities = getActivitiesForDate(activities, date);
          const inMonth = monthKeyFromDate(date) === month;
          const isToday = date === today;
          const isSelected = date === selectedDate;
          const number = Number(date.slice(-2));
          const label = `${formatCalendarDate(date)}, ${dateActivities.length} ${dateActivities.length === 1 ? "activity" : "activities"}`;

          return (
            <div
              key={date}
              className={`min-w-0 border-b border-r border-slate-200 p-0.5 sm:min-h-28 sm:p-1.5 ${
                inMonth ? "bg-white" : "bg-slate-50/80"
              } ${isSelected ? "ring-2 ring-inset ring-teal-600" : ""}`}
            >
              <button
                type="button"
                data-calendar-date={date}
                aria-label={label}
                aria-pressed={isSelected}
                onClick={() => onSelectDate(date)}
                className={`mx-auto flex h-7 w-7 cursor-pointer items-center justify-center rounded-full text-xs font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 sm:mx-0 ${
                  isToday ? "bg-teal-700 text-white" : isSelected ? "bg-teal-50 text-teal-900" : inMonth ? "text-slate-800" : "text-slate-400"
                }`}
              >
                {number}
              </button>
              <div className="mt-1 hidden space-y-1 sm:block">
                {dateActivities.slice(0, 3).map((activity) => (
                  <CalendarActivityBadge key={activity.id} activity={activity} today={today} compact />
                ))}
                {dateActivities.length > 3 && (
                  <button
                    type="button"
                    aria-label={`Show ${dateActivities.length - 3} more activities for ${formatCalendarDate(date)}`}
                    onClick={() => onSelectDate(date)}
                    className="w-full cursor-pointer rounded px-1.5 py-1 text-left text-[11px] font-semibold text-teal-800 hover:bg-teal-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600"
                  >
                    +{dateActivities.length - 3} more
                  </button>
                )}
              </div>
              <div className="mt-1 flex min-h-3 items-center justify-center gap-0.5 sm:hidden" aria-hidden="true">
                {dateActivities.length > 0 && (
                  <span className={`h-1.5 w-1.5 rounded-full ${isSelected ? "bg-teal-700" : "bg-teal-500"}`} />
                )}
                {dateActivities.length > 1 && <span className="text-[9px] font-semibold text-slate-500">{dateActivities.length}</span>}
              </div>
              {dateActivities.length > 3 && (
                <button
                  type="button"
                  aria-label={`Show ${dateActivities.length - 3} more activities for ${formatCalendarDate(date)}`}
                  onClick={() => onSelectDate(date)}
                  className="mt-0.5 block w-full cursor-pointer text-center text-[9px] font-semibold text-teal-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600 sm:hidden"
                >
                  +{dateActivities.length - 3} more
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
