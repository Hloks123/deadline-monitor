"use client";

import { useMemo } from "react";
import useClientWorkspaceData from "@/components/client/useClientWorkspaceData";

type CompletedWorkRow = {
  id: string;
  name: string;
  type: "Recurring" | "Checklist";
  relatedTo: string;
  responsiblePerson: string;
  dueDate: string;
  completedDate: string;
  priority: string;
  completionEvidence: string;
};

function formatDate(value?: string) {
  if (!value) {
    return "Not recorded";
  }

  const parsed = new Date(
    value.length === 10
      ? `${value}T00:00:00`
      : value
  );

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(
    "en-ZA",
    {
      dateStyle: "medium",
    }
  ).format(parsed);
}

export default function ClientCompletedView() {
  const {
    ready,
    tasks,
    occurrences,
    workspaceState,
  } = useClientWorkspaceData();

  const completedWork = useMemo<
    CompletedWorkRow[]
  >(() => {
    const taskMap = new Map(
      tasks.map((task) => [
        task.id,
        task,
      ])
    );

    const personMap = new Map(
      workspaceState.people.map(
        (person) => [
          person.id,
          person.name,
        ]
      )
    );

    const trackerMap = new Map(
      workspaceState.trackers.map(
        (tracker) => [
          tracker.id,
          tracker.name,
        ]
      )
    );

    const recurringRows =
      occurrences
        .filter(
          (occurrence) =>
            occurrence.status ===
            "completed"
        )
        .map((occurrence) => {
          const task = taskMap.get(
            occurrence.recurringTaskId
          );

          return {
            id: `recurring-${occurrence.id}`,
            name:
              task?.name ||
              "Recurring task",
            type: "Recurring" as const,
            relatedTo:
              "Recurring schedule",
            responsiblePerson:
              personMap.get(
                occurrence.ownerId
              ) ||
              personMap.get(
                task?.ownerId || ""
              ) ||
              occurrence.ownerId ||
              task?.ownerId ||
              "Unassigned",
            dueDate:
              occurrence.scheduledFor,
            completedDate:
              occurrence.completedAt ||
              occurrence.scheduledFor,
            priority:
              task?.priority ||
              "Medium",
            completionEvidence:
              occurrence.completionEvidence ||
              "No completion note recorded.",
          };
        });

    const checklistRows =
      workspaceState.items
        .filter(
          (item) =>
            item.status ===
            "Completed"
        )
        .map((item) => ({
          id: `checklist-${item.id}`,
          name: item.task,
          type: "Checklist" as const,
          relatedTo:
            trackerMap.get(
              item.trackerId
            ) ||
            "Checklist",
          responsiblePerson:
            item.responsiblePersonName ||
            "Unassigned",
          dueDate:
            item.targetDate,
          completedDate:
            item.completedDate ||
            item.updatedAt,
          priority:
            item.priority,
          completionEvidence:
            item.completionEvidence ||
            item.progressNotes ||
            "No completion note recorded.",
        }));

    return [
      ...recurringRows,
      ...checklistRows,
    ].sort((a, b) =>
      b.completedDate.localeCompare(
        a.completedDate
      )
    );
  }, [
    tasks,
    occurrences,
    workspaceState,
  ]);

  if (!ready) {
    return (
      <p
        role="status"
        className="p-6 text-slate-600"
      >
        Loading completed work...
      </p>
    );
  }

  const recurringCompleted =
    completedWork.filter(
      (item) =>
        item.type === "Recurring"
    ).length;

  const checklistCompleted =
    completedWork.filter(
      (item) =>
        item.type === "Checklist"
    ).length;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-slate-950">
          Completed work
        </h2>

        <p className="mt-1 text-sm text-slate-600">
          Review finished recurring tasks
          and checklist items together with
          their completion information.
        </p>
      </div>

      <section
        aria-label="Completed work summary"
        className="grid gap-3 sm:grid-cols-3"
      >
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-semibold text-slate-500">
            Total completed
          </p>

          <p className="mt-1 text-2xl font-bold text-slate-950">
            {completedWork.length}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-semibold text-slate-500">
            Recurring tasks
          </p>

          <p className="mt-1 text-2xl font-bold text-blue-700">
            {recurringCompleted}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-semibold text-slate-500">
            Checklist items
          </p>

          <p className="mt-1 text-2xl font-bold text-emerald-700">
            {checklistCompleted}
          </p>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 p-4">
          <h3 className="font-bold text-slate-950">
            Completion history
          </h3>

          <p className="mt-1 text-sm text-slate-500">
            Finished work is kept here for
            operational history and reporting.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1050px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
              <tr>
                <th className="px-4 py-3 font-bold">
                  Work
                </th>

                <th className="px-4 py-3 font-bold">
                  Type
                </th>

                <th className="px-4 py-3 font-bold">
                  Related to
                </th>

                <th className="px-4 py-3 font-bold">
                  Responsible
                </th>

                <th className="px-4 py-3 font-bold">
                  Due
                </th>

                <th className="px-4 py-3 font-bold">
                  Completed
                </th>

                <th className="px-4 py-3 font-bold">
                  Priority
                </th>

                <th className="px-4 py-3 font-bold">
                  Evidence
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {completedWork.map(
                (item) => (
                  <tr
                    key={item.id}
                    className="cursor-default"
                  >
                    <td className="px-4 py-4 font-semibold text-slate-950">
                      {item.name}
                    </td>

                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${
                          item.type ===
                          "Recurring"
                            ? "border-blue-200 bg-blue-50 text-blue-800"
                            : "border-emerald-200 bg-emerald-50 text-emerald-800"
                        }`}
                      >
                        {item.type}
                      </span>
                    </td>

                    <td className="px-4 py-4 text-slate-700">
                      {item.relatedTo}
                    </td>

                    <td className="px-4 py-4 text-slate-700">
                      {
                        item.responsiblePerson
                      }
                    </td>

                    <td className="px-4 py-4 text-slate-700">
                      {formatDate(
                        item.dueDate
                      )}
                    </td>

                    <td className="px-4 py-4 text-slate-700">
                      {formatDate(
                        item.completedDate
                      )}
                    </td>

                    <td className="px-4 py-4 text-slate-700">
                      {item.priority}
                    </td>

                    <td className="max-w-[280px] px-4 py-4 text-slate-600">
                      {
                        item.completionEvidence
                      }
                    </td>
                  </tr>
                )
              )}

              {completedWork.length ===
                0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-10 text-center text-slate-500"
                  >
                    No completed work is
                    available yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <p className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
        Completion history contains
        operational task information and
        text-based evidence only. Underlying
        company documents are not stored
        here.
      </p>
    </div>
  );
}