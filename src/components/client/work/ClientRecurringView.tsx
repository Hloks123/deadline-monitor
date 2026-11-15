"use client";

import useClientWorkspaceData from "@/components/client/useClientWorkspaceData";

function formatStatus(status: string) {
  return status
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) =>
      character.toUpperCase()
    );
}

function formatRecurrence(
  recurrence: unknown
) {
  if (
    !recurrence ||
    typeof recurrence !== "object"
  ) {
    return "Custom";
  }

  const rule = recurrence as {
    frequency?: string;
    dayOfMonth?: number;
    interval?: number;
    weekdays?: number[];
  };

  if (
    rule.frequency === "monthly" &&
    rule.dayOfMonth
  ) {
    return `Monthly · Day ${rule.dayOfMonth}`;
  }

  switch (rule.frequency) {
    case "daily":
      return "Daily";

    case "weekly":
      return "Weekly";

    case "monthly":
      return "Monthly";

    case "quarterly":
      return "Quarterly";

    case "annual":
      return "Annually";

    default:
      return rule.frequency
        ? formatStatus(rule.frequency)
        : "Custom";
  }
}

function statusClasses(status: string) {
  const value = status.toLowerCase();

  if (value === "active") {
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }

  if (value === "paused") {
    return "border-amber-200 bg-amber-50 text-amber-900";
  }

  if (
    value === "cancelled" ||
    value === "canceled" ||
    value === "archived"
  ) {
    return "border-slate-200 bg-slate-100 text-slate-700";
  }

  return "border-blue-200 bg-blue-50 text-blue-800";
}

function formatNextRun(value?: string) {
  if (!value) {
    return "Not scheduled";
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(
    "en-ZA",
    {
      dateStyle: "medium",
      timeStyle: "short",
    }
  ).format(parsed);
}

export default function ClientRecurringView() {
  const {
    ready,
    tasks,
    occurrences,
    workspaceState,
  } = useClientWorkspaceData();

  const personMap = new Map(
    workspaceState.people.map(
      (person) => [
        person.id,
        person.name,
      ]
    )
  );

  if (!ready) {
    return (
      <p
        role="status"
        className="p-6 text-slate-600"
      >
        Loading recurring work...
      </p>
    );
  }

  const activeCount = tasks.filter(
    (task) => task.status === "active"
  ).length;

  const pausedCount = tasks.filter(
    (task) => task.status === "paused"
  ).length;

  const completedOccurrenceCount =
    occurrences.filter(
      (occurrence) =>
        occurrence.status === "completed"
    ).length;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-slate-950">
          Recurring work
        </h2>

        <p className="mt-1 text-sm text-slate-600">
          View work schedules that repeat
          automatically. Individual generated
          work appears in the Tasks tab.
        </p>
      </div>

      <section
        aria-label="Recurring work summary"
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
      >
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-semibold text-slate-500">
            Active schedules
          </p>

          <p className="mt-1 text-2xl font-bold text-slate-950">
            {activeCount}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-semibold text-slate-500">
            Paused schedules
          </p>

          <p className="mt-1 text-2xl font-bold text-slate-950">
            {pausedCount}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-semibold text-slate-500">
            Generated tasks
          </p>

          <p className="mt-1 text-2xl font-bold text-slate-950">
            {occurrences.length}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-semibold text-slate-500">
            Completed occurrences
          </p>

          <p className="mt-1 text-2xl font-bold text-slate-950">
            {completedOccurrenceCount}
          </p>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 p-4">
          <h3 className="font-bold text-slate-950">
            Recurring schedules
          </h3>

          <p className="mt-1 text-sm text-slate-500">
            Each schedule creates individual
            work according to its recurrence
            rule.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
              <tr>
                <th className="px-4 py-3 font-bold">
                  Schedule
                </th>

                <th className="px-4 py-3 font-bold">
                  Responsible
                </th>

                <th className="px-4 py-3 font-bold">
                  Repeats
                </th>

                <th className="px-4 py-3 font-bold">
                  Due time
                </th>

                <th className="px-4 py-3 font-bold">
                  Priority
                </th>

                <th className="px-4 py-3 font-bold">
                  Next run
                </th>

                <th className="px-4 py-3 font-bold">
                  Status
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {tasks.map((task) => (
                <tr
                  key={task.id}
                  className="cursor-default"
                >
                  <td className="px-4 py-4">
                    <p className="font-semibold text-slate-950">
                      {task.name}
                    </p>

                    {task.requiresCompletionEvidence && (
                      <p className="mt-1 text-xs text-slate-500">
                        Completion evidence required
                      </p>
                    )}
                  </td>

                  <td className="px-4 py-4 text-slate-700">
                    {personMap.get(task.ownerId) ||
                      task.ownerId ||
                      "Unassigned"}
                  </td>

                  <td className="px-4 py-4 text-slate-700">
                    {formatRecurrence(
                      task.recurrence
                    )}
                  </td>

                  <td className="px-4 py-4 text-slate-700">
                    {task.dueTime ||
                      "No time"}
                  </td>

                  <td className="px-4 py-4 capitalize text-slate-700">
                    {task.priority}
                  </td>

                  <td className="px-4 py-4 text-slate-700">
                    {formatNextRun(
                      task.nextRunAt
                    )}
                  </td>

                  <td className="px-4 py-4">
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${statusClasses(
                        task.status
                      )}`}
                    >
                      {formatStatus(
                        task.status
                      )}
                    </span>
                  </td>
                </tr>
              ))}

              {tasks.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-10 text-center text-slate-500"
                  >
                    No client-visible recurring
                    schedules are available.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <p className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
        Recurring schedules define when work
        repeats. Complete the individual
        generated work from the Tasks tab.
        Prototype reminder preferences do not
        automatically send client email.
      </p>
    </div>
  );
}