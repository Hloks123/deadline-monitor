"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import type { ClientActivity, ClientActivityType } from "@/lib/clientActivities";
import {
  activityStatusLabel,
  activityTypeLabel,
  formatCalendarDate,
  getActivityTone,
} from "./calendarUtils";

type CalendarDayPanelProps = {
  date: string;
  activities: ClientActivity[];
  today: string;
  onClose: () => void;
  onAddActivity?: () => void;
};

const activityGroups: { label: string; types: ClientActivityType[] }[] = [
  { label: "Records", types: ["record_expiry"] },
  { label: "Tasks", types: ["recurring_task", "assigned_task"] },
  { label: "Checklist Items", types: ["checklist_item"] },
  { label: "Follow-ups", types: ["record_follow_up", "follow_up", "released_notification"] },
];

export default function CalendarDayPanel({
  date,
  activities,
  today,
  onClose,
  onAddActivity,
}: CalendarDayPanelProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    closeButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const panel = document.getElementById("calendar-day-panel");
      const focusable = panel?.querySelectorAll<HTMLElement>('a[href], button:not(:disabled)');
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!panel?.contains(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.querySelector<HTMLButtonElement>(`[data-calendar-date="${date}"]`)?.focus();
    };
  }, [date]);

  return (
    <div
      className="calendar-print-hide fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/45 sm:items-stretch sm:justify-end"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        id="calendar-day-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="calendar-day-panel-heading"
        className="flex h-full max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:max-h-none sm:max-w-xl sm:rounded-none sm:border-l sm:border-slate-200"
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 p-4 sm:p-6">
          <div className="min-w-0">
            <h2 id="calendar-day-panel-heading" className="text-xl font-bold text-slate-950">
              {formatCalendarDate(date)}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {activities.length} {activities.length === 1 ? "activity" : "activities"}
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="inline-flex min-h-10 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600"
          >
            Close
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          {activities.length === 0 ? (
            <p className="cursor-default rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
              No activities are scheduled for this date.
            </p>
          ) : (
            <div className="space-y-6">
              {activityGroups.map((group) => {
                const groupedActivities = activities.filter((activity) =>
                  group.types.includes(activity.activityType),
                );
                if (!groupedActivities.length) return null;

                return (
                  <section key={group.label} aria-labelledby={`calendar-day-group-${group.label.replaceAll(" ", "-")}`}>
                    <h3
                      id={`calendar-day-group-${group.label.replaceAll(" ", "-")}`}
                      className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500"
                    >
                      {group.label}
                    </h3>
                    <ul className="space-y-2">
                      {groupedActivities.map((activity) => (
                        <li key={activity.id} className={`rounded-xl border p-3 ${getActivityTone(activity, today)}`}>
                          <h4 className="font-semibold">{activity.title}</h4>
                          <dl className="mt-2 grid gap-x-3 gap-y-1 text-xs sm:grid-cols-[auto_1fr]">
                            <dt className="font-semibold">Time</dt>
                            <dd>{activity.time || "All day"}</dd>
                            <dt className="font-semibold">Type</dt>
                            <dd>{activityTypeLabel(activity.activityType)}</dd>
                            <dt className="font-semibold">Status</dt>
                            <dd>{activityStatusLabel(activity)}</dd>
                            {activity.organisationName && (
                              <>
                                <dt className="font-semibold">Client</dt>
                                <dd>{activity.organisationName}</dd>
                              </>
                            )}
                            {activity.responsiblePerson && (
                              <>
                                <dt className="font-semibold">Responsible</dt>
                                <dd>{activity.responsiblePerson}</dd>
                              </>
                            )}
                            {activity.priority && (
                              <>
                                <dt className="font-semibold">Priority</dt>
                                <dd>{activity.priority}</dd>
                              </>
                            )}
                            {activity.relatedName && (
                              <>
                                <dt className="font-semibold">Related to</dt>
                                <dd>{activity.relatedName}</dd>
                              </>
                            )}
                            {activity.nextAction && (
                              <>
                                <dt className="font-semibold">Next action</dt>
                                <dd>{activity.nextAction}</dd>
                              </>
                            )}
                          </dl>
                          {activity.route && (
                            <Link
                              href={activity.route}
                              className="mt-3 inline-flex min-h-9 cursor-pointer items-center font-semibold underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
                            >
                              Open {activity.sourceEntityType === "record"
                                ? "record"
                                : activity.sourceEntityType === "task"
                                  ? "task in My Tasks"
                                  : activity.sourceEntityType === "checklist" || activity.sourceEntityType === "tracker"
                                    ? "Work Tracker"
                                    : "activity"}
                              <span className="sr-only">: {activity.title}</span>
                            </Link>
                          )}
                        </li>
                      ))}
                    </ul>
                  </section>
                );
              })}
            </div>
          )}
        </div>

        {onAddActivity && (
          <footer className="shrink-0 border-t border-slate-200 bg-white p-4 sm:p-6">
            <button
              type="button"
              onClick={onAddActivity}
              className="min-h-11 w-full cursor-pointer rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600"
            >
              + Add Activity
            </button>
          </footer>
        )}
      </section>
    </div>
  );
}
