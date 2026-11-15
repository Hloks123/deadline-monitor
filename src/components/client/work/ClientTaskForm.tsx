"use client";

import {
  FormEvent,
  useState,
} from "react";

import useClientWorkspaceData from "@/components/client/useClientWorkspaceData";

import {
  generateOccurrences,
  saveRecurringTask,
} from "@/lib/recurringTasks/taskStore";

import {
  RecurrenceFrequency,
  RecurrenceRule,
  RecurringTaskInput,
  TaskPriority,
} from "@/lib/recurringTasks/types";

import {
  CLIENT_WORKSPACE_ORGANISATION_ID,
} from "@/lib/clientWorkspaceConstants";
import { getEffectiveClientTaskOwnerId } from "@/lib/clientTaskSelectors";

const fieldClass =
  "mt-1 min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3 text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100";

type Props = {
  onCreated?: () => void;
  onCancel: () => void;
};

type TaskFormValues = {
  name: string;
  description: string;
  linkedRecordId: string;
  ownerId: string;
  priority: TaskPriority;
  startDate: string;
  dueTime: string;
  frequency: RecurrenceFrequency;
  weekdays: number[];
  dayOfMonth: number;
  customInterval: number;
  customIntervalUnit:
    | "day"
    | "week"
    | "month"
    | "year";
  escalationEnabled: boolean;
  escalationAfterDays: number;
  requiresCompletionEvidence: boolean;
  requiresConsultantReview: boolean;
  clientCanSkip: boolean;
};

const weekdayOptions = [
  {
    value: 1,
    label: "Monday",
  },
  {
    value: 2,
    label: "Tuesday",
  },
  {
    value: 3,
    label: "Wednesday",
  },
  {
    value: 4,
    label: "Thursday",
  },
  {
    value: 5,
    label: "Friday",
  },
  {
    value: 6,
    label: "Saturday",
  },
  {
    value: 0,
    label: "Sunday",
  },
];

