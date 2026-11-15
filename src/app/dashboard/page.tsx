"use client";

import Link from "next/link";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import WorkspaceShell from "@/components/workspace/WorkspaceShell";

import {
  AuditEvent,
  calculateStatus,
  CommunicationEvent,
  daysUntil,
  getCommunications,
  getAuditEvents,
  MonitoredRecord,
} from "@/lib/recordStore";
import {
  loadAccessibleMonitoredRecords,
  loadAccessibleOrganisations,
} from "@/lib/monitoredRecords/repository";
import { generateOccurrences, getRecurringTasks, seedDemoRecurringTasksIfEmpty } from "@/lib/recurringTasks/taskStore";
import {
  loadConsultantWorkSnapshot,
  type ConsultantException,
  type ConsultantWorkSnapshot,
} from "@/lib/consultantWork";
import {
  getConsultantDashboardSummary,
  getRecentConsultantDashboardActivity,
} from "@/lib/consultantDashboardSelectors";
import { clientBusinessToday } from "@/lib/clientWorkspaceSelectors";

/* =========================================================
   TYPES
========================================================= */

type DashboardFilter =
  | "all"
  | "actions"
  | "due-soon"
  | "expired"
  | "awaiting-client"
  | "current";

type TimeFilter =
  | "all"
  | "today"
  | "7"
  | "14"
  | "30"
  | "60";

function QueueLink({
  label,
  value,
  href,
  colour,
}: {
  label: string;
  value: number;
  href: string;
  colour: string;
}) {
  return (
    <Link
      href={href}
      className="cursor-pointer rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:border-teal-400 hover:bg-teal-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
    >
      <span className="block text-sm font-semibold text-slate-500">{label}</span>
      <span className={`mt-2 block text-3xl font-bold ${colour}`}>{value}</span>
      <span className="mt-2 block text-xs font-medium text-teal-700">Open related view →</span>
    </Link>
  );
}

/* =========================================================
   DATE HELPERS
========================================================= */

function parseDate(value: string) {
  if (!value) {
    return null;
  }

  const date = new Date(
    `${value}T00:00:00`
  );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return null;
  }

  return date;
}

function displayDate(value: string) {
  const date =
    parseDate(value);

  if (!date) {
    return "Not set";
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

function dueDescription(
  expiryDate: string
) {
  const remaining =
    daysUntil(expiryDate);

  if (
    !Number.isFinite(
      remaining
    )
  ) {
    return "No expiry date";
  }

  if (remaining < 0) {
    const overdueDays =
      Math.abs(remaining);

    return `${overdueDays} day${
      overdueDays === 1
        ? ""
        : "s"
    } overdue`;
  }

  if (remaining === 0) {
    return "Due today";
  }

  return `${remaining} day${
    remaining === 1
      ? ""
      : "s"
  } remaining`;
}

/* =========================================================
   OPERATIONAL STATUS
========================================================= */

function getOperationalStatus(
  record: MonitoredRecord
): MonitoredRecord["status"] {
  return calculateStatus(
    record
  );
}

function requiresAction(
  record: MonitoredRecord
) {
  const status =
    getOperationalStatus(
      record
    );

  const followUpDays =
    daysUntil(
      record.followUp
    );

  return (
    status === "Expired" ||
    status === "Due soon" ||
    status ===
      "Awaiting client" ||
    followUpDays <= 0
  );
}

function requiresActionToday(
  record: MonitoredRecord
) {
  const status =
    getOperationalStatus(
      record
    );

  const expiryDays =
    daysUntil(
      record.expiryDate
    );

  const followUpDays =
    daysUntil(
      record.followUp
    );

  return (
    status === "Expired" ||
    expiryDays === 0 ||
    followUpDays <= 0 ||
    record.escalationLevel ===
      "Critical" ||
    record.escalationLevel ===
      "Escalated"
  );
}

/* =========================================================
   PRIORITY
========================================================= */

function getPriority(
  record: MonitoredRecord
) {
  const status =
    getOperationalStatus(
      record
    );

  const expiryDays =
    daysUntil(
      record.expiryDate
    );

  const followUpDays =
    daysUntil(
      record.followUp
    );

  if (
    record.escalationLevel ===
    "Critical"
  ) {
    return 1;
  }

  if (
    status === "Expired" &&
    record.risk === "High"
  ) {
    return 2;
  }

  if (
    status === "Expired"
  ) {
    return 3;
  }

  if (
    expiryDays === 0 &&
    record.risk === "High"
  ) {
    return 4;
  }

  if (
    status === "Due soon" &&
    record.risk === "High"
  ) {
    return 5;
  }

  if (
    followUpDays <= 0
  ) {
    return 6;
  }

  if (
    status === "Due soon"
  ) {
    return 7;
  }

  if (
    status ===
    "Awaiting client"
  ) {
    return 8;
  }

  return 9;
}

/* =========================================================
   SMART ACTION
========================================================= */

function getRecordAction(
  record: MonitoredRecord
) {
  const status =
    getOperationalStatus(
      record
    );

  if (
    status === "Expired"
  ) {
    return {
      label:
        "Resolve",

      href:
        `/monitored-records/${record.id}#confirm-replacement`,

      classes:
        "bg-red-600 text-white hover:bg-red-700 focus:ring-red-500",
    };
  }

  if (
    status === "Due soon"
  ) {
    return {
      label:
        "Review",

      href:
        `/reminders?record=${encodeURIComponent(
          record.id
        )}&action=review`,

      classes:
        "bg-slate-950 text-white hover:bg-slate-800 focus:ring-slate-600",
    };
  }

  if (
    status ===
    "Awaiting client"
  ) {
    return {
      label:
        "Follow Up",

      href:
        `/reminders?record=${encodeURIComponent(
          record.id
        )}&action=follow-up`,

      classes:
        "bg-teal-600 text-white hover:bg-teal-700 focus:ring-teal-500",
    };
  }

  return {
    label:
      "View",

    href:
      `/monitored-records/${record.id}`,

    classes:
      "bg-slate-950 text-white hover:bg-slate-800 focus:ring-slate-600",
  };
}

/* =========================================================
   BADGES
========================================================= */

function RiskBadge({
  risk,
}: {
  risk: MonitoredRecord["risk"];
}) {
  const styles = {
    High:
      "bg-red-100 text-red-700",

    Medium:
      "bg-amber-100 text-amber-700",

    Low:
      "bg-emerald-100 text-emerald-700",
  };

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ${styles[risk]}`}
    >
      {risk}
    </span>
  );
}

function StatusBadge({
  status,
}: {
  status:
    MonitoredRecord["status"];
}) {
  const styles = {
    Current:
      "bg-emerald-100 text-emerald-700",

    "Due soon":
      "bg-amber-100 text-amber-700",

    Expired:
      "bg-red-100 text-red-700",

    "Awaiting client":
      "bg-cyan-100 text-cyan-800",

    "Awaiting confirmation":
      "bg-violet-100 text-violet-800",

    Paused:
      "bg-slate-100 text-slate-700",

    Completed:
      "bg-slate-100 text-slate-700",
  };

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ${styles[status]}`}
    >
      {status}
    </span>
  );
}

