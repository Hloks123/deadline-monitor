"use client";

import Link from "next/link";

import {
  useEffect,
  useState,
} from "react";

import {
  useParams,
} from "next/navigation";

import WorkspaceShell from "@/components/workspace/WorkspaceShell";

import {
  calculateEscalation,
  calculateStatus,
  daysUntil,
  MonitoredRecord,
} from "@/lib/recordStore";
import { clientBusinessToday } from "@/lib/clientWorkspaceSelectors";
import {
  findAccessibleMonitoredRecord,
  httpMonitoredRecordRepository,
  type MonitoredRecordEntity,
} from "@/lib/monitoredRecords/repository";

function displayDate(
  value: string
) {
  if (!value) {
    return "Not set";
  }

  const date =
    new Date(
      `${value}T00:00:00`
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return value;
  }

  return date.toLocaleDateString(
    "en-ZA",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }
  );
}

function Detail({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <dt className="text-sm font-semibold text-slate-500">
        {label}
      </dt>

      <dd className="mt-1.5 font-medium text-slate-900">
        {value || "Not set"}
      </dd>
    </div>
  );
}

export default function RecordDetailPage() {
  const params =
    useParams();

  const id =
    String(params.id);

  const [
    record,
    setRecord,
  ] =
    useState<MonitoredRecordEntity | null>(
      null
    );

  const [
    loading,
    setLoading,
  ] =
    useState(true);
  const [replacementExpiry, setReplacementExpiry] = useState("");
  const [replacementConfirmedBy, setReplacementConfirmedBy] = useState("");
  const [confirmationMethod, setConfirmationMethod] = useState("Email");
  const [replacementError, setReplacementError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [savingReplacement, setSavingReplacement] = useState(false);

  useEffect(() => {
    let active = true;
    const frame = window.requestAnimationFrame(() => {
      setLoading(true);
      setLoadError("");
      void findAccessibleMonitoredRecord(id)
        .then((saved) => {
          if (active) setRecord(saved);
        })
        .catch((cause: unknown) => {
          if (active) {
            setLoadError(cause instanceof Error ? cause.message : "The record could not be loaded.");
          }
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    });
    return () => {
      active = false;
      window.cancelAnimationFrame(frame);
    };
  }, [id]);

  async function confirmReplacement(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!record || !replacementExpiry || !replacementConfirmedBy.trim()) {
      setReplacementError("Enter the replacement expiry date and who confirmed it.");
      return;
    }
    const today = clientBusinessToday();
    if (replacementExpiry <= today) {
      setReplacementError("The replacement expiry date must be in the future.");
      return;
    }
    if (replacementExpiry <= record.expiryDate) {
      setReplacementError("The replacement expiry date must be later than the current expiry date.");
      return;
    }
    setSavingReplacement(true);
    setReplacementError("");
    const nextFollowUpDate = new Date(`${replacementExpiry}T00:00:00.000Z`);
    const reminderLeadDays = Math.max(0, ...record.reminderDays);
    nextFollowUpDate.setUTCDate(nextFollowUpDate.getUTCDate() - reminderLeadDays);
    const nextFollowUp = nextFollowUpDate.toISOString().slice(0, 10);
    const baseRecord: MonitoredRecord = {
      ...record,
      issueDate: today,
      expiryDate: replacementExpiry,
      status: "Current",
      followUp: nextFollowUp < today
        ? today
        : nextFollowUp,
      lastConfirmed: today,
      confirmedBy: replacementConfirmedBy.trim(),
      confirmationMethod,
    };
    const updated: MonitoredRecord = {
      ...baseRecord,
      status: calculateStatus(baseRecord),
      escalationLevel: calculateEscalation(baseRecord),
    };
    try {
      const saved = await httpMonitoredRecordRepository.update(
        record.organisationId,
        record.id,
        record.version,
        {
          issueDate: updated.issueDate,
          expiryDate: updated.expiryDate,
          status: updated.status,
          escalationLevel: updated.escalationLevel,
          followUp: updated.followUp,
          lastConfirmed: updated.lastConfirmed,
          confirmedBy: updated.confirmedBy,
          confirmationMethod: updated.confirmationMethod,
        },
      );
      setRecord(saved);
      setReplacementExpiry("");
      setReplacementConfirmedBy("");
    } catch (cause: unknown) {
      setReplacementError(
        cause instanceof Error ? cause.message : "The replacement date could not be saved.",
      );
    } finally {
      setSavingReplacement(false);
    }
  }

  if (loading) {
    return (
      <WorkspaceShell
        eyebrow="Document Monitoring"
        title="Monitored Record"
      >
        <div className="p-8">
          Loading record...
        </div>
      </WorkspaceShell>
    );
  }

  if (loadError || !record) {
    return (
      <WorkspaceShell
        eyebrow="Document Monitoring"
        title={loadError ? "Record Unavailable" : "Record Not Found"}
      >
        <div className="p-8">
          {loadError && <p role="alert" className="mb-4 text-red-700">{loadError}</p>}
          <Link
            href="/monitored-records"
            className="font-semibold text-teal-700 hover:text-teal-900"
          >
            ← Back to Monitored Records
          </Link>
        </div>
      </WorkspaceShell>
    );
  }

  const remaining =
    daysUntil(
      record.expiryDate
    );

  return (
    <WorkspaceShell
      eyebrow="Document Monitoring"
      title={record.name}
      actions={
        <Link
          href={`/monitored-records/${record.id}/edit`}
          className="inline-flex min-h-[44px] items-center rounded-xl bg-teal-600 px-6 font-semibold text-white transition hover:bg-teal-700"
        >
          Edit Record
        </Link>
      }
    >
      <div className="space-y-6 p-5 lg:p-7">

        {/* STATUS */}

        <section className="flex flex-wrap gap-3">

          <span className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
            {record.status}
          </span>

          <span className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
            {record.risk} Risk
          </span>

          {record.escalationLevel !==
            "Normal" && (
            <span className="rounded-full bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-700">
              {record.escalationLevel}
            </span>
          )}

        </section>

        {/* RECORD INFORMATION */}

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

          <div className="border-b border-slate-200 p-6">

            <h2 className="text-xl font-bold text-slate-950">
              Record Details
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Approved monitoring metadata for this record.
            </p>

          </div>

          <dl className="grid gap-7 p-6 sm:grid-cols-2 xl:grid-cols-3">

            <Detail
              label="Document Name"
              value={record.name}
            />

            <Detail
              label="Organisation"
              value={record.organisation}
            />

            <Detail
              label="Category 1"
              value={record.category}
            />

            <Detail
              label="Category 2"
              value={record.category2}
            />

            <Detail
              label="Issue Date"
              value={displayDate(
                record.issueDate
              )}
            />

            <Detail
              label="Expiry Date"
              value={displayDate(
                record.expiryDate
              )}
            />

            <Detail
              label="Expiry Position"
              value={
                remaining < 0
                  ? `${Math.abs(
                      remaining
                    )} days overdue`
                  : remaining === 0
                    ? "Due today"
                    : `${remaining} days remaining`
              }
            />

            <Detail
              label="Status"
              value={record.status}
            />

            <Detail
              label="Risk"
              value={record.risk}
            />

            <Detail
              label="Responsible Contact"
              value={record.contact}
            />

            <Detail
              label="Contact Email"
              value={record.contactEmail ?? ""}
            />

            <Detail
              label="Next Follow-up"
              value={displayDate(
                record.followUp
              )}
            />

            <Detail
              label="Last Confirmed"
              value={displayDate(
                record.lastConfirmed
              )}
            />

            <Detail
              label="Confirmed By"
              value={record.confirmedBy}
            />

            <Detail
              label="Confirmation Method"
              value={
                record.confirmationMethod
              }
            />

            <Detail
              label="Data Source"
              value={record.dataSource}
            />

          </dl>

        </section>

        {/* ACTIONS */}

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">

          <h2 className="text-xl font-bold text-slate-950">
            Actions
          </h2>

          <div className="mt-5 flex flex-wrap gap-3">

            <Link
              href={`/monitored-records/${record.id}/edit`}
              className="rounded-xl bg-teal-600 px-6 py-3 font-semibold text-white hover:bg-teal-700"
            >
              Edit Record
            </Link>

            <Link
              href={`/reminders?record=${encodeURIComponent(
                record.id
              )}&action=review`}
              className="rounded-xl bg-slate-950 px-6 py-3 font-semibold text-white hover:bg-slate-800"
            >
              Review Reminder
            </Link>

            <Link
              href={`/reminders?record=${encodeURIComponent(
                record.id
              )}&action=follow-up`}
              className="rounded-xl border border-teal-600 px-6 py-3 font-semibold text-teal-700 hover:bg-teal-50"
            >
              Follow Up
            </Link>

            <Link
              href={`/audit-history?record=${encodeURIComponent(record.id)}&organisation=${encodeURIComponent(record.organisationId)}`}
              className="rounded-xl border border-slate-300 px-6 py-3 font-semibold text-slate-700 hover:bg-slate-50"
            >
              View Audit History
            </Link>

          </div>

        </section>

        <section id="confirm-replacement" className="rounded-2xl border border-teal-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-950">Confirm replacement and start next cycle</h2>
          <p className="mt-1 text-sm text-slate-600">Record the replacement date and confirmation details. No document file is collected.</p>
          {replacementError && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{replacementError}</p>}
          <form onSubmit={confirmReplacement} className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="font-semibold text-slate-700">Replacement expiry date<input required type="date" value={replacementExpiry} onChange={(event) => setReplacementExpiry(event.target.value)} className="mt-2 min-h-[44px] w-full rounded-xl border border-slate-300 px-3" /></label>
            <label className="font-semibold text-slate-700">Confirmed by<input required value={replacementConfirmedBy} onChange={(event) => setReplacementConfirmedBy(event.target.value)} className="mt-2 min-h-[44px] w-full rounded-xl border border-slate-300 px-3" /></label>
            <label className="font-semibold text-slate-700">Confirmation method<select value={confirmationMethod} onChange={(event) => setConfirmationMethod(event.target.value)} className="mt-2 min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3"><option>Email</option><option>Phone</option><option>WhatsApp</option><option>Other</option></select></label>
            <div className="flex items-end"><button type="submit" disabled={savingReplacement} className="min-h-[44px] rounded-xl bg-teal-600 px-5 font-semibold text-white hover:bg-teal-700 disabled:opacity-50">{savingReplacement ? "Saving…" : "Confirm replacement date"}</button></div>
          </form>
        </section>

        {/* PRIVACY */}

        <div className="rounded-xl border border-blue-200 bg-blue-50 p-5 text-sm text-blue-900">
          Deadline-Monitor stores approved monitoring metadata only. The underlying company document is not stored.
        </div>

      </div>
    </WorkspaceShell>
  );
}