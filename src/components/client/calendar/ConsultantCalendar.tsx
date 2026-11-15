"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import WorkspaceShell from "@/components/workspace/WorkspaceShell";

import CalendarDayPanel from "@/components/client/calendar/CalendarDayPanel";
import CalendarMonthView from "@/components/client/calendar/CalendarMonthView";
import CalendarWeekView from "@/components/client/calendar/CalendarWeekView";

import {
  formatCalendarDate,
  formatCalendarMonth,
  getCalendarWeekDays,
  getMonthGridDays,
  monthKeyFromDate,
  shiftCalendarDate,
  shiftMonth,
} from "@/components/client/calendar/calendarUtils";

import {
  filterConsultantActivities,
  getConsultantActivities,
} from "@/lib/consultantActivities";

import {
  getActivitiesForDate,
  getActivitiesForMonth,
  getActivitiesForWeek,
  type ClientActivityStatusFilter,
  type ClientActivityTypeFilter,
} from "@/lib/clientActivities";

import {
  loadConsultantWorkSnapshot,
  type ConsultantWorkSnapshot,
} from "@/lib/consultantWork";
import {
  loadAccessibleMonitoredRecords,
  loadAccessibleOrganisations,
} from "@/lib/monitoredRecords/repository";

import {
  clientBusinessToday,
} from "@/lib/clientWorkspaceSelectors";

type CalendarView =
  | "month"
  | "week";

const emptySnapshot:
  ConsultantWorkSnapshot = {
    organisations: [],
    people: [],
    tasks: [],
    checklists: [],
    recurring: [],
    completed: [],
    exceptions: [],
  };

const selectClass =
  "cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600";

