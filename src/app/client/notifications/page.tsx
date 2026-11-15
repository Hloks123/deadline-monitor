"use client";

import { useMemo, useState } from "react";
import ClientWorkspaceShell from "@/components/client/ClientWorkspaceShell";
import useClientWorkspaceData from "@/components/client/useClientWorkspaceData";
import { CLIENT_WORKSPACE_ORGANISATION_ID } from "@/lib/clientWorkspaceConstants";

function getReadNotificationsKey() {
  return `docmon_client_read_notifications_${CLIENT_WORKSPACE_ORGANISATION_ID}_v1`;
}

const filters = [
  ["all", "All"],
  ["unread", "Unread"],
  ["record", "Records"],
  ["task", "Tasks"],
] as const;

function getReadNotificationIds() {
  if (typeof window === "undefined") return [];
  const stored = window.localStorage.getItem(getReadNotificationsKey());
  if (!stored) return [];
  try {
    const parsed: unknown = JSON.parse(stored);
    if (Array.isArray(parsed) && parsed.every((id) => typeof id === "string")) return parsed;
    console.error("Could not read notification read-state; stored value has an invalid shape.");
  } catch (error) {
    console.error("Could not read notification read-state.", error);
  }
  return [];
}

export default function ClientNotificationsPage() {
  const { notifications } = useClientWorkspaceData();
  const [filter, setFilter] = useState<(typeof filters)[number][0]>("all");
  const [readIds, setReadIds] = useState<string[]>(getReadNotificationIds);

  const visible = useMemo(() => notifications.filter((item) => {
    if (filter === "unread") return !readIds.includes(item.id);
    if (filter === "record") return item.kind === "Record";
    if (filter === "task") return item.kind === "Task";
    return true;
  }), [notifications, filter, readIds]);

  function markRead(id: string) {
    const updated = [...new Set([...readIds, id])];
    window.localStorage.setItem(getReadNotificationsKey(), JSON.stringify(updated));
    setReadIds(updated);
  }

  return (
    <ClientWorkspaceShell title="Notifications">
      <div className="space-y-5 p-4 sm:p-6 lg:p-8">
        <div>
          <h2 className="text-xl font-bold text-slate-950">Released notifications</h2>
          <p className="mt-1 text-sm text-slate-600">Only approved notifications marked sent or delivered are shown. Consultant drafts and suppressed items are excluded.</p>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Filter notifications">
          {filters.map(([value, label]) => <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)} className={`min-h-[40px] shrink-0 cursor-pointer rounded-full border px-4 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 ${filter === value ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"}`}>{label}{value === "unread" ? ` (${notifications.filter((item) => !readIds.includes(item.id)).length})` : ""}</button>)}
        </div>
        <section aria-label="Released notifications" className="space-y-3">
          {visible.map((item) => {
            const isRead = readIds.includes(item.id);
            return (
              <article key={item.id} className={`rounded-xl border-l-4 p-4 shadow-sm ${isRead ? "border-slate-300 bg-white" : "border-blue-600 bg-blue-50/60"}`}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold text-slate-950">{item.subject}</h3>
                      <span className={`rounded-full border px-2 py-0.5 text-xs font-bold ${isRead ? "border-slate-200 bg-slate-100 text-slate-700" : "border-blue-200 bg-blue-100 text-blue-900"}`}>{isRead ? "Read" : "Unread"}</span>
                      <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs font-semibold text-slate-700">{item.kind}</span>
                    </div>
                    <p className="text-sm text-slate-700">Related {item.kind.toLowerCase()}: <strong>{item.related}</strong></p>
                    <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-600">
                      <span>Sent / delivered: {item.date}</span>
                      {item.relevantDate && <span>Relevant due / expiry date: {item.relevantDate}</span>}
                      {item.daysRemaining !== undefined && <span className={item.daysRemaining < 0 ? "font-semibold text-red-800" : item.daysRemaining <= 7 ? "font-semibold text-orange-800" : "font-semibold text-slate-700"}>{item.daysRemaining < 0 ? `Expired ${Math.abs(item.daysRemaining)} days ago` : item.daysRemaining === 0 ? "Due today" : `${item.daysRemaining} days remaining`}</span>}
                      <span>Delivery: <strong className="text-emerald-800">{item.deliveryStatus}</strong></span>
                    </div>
                  </div>
                  {!isRead && <button type="button" onClick={() => markRead(item.id)} className="min-h-[40px] shrink-0 cursor-pointer rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600">Mark as read</button>}
                </div>
              </article>
            );
          })}
          {visible.length === 0 && <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">{filter === "unread" ? "You are all caught up." : "No released notifications match this filter."}</p>}
        </section>
        <p className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">Prototype notification history only. No client email is sent automatically.</p>
      </div>
    </ClientWorkspaceShell>
  );
}
