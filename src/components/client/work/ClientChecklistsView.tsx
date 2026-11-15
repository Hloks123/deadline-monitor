"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  addResponsiblePerson,
  carryForwardChecklistItem,
  ChecklistItem,
  ChecklistStatus,
  ClientWorkspaceState,
  deleteDraftChecklistItem,
  duplicateTrackerForPeriod,
  getClientWorkspaceState,
  ReminderDelivery,
  saveChecklistItem,
  saveWorkTracker,
  TrackerPeriod,
  updateChecklistItem,
  WorkPriority,
  WorkTracker,
} from "@/lib/clientWorkspaceStore";

const fieldClass =
  "mt-1 min-h-[42px] w-full rounded-lg border border-slate-300 bg-white px-3 text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100";

const statusOptions: ChecklistStatus[] = [
  "Not Started",
  "In Progress",
  "Scheduled",
  "Awaiting Confirmation",
  "Completed",
  "Skipped",
  "Blocked",
  "Overdue",
  "Carry Forward",
];

const periods: TrackerPeriod[] = [
  "Daily checklist",
  "Weekly tracker",
  "Monthly tracker",
  "Custom tracker",
];

function isOpen(status: ChecklistStatus) {
  return ![
    "Completed",
    "Skipped",
    "Carry Forward",
  ].includes(status);
}