export default function ConsultantCalendar() {
  const today =
    clientBusinessToday();

  const [snapshot, setSnapshot] =
    useState<ConsultantWorkSnapshot>(
      emptySnapshot
    );

  const [view, setView] =
    useState<CalendarView>("month");

  const [month, setMonth] =
    useState(() =>
      today.slice(0, 7)
    );

  const [
    selectedDate,
    setSelectedDate,
  ] = useState(today);

  const [
    organisationId,
    setOrganisationId,
  ] = useState("all");

  const [
    typeFilter,
    setTypeFilter,
  ] =
    useState<ClientActivityTypeFilter>(
      "all"
    );

  const [
    statusFilter,
    setStatusFilter,
  ] =
    useState<ClientActivityStatusFilter>(
      "all"
    );

  const [
    personFilter,
    setPersonFilter,
  ] = useState("all");

  const [
    priorityFilter,
    setPriorityFilter,
  ] = useState<
    "all" | "high" | "medium" | "low"
  >("all");

  const [
    filtersOpen,
    setFiltersOpen,
  ] = useState(false);

  const [
    dayPanelOpen,
    setDayPanelOpen,
  ] = useState(false);
  const [recordLoadError, setRecordLoadError] = useState("");

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const [records, organisations] = await Promise.all([
          loadAccessibleMonitoredRecords(),
          loadAccessibleOrganisations(),
        ]);
        if (!active) return;
        setRecordLoadError("");
        setSnapshot(loadConsultantWorkSnapshot(
          today,
          records,
          organisations.map(({ id, name }) => ({ id, name })),
        ));
      } catch (cause: unknown) {
        if (active) {
          setRecordLoadError(
            cause instanceof Error ? cause.message : "Monitored-record calendar items could not be loaded.",
          );
        }
      }
    };
    const refresh = () => void load();
    const frame = window.requestAnimationFrame(refresh);

    window.addEventListener(
      "deadline-monitor-updated",
      refresh
    );

    window.addEventListener(
      "deadline-monitor-clients-updated",
      refresh
    );

    return () => {
      active = false;
      window.cancelAnimationFrame(
        frame
      );

      window.removeEventListener(
        "deadline-monitor-updated",
        refresh
      );

      window.removeEventListener(
        "deadline-monitor-clients-updated",
        refresh
      );
    };
  }, [today]);

  const allActivities =
    useMemo(
      () =>
        getConsultantActivities(
          snapshot,
          today
        ),
      [snapshot, today]
    );

  const filteredActivities =
    useMemo(
      () =>
        filterConsultantActivities(
          allActivities,
          {
            organisationId,
            activityType:
              typeFilter,
            status: statusFilter,
            responsiblePerson:
              personFilter,
            priority:
              priorityFilter,
          }
        ),
      [
        allActivities,
        organisationId,
        typeFilter,
        statusFilter,
        personFilter,
        priorityFilter,
      ]
    );

  const people = useMemo(
    () =>
      [
        ...new Set(
          snapshot.people
            .filter(
              (person) =>
                organisationId ===
                  "all" ||
                person.organisationId ===
                  organisationId
            )
            .map(
              (person) =>
                person.name
            )
            .filter(Boolean)
        ),
      ].sort(),
    [
      snapshot.people,
      organisationId,
    ]
  );

  const monthActivities =
    useMemo(
      () =>
        getActivitiesForMonth(
          filteredActivities,
          month
        ),
      [
        filteredActivities,
        month,
      ]
    );

  const weekActivities =
    useMemo(
      () =>
        getActivitiesForWeek(
          filteredActivities,
          selectedDate
        ),
      [
        filteredActivities,
        selectedDate,
      ]
    );

  const selectedActivities =
    useMemo(
      () =>
        getActivitiesForDate(
          filteredActivities,
          selectedDate
        ),
      [
        filteredActivities,
        selectedDate,
      ]
    );

  const weekDays = useMemo(
    () =>
      getCalendarWeekDays(
        selectedDate
      ),
    [selectedDate]
  );

  const days = useMemo(
    () =>
      getMonthGridDays(month),
    [month]
  );

  const organisationLabel =
    organisationId === "all"
      ? "All authorised organisations"
      : snapshot.organisations.find(
          (organisation) =>
            organisation.id ===
            organisationId
        )?.name ||
        "Selected organisation";

  const heading =
    view === "week"
      ? `${formatCalendarDate(
          weekDays[0],
          {
            weekday: "short",
            day: "numeric",
            month: "short",
          }
        )} – ${formatCalendarDate(
          weekDays[6],
          {
            weekday: "short",
            day: "numeric",
            month: "short",
            year: "numeric",
          }
        )}`
      : formatCalendarMonth(
          month
        );

  const visibleActivityCount =
    view === "week"
      ? weekActivities.length
      : monthActivities.length;

  function navigatePeriod(
    offset: number
  ) {
    if (view === "week") {
      const nextDate =
        shiftCalendarDate(
          selectedDate,
          offset * 7
        );

      setSelectedDate(nextDate);

      setMonth(
        monthKeyFromDate(
          nextDate
        )
      );

      return;
    }

    const nextMonth =
      shiftMonth(month, offset);

    setMonth(nextMonth);
    setSelectedDate(
      `${nextMonth}-01`
    );
  }

  function goToToday() {
    setMonth(
      today.slice(0, 7)
    );

    setSelectedDate(today);
  }

  function selectDate(
    date: string
  ) {
    setSelectedDate(date);

    if (
      monthKeyFromDate(date) !==
      month
    ) {
      setMonth(
        monthKeyFromDate(date)
      );
    }

    setDayPanelOpen(true);
  }

  function printMonth() {
    const cleanup = () =>
      document.body.classList.remove(
        "calendar-print-active"
      );

    document.body.classList.add(
      "calendar-print-active"
    );

    window.addEventListener(
      "afterprint",
      cleanup,
      { once: true }
    );

    window.print();

    window.setTimeout(
      cleanup,
      1000
    );
  }

  return (
    <WorkspaceShell
      eyebrow="Operations"
      title="Calendar"
    >
      <div
        id="consultant-calendar-print-root"
        className="mx-auto max-w-[1600px] space-y-4 p-3 sm:space-y-5 sm:p-6"
      >
        {recordLoadError && (
          <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {recordLoadError}
          </p>
        )}
        <div className="calendar-print-heading hidden">
          <p className="text-lg font-bold">
            Deadline-Monitor
          </p>

          <p>
            {organisationLabel}
          </p>

          <h1 className="text-2xl font-bold">
            Consultant Monitoring
            Calendar ·{" "}
            {formatCalendarMonth(
              month
            )}
          </h1>
        </div>

        <section
          aria-label="Calendar organisation filter"
          className="calendar-print-hide rounded-xl border border-teal-200 bg-teal-50 p-4 sm:flex sm:items-center sm:gap-4"
        >
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold text-slate-950">
              Organisation
            </h2>

            <p className="mt-1 text-sm text-slate-600">
              View activity across all
              authorised organisations or
              focus on one client.
            </p>
          </div>

          <label className="mt-3 block sm:mt-0 sm:w-80">
            <span className="sr-only">
              Filter calendar by
              organisation
            </span>

            <select
              value={
                organisationId
              }
              onChange={(event) => {
                setOrganisationId(
                  event.target.value
                );

                setPersonFilter(
                  "all"
                );
              }}
              className={`${selectClass} w-full`}
            >
              <option value="all">
                All authorised
                organisations
              </option>

              {snapshot.organisations.map(
                (organisation) => (
                  <option
                    key={
                      organisation.id
                    }
                    value={
                      organisation.id
                    }
                  >
                    {
                      organisation.name
                    }
                  </option>
                )
              )}
            </select>
          </label>
        </section>

        <section
          aria-label="Calendar controls"
          className="calendar-print-hide rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4"
        >
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={goToToday}
              className="cursor-pointer rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600"
            >
              Today
            </button>

            <button
              type="button"
              aria-label={`Previous ${
                view === "week"
                  ? "week"
                  : "month"
              }`}
              onClick={() =>
                navigatePeriod(-1)
              }
              className="cursor-pointer rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
            >
              ←
            </button>

            <button
              type="button"
              aria-label={`Next ${
                view === "week"
                  ? "week"
                  : "month"
              }`}
              onClick={() =>
                navigatePeriod(1)
              }
              className="cursor-pointer rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
            >
              →
            </button>

            <h2 className="order-first w-full text-xl font-bold text-slate-950 sm:order-none sm:ml-2 sm:w-auto sm:text-2xl">
              {heading}
            </h2>

            <div
              role="group"
              aria-label="Calendar view"
              className="ml-auto flex items-center gap-1 rounded-lg bg-slate-100 p-1"
            >
              {(
                [
                  "month",
                  "week",
                ] as const
              ).map(
                (calendarView) => (
                  <button
                    key={
                      calendarView
                    }
                    type="button"
                    aria-pressed={
                      view ===
                      calendarView
                    }
                    onClick={() =>
                      setView(
                        calendarView
                      )
                    }
                    className={`cursor-pointer rounded-md px-3 py-1.5 text-sm font-semibold ${
                      view ===
                      calendarView
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-600 hover:bg-white/70"
                    }`}
                  >
                    {calendarView[0].toUpperCase() +
                      calendarView.slice(
                        1
                      )}
                  </button>
                )
              )}
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
            <button
              type="button"
              aria-expanded={
                filtersOpen
              }
              onClick={() =>
                setFiltersOpen(
                  !filtersOpen
                )
              }
              className="cursor-pointer rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Filters
            </button>

            <button
              type="button"
              onClick={printMonth}
              disabled={
                view !== "month"
              }
              className={`rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold ${
                view === "month"
                  ? "cursor-pointer text-slate-700 hover:bg-slate-50"
                  : "cursor-not-allowed text-slate-400"
              }`}
            >
              Print Month
            </button>

            <span className="ml-auto cursor-default text-xs text-slate-500">
              {
                visibleActivityCount
              }{" "}
              activities{" "}
              {view === "week"
                ? "this week"
                : "this month"}
            </span>
          </div>

          {filtersOpen && (
            <div className="mt-3 grid gap-3 border-t border-slate-100 pt-3 sm:grid-cols-2 xl:grid-cols-4">
              <label className="grid gap-1 text-xs font-semibold text-slate-600">
                Activity type

                <select
                  value={
                    typeFilter
                  }
                  onChange={(
                    event
                  ) =>
                    setTypeFilter(
                      event.target
                        .value as ClientActivityTypeFilter
                    )
                  }
                  className={
                    selectClass
                  }
                >
                  <option value="all">
                    All
                  </option>
                  <option value="records">
                    Records
                  </option>
                  <option value="tasks">
                    Tasks
                  </option>
                  <option value="checklist">
                    Checklist
                  </option>
                  <option value="follow_ups">
                    Follow-ups
                  </option>
                </select>
              </label>

              <label className="grid gap-1 text-xs font-semibold text-slate-600">
                Status

                <select
                  value={
                    statusFilter
                  }
                  onChange={(
                    event
                  ) =>
                    setStatusFilter(
                      event.target
                        .value as ClientActivityStatusFilter
                    )
                  }
                  className={
                    selectClass
                  }
                >
                  <option value="all">
                    All
                  </option>
                  <option value="due">
                    Due
                  </option>
                  <option value="overdue">
                    Overdue
                  </option>
                  <option value="completed">
                    Completed
                  </option>
                  <option value="awaiting">
                    Awaiting
                  </option>
                  <option value="paused">
                    Paused
                  </option>
                </select>
              </label>

              <label className="grid gap-1 text-xs font-semibold text-slate-600">
                Responsible person

                <select
                  value={
                    personFilter
                  }
                  onChange={(
                    event
                  ) =>
                    setPersonFilter(
                      event.target
                        .value
                    )
                  }
                  className={
                    selectClass
                  }
                >
                  <option value="all">
                    Everyone
                  </option>

                  {people.map(
                    (person) => (
                      <option
                        key={
                          person
                        }
                        value={
                          person
                        }
                      >
                        {person}
                      </option>
                    )
                  )}
                </select>
              </label>

              <label className="grid gap-1 text-xs font-semibold text-slate-600">
                Priority

                <select
                  value={
                    priorityFilter
                  }
                  onChange={(
                    event
                  ) =>
                    setPriorityFilter(
                      event.target
                        .value as typeof priorityFilter
                    )
                  }
                  className={
                    selectClass
                  }
                >
                  <option value="all">
                    All
                  </option>
                  <option value="high">
                    High / Critical
                  </option>
                  <option value="medium">
                    Medium
                  </option>
                  <option value="low">
                    Low
                  </option>
                </select>
              </label>
            </div>
          )}
        </section>

        <section
          aria-label={`${heading} ${view} view`}
          className="calendar-print-area"
        >
          {view === "month" && (
            <>
              <CalendarMonthView
                days={days}
                month={month}
                today={today}
                selectedDate={
                  selectedDate
                }
                activities={
                  filteredActivities
                }
                onSelectDate={
                  selectDate
                }
              />

              <div
                aria-label="Calendar legend"
                className="mt-3 grid gap-2 text-[11px] text-slate-600 sm:grid-cols-2 lg:grid-cols-5"
              >
                {[
                  [
                    "bg-emerald-500",
                    "Completed",
                  ],
                  [
                    "bg-blue-500",
                    "Scheduled task",
                  ],
                  [
                    "bg-orange-500",
                    "Expiring soon",
                  ],
                  [
                    "bg-red-500",
                    "Overdue / Expired",
                  ],
                  [
                    "bg-violet-500",
                    "Awaiting confirmation",
                  ],
                ].map(
                  ([
                    colour,
                    label,
                  ]) => (
                    <span
                      key={label}
                      className="flex cursor-default items-center gap-2"
                    >
                      <span
                        aria-hidden="true"
                        className={`h-2.5 w-2.5 rounded-full ${colour}`}
                      />

                      {label}
                    </span>
                  )
                )}
              </div>
            </>
          )}

          {view === "week" && (
            <CalendarWeekView
              days={weekDays}
              today={today}
              activities={
                weekActivities
              }
            />
          )}

        </section>

        <p className="calendar-print-hide cursor-default text-xs text-slate-500">
          Week starts Monday.
          Calendar activity is derived
          from monitored records,
          follow-ups, recurring work and
          checklist items.
        </p>

        {dayPanelOpen && (
          <CalendarDayPanel
            date={selectedDate}
            activities={
              selectedActivities
            }
            today={today}
            onClose={() =>
              setDayPanelOpen(false)
            }
          />
        )}
      </div>
    </WorkspaceShell>
  );
}