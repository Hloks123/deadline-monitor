"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import ClientWorkspaceShell from "@/components/client/ClientWorkspaceShell";
import useClientWorkspaceData from "@/components/client/useClientWorkspaceData";
import { calculateStatus } from "@/lib/recordStore";

export default function ClientRecordDetailPage() {
  const params = useParams<{ id: string }>();
  const { records, organisation, ready } = useClientWorkspaceData();
  const record = records.find((item) => item.id === String(params.id));
  return (
    <ClientWorkspaceShell title={record?.name || "Record details"} actions={<Link href="/client/records" className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">Back to records</Link>}>
      {!ready ? (
        <p role="status" className="p-8 text-slate-600">Loading record...</p>
      ) : !record ? (
        <div className="p-8"><h2 className="text-xl font-bold text-slate-950">Record unavailable</h2><p className="mt-2 text-slate-600">This record is not available in the client workspace.</p><Link href="/client/records" className="mt-4 inline-block font-semibold text-teal-700">Return to My Records</Link></div>
      ) : (
        <div className="space-y-6 p-4 sm:p-6 lg:p-8">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            <h2 className="text-xl font-bold text-slate-950">Approved record information</h2>
            <dl className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[
                ["Organisation", organisation?.company || record.organisation],
                ["Record type", record.category2],
                ["Category", record.category],
                ["Issue date", record.issueDate || "Not provided"],
                ["Expiry date", record.expiryDate || "Not provided"],
                ["Status", calculateStatus(record)],
                ["Risk", record.risk],
                ["Responsible contact", record.contact || "Not specified"],
                ["Reference number", record.referenceNumber || "Not provided"],
                ["Next follow-up", record.followUp || "Not scheduled"],
                ["Next action", record.nextAction || "Not specified"],
                ["Last confirmed", record.lastConfirmed || "Not confirmed"],
              ].map(([label, value]) => <div key={label}><dt className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</dt><dd className="mt-1 break-words font-semibold text-slate-900">{value}</dd></div>)}
            </dl>
          </section>
          <p className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">Company monitored records are shared read-only with active employees. Contact the Senior Manager to request a correction.</p>
        </div>
      )}
    </ClientWorkspaceShell>
  );
}