function localDate(date = new Date()) {
  return `${date.getFullYear()}-${String(
    date.getMonth() + 1
  ).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

function startOfWeek(date: Date) {
  const result = new Date(date);
  const weekday =
    (result.getDay() + 6) % 7;

  result.setDate(
    result.getDate() - weekday
  );

  result.setHours(0, 0, 0, 0);

  return result;
}

type TrackerValues = {
  name: string;
  description: string;
  periodType: TrackerPeriod;
  startDate: string;
  endDate: string;
  ownerId: string;
  reminderPreference: ReminderDelivery;
  status: WorkTracker["status"];
};

const emptyTracker = (
  ownerId = ""
): TrackerValues => ({
  name: "",
  description: "",
  periodType: "Weekly tracker",
  startDate: localDate(),
  endDate: localDate(
    new Date(Date.now() + 6 * 86400000)
  ),
  ownerId,
  reminderPreference: "In-app only",
  status: "Active",
});

type ItemValues = {
  trackerId: string;
  task: string;
  responsiblePersonId: string;
  targetDate: string;
  targetTime: string;
  status: ChecklistStatus;
  priority: WorkPriority;
  progressNotes: string;
  nextAction: string;
  completionEvidence: string;
  reminderPreference: ReminderDelivery;
  clientCanSkip: boolean;
};

const emptyItem = (
  trackerId = "",
  responsiblePersonId = ""
): ItemValues => ({
  trackerId,
  task: "",
  responsiblePersonId,
  targetDate: localDate(),
  targetTime: "17:00",
  status: "Not Started",
  priority: "Medium",
  progressNotes: "",
  nextAction: "",
  completionEvidence: "",
  reminderPreference: "In-app only",
  clientCanSkip: false,
});

type ClientChecklistsViewProps = {
  createSignal?: number;
};

export default function ClientChecklistsView({
  createSignal = 0,
}: ClientChecklistsViewProps) {
  const [state, setState] =
    useState<ClientWorkspaceState>({
      organisationId: "",
      people: [],
      trackers: [],
      items: [],
      reminderPreference: {
        delivery: "In-app only",
        summaryFrequency:
          "Weekly on Monday",
        time: "09:00",
        dailySummary: "morning",
        monthlyRule:
          "last-working-day",
        categories: [],
        timeZone:
          "Africa/Johannesburg",
      },
    });

  const [
    showTrackerForm,
    setShowTrackerForm,
  ] = useState(false);

  const [
    showItemForm,
    setShowItemForm,
  ] = useState(false);

  const [
    showPersonForm,
    setShowPersonForm,
  ] = useState(false);

  const [
    trackerEdit,
    setTrackerEdit,
  ] = useState<WorkTracker>();

  const [
    itemEdit,
    setItemEdit,
  ] = useState<ChecklistItem>();

  const [
    trackerValues,
    setTrackerValues,
  ] = useState<TrackerValues>(
    emptyTracker()
  );

  const [
    itemValues,
    setItemValues,
  ] = useState<ItemValues>(
    emptyItem()
  );

  const [
    selectedTracker,
    setSelectedTracker,
  ] = useState("");

  const [
    trackerTab,
    setTrackerTab,
  ] = useState<
    "active" | "templates"
  >("active");

  const [
    selectedStatus,
    setSelectedStatus,
  ] = useState("All statuses");

  const [
    selectedPriority,
    setSelectedPriority,
  ] = useState("All priorities");

  const [search, setSearch] =
    useState("");

  const [message, setMessage] =
    useState("");

  const [error, setError] =
    useState("");

  const [week, setWeek] = useState(
    () => startOfWeek(new Date())
  );

  const [
    personValues,
    setPersonValues,
  ] = useState({
    name: "",
    email: "",
    role: "",
  });

  const [carry, setCarry] =
    useState<{
      id: string;
      date: string;
      reason: string;
    }>();

  const [block, setBlock] =
    useState<{
      id: string;
      reason: string;
    }>();

  const [
    selectedItems,
    setSelectedItems,
  ] = useState<string[]>([]);

  const [
    completionEvidence,
    setCompletionEvidence,
  ] = useState<
    Record<string, string>
  >({});

  const [
    duplicateStart,
    setDuplicateStart,
  ] = useState("");

  const [
    duplicateEnd,
    setDuplicateEnd,
  ] = useState("");

  const handledCreateSignal = useRef(0);

  useEffect(() => {
    const load = () =>
      setState(
        getClientWorkspaceState()
      );

    const timer =
      window.setTimeout(load, 0);

    window.addEventListener(
      "deadline-monitor-updated",
      load
    );

    return () => {
      window.clearTimeout(timer);

      window.removeEventListener(
        "deadline-monitor-updated",
        load
      );
    };
  }, []);
useEffect(() => {
  if (
    createSignal <= 0 ||
    createSignal <= handledCreateSignal.current
  ) {
    return;
  }

  handledCreateSignal.current = createSignal;
  const timer = window.setTimeout(() => {
    setTrackerTab("active");
    setTrackerEdit(undefined);

    setTrackerValues(
      emptyTracker(
        state.people[0]?.id || ""
      )
    );

    setShowTrackerForm(true);
  }, 0);
  return () => window.clearTimeout(timer);
}, [createSignal, state.people]);
  const currentTracker =
    state.trackers.find(
      (tracker) =>
        tracker.id === selectedTracker
    );

  const dayStart =
    localDate(week);

  const weekEndDate =
    new Date(week);

  weekEndDate.setDate(
    weekEndDate.getDate() + 6
  );

  const dayEnd =
    localDate(weekEndDate);

  const visibleItems = useMemo(
    () =>
      state.items.filter((item) => {
        const trackerMatches =
          !selectedTracker ||
          item.trackerId ===
            selectedTracker;

        const statusMatches =
          selectedStatus ===
            "All statuses" ||
          item.status ===
            selectedStatus;

        const priorityMatches =
          selectedPriority ===
            "All priorities" ||
          item.priority ===
            selectedPriority;

        const queryMatches =
          `${item.task} ${item.responsiblePersonName} ${
            item.nextAction || ""
          }`
            .toLowerCase()
            .includes(
              search
                .trim()
                .toLowerCase()
            );

        return (
          trackerMatches &&
          statusMatches &&
          priorityMatches &&
          queryMatches &&
          (!currentTracker ||
            (item.targetDate >=
              dayStart &&
              item.targetDate <=
                dayEnd))
        );
      }),
    [
      state.items,
      selectedTracker,
      selectedStatus,
      selectedPriority,
      search,
      currentTracker,
      dayStart,
      dayEnd,
    ]
  );

  const today = localDate();

  const dueToday =
    state.items.filter(
      (item) =>
        item.targetDate === today &&
        isOpen(item.status)
    ).length;

  const overdue =
    state.items.filter(
      (item) =>
        item.targetDate < today &&
        isOpen(item.status)
    ).length;

  const blocked =
    state.items.filter(
      (item) =>
        item.status === "Blocked"
    ).length;

  const activeTrackers =
    state.trackers.filter(
      (tracker) =>
        tracker.status === "Active"
    ).length;

  const cards = [
    {
      label: "Active checklists",
      value: activeTrackers,
    },
    {
      label: "Tasks due today",
      value: dueToday,
    },
    {
      label: "Overdue",
      value: overdue,
    },
    {
      label: "Blocked",
      value: blocked,
    },
    {
      label:
        "Incomplete monthly items",
      value: state.items.filter(
        (item) =>
          state.trackers.find(
            (tracker) =>
              tracker.id ===
              item.trackerId
          )?.periodType ===
            "Monthly tracker" &&
          isOpen(item.status)
      ).length,
    },
    {
      label: "Total checklist items",
      value: state.items.length,
    },
  ];

  function showResult(
    result: {
      success: boolean;
      message?: string;
    },
    successText: string
  ) {
    if (!result.success) {
      setError(
        result.message ||
          "Could not save this item."
      );
      setMessage("");
      return false;
    }

    setError("");
    setMessage(successText);

    return true;
  }

  function submitTracker(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (
      !showResult(
        saveWorkTracker(
          trackerValues,
          trackerEdit?.id
        ),
        "Checklist saved and recorded in the prototype audit history."
      )
    ) {
      return;
    }

    setShowTrackerForm(false);
    setTrackerEdit(undefined);
  }

  function submitItem(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const result =
      saveChecklistItem(
        {
          ...itemValues,
          responsibleEmail:
            undefined,
          progressNotes:
            itemValues.progressNotes,
          nextAction:
            itemValues.nextAction,
          completionEvidence:
            itemValues.completionEvidence ||
            undefined,
        },
        itemEdit?.id
      );

    if (
      !showResult(
        result,
        "Checklist item saved and recorded in the prototype audit history."
      )
    ) {
      return;
    }

    setShowItemForm(false);
    setItemEdit(undefined);
  }

  function editItem(
    item: ChecklistItem
  ) {
    setItemEdit(item);

    setItemValues({
      trackerId: item.trackerId,
      task: item.task,
      responsiblePersonId:
        item.responsiblePersonId,
      targetDate: item.targetDate,
      targetTime:
        item.targetTime || "17:00",
      status: item.status,
      priority: item.priority,
      progressNotes:
        item.progressNotes || "",
      nextAction:
        item.nextAction || "",
      completionEvidence:
        item.completionEvidence || "",
      reminderPreference:
        item.reminderPreference,
      clientCanSkip:
        item.clientCanSkip || false,
    });

    setShowItemForm(true);
  }

  function changeItemStatus(
    item: ChecklistItem,
    status: ChecklistStatus,
    note?: string
  ) {
    const result =
      updateChecklistItem(
        item.id,
        status,
        note
      );

    showResult(
      result,
      `Item marked ${status.toLowerCase()} and recorded in the prototype audit history.`
    );

    setBlock(undefined);
  }

  function carryItem() {
    if (!carry) return;

    const result =
      carryForwardChecklistItem(
        carry.id,
        carry.date,
        carry.reason
      );

    if (!result.success) {
      showResult(result, "");
      return;
    }

    showResult(
      result,
      "Item carried forward to a new checklist period. Both events are recorded in the prototype audit history."
    );

    setCarry(undefined);

    setSelectedTracker(
      result.tracker?.id || ""
    );

    setWeek(
      startOfWeek(
        new Date(
          `${result.item.targetDate}T00:00:00`
        )
      )
    );
  }

  function duplicate() {
    if (!currentTracker) return;

    const itemDates =
      Object.fromEntries(
        state.items
          .filter((item) =>
            selectedItems.includes(
              item.id
            )
          )
          .map((item) => {
            const offset = Math.max(
              0,
              Math.round(
                (new Date(
                  `${item.targetDate}T00:00:00`
                ).getTime() -
                  new Date(
                    `${currentTracker.startDate}T00:00:00`
                  ).getTime()) /
                  86400000
              )
            );

            const dueDate =
              new Date(
                `${duplicateStart}T00:00:00`
              );

            dueDate.setDate(
              dueDate.getDate() +
                offset
            );

            return [
              item.id,
              localDate(dueDate),
            ];
          })
      );

    const result =
      duplicateTrackerForPeriod(
        currentTracker.id,
        duplicateStart,
        duplicateEnd,
        itemDates,
        selectedItems
      );

    if (!result.success) {
      showResult(result, "");
      return;
    }

    setError("");

    setMessage(
      "Checklist duplicated. Completed checklist items were not copied."
    );

    setSelectedTracker(
      result.tracker.id
    );

    setWeek(
      startOfWeek(
        new Date(
          `${duplicateStart}T00:00:00`
        )
      )
    );

    setSelectedItems([]);
  }

  function addPerson(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const result =
      addResponsiblePerson({
        ...personValues,
        active: true,
      });

    if (!result.success) {
      showResult(result, "");
      return;
    }

    if (
      !showResult(
        result,
        "Organisation responsible person added. No account or invitation was created."
      )
    ) {
      return;
    }

    if (showItemForm) {
      setItemValues((current) => ({
        ...current,
        responsiblePersonId:
          result.person.id,
      }));
    }

    setPersonValues({
      name: "",
      email: "",
      role: "",
    });

    setShowPersonForm(false);
  }

  const days = Array.from(
    { length: 7 },
    (_, index) => {
      const date = new Date(week);

      date.setDate(
        date.getDate() + index
      );

      return localDate(date);
    }
  );

  const trackerTemplates: {
    name: string;
    description: string;
    periodType: TrackerPeriod;
  }[] = [
    {
      name:
        "Daily Operations Checklist",
      description:
        "A lightweight daily checklist for recurring operational follow-ups.",
      periodType:
        "Daily checklist",
    },
    {
      name: "Weekly Work Checklist",
      description:
        "A weekly checklist for assigned tasks, reviews and follow-ups.",
      periodType:
        "Weekly tracker",
    },
    {
      name:
        "Monthly Reporting Checklist",
      description:
        "A monthly checklist for recurring reporting and review actions.",
      periodType:
        "Monthly tracker",
    },
  ];

  return (
    <div className="space-y-5">
      <div>
  <h2 className="text-xl font-bold text-slate-950">
    Organisation checklists
  </h2>

  <p className="mt-1 text-sm text-slate-600">
    Group related tasks into reusable daily,
    weekly, monthly or custom checklists.
  </p>
</div>

      {error && (
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800"
        >
          {error}
        </p>
      )}

      {message && (
        <p
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800"
        >
          {message}
        </p>
      )}

      <div
        role="tablist"
        aria-label="Checklist sections"
        className="flex gap-2 border-b border-slate-200"
      >
        {(
          [
            "active",
            "templates",
          ] as const
        ).map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={
              trackerTab === tab
            }
            onClick={() => {
              setTrackerTab(tab);

              setShowItemForm(false);
            }}
            className={`min-h-[44px] cursor-pointer border-b-2 px-4 text-sm font-semibold ${
              trackerTab === tab
                ? "border-teal-700 text-teal-900"
                : "border-transparent text-slate-600 hover:text-slate-900"
            }`}
          >
            {tab === "active"
              ? "Active Checklists"
              : "Templates"}
          </button>
        ))}
      </div>

      {trackerTab ===
        "templates" && (
        <section
          aria-label="Checklist templates"
          className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
        >
          {trackerTemplates.map(
            (template) => (
              <article
                key={template.name}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <p className="text-xs font-bold uppercase tracking-wide text-teal-800">
                  {
                    template.periodType
                  }
                </p>

                <h2 className="mt-1 font-bold text-slate-950">
                  {template.name}
                </h2>

                <p className="mt-2 text-sm text-slate-600">
                  {
                    template.description
                  }
                </p>

                <button
                  type="button"
                  onClick={() => {
                    setTrackerTab(
                      "active"
                    );

                    setTrackerEdit(
                      undefined
                    );

                    setTrackerValues({
                      ...emptyTracker(
                        state.people[0]
                          ?.id || ""
                      ),
                      name: template.name,
                      description:
                        template.description,
                      periodType:
                        template.periodType,
                    });

                    setShowTrackerForm(
                      true
                    );
                  }}
                  className="mt-4 min-h-[40px] cursor-pointer rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                >
                  Create from template
                </button>
              </article>
            )
          )}
        </section>
      )}

      {trackerTab === "active" && (
        <>
          <section
            aria-label="Checklist summary"
            className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
          >
            {cards.map((card) => (
              <div
                key={card.label}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <p className="text-sm font-semibold text-slate-500">
                  {card.label}
                </p>

                <p className="mt-1 text-2xl font-bold text-slate-950">
                  {card.value}
                </p>
              </div>
            ))}
          </section>

          {showPersonForm && (
            <form
              onSubmit={addPerson}
              className="grid gap-3 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-3"
            >
              <h3 className="text-base font-bold sm:col-span-3">
                Add responsible person
              </h3>

              <label className="text-sm font-semibold">
                Name
                <input
                  required
                  maxLength={100}
                  value={
                    personValues.name
                  }
                  onChange={(event) =>
                    setPersonValues({
                      ...personValues,
                      name: event.target
                        .value,
                    })
                  }
                  className={
                    fieldClass
                  }
                />
              </label>

              <label className="text-sm font-semibold">
                Work email (optional)
                <input
                  type="email"
                  value={
                    personValues.email
                  }
                  onChange={(event) =>
                    setPersonValues({
                      ...personValues,
                      email:
                        event.target
                          .value,
                    })
                  }
                  className={
                    fieldClass
                  }
                />
              </label>

              <label className="text-sm font-semibold">
                Role (optional)
                <input
                  maxLength={80}
                  value={
                    personValues.role
                  }
                  onChange={(event) =>
                    setPersonValues({
                      ...personValues,
                      role: event.target
                        .value,
                    })
                  }
                  className={
                    fieldClass
                  }
                />
              </label>

              <div className="flex gap-2 sm:col-span-3">
                <button className="min-h-[42px] cursor-pointer rounded-lg bg-teal-700 px-4 font-semibold text-white">
                  Save person
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setShowPersonForm(
                      false
                    )
                  }
                  className="min-h-[42px] cursor-pointer rounded-lg border px-4"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {showTrackerForm && (
            <form
              onSubmit={
                submitTracker
              }
              className="grid gap-3 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-2 lg:grid-cols-3"
            >
              <h3 className="text-lg font-bold sm:col-span-2 lg:col-span-3">
                {trackerEdit
                  ? "Edit checklist"
                  : "Create checklist"}
              </h3>

              <label className="text-sm font-semibold">
                Checklist name
                <input
                  required
                  maxLength={120}
                  value={
                    trackerValues.name
                  }
                  onChange={(event) =>
                    setTrackerValues({
                      ...trackerValues,
                      name: event.target
                        .value,
                    })
                  }
                  className={
                    fieldClass
                  }
                />
              </label>

              <label className="text-sm font-semibold">
                Period type
                <select
                  value={
                    trackerValues.periodType
                  }
                  onChange={(event) =>
                    setTrackerValues({
                      ...trackerValues,
                      periodType:
                        event.target
                          .value as TrackerPeriod,
                    })
                  }
                  className={
                    fieldClass
                  }
                >
                  {periods.map(
                    (period) => (
                      <option
                        key={period}
                      >
                        {period}
                      </option>
                    )
                  )}
                </select>
              </label>

              <label className="text-sm font-semibold">
                Owner
                <select
                  required
                  value={
                    trackerValues.ownerId
                  }
                  onChange={(event) =>
                    setTrackerValues({
                      ...trackerValues,
                      ownerId:
                        event.target
                          .value,
                    })
                  }
                  className={
                    fieldClass
                  }
                >
                  <option value="">
                    Select a responsible
                    person
                  </option>

                  {state.people
                    .filter(
                      (person) =>
                        person.active
                    )
                    .map((person) => (
                      <option
                        key={person.id}
                        value={person.id}
                      >
                        {person.name}
                      </option>
                    ))}
                </select>
              </label>

              <label className="text-sm font-semibold">
                Start date
                <input
                  required
                  type="date"
                  value={
                    trackerValues.startDate
                  }
                  onChange={(event) =>
                    setTrackerValues({
                      ...trackerValues,
                      startDate:
                        event.target
                          .value,
                    })
                  }
                  className={
                    fieldClass
                  }
                />
              </label>

              <label className="text-sm font-semibold">
                End date
                <input
                  required
                  type="date"
                  value={
                    trackerValues.endDate
                  }
                  onChange={(event) =>
                    setTrackerValues({
                      ...trackerValues,
                      endDate:
                        event.target
                          .value,
                    })
                  }
                  className={
                    fieldClass
                  }
                />
              </label>

              <label className="text-sm font-semibold">
                Reminder preference
                <select
                  value={
                    trackerValues.reminderPreference
                  }
                  onChange={(event) =>
                    setTrackerValues({
                      ...trackerValues,
                      reminderPreference:
                        event.target
                          .value as ReminderDelivery,
                    })
                  }
                  className={
                    fieldClass
                  }
                >
                  <option>
                    In-app only
                  </option>
                  <option>
                    Email and in-app
                  </option>
                  <option>
                    No reminder
                  </option>
                </select>
              </label>

              <label className="text-sm font-semibold">
                Checklist status
                <select
                  value={
                    trackerValues.status
                  }
                  onChange={(event) =>
                    setTrackerValues({
                      ...trackerValues,
                      status:
                        event.target
                          .value as TrackerValues["status"],
                    })
                  }
                  className={
                    fieldClass
                  }
                >
                  <option>Draft</option>
                  <option>Active</option>
                  <option>
                    Completed
                  </option>
                  <option>
                    Archived
                  </option>
                </select>
              </label>

              <label className="text-sm font-semibold sm:col-span-2 lg:col-span-3">
                Description (optional)
                <textarea
                  maxLength={500}
                  rows={2}
                  value={
                    trackerValues.description
                  }
                  onChange={(event) =>
                    setTrackerValues({
                      ...trackerValues,
                      description:
                        event.target
                          .value,
                    })
                  }
                  className={`${fieldClass} py-2`}
                />
              </label>

              <div className="flex gap-2 sm:col-span-2 lg:col-span-3">
                <button className="min-h-[42px] cursor-pointer rounded-lg bg-teal-600 px-4 font-semibold text-white">
                  Save checklist
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setShowTrackerForm(
                      false
                    )
                  }
                  className="min-h-[42px] cursor-pointer rounded-lg border px-4"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {showItemForm && (
            <form
              onSubmit={submitItem}
              className="grid gap-3 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-2 lg:grid-cols-3"
            >
              <h3 className="text-lg font-bold sm:col-span-2 lg:col-span-3">
                {itemEdit
                  ? "Edit checklist item"
                  : "Add checklist item"}
              </h3>

              <label className="text-sm font-semibold">
                Checklist
                <select
                  required
                  value={
                    itemValues.trackerId
                  }
                  onChange={(event) =>
                    setItemValues({
                      ...itemValues,
                      trackerId:
                        event.target
                          .value,
                    })
                  }
                  className={
                    fieldClass
                  }
                >
                  <option value="">
                    Select a checklist
                  </option>

                  {state.trackers
                    .filter(
                      (tracker) =>
                        tracker.status !==
                        "Archived"
                    )
                    .map((tracker) => (
                      <option
                        key={tracker.id}
                        value={tracker.id}
                      >
                        {tracker.name}
                      </option>
                    ))}
                </select>
              </label>

              <label className="text-sm font-semibold">
                Task or deliverable
                <input
                  required
                  maxLength={160}
                  value={
                    itemValues.task
                  }
                  onChange={(event) =>
                    setItemValues({
                      ...itemValues,
                      task: event.target
                        .value,
                    })
                  }
                  className={
                    fieldClass
                  }
                />
              </label>

              <div>
                <label className="text-sm font-semibold">
                  Responsible person
                  <select
                    required
                    value={
                      itemValues.responsiblePersonId
                    }
                    onChange={(
                      event
                    ) =>
                      setItemValues({
                        ...itemValues,
                        responsiblePersonId:
                          event.target
                            .value,
                      })
                    }
                    className={
                      fieldClass
                    }
                  >
                    <option value="">
                      Select a responsible
                      person
                    </option>

                    {state.people
                      .filter(
                        (person) =>
                          person.active
                      )
                      .map((person) => (
                        <option
                          key={
                            person.id
                          }
                          value={
                            person.id
                          }
                        >
                          {
                            person.name
                          }
                        </option>
                      ))}
                  </select>
                </label>

                <button
                  type="button"
                  onClick={() =>
                    setShowPersonForm(
                      !showPersonForm
                    )
                  }
                  className="mt-1 min-h-[32px] cursor-pointer text-xs font-semibold text-teal-800 underline"
                >
                  {showPersonForm
                    ? "Close person form"
                    : "+ Add responsible person"}
                </button>
              </div>

              <label className="text-sm font-semibold">
                Target date
                <input
                  required
                  type="date"
                  value={
                    itemValues.targetDate
                  }
                  onChange={(event) =>
                    setItemValues({
                      ...itemValues,
                      targetDate:
                        event.target
                          .value,
                    })
                  }
                  className={
                    fieldClass
                  }
                />
              </label>

              <label className="text-sm font-semibold">
                Target time
                <input
                  type="time"
                  value={
                    itemValues.targetTime
                  }
                  onChange={(event) =>
                    setItemValues({
                      ...itemValues,
                      targetTime:
                        event.target
                          .value,
                    })
                  }
                  className={
                    fieldClass
                  }
                />
              </label>

              <label className="text-sm font-semibold">
                Priority
                <select
                  value={
                    itemValues.priority
                  }
                  onChange={(event) =>
                    setItemValues({
                      ...itemValues,
                      priority:
                        event.target
                          .value as WorkPriority,
                    })
                  }
                  className={
                    fieldClass
                  }
                >
                  <option>High</option>
                  <option>Medium</option>
                  <option>Low</option>
                </select>
              </label>

              <label className="text-sm font-semibold">
                Status
                <select
                  value={
                    itemValues.status
                  }
                  onChange={(event) =>
                    setItemValues({
                      ...itemValues,
                      status:
                        event.target
                          .value as ChecklistStatus,
                    })
                  }
                  className={
                    fieldClass
                  }
                >
                  {statusOptions.map(
                    (status) => (
                      <option
                        key={status}
                      >
                        {status}
                      </option>
                    )
                  )}
                </select>
              </label>

              <label className="text-sm font-semibold">
                Reminder preference
                <select
                  value={
                    itemValues.reminderPreference
                  }
                  onChange={(event) =>
                    setItemValues({
                      ...itemValues,
                      reminderPreference:
                        event.target
                          .value as ReminderDelivery,
                    })
                  }
                  className={
                    fieldClass
                  }
                >
                  <option>
                    In-app only
                  </option>
                  <option>
                    Email and in-app
                  </option>
                  <option>
                    No reminder
                  </option>
                </select>
              </label>

              <label className="flex items-center gap-2 text-sm font-semibold">
                <input
                  type="checkbox"
                  checked={
                    itemValues.clientCanSkip
                  }
                  onChange={(event) =>
                    setItemValues({
                      ...itemValues,
                      clientCanSkip:
                        event.target
                          .checked,
                    })
                  }
                  className="h-4 w-4"
                />
                Client may skip this item
                with a reason
              </label>

              <label className="text-sm font-semibold">
                Next action
                <input
                  maxLength={160}
                  value={
                    itemValues.nextAction
                  }
                  onChange={(event) =>
                    setItemValues({
                      ...itemValues,
                      nextAction:
                        event.target
                          .value,
                    })
                  }
                  className={
                    fieldClass
                  }
                />
              </label>

              <label className="text-sm font-semibold sm:col-span-2 lg:col-span-3">
                Progress / completion
                notes (text only)
                <textarea
                  maxLength={500}
                  rows={2}
                  value={
                    itemValues.progressNotes
                  }
                  onChange={(event) =>
                    setItemValues({
                      ...itemValues,
                      progressNotes:
                        event.target
                          .value,
                    })
                  }
                  className={`${fieldClass} py-2`}
                  placeholder="No confidential document contents."
                />
              </label>

              <div className="flex gap-2 sm:col-span-2 lg:col-span-3">
                <button className="min-h-[42px] cursor-pointer rounded-lg bg-teal-600 px-4 font-semibold text-white">
                  Save checklist item
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setShowItemForm(
                      false
                    )
                  }
                  className="min-h-[42px] cursor-pointer rounded-lg border px-4"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="text-sm font-semibold">
                Checklist
                <select
                  value={
                    selectedTracker
                  }
                  onChange={(event) => {
                    const trackerId =
                      event.target.value;

                    setSelectedTracker(
                      trackerId
                    );

                    const tracker =
                      state.trackers.find(
                        (item) =>
                          item.id ===
                          trackerId
                      );

                    if (tracker) {
                      setWeek(
                        startOfWeek(
                          new Date(
                            `${tracker.startDate}T00:00:00`
                          )
                        )
                      );
                    }
                  }}
                  className={
                    fieldClass
                  }
                >
                  <option value="">
                    All checklists
                  </option>

                  {state.trackers.map(
                    (tracker) => (
                      <option
                        key={tracker.id}
                        value={tracker.id}
                      >
                        {tracker.name} ·{" "}
                        {tracker.status}
                      </option>
                    )
                  )}
                </select>
              </label>

              <label className="text-sm font-semibold">
                Search tasks
                <input
                  type="search"
                  value={search}
                  onChange={(event) =>
                    setSearch(
                      event.target.value
                    )
                  }
                  className={
                    fieldClass
                  }
                  placeholder="Task, person or next action"
                />
              </label>

              <label className="text-sm font-semibold">
                Status
                <select
                  value={
                    selectedStatus
                  }
                  onChange={(event) =>
                    setSelectedStatus(
                      event.target.value
                    )
                  }
                  className={
                    fieldClass
                  }
                >
                  <option>
                    All statuses
                  </option>

                  {statusOptions.map(
                    (status) => (
                      <option
                        key={status}
                      >
                        {status}
                      </option>
                    )
                  )}
                </select>
              </label>

              <label className="text-sm font-semibold">
                Priority
                <select
                  value={
                    selectedPriority
                  }
                  onChange={(event) =>
                    setSelectedPriority(
                      event.target.value
                    )
                  }
                  className={
                    fieldClass
                  }
                >
                  <option>
                    All priorities
                  </option>
                  <option>High</option>
                  <option>Medium</option>
                  <option>Low</option>
                </select>
              </label>
            </div>

            {selectedTracker && (
              <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    aria-label="Previous week"
                    onClick={() =>
                      setWeek(
                        new Date(
                          week.getFullYear(),
                          week.getMonth(),
                          week.getDate() -
                            7
                        )
                      )
                    }
                    className="min-h-[40px] cursor-pointer rounded-lg border px-3"
                  >
                    ←
                  </button>

                  <p className="text-sm font-semibold">
                    {dayStart} – {dayEnd}
                  </p>

                  <button
                    type="button"
                    aria-label="Next week"
                    onClick={() =>
                      setWeek(
                        new Date(
                          week.getFullYear(),
                          week.getMonth(),
                          week.getDate() +
                            7
                        )
                      )
                    }
                    className="min-h-[40px] cursor-pointer rounded-lg border px-3"
                  >
                    →
                  </button>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setItemEdit(
                        undefined
                      );

                      setItemValues(
                        emptyItem(
                          selectedTracker,
                          state.people[0]
                            ?.id || ""
                        )
                      );

                      setShowItemForm(
                        true
                      );
                    }}
                    className="min-h-[40px] cursor-pointer rounded-lg bg-teal-700 px-3 text-sm font-semibold text-white"
                  >
                    + Add checklist item
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setTrackerEdit(
                        currentTracker
                      );

                      setTrackerValues({
                        name:
                          currentTracker?.name ||
                          "",
                        description:
                          currentTracker?.description ||
                          "",
                        periodType:
                          currentTracker?.periodType ||
                          "Weekly tracker",
                        startDate:
                          currentTracker?.startDate ||
                          today,
                        endDate:
                          currentTracker?.endDate ||
                          today,
                        ownerId:
                          currentTracker?.ownerId ||
                          "",
                        reminderPreference:
                          currentTracker?.reminderPreference ||
                          "In-app only",
                        status:
                          currentTracker?.status ||
                          "Active",
                      });

                      setShowTrackerForm(
                        true
                      );
                    }}
                    className="min-h-[40px] cursor-pointer rounded-lg border px-3 text-sm font-semibold"
                  >
                    Edit checklist
                  </button>

                  <button
                    type="button"
                    onClick={duplicate}
                    disabled={
                      selectedItems.length ===
                      0
                    }
                    className="min-h-[40px] cursor-pointer rounded-lg border px-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Duplicate selected
                    incomplete items
                  </button>
                </div>
              </div>
            )}

            {currentTracker && (
              <div className="grid grid-cols-7 gap-1">
                {days.map((day) => (
                  <div
                    key={day}
                    className="min-h-[64px] cursor-default rounded-lg bg-slate-50 p-2 text-center"
                  >
                    <span className="block text-[10px] font-bold uppercase text-slate-500">
                      {new Date(
                        `${day}T00:00:00`
                      ).toLocaleDateString(
                        undefined,
                        {
                          weekday:
                            "short",
                        }
                      )}
                    </span>

                    <span
                      className={`mt-1 block text-sm font-semibold ${
                        day === today
                          ? "text-teal-700"
                          : "text-slate-800"
                      }`}
                    >
                      {day.slice(8)}
                    </span>

                    <span className="text-[10px] text-slate-500">
                      {
                        state.items.filter(
                          (item) =>
                            item.trackerId ===
                              currentTracker.id &&
                            item.targetDate ===
                              day
                        ).length
                      }{" "}
                      tasks
                    </span>
                  </div>
                ))}
              </div>
            )}

            {selectedTracker && (
              <div className="grid gap-2 rounded-xl bg-slate-50 p-3 sm:grid-cols-3">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="date"
                    value={
                      duplicateStart
                    }
                    onChange={(event) =>
                      setDuplicateStart(
                        event.target.value
                      )
                    }
                    className="min-h-[38px] cursor-text rounded border px-2"
                  />
                  Copy period starts
                </label>

                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="date"
                    value={duplicateEnd}
                    onChange={(event) =>
                      setDuplicateEnd(
                        event.target.value
                      )
                    }
                    className="min-h-[38px] cursor-text rounded border px-2"
                  />
                  Copy period ends
                </label>

                <span className="self-center text-xs text-slate-600">
                  Select incomplete item
                  rows to include.
                </span>
              </div>
            )}

            <div className="space-y-3">
              {visibleItems.map(
                (item) => (
                  <article
                    key={item.id}
                    className="rounded-xl border border-slate-200 p-4"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex min-w-0 gap-3">
                        <input
                          type="checkbox"
                          aria-label={`Select ${item.task} for duplication`}
                          checked={selectedItems.includes(
                            item.id
                          )}
                          disabled={
                            [
                              "Completed",
                              "Skipped",
                              "Carry Forward",
                            ].includes(
                              item.status
                            ) ||
                            item.trackerId !==
                              selectedTracker
                          }
                          onChange={(
                            event
                          ) =>
                            setSelectedItems(
                              event.target
                                .checked
                                ? [
                                    ...selectedItems,
                                    item.id,
                                  ]
                                : selectedItems.filter(
                                    (
                                      id
                                    ) =>
                                      id !==
                                      item.id
                                  )
                            )
                          }
                          className="mt-1 h-4 w-4 cursor-pointer disabled:cursor-not-allowed"
                        />

                        <div>
                          <h3 className="font-bold text-slate-950">
                            {item.task}
                          </h3>

                          <p className="mt-1 text-sm text-slate-600">
                            {
                              state.trackers.find(
                                (
                                  tracker
                                ) =>
                                  tracker.id ===
                                  item.trackerId
                              )?.name
                            }{" "}
                            ·{" "}
                            {
                              item.responsiblePersonName
                            }{" "}
                            · Due{" "}
                            {
                              item.targetDate
                            }{" "}
                            {
                              item.targetTime
                            }
                          </p>

                          <p className="mt-1 text-sm text-slate-700">
                            Status:{" "}
                            <strong>
                              {
                                item.status
                              }
                            </strong>{" "}
                            · Priority:{" "}
                            <strong>
                              {
                                item.priority
                              }
                            </strong>
                            {item.nextAction
                              ? ` · Next: ${item.nextAction}`
                              : ""}
                          </p>

                          {item.blockedReason && (
                            <p className="mt-1 text-sm text-amber-800">
                              Blocked:{" "}
                              {
                                item.blockedReason
                              }
                            </p>
                          )}

                          {item.carryForwardReason && (
                            <p className="mt-1 text-sm text-slate-600">
                              Carry-forward
                              reason:{" "}
                              {
                                item.carryForwardReason
                              }
                            </p>
                          )}

                          {item.progressNotes && (
                            <p className="mt-1 text-sm text-slate-600">
                              Progress:{" "}
                              {
                                item.progressNotes
                              }
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex shrink-0 flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            editItem(
                              item
                            )
                          }
                          className="min-h-[38px] cursor-pointer rounded-lg border px-3 text-sm font-semibold"
                        >
                          Edit
                        </button>

                        {item.status !==
                          "In Progress" &&
                          item.status !==
                            "Completed" && (
                            <button
                              type="button"
                              onClick={() =>
                                changeItemStatus(
                                  item,
                                  "In Progress"
                                )
                              }
                              className="min-h-[38px] cursor-pointer rounded-lg border px-3 text-sm font-semibold"
                            >
                              Start
                            </button>
                          )}

                        {item.status !==
                          "Completed" && (
                          <button
                            type="button"
                            onClick={() =>
                              changeItemStatus(
                                item,
                                "Completed",
                                completionEvidence[
                                  item.id
                                ]
                              )
                            }
                            className="min-h-[38px] cursor-pointer rounded-lg bg-teal-600 px-3 text-sm font-semibold text-white"
                          >
                            Complete
                          </button>
                        )}

                        {item.status !==
                          "Completed" && (
                          <button
                            type="button"
                            onClick={() =>
                              setBlock({
                                id: item.id,
                                reason: "",
                              })
                            }
                            className="min-h-[38px] cursor-pointer rounded-lg border border-amber-300 px-3 text-sm font-semibold text-amber-900"
                          >
                            Block
                          </button>
                        )}

                        {item.status !==
                          "Completed" && (
                          <button
                            type="button"
                            onClick={() =>
                              setCarry({
                                id: item.id,
                                date: localDate(
                                  new Date(
                                    Date.now() +
                                      7 *
                                        86400000
                                  )
                                ),
                                reason: "",
                              })
                            }
                            className="min-h-[38px] cursor-pointer rounded-lg border px-3 text-sm font-semibold"
                          >
                            Carry forward
                          </button>
                        )}

                        {item.status ===
                          "Not Started" && (
                          <button
                            type="button"
                            onClick={() => {
                              if (
                                deleteDraftChecklistItem(
                                  item.id
                                )
                              ) {
                                setMessage(
                                  "Draft checklist item removed and audited."
                                );
                              }
                            }}
                            className="min-h-[38px] cursor-pointer rounded-lg border border-red-200 px-3 text-sm font-semibold text-red-800"
                          >
                            Delete draft
                          </button>
                        )}
                      </div>
                    </div>

                    {item.status !==
                      "Completed" && (
                      <label className="mt-3 block text-sm font-semibold text-slate-700">
                        Completion evidence
                        (text only; required
                        to complete)
                        <textarea
                          rows={2}
                          maxLength={500}
                          value={
                            completionEvidence[
                              item.id
                            ] || ""
                          }
                          onChange={(
                            event
                          ) =>
                            setCompletionEvidence(
                              {
                                ...completionEvidence,
                                [item.id]:
                                  event
                                    .target
                                    .value,
                              }
                            )
                          }
                          className={`${fieldClass} py-2`}
                          placeholder="Brief operational confirmation, not document contents"
                        />
                      </label>
                    )}

                    {block?.id ===
                      item.id && (
                      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                        <label className="flex-1 text-sm font-semibold">
                          Reason required
                          <input
                            value={
                              block.reason
                            }
                            onChange={(
                              event
                            ) =>
                              setBlock({
                                ...block,
                                reason:
                                  event
                                    .target
                                    .value,
                              })
                            }
                            className={
                              fieldClass
                            }
                          />
                        </label>

                        <button
                          type="button"
                          onClick={() =>
                            changeItemStatus(
                              item,
                              "Blocked",
                              block.reason
                            )
                          }
                          className="min-h-[42px] cursor-pointer self-end rounded-lg bg-amber-600 px-4 font-semibold text-white"
                        >
                          Save blocked reason
                        </button>
                      </div>
                    )}

                    {carry?.id ===
                      item.id && (
                      <div className="mt-3 grid gap-2 sm:grid-cols-3">
                        <label className="text-sm font-semibold">
                          New target date
                          <input
                            type="date"
                            value={
                              carry.date
                            }
                            onChange={(
                              event
                            ) =>
                              setCarry({
                                ...carry,
                                date: event
                                  .target
                                  .value,
                              })
                            }
                            className={
                              fieldClass
                            }
                          />
                        </label>

                        <label className="text-sm font-semibold">
                          Reason required
                          <input
                            value={
                              carry.reason
                            }
                            onChange={(
                              event
                            ) =>
                              setCarry({
                                ...carry,
                                reason:
                                  event
                                    .target
                                    .value,
                              })
                            }
                            className={
                              fieldClass
                            }
                          />
                        </label>

                        <button
                          type="button"
                          onClick={
                            carryItem
                          }
                          className="min-h-[42px] cursor-pointer self-end rounded-lg bg-teal-600 px-4 font-semibold text-white"
                        >
                          Carry to new period
                        </button>
                      </div>
                    )}
                  </article>
                )
              )}

              {visibleItems.length ===
                0 && (
                <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-500">
                  {state.items.length ===
                  0
                    ? "No checklist items yet. Create a checklist and add your first item."
                    : "No checklist items match these filters or the selected week."}
                </p>
              )}
            </div>
          </section>
        </>
      )}

      <p className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
        All client data is scoped to the
        fictional demo organisation.
        Checklist reminders are preferences
        only; no email is sent. Do not
        upload documents or enter
        confidential contents.
      </p>
    </div>
  );
}