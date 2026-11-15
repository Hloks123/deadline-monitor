"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import WorkspaceShell from "@/components/workspace/WorkspaceShell";
import AssistantWorkspaceImportPanel from "@/components/settings/AssistantWorkspaceImportPanel";
import { Client, ClientStatus } from "@/lib/clientStore";
import { getRecords, MonitoredRecord } from "@/lib/recordStore";
import { getRecurringTasks } from "@/lib/recurringTasks/taskStore";
import { RecurringTask } from "@/lib/recurringTasks/types";
import {
  ManagedOrganisation,
  mergeManagedOrganisations,
} from "@/lib/admin/organisations";

function nextAction(records: MonitoredRecord[]) {
  const pending = records
    .filter((record) => record.status !== "Completed")
    .map((record) => record.followUp || record.expiryDate)
    .filter(Boolean)
    .sort();
  return pending[0] || "";
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [records, setRecords] = useState<MonitoredRecord[]>([]);
  const [tasks, setTasks] = useState<RecurringTask[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | ClientStatus>("All");
  const [directoryError, setDirectoryError] = useState("");

  function load() {
    setRecords(Object.values(getRecords()));
    setTasks(getRecurringTasks());
  }

  async function loadCanonicalOrganisations() {
    try {
      const response = await fetch("/api/admin/organisations?includeInactive=true", { cache: "no-store" });
      const result = (await response.json()) as {
        error?: string;
        organisations?: ManagedOrganisation[];
      };
      if (!response.ok) {
        setDirectoryError(result.error || "Client organisations could not be loaded.");
        return;
      }
      setDirectoryError("");
      setClients(mergeManagedOrganisations([], result.organisations ?? []));
    } catch {
      setDirectoryError("Client organisations could not be loaded. Check your connection and try again.");
    }
  }

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      load();
      void loadCanonicalOrganisations();
    });
    const reload = () => {
      load();
      void loadCanonicalOrganisations();
    };
    window.addEventListener("deadline-monitor-updated", reload);
    window.addEventListener("deadline-monitor-clients-updated", reload);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("deadline-monitor-updated", reload);
      window.removeEventListener("deadline-monitor-clients-updated", reload);
    };
  }, []);

  const summaries = useMemo(() => clients.map((client) => {
    const clientRecords = records.filter((record) => record.organisationId === client.id || record.organisation === client.company);
    const clientTasks = tasks.filter((task) => task.organisationId === client.id);
    const primary = client.contacts.find((contact) => contact.primary) || client.contacts[0];
    return {
      client,
      primary,
      records: clientRecords.length,
      tasks: clientTasks.length,
      nextAction: nextAction(clientRecords),
    };
  }), [clients, records, tasks]);

  const filtered = summaries.filter(({ client, primary }) => {
    const searchable = `${client.company} ${primary?.name || ""} ${primary?.email || ""} ${primary?.phone || ""}`.toLowerCase();
    return searchable.includes(search.toLowerCase()) && (statusFilter === "All" || client.status === statusFilter);
  });

  return (
    <WorkspaceShell eyebrow="Client Management" title="Clients" actions={<Link href="/clients/new" className="inline-flex min-h-[44px] items-center rounded-xl bg-teal-600 px-5 font-semibold text-white hover:bg-teal-700">+ Add Client</Link>}>
      <div className="space-y-6 p-5 lg:p-7">
        <AssistantWorkspaceImportPanel />
        {directoryError && <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{directoryError} The client directory could not be verified.</p>}
        <section className="grid gap-4 sm:grid-cols-3">
          {[["Total Clients", clients.length, "text-slate-950"], ["Active Clients", clients.filter((client) => client.status === "Active").length, "text-emerald-700"], ["Pilot Clients", clients.filter((client) => client.status === "Pilot").length, "text-amber-700"]].map(([label, value, colour]) => <div key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm font-semibold text-slate-500">{label}</p><p className={`mt-2 text-3xl font-bold ${colour}`}>{value}</p></div>)}
        </section>
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-200 p-5 md:flex-row">
            <label className="flex-1"><span className="sr-only">Search clients</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search organisation, contact, email or telephone" className="min-h-[44px] w-full rounded-xl border border-slate-300 px-4" /></label>
            <label><span className="sr-only">Filter by service status</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "All" | ClientStatus)} className="min-h-[44px] rounded-xl border border-slate-300 bg-white px-4"><option value="All">All statuses</option><option>Active</option><option>Pilot</option><option>Suspended</option></select></label>
          </div>
          <div className="hidden overflow-x-auto lg:block">
            <table className="dm-data-table w-full min-w-[980px] text-left">
              <thead className="bg-slate-50 text-xs uppercase text-slate-600"><tr>{["Organisation", "Authorised contact", "Package", "Status", "Records", "Tasks", "Next action", ""].map((heading) => <th key={heading} className="p-4">{heading}</th>)}</tr></thead>
              <tbody className="divide-y divide-slate-200">{filtered.map(({ client, primary, records: recordCount, tasks: taskCount, nextAction: action }) => {
                const canonicalOnly = client.canonicalOrganisationId === client.id;
                const viewHref = canonicalOnly
                  ? `/clients/new?organisationId=${client.canonicalOrganisationId}`
                  : `/clients/${client.id}`;
                return <tr key={client.id}>
                <td className="p-4 font-semibold text-slate-900">{client.company}</td><td className="p-4"><p>{primary?.name || "No authorised contact"}</p><p className="text-sm text-slate-500">{primary?.email || "—"}{primary?.phone ? ` · ${primary.phone}` : ""}</p></td><td className="p-4">{client.servicePackage}</td><td className="p-4">{client.status}</td><td className="p-4">{recordCount}</td><td className="p-4">{taskCount}</td><td className="p-4">{action || "No pending action"}</td><td className="p-4"><div className="flex gap-3"><Link className="font-semibold text-teal-700" href={viewHref}>{canonicalOnly ? "Manage" : "View"}</Link>{client.canonicalOrganisationId && !canonicalOnly && <Link className="font-semibold text-teal-700" href={`/clients/new?organisationId=${client.canonicalOrganisationId}&legacy=true`}>Edit</Link>}</div></td>
              </tr>;
              })}
              </tbody>
            </table>
          </div>
          <div className="divide-y divide-slate-200 lg:hidden">{filtered.map(({ client, primary, records: recordCount, tasks: taskCount, nextAction: action }) => {
            const canonicalOnly = client.canonicalOrganisationId === client.id;
            const viewHref = canonicalOnly
              ? `/clients/new?organisationId=${client.canonicalOrganisationId}`
              : `/clients/${client.id}`;
            return <article key={client.id} className="space-y-3 p-5"><div><h2 className="font-bold text-slate-900">{client.company}</h2><p className="mt-1 text-sm text-slate-600">{primary?.name || "No authorised contact"} · {primary?.email || "No email"}{primary?.phone ? ` · ${primary.phone}` : ""}</p></div><div className="flex flex-wrap gap-2 text-sm"><span className="rounded-full bg-slate-100 px-3 py-1">{client.servicePackage}</span><span className="rounded-full bg-slate-100 px-3 py-1">{client.status}</span><span className="rounded-full bg-slate-100 px-3 py-1">{recordCount} records</span><span className="rounded-full bg-slate-100 px-3 py-1">{taskCount} tasks</span></div><p className="text-sm text-slate-600">Next action: {action || "No pending action"}</p><div className="flex gap-3"><Link className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-xl bg-slate-950 font-semibold text-white" href={viewHref}>{canonicalOnly ? "Manage Organisation" : "View Client"}</Link>{client.canonicalOrganisationId && !canonicalOnly && <Link className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-xl border border-teal-700 font-semibold text-teal-800" href={`/clients/new?organisationId=${client.canonicalOrganisationId}&legacy=true`}>Edit Organisation</Link>}</div></article>;
          })}</div>
          {filtered.length === 0 && <p className="p-10 text-center text-slate-500">{clients.length ? "No clients match your filters." : "No clients yet."}</p>}
        </section>
      </div>
    </WorkspaceShell>
  );
}
