"use client";
import ClientTaskForm from "@/components/client/work/ClientTaskForm";
import { useState } from "react";
import ClientWorkspaceShell from "@/components/client/ClientWorkspaceShell";
import ClientTasksView from "@/components/client/work/ClientTasksView";
import ClientChecklistsView from "@/components/client/work/ClientChecklistsView";
import ClientRecurringView from "@/components/client/work/ClientRecurringView";
import ClientCompletedView from "@/components/client/work/ClientCompletedView";
import ClientAssignedTasks from "@/components/client/work/ClientAssignedTasks";

type WorkTab =
  | "tasks"
  | "checklists"
  | "recurring"
  | "completed";

const tabs: Array<{
  id: WorkTab;
  label: string;
}> = [
  {
    id: "tasks",
    label: "Tasks",
  },
  {
    id: "checklists",
    label: "Checklists",
  },
  {
    id: "recurring",
    label: "Recurring",
  },
  {
    id: "completed",
    label: "Completed",
  },
];

export default function ClientWorkPage() {
  const [activeTab, setActiveTab] =
    useState<WorkTab>("tasks");
const [
  showTaskForm,
  setShowTaskForm,
] = useState(false);
  const [
    checklistCreateSignal,
    setChecklistCreateSignal,
  ] = useState(0);

  return (
    <ClientWorkspaceShell title="My Work">
      <div className="space-y-6 p-6 lg:p-8">
        <ClientAssignedTasks />
        <section className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-2xl font-bold text-slate-950">
                My Work
              </h2>

              <p className="mt-2 text-slate-600">
                Manage tasks, checklists and recurring
                work in one place.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
  type="button"
  aria-expanded={showTaskForm}
  onClick={() => {
    setActiveTab("tasks");
    setShowTaskForm(
      (current) => !current
    );
  }}
  className="min-h-11 cursor-pointer rounded-lg bg-teal-700 px-5 py-2.5 font-semibold text-white transition-colors hover:bg-teal-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
>
  {showTaskForm
    ? "Close Task Form"
    : "+ New Task"}
</button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab("checklists");

                  setChecklistCreateSignal(
                    (current) => current + 1
                  );
                }}
                className="min-h-11 cursor-pointer rounded-lg border border-slate-300 bg-white px-5 py-2.5 font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
              >
                + New Checklist
              </button>
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div
            role="tablist"
            aria-label="My Work sections"
            className="flex overflow-x-auto border-b border-slate-200 px-4"
          >
            {tabs.map((tab) => {
              const isActive =
                activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() =>
                    setActiveTab(tab.id)
                  }
                  className={`min-h-14 shrink-0 cursor-pointer border-b-2 px-5 font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-500 ${
                    isActive
                      ? "border-teal-600 text-teal-700"
                      : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-900"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div
            role="tabpanel"
            className="min-h-[260px] p-6"
          >
            {activeTab === "tasks" && (
  <div className="space-y-5">
    {showTaskForm && (
      <ClientTaskForm
        onCreated={() => {
          setShowTaskForm(false);
        }}
        onCancel={() => {
          setShowTaskForm(false);
        }}
      />
    )}

    <ClientTasksView />
  </div>
)}

            {activeTab === "checklists" && (
              <ClientChecklistsView
                createSignal={
                  checklistCreateSignal
                }
              />
            )}

            {activeTab === "recurring" && (
              <ClientRecurringView />
            )}

            {activeTab === "completed" && (
              <ClientCompletedView />
            )}
          </div>
        </section>
      </div>
    </ClientWorkspaceShell>
  );
}