function EscalationBadge({
  level,
}: {
  level:
    MonitoredRecord["escalationLevel"];
}) {
  const styles = {
    Normal:
      "bg-slate-100 text-slate-600",

    "Follow-up required":
      "bg-amber-100 text-amber-700",

    Escalated:
      "bg-orange-100 text-orange-700",

    Critical:
      "bg-red-600 text-white",
  };

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${styles[level]}`}
    >
      {level}
    </span>
  );
}

/* =========================================================
   SUMMARY CARD
========================================================= */

function SummaryCard({
  label,
  value,
  colour,
  description,
  active,
  onClick,
}: {
  label: string;
  value: number;
  colour: string;
  description: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`cursor-pointer rounded-xl border bg-white p-4 text-left transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${
        active
          ? "border-teal-600 bg-teal-50 ring-2 ring-teal-100"
          : "border-slate-200"
      }`}
    >
      <p className="text-sm font-semibold text-slate-500">
        {label}
      </p>

      <p
        className={`mt-3 text-3xl font-bold ${colour}`}
      >
        {value}
      </p>

      <p className="mt-2 text-xs font-medium text-slate-400">
        {description}
      </p>
    </button>
  );
}

function DashboardMetric({
  label,
  value,
  colour,
}: {
  label: string;
  value: number;
  colour: string;
}) {
  return (
    <div className="cursor-default rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-sm font-semibold text-slate-600">{label}</p>
      <p className={`mt-2 text-2xl font-bold ${colour}`}>{value}</p>
    </div>
  );
}

function ExceptionSeverityBadge({
  severity,
}: {
  severity: ConsultantException["severity"];
}) {
  const styles: Record<ConsultantException["severity"], string> = {
    Critical: "border-red-300 bg-red-50 text-red-900",
    High: "border-orange-300 bg-orange-50 text-orange-900",
    Medium: "border-amber-300 bg-amber-50 text-amber-900",
    Low: "border-slate-300 bg-slate-100 text-slate-700",
  };

  return (
    <span className={`inline-flex cursor-default rounded-full border px-2.5 py-1 text-xs font-semibold ${styles[severity]}`}>
      {severity}
    </span>
  );
}

function auditActivityHref(activity: AuditEvent) {
  if (activity.entityType === "recurring task" && activity.entityId) {
    return `/recurring-tasks/${encodeURIComponent(activity.entityId)}`;
  }

  if (activity.entityType === "record") {
    const recordId = activity.entityId || activity.recordId;
    if (recordId) return `/monitored-records/${encodeURIComponent(recordId)}`;
  }

  return "/work";
}

function formatAuditTimestamp(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value || "Timestamp unavailable";
  }

  return new Intl.DateTimeFormat("en-ZA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

/* =========================================================
   PAGE
========================================================= */

export default function DashboardPage() {
  const emptyWorkSnapshot: ConsultantWorkSnapshot = {
    organisations: [],
    people: [],
    tasks: [],
    checklists: [],
    recurring: [],
    completed: [],
    exceptions: [],
  };

  const [
    records,
    setRecords,
  ] =
    useState<
      MonitoredRecord[]
    >([]);

  const [
    auditEvents,
    setAuditEvents,
  ] =
    useState<
      AuditEvent[]
    >([]);

  const [communications, setCommunications] = useState<CommunicationEvent[]>([]);
  const [workSnapshot, setWorkSnapshot] = useState(emptyWorkSnapshot);
  const [recordLoadError, setRecordLoadError] = useState("");

  const [
    dashboardFilter,
    setDashboardFilter,
  ] =
    useState<DashboardFilter>(
      "all"
    );

  const [
    timeFilter,
    setTimeFilter,
  ] =
    useState<TimeFilter>(
      "all"
    );

  const [
    search,
    setSearch,
  ] =
    useState("");

  /* =======================================================
     LOAD DATA
  ======================================================= */

  async function loadData() {
    try {
      const [savedRecords, organisations] = await Promise.all([
        loadAccessibleMonitoredRecords(),
        loadAccessibleOrganisations(),
      ]);
      const snapshot = loadConsultantWorkSnapshot(
        clientBusinessToday(),
        savedRecords,
        organisations.map(({ id, name }) => ({ id, name })),
      );
      setRecords(savedRecords);
      setRecordLoadError("");
      setAuditEvents(getAuditEvents());
      setWorkSnapshot(snapshot);
      setCommunications(getCommunications());
    } catch (cause: unknown) {
      setRecordLoadError(
        cause instanceof Error ? cause.message : "Canonical monitored records could not be loaded.",
      );
    }
  }

  useEffect(() => {
    seedDemoRecurringTasksIfEmpty();
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    const through = new Date(from);
    through.setDate(through.getDate() + 30);
    generateOccurrences(getRecurringTasks(), from, through);
    const refresh = () => void loadData();
    const frame = window.requestAnimationFrame(refresh);

    window.addEventListener(
      "deadline-monitor-updated",
      refresh
    );
    window.addEventListener(
      "deadline-monitor-clients-updated",
      refresh
    );
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener(
        "deadline-monitor-updated",
        refresh
      );
      window.removeEventListener(
        "deadline-monitor-clients-updated",
        refresh
      );
    };
  }, []);

  const today = clientBusinessToday();
  const dashboardSummary = useMemo(
    () => getConsultantDashboardSummary(workSnapshot, today),
    [workSnapshot, today],
  );
  const recentMaterialActivity = useMemo(
    () => getRecentConsultantDashboardActivity(auditEvents, workSnapshot.organisations),
    [auditEvents, workSnapshot.organisations],
  );

  const operationCounts = useMemo(() => {
    const activeRecords = records.filter((record) => record.status !== "Completed");
    const pendingReminderReviews = activeRecords.filter((record) => {
      const days = daysUntil(record.expiryDate);
      const dueForReminder = days < 0 || record.reminderDays.includes(days);
      if (!dueForReminder) return false;
      const reviewed = communications
        .filter((communication) => communication.recordId === record.id && communication.type === "Reminder")
        .sort((first, second) => Date.parse(second.date) - Date.parse(first.date))[0];
      return !reviewed || (
        reviewed.deliveryStatus !== "Approved" &&
        reviewed.deliveryStatus !== "Suppressed" &&
        reviewed.decision !== "approved" &&
        reviewed.decision !== "suppressed"
      );
    }).length;
    return {
      expired: activeRecords.filter((record) => daysUntil(record.expiryDate) < 0).length,
      dueToday: activeRecords.filter((record) => daysUntil(record.expiryDate) === 0).length,
      due7: activeRecords.filter((record) => daysUntil(record.expiryDate) >= 0 && daysUntil(record.expiryDate) <= 7).length,
      due30: activeRecords.filter((record) => daysUntil(record.expiryDate) >= 0 && daysUntil(record.expiryDate) <= 30).length,
      due60: activeRecords.filter((record) => daysUntil(record.expiryDate) >= 0 && daysUntil(record.expiryDate) <= 60).length,
      awaiting: records.filter((record) => record.status === "Awaiting client").length,
      completed: records.filter((record) => record.status === "Completed").length,
      remindersReview: pendingReminderReviews,
    };
  }, [records, communications]);

  /* =======================================================
     COUNTS
  ======================================================= */

  const actionCount =
    useMemo(() => {
      return records.filter(requiresActionToday).length +
        dashboardSummary.workRequiringAttention;
    }, [records, dashboardSummary.workRequiringAttention]);

  const dueSoonCount =
    useMemo(() => {
      return records.filter(
        (record) =>
          getOperationalStatus(
            record
          ) === "Due soon"
      ).length;
    }, [records]);

  const expiredCount =
    useMemo(() => {
      return records.filter(
        (record) =>
          getOperationalStatus(
            record
          ) === "Expired"
      ).length;
    }, [records]);

  const awaitingClientCount =
    useMemo(() => {
      return records.filter(
        (record) =>
          getOperationalStatus(
            record
          ) ===
          "Awaiting client"
      ).length;
    }, [records]);

  /* =======================================================
     FILTERING
  ======================================================= */

  const filteredRecords =
    useMemo(() => {
      return [...records]
        .filter((record) => {
          const status =
            getOperationalStatus(
              record
            );

          if (
            dashboardFilter ===
            "actions"
          ) {
            return requiresAction(
              record
            );
          }

          if (
            dashboardFilter ===
            "due-soon"
          ) {
            return (
              status ===
              "Due soon"
            );
          }

          if (
            dashboardFilter ===
            "expired"
          ) {
            return (
              status ===
              "Expired"
            );
          }

          if (
            dashboardFilter ===
            "awaiting-client"
          ) {
            return (
              status ===
              "Awaiting client"
            );
          }

          if (
            dashboardFilter ===
            "current"
          ) {
            return (
              status ===
              "Current"
            );
          }

          return true;
        })
        .filter((record) => {
          const days =
            daysUntil(
              record.expiryDate
            );

          if (
            timeFilter ===
            "today"
          ) {
            return (
              days === 0 ||
              daysUntil(
                record.followUp
              ) <= 0
            );
          }

          if (
            timeFilter === "7"
          ) {
            return (
              days >= 0 &&
              days <= 7
            );
          }

          if (
            timeFilter === "14"
          ) {
            return (
              days >= 0 &&
              days <= 14
            );
          }

          if (
            timeFilter === "30"
          ) {
            return (
              days >= 0 &&
              days <= 30
            );
          }

          if (
            timeFilter === "60"
          ) {
            return (
              days >= 0 &&
              days <= 60
            );
          }

          return true;
        })
        .filter((record) => {
          const searchableText = `
            ${record.name}
            ${record.organisation}
            ${record.category}
            ${record.category2}
            ${record.contact}
            ${record.contactEmail}
            ${record.risk}
            ${record.status}
            ${record.escalationLevel}
          `.toLowerCase();

          return searchableText.includes(
            search.toLowerCase()
          );
        })
        .sort(
          (first, second) =>
            getPriority(first) -
            getPriority(second)
        );
    }, [
      records,
      dashboardFilter,
      timeFilter,
      search,
    ]);

  /* =======================================================
     RESET FILTERS
  ======================================================= */

  function clearFilters() {
    setSearch("");

    setDashboardFilter(
      "all"
    );

    setTimeFilter(
      "all"
    );
  }

  /* =======================================================
     PAGE
  ======================================================= */

  return (
    <WorkspaceShell
      eyebrow="Consultant Workspace"
      title="Overview"
      actions={
        <Link
          href="/reminders"
          aria-label={`${actionCount} actions require attention today. Open operational queues.`}
          className="group flex min-h-[58px] cursor-pointer items-center gap-4 rounded-xl border border-slate-700 bg-slate-950/40 px-5 py-2.5 transition hover:border-teal-500 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
        >
          {/* STATUS INDICATOR */}

          <span className="relative flex h-3 w-3 shrink-0">

            {actionCount > 0 && (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-30" />
            )}

            <span
              className={`relative inline-flex h-3 w-3 rounded-full ${
                actionCount > 0
                  ? "bg-amber-400"
                  : "bg-emerald-400"
              }`}
            />

          </span>

          {/* STATUS TEXT */}

          <span className="text-left">

            <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">
              Daily Monitoring Status
            </span>

            <span className="mt-0.5 block text-sm font-bold text-white group-hover:text-teal-300">
              {actionCount === 0
                ? "No actions require attention today"
                : `${actionCount} action${
                    actionCount === 1
                      ? ""
                      : "s"
                  } require attention today`}
            </span>

          </span>

          <span
            aria-hidden="true"
            className="ml-1 text-lg text-teal-400 transition-transform group-hover:translate-x-1"
          >
            →
          </span>
        </Link>
      }
    >
      <div className="space-y-5 p-4 sm:p-5 lg:p-6">
        {recordLoadError && (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            Monitored-record dashboard data is unavailable: {recordLoadError}
          </div>
        )}

        {/* ===============================================
            SUMMARY CARDS
        =============================================== */}

        <section
          aria-label="Dashboard summary"
          className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
        >
          <SummaryCard
            label="Actions Today"
            value={actionCount}
            colour="text-slate-950"
            description="Click to filter"
            active={
              dashboardFilter ===
              "actions"
            }
            onClick={() =>
              setDashboardFilter(
                dashboardFilter ===
                  "actions"
                  ? "all"
                  : "actions"
              )
            }
          />

          <SummaryCard
            label="Due Soon"
            value={dueSoonCount}
            colour="text-amber-600"
            description="Click to filter"
            active={
              dashboardFilter ===
              "due-soon"
            }
            onClick={() =>
              setDashboardFilter(
                dashboardFilter ===
                  "due-soon"
                  ? "all"
                  : "due-soon"
              )
            }
          />

          <SummaryCard
            label="Expired"
            value={expiredCount}
            colour="text-red-600"
            description="Click to filter"
            active={
              dashboardFilter ===
              "expired"
            }
            onClick={() =>
              setDashboardFilter(
                dashboardFilter ===
                  "expired"
                  ? "all"
                  : "expired"
              )
            }
          />

          <SummaryCard
            label="Awaiting Client"
            value={
              awaitingClientCount
            }
            colour="text-teal-600"
            description="Click to filter"
            active={
              dashboardFilter ===
              "awaiting-client"
            }
            onClick={() =>
              setDashboardFilter(
                dashboardFilter ===
                  "awaiting-client"
                  ? "all"
                  : "awaiting-client"
              )
            }
          />
        </section>

        <section aria-label="Operational queues" className="space-y-3">
          <div>
            <h2 className="text-xl font-bold text-slate-950">Operational queues</h2>
            <p className="mt-1 text-sm text-slate-500">Open a queue to review the matching records, tasks or decisions.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <QueueLink label="Expired records" value={operationCounts.expired} href="/monitored-records?window=expired" colour="text-red-700" />
            <QueueLink label="Due today" value={operationCounts.dueToday} href="/monitored-records?window=today" colour="text-amber-700" />
            <QueueLink label="Due within 7 days" value={operationCounts.due7} href="/monitored-records?window=7" colour="text-amber-700" />
            <QueueLink label="Due within 30 days" value={operationCounts.due30} href="/monitored-records?window=30" colour="text-slate-950" />
            <QueueLink label="Due within 60 days" value={operationCounts.due60} href="/monitored-records?window=60" colour="text-slate-950" />
            <QueueLink label="Awaiting client" value={operationCounts.awaiting} href="/monitored-records?status=Awaiting%20client" colour="text-teal-700" />
            <QueueLink label="Completed records" value={operationCounts.completed} href="/monitored-records?status=Completed" colour="text-emerald-700" />
            <QueueLink label="Recurring tasks due today" value={dashboardSummary.today.recurringOccurrences} href="/work" colour="text-violet-700" />
            <QueueLink label="Overdue recurring tasks" value={dashboardSummary.exceptions.missedRecurring} href="/work" colour="text-red-700" />
            <QueueLink label="Failed recurring tasks" value={dashboardSummary.exceptions.failedRecurring} href="/work" colour="text-red-700" />
            <QueueLink label="Reminders awaiting review" value={operationCounts.remindersReview} href="/reminders?filter=review" colour="text-amber-700" />
            <QueueLink label="Exceptions requiring attention" value={dashboardSummary.exceptions.ordered.length} href="/work" colour="text-red-700" />
          </div>
        </section>

        <section aria-labelledby="dashboard-attention-heading" className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="dashboard-attention-heading" className="text-xl font-bold text-slate-950">
                Requires Attention
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Operational exceptions across active authorised organisations.
              </p>
            </div>
            <Link
              href="/work"
              className="cursor-pointer rounded-lg border border-teal-700 px-3 py-2 text-sm font-semibold text-teal-800 hover:bg-teal-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600"
            >
              View all exceptions
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            <DashboardMetric label="Critical exceptions" value={dashboardSummary.exceptions.critical} colour="text-red-700" />
            <DashboardMetric label="High severity exceptions" value={dashboardSummary.exceptions.high} colour="text-orange-700" />
            <DashboardMetric label="Blocked work" value={dashboardSummary.exceptions.blocked} colour="text-amber-800" />
            <DashboardMetric label="Failed recurring occurrences" value={dashboardSummary.exceptions.failedRecurring} colour="text-red-700" />
            <DashboardMetric label="Awaiting client confirmation" value={dashboardSummary.exceptions.awaitingConfirmation} colour="text-violet-800" />
            <DashboardMetric label="High-risk expired records" value={dashboardSummary.exceptions.highRiskExpiredRecords} colour="text-red-700" />
            <DashboardMetric label="Missed recurring occurrences" value={dashboardSummary.exceptions.missedRecurring} colour="text-amber-800" />
            <DashboardMetric label="Paused schedules to review" value={dashboardSummary.exceptions.pausedSchedulesRequiringReview} colour="text-slate-700" />
          </div>

          {dashboardSummary.exceptions.ordered.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-600">
              No operational exceptions require attention.
            </p>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-semibold text-slate-900">Priority exceptions</h3>
                <span className="cursor-default text-sm text-slate-500">
                  Showing {Math.min(8, dashboardSummary.exceptions.ordered.length)} of {dashboardSummary.exceptions.ordered.length}
                </span>
              </div>
              <ul className="space-y-2">
                {dashboardSummary.exceptions.ordered.slice(0, 8).map((item) => (
                  <li
                    key={`${item.organisationId}:${item.id}`}
                    className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-start"
                  >
                    <ExceptionSeverityBadge severity={item.severity} />
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-950">{item.issue}</p>
                      <p className="mt-1 text-sm text-slate-700">
                        <span className="font-medium">{item.organisation}</span>
                        <span aria-hidden="true"> · </span>
                        {item.related}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        Responsible: {item.responsible || "Unassigned"}
                        <span aria-hidden="true"> · </span>
                        Date: {item.date || "—"}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        Next action: {item.nextAction || "—"}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        Status: {item.status || "—"}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <section aria-labelledby="dashboard-work-today-heading" className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="dashboard-work-today-heading" className="text-xl font-bold text-slate-950">
                Work Today
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                {dashboardSummary.today.total} open item{dashboardSummary.today.total === 1 ? "" : "s"} due {today}.
              </p>
            </div>
            <Link
              href="/work"
              className="cursor-pointer rounded-lg border border-teal-700 px-3 py-2 text-sm font-semibold text-teal-800 hover:bg-teal-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600"
            >
              View Work
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <DashboardMetric label="Tasks due today" value={dashboardSummary.today.tasks} colour="text-blue-700" />
            <DashboardMetric label="Checklist items due today" value={dashboardSummary.today.checklist} colour="text-teal-700" />
            <DashboardMetric label="Recurring occurrences due today" value={dashboardSummary.today.recurringOccurrences} colour="text-violet-800" />
            <DashboardMetric label="Record actions due today" value={dashboardSummary.today.recordActions} colour="text-amber-800" />
          </div>
          {dashboardSummary.today.total === 0 && (
            <p className="rounded-xl border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-600">
              No open work is due today.
            </p>
          )}
        </section>

        <section aria-labelledby="dashboard-recurring-health-heading" className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="dashboard-recurring-health-heading" className="text-xl font-bold text-slate-950">
                Recurring Health
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Schedule status and job health from Consultant Work.
              </p>
            </div>
            <Link
              href="/work"
              className="cursor-pointer rounded-lg border border-teal-700 px-3 py-2 text-sm font-semibold text-teal-800 hover:bg-teal-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600"
            >
              View Recurring Work
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
            <DashboardMetric label="Active schedules" value={dashboardSummary.recurring.active} colour="text-teal-700" />
            <DashboardMetric label="Paused schedules" value={dashboardSummary.recurring.paused} colour="text-slate-700" />
            <DashboardMetric label="Healthy schedules" value={dashboardSummary.recurring.healthy} colour="text-emerald-700" />
            <DashboardMetric label="Schedules with missed occurrence" value={dashboardSummary.recurring.missed} colour="text-amber-800" />
            <DashboardMetric label="Schedules with failed occurrence" value={dashboardSummary.recurring.failed} colour="text-red-700" />
          </div>
          {dashboardSummary.recurring.missed === 0 &&
            dashboardSummary.recurring.failed === 0 &&
            dashboardSummary.recurring.paused === 0 && (
              <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                Recurring schedules are operating without recorded exceptions.
              </p>
            )}
        </section>

        {/* ===============================================
            RECORDS REQUIRING ATTENTION
        =============================================== */}

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">

          {/* HEADER */}

          <div className="border-b border-slate-200 p-4">

            <div className="flex flex-wrap items-start justify-between gap-4">

              <div>

                <h2 className="text-xl font-bold text-slate-950">
                  Records Requiring Attention
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Review due, expired and outstanding records.
                </p>

              </div>

              <p
                aria-live="polite"
                className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-600"
              >
                {filteredRecords.length}{" "}
                record
                {filteredRecords.length ===
                1
                  ? ""
                  : "s"}
              </p>

            </div>

            {/* SEARCH */}

            <div className="mt-5 flex flex-col gap-3 lg:flex-row">

              <label className="min-w-0 flex-1">

                <span className="sr-only">
                  Search monitored records
                </span>

                <input
                  type="search"
                  value={search}
                  onChange={(event) =>
                    setSearch(
                      event.target.value
                    )
                  }
                  placeholder="Search record or organisation..."
                  className="min-h-[46px] w-full rounded-xl border border-slate-300 px-4 text-slate-900 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                />

              </label>

              <button
                type="button"
                onClick={clearFilters}
                className="min-h-[46px] cursor-pointer rounded-xl border border-slate-300 px-5 font-semibold text-slate-700 hover:bg-slate-50"
              >
                Clear Filters
              </button>

            </div>

            {/* DATE FILTERS */}

            <div
              className="mt-4 flex flex-wrap gap-2"
              aria-label="Due-date filters"
            >
              {[
                {
                  label: "All",
                  value: "all",
                },
                {
                  label: "Today",
                  value: "today",
                },
                {
                  label: "7 Days",
                  value: "7",
                },
                {
                  label: "14 Days",
                  value: "14",
                },
                {
                  label: "30 Days",
                  value: "30",
                },
                {
                  label: "60 Days",
                  value: "60",
                },
              ].map(
                (filter) => {
                  const active =
                    timeFilter ===
                    filter.value;

                  return (
                    <button
                      key={
                        filter.value
                      }
                      type="button"
                      onClick={() =>
                        setTimeFilter(
                          filter.value as TimeFilter
                        )
                      }
                      aria-pressed={
                        active
                      }
                      className={`min-h-[40px] cursor-pointer rounded-lg px-4 text-sm font-semibold transition ${
                        active
                          ? "bg-teal-600 text-white"
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      }`}
                    >
                      {
                        filter.label
                      }
                    </button>
                  );
                }
              )}
            </div>

          </div>

          {/* =============================================
              DESKTOP TABLE
          ============================================= */}

          <div
            className="hidden lg:block"
            style={{ maxWidth: "100%", overflowX: "auto" }}
          >

            <table className="dm-data-table w-full table-fixed">

              <thead className="bg-slate-50">

                <tr>

                  <th className="w-[25%] px-5 py-4 text-left text-xs font-bold uppercase tracking-wide text-slate-600">
                    Record
                  </th>

                  <th className="w-[21%] px-5 py-4 text-left text-xs font-bold uppercase tracking-wide text-slate-600">
                    Organisation
                  </th>

                  <th className="w-[14%] px-5 py-4 text-left text-xs font-bold uppercase tracking-wide text-slate-600">
                    Expiry
                  </th>

                  <th className="w-[10%] px-5 py-4 text-left text-xs font-bold uppercase tracking-wide text-slate-600">
                    Risk
                  </th>

                  <th className="w-[16%] px-5 py-4 text-left text-xs font-bold uppercase tracking-wide text-slate-600">
                    Status
                  </th>

                  <th className="w-[14%] px-5 py-4 text-right text-xs font-bold uppercase tracking-wide text-slate-600">
                    Action
                  </th>

                </tr>

              </thead>

              <tbody className="divide-y divide-slate-200">

                {filteredRecords.map(
                  (record) => {
                    const status =
                      getOperationalStatus(
                        record
                      );

                    const action =
                      getRecordAction(
                        record
                      );

                    return (
                      <tr
                        key={
                          record.id
                        }
                        className="hover:bg-slate-50"
                      >

                        {/* RECORD */}

                        <td className="break-words px-5 py-5">

                          <Link
                            href={`/monitored-records/${record.id}`}
                            className="cursor-pointer font-bold text-slate-900 hover:text-teal-700"
                          >
                            {
                              record.name
                            }
                          </Link>

                          <p className="mt-1 text-sm text-slate-500">
                            {
                              record.category
                            }{" "}
                            ·{" "}
                            {
                              record.category2
                            }
                          </p>

                          {record.escalationLevel !==
                            "Normal" && (
                            <div className="mt-2">
                              <EscalationBadge
                                level={
                                  record.escalationLevel
                                }
                              />
                            </div>
                          )}

                        </td>

                        {/* ORGANISATION */}

                        <td className="break-words px-5 py-5 text-slate-600">
                          {
                            record.organisation
                          }
                        </td>

                        {/* EXPIRY */}

                        <td className="px-5 py-5">

                          <p className="font-medium text-slate-700">
                            {displayDate(
                              record.expiryDate
                            )}
                          </p>

                          <p
                            className={`mt-1 text-sm font-semibold ${
                              daysUntil(
                                record.expiryDate
                              ) < 0
                                ? "text-red-600"
                                : daysUntil(
                                      record.expiryDate
                                    ) <= 14
                                  ? "text-amber-600"
                                  : "text-slate-500"
                            }`}
                          >
                            {dueDescription(
                              record.expiryDate
                            )}
                          </p>

                        </td>

                        {/* RISK */}

                        <td className="px-5 py-5">
                          <RiskBadge
                            risk={
                              record.risk
                            }
                          />
                        </td>

                        {/* STATUS */}

                        <td className="px-5 py-5">
                          <StatusBadge
                            status={
                              status
                            }
                          />
                        </td>

                        {/* ACTION */}

                        <td className="px-5 py-5 text-right">

                          <Link
                            href={
                              action.href
                            }
                            className={`inline-flex min-h-[42px] cursor-pointer items-center justify-center rounded-xl px-4 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-offset-2 ${action.classes}`}
                          >
                            {
                              action.label
                            }
                          </Link>

                        </td>

                      </tr>
                    );
                  }
                )}

              </tbody>

            </table>

          </div>

          {/* =============================================
              MOBILE CARDS
          ============================================= */}

          <div className="divide-y divide-slate-200 lg:hidden">

            {filteredRecords.map(
              (record) => {
                const status =
                  getOperationalStatus(
                    record
                  );

                const action =
                  getRecordAction(
                    record
                  );

                return (
                  <article
                    key={
                      record.id
                    }
                    className="space-y-4 p-5"
                  >

                    <div>

                      <Link
                        href={`/monitored-records/${record.id}`}
                        className="cursor-pointer font-bold text-slate-900 hover:text-teal-700"
                      >
                        {
                          record.name
                        }
                      </Link>

                      <p className="mt-1 text-sm text-slate-600">
                        {
                          record.organisation
                        }
                      </p>

                      <p className="mt-1 text-sm text-slate-500">
                        {
                          record.category
                        }{" "}
                        ·{" "}
                        {
                          record.category2
                        }
                      </p>

                    </div>

                    <div className="flex flex-wrap gap-2">

                      <RiskBadge
                        risk={
                          record.risk
                        }
                      />

                      <StatusBadge
                        status={
                          status
                        }
                      />

                      {record.escalationLevel !==
                        "Normal" && (
                        <EscalationBadge
                          level={
                            record.escalationLevel
                          }
                        />
                      )}

                    </div>

                    <div className="rounded-xl bg-slate-50 p-3">

                      <p className="text-sm font-semibold text-slate-700">
                        Expires{" "}
                        {displayDate(
                          record.expiryDate
                        )}
                      </p>

                      <p className="mt-1 text-sm text-slate-500">
                        {dueDescription(
                          record.expiryDate
                        )}
                      </p>

                    </div>

                    <Link
                      href={
                        action.href
                      }
                      className={`inline-flex min-h-[44px] w-full cursor-pointer items-center justify-center rounded-xl px-4 font-semibold ${action.classes}`}
                    >
                      {
                        action.label
                      }
                    </Link>

                  </article>
                );
              }
            )}

          </div>

          {/* EMPTY STATE */}

          {filteredRecords.length ===
            0 && (
            <div className="p-12 text-center">

              <p className="font-semibold text-slate-900">
                No records match the selected filters
              </p>

              <p className="mt-1 text-sm text-slate-500">
                Change the filters or clear the search.
              </p>

              <button
                type="button"
                onClick={
                  clearFilters
                }
                className="mt-4 font-semibold text-teal-700 hover:text-teal-900"
              >
                Clear all filters
              </button>

            </div>
          )}

        </section>

        {/* ===============================================
            RECENT / CLIENT ACTIVITY
        =============================================== */}

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:p-6">

          <div className="flex flex-wrap items-center justify-between gap-4">

            <div>

              <h2 className="text-xl font-bold text-slate-950">
                Recent / Client Activity
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Recent material operational changes for active organisations.
              </p>

            </div>

            <Link
              href="/audit-history"
              className="cursor-pointer font-semibold text-teal-700 hover:text-teal-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
            >
              View Audit History →
            </Link>

          </div>

          {recentMaterialActivity.length > 0 ? (
            <div className="mt-4 divide-y divide-slate-200">
              {recentMaterialActivity.map((activity) => (
                  <article
                    key={
                      activity.id
                    }
                    className="flex flex-col gap-2 py-4 sm:flex-row sm:items-start sm:justify-between"
                  >

                    <div className="min-w-0">

                      <p className="font-semibold text-slate-900">
                        {
                          activity.action
                        }
                      </p>

                      <Link
                        href={auditActivityHref(activity)}
                        className="mt-1 block cursor-pointer text-sm font-medium text-teal-700 hover:text-teal-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                      >
                        {
                          activity.entityName ||
                          activity.recordName
                        }
                      </Link>

                      <p className="mt-1 text-sm text-slate-500">
                        {
                          activity.organisation
                        }
                      </p>

                      <p className="mt-1 text-sm text-slate-500">
                        Actor: {activity.user || "Unknown"}
                      </p>

                    </div>

                    <time
                      dateTime={activity.timestamp || activity.date || undefined}
                      className="shrink-0 text-sm text-slate-500"
                    >
                      {formatAuditTimestamp(activity.timestamp || activity.date)}
                    </time>

                  </article>
              ))}
            </div>
          ) : (
            <div className="mt-5 rounded-xl bg-slate-50 p-6 text-center">
              <p className="font-semibold text-slate-900">
                No recent activity
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Material client and operational changes will appear here.
              </p>
            </div>
          )}

        </section>

      </div>
    </WorkspaceShell>
  );
}