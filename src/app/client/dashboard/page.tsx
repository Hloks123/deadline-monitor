"use client";

import Link from "next/link";
import ClientWorkspaceShell from "@/components/client/ClientWorkspaceShell";
import useClientWorkspaceData from "@/components/client/useClientWorkspaceData";
import { ClientTaskOccurrence } from "@/lib/clientWorkspace";
import { calculateStatus, daysUntil } from "@/lib/recordStore";

function localDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function endOfWeek(date = new Date()) {
  return localDate(new Date(date.getFullYear(), date.getMonth(), date.getDate() + 6 - ((date.getDay() + 6) % 7)));
}

function isOpen(status: string) {
  return !["completed", "skipped", "cancelled", "Completed", "Skipped", "Carry Forward"].includes(status);
}

type ScheduleRow = {
  key: string;
  time: string;
  task: string;
  responsible: string;
  related: string;
  priority: string;
  status: string;
  href: string;
};

function occurrenceTime(item: ClientTaskOccurrence) {
  return item.dueAt.includes("T") ? item.dueAt.slice(11, 16) : "—";
}

export default function ClientDashboardPage() {
  const { organisation, records, tasks, occurrences, workspaceState } = useClientWorkspaceData();
  const today = localDate();
  const weekEnd = endOfWeek();
  const monthEnd = localDate(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0));
  const taskMap = new Map(tasks.map((task) => [task.id, task]));
  const recordMap = new Map(records.map((record) => [record.id, record]));
  const trackerMap = new Map(workspaceState.trackers.map((tracker) => [tracker.id, tracker]));
  const personMap = new Map(workspaceState.people.map((person) => [person.id, person.name]));

  const expiredRecords = records.filter((record) => calculateStatus(record) === "Expired");
  const overdueOccurrences = occurrences.filter((item) => item.status === "overdue" || (item.scheduledFor < today && isOpen(item.status)));
  const overdueChecklist = workspaceState.items.filter((item) => item.targetDate < today && isOpen(item.status));
  const blockedItems = workspaceState.items.filter((item) => item.status === "Blocked");
  const awaitingRecords = records.filter((record) => ["Awaiting confirmation", "Awaiting client"].includes(calculateStatus(record)));

  const schedule: ScheduleRow[] = [
    ...occurrences.filter((item) => item.scheduledFor === today).map((item) => {
      const task = taskMap.get(item.recurringTaskId);
      const record = task?.linkedRecordId ? recordMap.get(task.linkedRecordId) : undefined;
      return {
        key: `occurrence-${item.id}`,
        time: occurrenceTime(item),
        task: task?.name || "Client task",
        responsible: task ? personMap.get(task.ownerId) || task.ownerId || "Unassigned" : "Unassigned",
        related: record?.name || "Recurring task",
        priority: task?.priority || "Medium",
        status: item.status === "completed" ? "Completed" : item.status === "in_progress" ? "In Progress"
          : ["overdue", "failed", "skipped", "cancelled"].includes(item.status) ? item.status.replaceAll("_", " ")
          : "Due today",
        href: "/client/tasks",
      };
    }),
    ...workspaceState.items.filter((item) => item.targetDate === today).map((item) => ({
      key: `checklist-${item.id}`,
      time: item.targetTime || "—",
      task: item.task,
      responsible: item.responsiblePersonName || "Unassigned",
      related: trackerMap.get(item.trackerId)?.name || "Work tracker",
      priority: item.priority,
      status: ["Completed", "In Progress", "Blocked", "Awaiting Confirmation", "Overdue"].includes(item.status) ? item.status : "Due today",
      href: "/client/work-tracker",
    })),
    ...records.filter((record) => record.followUp === today || record.expiryDate === today).map((record) => ({
      key: `record-${record.id}`,
      time: "—",
      task: record.nextAction || (record.expiryDate === today ? "Record expires today" : "Record follow-up"),
      responsible: record.contact || "Unassigned",
      related: record.name,
      priority: record.risk,
      status: ["Awaiting confirmation", "Awaiting client", "Expired", "Paused"].includes(calculateStatus(record)) ? calculateStatus(record) : "Due today",
      href: `/client/records/${record.id}`,
    })),
  ].sort((a, b) => a.time.localeCompare(b.time));

  const dueOccurrences = occurrences.filter((item) => item.scheduledFor >= today && isOpen(item.status));
  const dueChecklist = workspaceState.items.filter((item) => isOpen(item.status));
  const countExpiring = (days: number) => records.filter((record) => {
    const remaining = daysUntil(record.expiryDate);
    return remaining >= 0 && remaining <= days;
  }).length;

  const attention = [
    { label: "Expired records", value: expiredRecords.length, href: "/client/records?filter=expired", color: "text-red-700", tone: "border-red-200 bg-red-50" },
    { label: "Overdue tasks", value: overdueOccurrences.length + overdueChecklist.length, href: "/client/tasks?filter=overdue", color: "text-red-700", tone: "border-red-200 bg-red-50" },
    { label: "Blocked work", value: blockedItems.length, href: "/client/tasks?filter=blocked", color: "text-amber-800", tone: "border-amber-200 bg-amber-50" },
    { label: "Awaiting confirmation", value: awaitingRecords.length, href: "/client/records?filter=awaiting", color: "text-violet-800", tone: "border-violet-200 bg-violet-50" },
  ];
  const comingUp = [
    { label: "Records expiring in 7 days", value: countExpiring(7), href: "/client/records?filter=due-week", color: "text-orange-800" },
    { label: "Records expiring in 30 days", value: countExpiring(30), href: "/client/records?filter=due-month", color: "text-amber-800" },
    { label: "Records expiring in 60 days", value: countExpiring(60), href: "/client/records", color: "text-yellow-800" },
    { label: "Records expiring in 90 days", value: countExpiring(90), href: "/client/records", color: "text-yellow-800" },
    { label: "Tasks due this week", value: dueOccurrences.filter((item) => item.scheduledFor <= weekEnd).length + dueChecklist.filter((item) => item.targetDate >= today && item.targetDate <= weekEnd).length, href: "/client/tasks?filter=due-week", color: "text-blue-800" },
    { label: "Tasks due this month", value: dueOccurrences.filter((item) => item.scheduledFor <= monthEnd).length + dueChecklist.filter((item) => item.targetDate >= today && item.targetDate <= monthEnd).length, href: "/client/tasks?filter=due-month", color: "text-blue-800" },
  ];

  return (
    <ClientWorkspaceShell title="Overview">
      <div className="space-y-6 p-4 sm:p-6 lg:p-8">
        <section>
          <h2 className="text-xl font-bold text-slate-950">{organisation?.company || "Your organisation"}</h2>
          <p className="mt-1 text-sm text-slate-600">Your work, deadlines and monitored records at a glance.</p>
        </section>

        <section aria-labelledby="needs-attention" className="space-y-3">
          <h2 id="needs-attention" className="text-lg font-bold text-slate-950">Needs attention</h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {attention.map((item) => (
              <Link key={item.label} href={item.href} className={`cursor-pointer rounded-xl border p-4 transition hover:shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 ${item.tone}`}>
                <span className="block text-sm font-semibold text-slate-700">{item.label}</span>
                <span className={`mt-1 block text-2xl font-bold ${item.color}`}>{item.value}</span>
              </Link>
            ))}
          </div>
        </section>

        <section aria-labelledby="today-overview" className="space-y-3">
          <div className="flex items-end justify-between gap-3">
            <div><h2 id="today-overview" className="text-lg font-bold text-slate-950">Today</h2><p className="text-sm text-slate-600">Tasks, record actions and confirmations due today.</p></div>
            <Link href="/client/reports" className="shrink-0 text-sm font-semibold text-teal-800 underline">View reports</Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4"><span className="text-sm font-semibold text-slate-700">Tasks due today</span><strong className="mt-1 block text-2xl text-blue-800">{schedule.filter((item) => !item.key.startsWith("record-") && !["Completed", "completed", "Skipped", "skipped", "Cancelled", "cancelled"].includes(item.status)).length}</strong></div>
            <div className="rounded-xl border border-orange-200 bg-orange-50 p-4"><span className="text-sm font-semibold text-slate-700">Record actions due today</span><strong className="mt-1 block text-2xl text-orange-800">{schedule.filter((item) => item.key.startsWith("record-")).length}</strong></div>
            <div className="rounded-xl border border-violet-200 bg-violet-50 p-4"><span className="text-sm font-semibold text-slate-700">Confirmations due today</span><strong className="mt-1 block text-2xl text-violet-800">{records.filter((record) => record.followUp === today && ["Awaiting confirmation", "Awaiting client"].includes(calculateStatus(record))).length}</strong></div>
          </div>
        </section>

        <section aria-labelledby="coming-up" className="space-y-3">
          <h2 id="coming-up" className="text-lg font-bold text-slate-950">Coming up</h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {comingUp.map((item) => (
              <Link key={item.label} href={item.href} className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-teal-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600">
                <span className="text-sm font-semibold text-slate-700">{item.label}</span><strong className={`text-xl ${item.color}`}>{item.value}</strong>
              </Link>
            ))}
          </div>
        </section>

        <section aria-labelledby="todays-schedule" className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-1 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div><h2 id="todays-schedule" className="text-lg font-bold text-slate-950">Today&apos;s Schedule</h2><p className="text-sm text-slate-600">Compact view of today&apos;s client-visible work.</p></div>
            <Link href="/client/reports" className="text-sm font-semibold text-teal-800 underline">Download today&apos;s report</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600"><tr>{["Time", "Task / action", "Responsible person", "Related record / tracker", "Priority", "Status"].map((heading) => <th key={heading} scope="col" className="px-4 py-3 font-bold">{heading}</th>)}</tr></thead>
              <tbody className="divide-y divide-slate-100">
                {schedule.map((item) => <tr key={item.key} className="hover:bg-slate-50">
                  <td className="whitespace-nowrap px-4 py-3 text-slate-700">{item.time}</td><td className="px-4 py-3"><Link href={item.href} className="font-semibold text-slate-950 underline decoration-transparent hover:decoration-current">{item.task}</Link></td><td className="px-4 py-3 text-slate-700">{item.responsible}</td><td className="px-4 py-3 text-slate-700">{item.related}</td><td className="px-4 py-3 text-slate-700">{item.priority}</td><td className="px-4 py-3"><span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${item.status.toLowerCase().includes("overdue") || item.status.toLowerCase().includes("expired") ? "border-red-200 bg-red-50 text-red-800" : item.status.toLowerCase().includes("complete") ? "border-emerald-200 bg-emerald-50 text-emerald-800" : item.status.toLowerCase().includes("awaiting") ? "border-violet-200 bg-violet-50 text-violet-800" : "border-blue-200 bg-blue-50 text-blue-800"}`}>{item.status}</span></td>
                </tr>)}
                {schedule.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">Nothing is scheduled for today.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
        <p className="rounded-xl border border-slate-200 bg-slate-100 p-4 text-sm text-slate-700">Prototype preview only. No documents are stored and client notifications are not sent automatically.</p>
      </div>
    </ClientWorkspaceShell>
  );
}