function localDate(
  date = new Date()
) {
  return `${date.getFullYear()}-${String(
    date.getMonth() + 1
  ).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

function createInitialValues(
  ownerId = ""
): TaskFormValues {
  const today = new Date();

  return {
    name: "",
    description: "",
    linkedRecordId: "",
    ownerId,
    priority: "medium",
    startDate: localDate(today),
    dueTime: "17:00",
    frequency: "once",
    weekdays: [],
    dayOfMonth: today.getDate(),
    customInterval: 1,
    customIntervalUnit: "week",
    escalationEnabled: false,
    escalationAfterDays: 2,
    requiresCompletionEvidence: false,
    requiresConsultantReview: true,
    clientCanSkip: false,
  };
}

function buildRecurrence(
  values: TaskFormValues
): RecurrenceRule {
  if (
    values.frequency ===
    "weekdays"
  ) {
    return {
      frequency: "weekdays",
      weekdays:
        values.weekdays.length > 0
          ? values.weekdays
          : [1, 2, 3, 4, 5],
    };
  }

  if (
    values.frequency === "weekly"
  ) {
    const start =
      new Date(
        `${values.startDate}T00:00:00`
      );

    return {
      frequency: "weekly",
      weekdays:
        values.weekdays.length > 0
          ? values.weekdays
          : [start.getDay()],
    };
  }

  if (
    values.frequency ===
    "monthly"
  ) {
    return {
      frequency: "monthly",
      dayOfMonth:
        values.dayOfMonth,
    };
  }

  if (
    values.frequency === "custom"
  ) {
    return {
      frequency: "custom",
      interval:
        values.customInterval,
      intervalUnit:
        values.customIntervalUnit,
    };
  }

  return {
    frequency: values.frequency,
  };
}

export default function ClientTaskForm({
  onCreated,
  onCancel,
}: Props) {
  const {
    ready,
    records,
    workspaceState,
  } = useClientWorkspaceData();

  const activePeople =
    workspaceState.people.filter(
      (person) => person.active
    );

  const [values, setValues] =
    useState<TaskFormValues>(
      createInitialValues()
    );
  const ownerId = getEffectiveClientTaskOwnerId(values.ownerId, activePeople);

  const [error, setError] =
    useState("");

  const [saving, setSaving] =
    useState(false);

  function toggleWeekday(
    weekday: number
  ) {
    setValues((current) => ({
      ...current,
      weekdays:
        current.weekdays.includes(
          weekday
        )
          ? current.weekdays.filter(
              (value) =>
                value !== weekday
            )
          : [
              ...current.weekdays,
              weekday,
            ],
    }));
  }

  function submit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!values.name.trim()) {
      setError(
        "Task name is required."
      );
      return;
    }

    if (!ownerId) {
      setError(
        "Select a responsible person."
      );
      return;
    }

    if (!values.startDate) {
      setError(
        "Start date is required."
      );
      return;
    }

    if (
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(
        values.dueTime
      )
    ) {
      setError(
        "Enter a valid due time."
      );
      return;
    }

    if (
      values.frequency ===
        "weekdays" &&
      values.weekdays.length === 0
    ) {
      setError(
        "Select at least one weekday."
      );
      return;
    }

    if (
      values.frequency ===
        "weekly" &&
      values.weekdays.length === 0
    ) {
      setError(
        "Select at least one weekly schedule day."
      );
      return;
    }

    if (
      values.frequency ===
        "monthly" &&
      (values.dayOfMonth < 1 ||
        values.dayOfMonth > 31)
    ) {
      setError(
        "Monthly day must be between 1 and 31."
      );
      return;
    }

    if (
      values.frequency ===
        "custom" &&
      (values.customInterval < 1 ||
        values.customInterval >
          365)
    ) {
      setError(
        "Custom interval must be between 1 and 365."
      );
      return;
    }

    if (
      values.escalationEnabled &&
      (values.escalationAfterDays <
        0 ||
        values.escalationAfterDays >
          365)
    ) {
      setError(
        "Escalation days must be between 0 and 365."
      );
      return;
    }

    setSaving(true);
    setError("");

    try {
      const input: RecurringTaskInput =
        {
          organisationId:
            CLIENT_WORKSPACE_ORGANISATION_ID,

          name: values.name.trim(),

          description:
            values.description.trim() ||
            undefined,

          linkedRecordId:
            values.linkedRecordId ||
            undefined,

          ownerId,

          reviewerId:
            "Prototype Consultant",

          priority:
            values.priority,

          startDate:
            values.startDate,

          dueTime: values.dueTime,

          timezone:
            "Africa/Johannesburg",

          recurrence:
            buildRecurrence(values),

          escalationRule: {
            enabled:
              values.escalationEnabled,
            afterDays:
              values.escalationAfterDays,
          },

          requiresCompletionEvidence:
            values.requiresCompletionEvidence,

          requiresConsultantReview:
            values.requiresConsultantReview,

          clientVisible: true,

          clientCanSkip:
            values.clientCanSkip,

          status: "active",
        };

      const task =
        saveRecurringTask(input);

      const from = new Date(
        `${values.startDate}T00:00:00`
      );

      const through =
        new Date(from);

      if (
        values.frequency === "once"
      ) {
        through.setDate(
          through.getDate()
        );
      } else {
        through.setDate(
          through.getDate() + 90
        );
      }

      generateOccurrences(
        [task],
        from,
        through
      );

      onCreated?.();
    } catch (taskError) {
      console.error(
        "Could not create task.",
        taskError
      );

      setError(
        "The task could not be created. Check the task details and try again."
      );
    } finally {
      setSaving(false);
    }
  }

  if (!ready) {
    return (
      <p
        role="status"
        className="rounded-xl border border-slate-200 bg-white p-5 text-slate-600"
      >
        Loading task form...
      </p>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-2 sm:p-6"
    >
      <div className="sm:col-span-2">
        <h3 className="text-lg font-bold text-slate-950">
          Create task
        </h3>

        <p className="mt-1 text-sm text-slate-600">
          Add one-off or recurring work.
          Operational metadata and brief
          notes only.
        </p>
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 sm:col-span-2"
        >
          {error}
        </p>
      )}

      <label className="text-sm font-semibold text-slate-700">
        Task name
        <input
          required
          maxLength={160}
          value={values.name}
          onChange={(event) =>
            setValues({
              ...values,
              name: event.target.value,
            })
          }
          className={fieldClass}
          placeholder="Prepare monthly payroll"
        />
      </label>

      <label className="text-sm font-semibold text-slate-700">
        Responsible person
        <select
          required
          value={ownerId}
          onChange={(event) =>
            setValues({
              ...values,
              ownerId:
                event.target.value,
            })
          }
          className={fieldClass}
        >
          <option value="">
            Select a responsible person
          </option>

          {activePeople.map(
            (person) => (
              <option
                key={person.id}
                value={person.id}
              >
                {person.name}
              </option>
            )
          )}
        </select>
      </label>

      <label className="text-sm font-semibold text-slate-700">
        Related monitored record
        <select
          value={
            values.linkedRecordId
          }
          onChange={(event) =>
            setValues({
              ...values,
              linkedRecordId:
                event.target.value,
            })
          }
          className={fieldClass}
        >
          <option value="">
            No related record
          </option>

          {records.map((record) => (
            <option
              key={record.id}
              value={record.id}
            >
              {record.name}
            </option>
          ))}
        </select>
      </label>

      <label className="text-sm font-semibold text-slate-700">
        Priority
        <select
          value={values.priority}
          onChange={(event) =>
            setValues({
              ...values,
              priority:
                event.target
                  .value as TaskPriority,
            })
          }
          className={fieldClass}
        >
          <option value="low">
            Low
          </option>
          <option value="medium">
            Medium
          </option>
          <option value="high">
            High
          </option>
          <option value="critical">
            Critical
          </option>
        </select>
      </label>

      <label className="text-sm font-semibold text-slate-700">
        Start date
        <input
          required
          type="date"
          value={values.startDate}
          onChange={(event) =>
            setValues({
              ...values,
              startDate:
                event.target.value,
            })
          }
          className={fieldClass}
        />
      </label>

      <label className="text-sm font-semibold text-slate-700">
        Due time
        <input
          required
          type="time"
          value={values.dueTime}
          onChange={(event) =>
            setValues({
              ...values,
              dueTime:
                event.target.value,
            })
          }
          className={fieldClass}
        />
      </label>

      <label className="text-sm font-semibold text-slate-700">
        Repeat
        <select
          value={values.frequency}
          onChange={(event) => {
            const frequency =
              event.target
                .value as RecurrenceFrequency;

            setValues({
              ...values,
              frequency,
              weekdays:
                frequency ===
                "weekdays"
                  ? [1, 2, 3, 4, 5]
                  : values.weekdays,
            });
          }}
          className={fieldClass}
        >
          <option value="once">
            Does not repeat
          </option>
          <option value="daily">
            Daily
          </option>
          <option value="weekdays">
            Selected weekdays
          </option>
          <option value="weekly">
            Weekly
          </option>
          <option value="monthly">
            Monthly
          </option>
          <option value="month_end">
            Month end
          </option>
          <option value="quarterly">
            Quarterly
          </option>
          <option value="annually">
            Annually
          </option>
          <option value="custom">
            Custom
          </option>
        </select>
      </label>

      <label className="text-sm font-semibold text-slate-700">
        Time zone
        <input
          readOnly
          value="Africa/Johannesburg"
          className={`${fieldClass} cursor-default bg-slate-50 text-slate-600`}
        />
      </label>

      {(values.frequency ===
        "weekdays" ||
        values.frequency ===
          "weekly") && (
        <fieldset className="rounded-xl border border-slate-200 p-4 sm:col-span-2">
          <legend className="px-1 text-sm font-semibold text-slate-700">
            Schedule days
          </legend>

          <div className="mt-2 flex flex-wrap gap-2">
            {weekdayOptions.map(
              (weekday) => {
                const checked =
                  values.weekdays.includes(
                    weekday.value
                  );

                return (
                  <label
                    key={weekday.value}
                    className={`flex cursor-pointer items-center gap-2 rounded-full border px-3 py-2 text-sm font-semibold ${
                      checked
                        ? "border-teal-700 bg-teal-50 text-teal-900"
                        : "border-slate-300 bg-white text-slate-700"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        toggleWeekday(
                          weekday.value
                        )
                      }
                      className="h-4 w-4"
                    />

                    {weekday.label}
                  </label>
                );
              }
            )}
          </div>
        </fieldset>
      )}

      {values.frequency ===
        "monthly" && (
        <label className="text-sm font-semibold text-slate-700">
          Day of month
          <input
            required
            type="number"
            min={1}
            max={31}
            value={values.dayOfMonth}
            onChange={(event) =>
              setValues({
                ...values,
                dayOfMonth: Number(
                  event.target.value
                ),
              })
            }
            className={fieldClass}
          />
        </label>
      )}

      {values.frequency ===
        "custom" && (
        <>
          <label className="text-sm font-semibold text-slate-700">
            Repeat every
            <input
              required
              type="number"
              min={1}
              max={365}
              value={
                values.customInterval
              }
              onChange={(event) =>
                setValues({
                  ...values,
                  customInterval:
                    Number(
                      event.target
                        .value
                    ),
                })
              }
              className={fieldClass}
            />
          </label>

          <label className="text-sm font-semibold text-slate-700">
            Interval unit
            <select
              value={
                values.customIntervalUnit
              }
              onChange={(event) =>
                setValues({
                  ...values,
                  customIntervalUnit:
                    event.target
                      .value as TaskFormValues["customIntervalUnit"],
                })
              }
              className={fieldClass}
            >
              <option value="day">
                Day
              </option>
              <option value="week">
                Week
              </option>
              <option value="month">
                Month
              </option>
              <option value="year">
                Year
              </option>
            </select>
          </label>
        </>
      )}

      <fieldset className="space-y-3 rounded-xl border border-slate-200 p-4 sm:col-span-2">
        <legend className="px-1 text-sm font-semibold text-slate-700">
          Task controls
        </legend>

        <label className="flex items-start gap-3 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={
              values.requiresCompletionEvidence
            }
            onChange={(event) =>
              setValues({
                ...values,
                requiresCompletionEvidence:
                  event.target.checked,
              })
            }
            className="mt-1 h-4 w-4"
          />

          <span>
            <strong>
              Completion evidence required
            </strong>

            <span className="mt-1 block text-slate-500">
              Require a brief text
              confirmation before the task
              can be completed.
            </span>
          </span>
        </label>

        <label className="flex items-start gap-3 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={
              values.clientCanSkip
            }
            onChange={(event) =>
              setValues({
                ...values,
                clientCanSkip:
                  event.target.checked,
              })
            }
            className="mt-1 h-4 w-4"
          />

          <span>
            <strong>
              Client may skip with a reason
            </strong>

            <span className="mt-1 block text-slate-500">
              A reason must be supplied
              when the task is skipped.
            </span>
          </span>
        </label>

        <label className="flex items-start gap-3 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={
              values.requiresConsultantReview
            }
            onChange={(event) =>
              setValues({
                ...values,
                requiresConsultantReview:
                  event.target.checked,
              })
            }
            className="mt-1 h-4 w-4"
          />

          <span>
            <strong>
              Consultant review required
            </strong>

            <span className="mt-1 block text-slate-500">
              Keep client-facing task
              communication subject to
              prototype review.
            </span>
          </span>
        </label>
      </fieldset>

      <fieldset className="grid gap-4 rounded-xl border border-slate-200 p-4 sm:col-span-2 sm:grid-cols-2">
        <legend className="px-1 text-sm font-semibold text-slate-700">
          Escalation
        </legend>

        <label className="flex items-center gap-3 text-sm font-semibold text-slate-700">
          <input
            type="checkbox"
            checked={
              values.escalationEnabled
            }
            onChange={(event) =>
              setValues({
                ...values,
                escalationEnabled:
                  event.target.checked,
              })
            }
            className="h-4 w-4"
          />

          Escalate overdue work
        </label>

        {values.escalationEnabled && (
          <label className="text-sm font-semibold text-slate-700">
            Escalate after days
            <input
              required
              type="number"
              min={0}
              max={365}
              value={
                values.escalationAfterDays
              }
              onChange={(event) =>
                setValues({
                  ...values,
                  escalationAfterDays:
                    Number(
                      event.target
                        .value
                    ),
                })
              }
              className={fieldClass}
            />
          </label>
        )}
      </fieldset>

      <label className="text-sm font-semibold text-slate-700 sm:col-span-2">
        Operational notes
        <textarea
          maxLength={500}
          rows={3}
          value={values.description}
          onChange={(event) =>
            setValues({
              ...values,
              description:
                event.target.value,
            })
          }
          className={`${fieldClass} py-3`}
          placeholder="Brief operational instructions only. Do not include confidential document contents."
        />
      </label>

      <div className="flex flex-wrap gap-2 sm:col-span-2">
        <button
          type="submit"
          disabled={saving}
          className="min-h-[44px] cursor-pointer rounded-xl bg-teal-600 px-5 font-semibold text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving
            ? "Creating task..."
            : "Create task"}
        </button>

        <button
          type="button"
          onClick={onCancel}
          className="min-h-[44px] cursor-pointer rounded-xl border border-slate-300 px-5 font-semibold text-slate-700 hover:bg-slate-50"
        >
          Cancel
        </button>
      </div>

      {activePeople.length === 0 && (
        <p className="text-sm text-amber-800 sm:col-span-2">
          No active responsible people are
          available for this organisation.
        </p>
      )}
    </form>
  );
}