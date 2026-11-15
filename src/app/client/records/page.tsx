"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import ClientWorkspaceShell from "@/components/client/ClientWorkspaceShell";
import useClientWorkspaceData from "@/components/client/useClientWorkspaceData";
import { calculateStatus, daysUntil } from "@/lib/recordStore";

function ClientRecordsContent() {
  const params = useSearchParams();
  const initialFilter = params.get("filter");
  const { records } = useClientWorkspaceData();
  const [search, setSearch] = useState("");
  const [quickFilter, setQuickFilter] = useState(() => {
    if (initialFilter === "expired") return "expired";
    if (initialFilter === "due-week") return "7";
    if (initialFilter === "due-month") return "30";
    return "all";
  });
  const [deepLinkFilter, setDeepLinkFilter] = useState(initialFilter);

  const quickFilters = [
    ["all", "All"],
    ["current", "Current"],
    ["7", "Expiring in 7 days"],
    ["30", "Expiring in 30 days"],
    ["60", "Expiring in 60 days"],
    ["90", "Expiring in 90 days"],
    ["expired", "Expired"],
  ];

  const visible = useMemo(() => records.filter((record) => {
    const status = calculateStatus(record);
    const daysToExpiry = daysUntil(record.expiryDate);
    const matchesQuickFilter = quickFilter === "expired" ? status === "Expired"
      : quickFilter === "current" ? status === "Current"
      : quickFilter === "all" ? true
      : daysToExpiry >= 0 && daysToExpiry <= Number(quickFilter);
    const matchesDeepLink = !["awaiting", "attention", "due-soon"].includes(deepLinkFilter || "") ||
      (deepLinkFilter === "awaiting" ? status === "Awaiting client" || status === "Awaiting confirmation"
        : deepLinkFilter === "due-soon" ? status === "Due soon"
        : status === "Expired" || status === "Due soon" || status === "Awaiting client" || status === "Awaiting confirmation" || daysUntil(record.followUp) <= 0);
    return matchesQuickFilter && matchesDeepLink && `${record.name} ${record.referenceNumber || ""} ${record.category} ${record.category2} ${record.nextAction || ""}`.toLowerCase().includes(search.trim().toLowerCase());
  }), [records, deepLinkFilter, quickFilter, search]);

  return (
    <ClientWorkspaceShell title="My Records">
      <div className="space-y-5 p-4 sm:p-6 lg:p-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div><h2 className="text-xl font-bold text-slate-950">Monitored records</h2><p className="mt-1 text-sm text-slate-600">Approved metadata for your organisation only.</p></div>
          <label className="sm:w-80"><span className="sr-only">Search company records</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search records" className="min-h-[44px] w-full cursor-text rounded-xl border border-slate-300 px-4" /></label>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Filter records">
          {quickFilters.map(([value, label]) => <button key={value} type="button" aria-pressed={quickFilter === value} onClick={() => { setQuickFilter(value); setDeepLinkFilter(null); }} className={`min-h-[40px] shrink-0 rounded-full border px-4 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 ${quickFilter === value ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"}`}>{label}</button>)}
        </div>
        <section aria-label="My monitored records" className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="hidden grid-cols-[2fr_1fr_1fr_1.2fr_1fr_1fr_1.5fr] gap-3 border-b border-slate-200 bg-slate-50 px-5 py-3 text-xs font-bold uppercase tracking-wide text-slate-500 lg:grid">
            <span>Record</span><span>Category</span><span>Expiry</span><span>Days remaining</span><span>Status</span><span>Risk</span><span>Next action</span>
          </div>
          <div className="divide-y divide-slate-200">
            {visible.map((record) => {
              const status = calculateStatus(record);
              const daysRemaining = daysUntil(record.expiryDate);
              const statusClass = status === "Expired" ? "border-red-200 bg-red-50 text-red-800"
                : status === "Current" ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : status === "Awaiting confirmation" || status === "Awaiting client" ? "border-violet-200 bg-violet-50 text-violet-800"
                : status === "Paused" ? "border-slate-200 bg-slate-100 text-slate-700"
                : "border-amber-200 bg-amber-50 text-amber-900";
              const daysLabel = daysRemaining === Number.POSITIVE_INFINITY ? "Not set"
                : daysRemaining < 0 ? `Expired ${Math.abs(daysRemaining)} ${Math.abs(daysRemaining) === 1 ? "day" : "days"} ago`
                : daysRemaining === 0 ? "Due today"
                : `${daysRemaining} days remaining`;
              const nextAction = status === "Awaiting client" ? "Confirm replacement date"
                : status === "Expired" ? "Provide replacement expiry"
                : status === "Due soon" ? "Review upcoming expiry"
                : record.followUp ? `Follow-up ${record.followUp}` : "No action due";
              return (
                <Link key={record.id} href={`/client/records/${record.id}`} className="grid cursor-pointer gap-2 p-4 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-teal-600 lg:grid-cols-[2fr_1fr_1fr_1.2fr_1fr_1fr_1.5fr] lg:items-center lg:gap-3 lg:px-5">
                  <span><span className="block text-xs font-semibold uppercase text-slate-500 lg:hidden">Record</span><span className="font-semibold text-slate-950">{record.name}</span></span>
                  <span className="text-sm text-slate-700"><span className="mr-2 text-xs font-semibold uppercase text-slate-500 lg:hidden">Category · </span>{record.category} · {record.category2}</span>
                  <span className="text-sm text-slate-700"><span className="mr-2 text-xs font-semibold uppercase text-slate-500 lg:hidden">Expiry · </span>{record.expiryDate || "Not set"}</span>
                  <span className={`w-fit rounded-full border px-2.5 py-1 text-xs font-bold ${!Number.isFinite(daysRemaining) ? "border-slate-200 bg-slate-100 text-slate-700" : daysRemaining < 0 ? "border-red-200 bg-red-50 text-red-800" : daysRemaining <= 7 ? "border-orange-200 bg-orange-50 text-orange-900" : daysRemaining <= 30 ? "border-amber-200 bg-amber-50 text-amber-900" : daysRemaining <= 90 ? "border-yellow-200 bg-yellow-50 text-yellow-900" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}><span className="mr-2 text-xs font-semibold uppercase text-slate-500 lg:hidden">Days remaining · </span>{daysLabel}</span>
                  <span className={`w-fit rounded-full border px-2.5 py-1 text-xs font-bold ${statusClass}`}><span className="mr-2 text-xs font-semibold uppercase lg:hidden">Status · </span>{status}</span>
                  <span className="text-sm text-slate-700"><span className="mr-2 text-xs font-semibold uppercase text-slate-500 lg:hidden">Risk · </span>{record.risk}</span>
                  <span className="text-sm text-teal-800"><span className="mr-2 text-xs font-semibold uppercase text-slate-500 lg:hidden">Next action · </span>{nextAction}</span>
                </Link>
              );
            })}
            {visible.length === 0 && <p className="p-8 text-center text-slate-500">{records.length === 0 ? "No records are available for this organisation." : "No records match this filter or search."}</p>}
          </div>
        </section>
      </div>
    </ClientWorkspaceShell>
  );
}

export default function ClientRecordsPage() {
  return <Suspense fallback={<p role="status" className="p-8 text-slate-600">Loading records...</p>}><ClientRecordsContent /></Suspense>;
}
