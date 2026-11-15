"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useState,
} from "react";

import WorkspaceShell from "@/components/workspace/WorkspaceShell";

import {
  CategoryOne,
  CommunicationEvent,
  getCommunications,
  MonitoredRecord,
} from "@/lib/recordStore";
import {
  loadAccessibleMonitoredRecords,
  loadAccessibleOrganisations,
} from "@/lib/monitoredRecords/repository";
import {
  getConsultantActivities,
  filterConsultantActivities,
} from "@/lib/consultantActivities";
import {
  loadConsultantWorkSnapshot,
  type ConsultantWorkSnapshot,
} from "@/lib/consultantWork";
import {
  activityStatusLabel,
  activityTypeLabel,
  formatCalendarMonth,
} from "@/components/client/calendar/calendarUtils";
import {
  getActivitiesForMonth,
} from "@/lib/clientActivities";
import {
  clientBusinessToday,
  normalizeClientStatus,
} from "@/lib/clientWorkspaceSelectors";
import {
  exportClientReport,
  reportDisclaimer,
  type ClientReportFormat,
  type ClientReportRow,
} from "@/lib/clientReports";
import {
  OccurrenceStatus,
  RecurringTask,
  TaskOccurrence,
} from "@/lib/recurringTasks/types";

type SummaryFilter =
  | "all"
  | "requires-action"
  | "high-risk"
  | "current"
  | "due-soon"
  | "expired"
  | "awaiting-client"
  | "completed";

type PeriodFilter =
  | "all"
  | "expired"
  | "today"
  | "7"
  | "14"
  | "30"
  | "60";

type StatusFilter =
  | "All"
  | MonitoredRecord["status"];

type RiskFilter =
  | "All"
  | MonitoredRecord["risk"];

const consultantReportTypes = [
  { id: "expired-records", label: "Expired Records" },
  { id: "expiring-records", label: "Expiring Records (Next 30 Days)" },
  { id: "overdue-work", label: "Overdue Work" },
  { id: "completed-work", label: "Completed Work" },
  { id: "monthly-calendar", label: "Monthly Calendar" },
  { id: "notification-history", label: "Notification History" },
  { id: "monthly-monitoring-summary", label: "Monthly Monitoring Summary" },
] as const;

type ConsultantReportType =
  (typeof consultantReportTypes)[number]["id"];

const consultantReportColumns: Record<
  ConsultantReportType,
  string[]
> = {
  "expired-records": [
    "Organisation",
    "Record",
    "Category",
    "Expiry Date",
    "Risk",
    "Responsible Person",
    "Status",
    "Next Action",
  ],
  "expiring-records": [
    "Organisation",
    "Record",
    "Category",
    "Expiry Date",
    "Risk",
    "Responsible Person",
    "Status",
    "Next Action",
  ],
  "overdue-work": [
    "Organisation",
    "Task",
    "Tracker / Related Record",
    "Responsible Person",
    "Due Date",
    "Due Time",
    "Priority",
    "Status",
    "Next Action",
  ],
  "completed-work": [
    "Organisation",
    "Task",
    "Tracker / Related Record",
    "Responsible Person",
    "Due Date",
    "Completion Date",
    "Priority",
    "Status",
    "Next Action",
  ],
  "monthly-calendar": [
    "Organisation",
    "Date",
    "Time",
    "Activity",
    "Activity Type",
    "Related Record / Tracker",
    "Responsible Person",
    "Priority",
    "Status",
    "Next Action",
  ],
  "notification-history": [
    "Organisation",
    "Date",
    "Subject",
    "Type",
    "Related Record / Task",
    "Delivery / Status",
    "Next Follow-up",
  ],
  "monthly-monitoring-summary": [
    "Organisation",
    "Reporting Month",
    "Monitored Records",
    "Expired Records",
    "Expiring Records",
    "Overdue Work",
    "Completed Work",
    "Calendar Activities",
    "Notifications",
  ],
};

function createReportRow(input: {
  id: string;
  organisationId: string;
  type: string;
  status: string;
  dueDate?: string;
  category: string;
  person: string;
  priority: string;
  cells: ClientReportRow["cells"];
}): ClientReportRow {
  return {
    ...input,
    normalizedStatus: normalizeClientStatus(input.status),
  };
}

function parseDate(value: string) {
  if (!value) return null;

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function getToday() {
  const today = new Date();

  today.setHours(0, 0, 0, 0);

  return today;
}

function daysUntil(value: string) {
  const date = parseDate(value);

  if (!date) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.ceil(
    (date.getTime() - getToday().getTime()) /
      (1000 * 60 * 60 * 24)
  );
}

function displayDate(value: string) {
  const date = parseDate(value);

  if (!date) {
    return "Not set";
  }

  return date.toLocaleDateString("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function generatedDate() {
  return new Date().toLocaleDateString("en-ZA", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function dueDescription(value: string) {
  const days = daysUntil(value);

  if (!Number.isFinite(days)) {
    return "No expiry date";
  }

  if (days < 0) {
    const overdue = Math.abs(days);

    return `${overdue} day${
      overdue === 1 ? "" : "s"
    } overdue`;
  }

  if (days === 0) {
    return "Due today";
  }

  return `${days} day${
    days === 1 ? "" : "s"
  } remaining`;
}

function getOperationalStatus(
  record: MonitoredRecord
): MonitoredRecord["status"] {
  if (
    record.status !== "Completed" &&
    daysUntil(record.expiryDate) < 0
  ) {
    return "Expired";
  }

  return record.status;
}

function requiresAction(record: MonitoredRecord) {
  const status = getOperationalStatus(record);

  return (
    status === "Expired" ||
    status === "Due soon" ||
    status === "Awaiting client"
  );
}

function getPriority(record: MonitoredRecord) {
  const status = getOperationalStatus(record);

  if (
    status === "Expired" &&
    record.risk === "High"
  ) {
    return 1;
  }

  if (status === "Expired") {
    return 2;
  }

  if (
    status === "Due soon" &&
    record.risk === "High"
  ) {
    return 3;
  }

  if (status === "Due soon") {
    return 4;
  }

  if (status === "Awaiting client") {
    return 5;
  }

  if (status === "Current") {
    return 6;
  }

  return 7;
}

function getAction(record: MonitoredRecord) {
  const status = getOperationalStatus(record);

  if (status === "Expired") {
    return {
      label: "Resolve",
      href: `/monitored-records/${record.id}#confirm-replacement`,
      classes:
        "bg-red-600 text-white hover:bg-red-700",
    };
  }

  if (status === "Due soon") {
    return {
      label: "Review",
      href: `/reminders?record=${encodeURIComponent(
        record.id
      )}&action=review`,
      classes:
        "bg-slate-950 text-white hover:bg-slate-800",
    };
  }

  if (status === "Awaiting client") {
    return {
      label: "Follow Up",
      href: `/reminders?record=${encodeURIComponent(
        record.id
      )}&action=follow-up`,
      classes:
        "bg-teal-600 text-white hover:bg-teal-700",
    };
  }

  return {
    label: "View",
    href: `/monitored-records/${record.id}`,
    classes:
      "bg-slate-950 text-white hover:bg-slate-800",
  };
}

function downloadCsv(
  filename: string,
  rows: string[][]
) {
  const csv = rows
    .map((row) =>
      row
        .map((value) => {
          let safeValue = String(
            value ?? ""
          ).replace(/"/g, '""');
          if (/^[=+\-@\t\r]/.test(safeValue)) {
            safeValue = `'${safeValue}`;
          }

          return `"${safeValue}"`;
        })
        .join(",")
    )
    .join("\n");

  const blob = new Blob([csv], {
    type: "text/csv;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);

  const link =
    document.createElement("a");

  link.href = url;
  link.download = filename;

  document.body.appendChild(link);

  link.click();
  link.remove();

  URL.revokeObjectURL(url);
}

function RiskBadge({
  risk,
}: {
  risk: MonitoredRecord["risk"];
}) {
  const styles = {
    High: "bg-red-100 text-red-700",
    Medium: "bg-amber-100 text-amber-700",
    Low: "bg-emerald-100 text-emerald-700",
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
  status: MonitoredRecord["status"];
}) {
  const styles = {
    Current: "bg-emerald-100 text-emerald-700",
    "Due soon": "bg-amber-100 text-amber-700",
    Expired: "bg-red-100 text-red-700",
    "Awaiting client":
      "bg-cyan-100 text-cyan-800",
    "Awaiting confirmation":
      "bg-violet-100 text-violet-800",
    Paused: "bg-slate-100 text-slate-700",
    Completed: "bg-slate-100 text-slate-700",
  };

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ${styles[status]}`}
    >
      {status}
    </span>
  );
}

function DeliveryBadge({
  outcome,
}: {
  outcome: string;
}) {
  const approved =
    outcome
      .toLowerCase()
      .includes("approved") ||
    outcome
      .toLowerCase()
      .includes("contacted");

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
        approved
          ? "bg-emerald-100 text-emerald-700"
          : "bg-amber-100 text-amber-700"
      }`}
    >
      {outcome}
    </span>
  );
}

function MetricCard({
  label,
  value,
  description,
  colour,
  active,
  onClick,
}: {
  label: string;
  value: number;
  description: string;
  colour: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-2xl border bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-teal-500 ${
        active
          ? "border-teal-600 ring-2 ring-teal-100"
          : "border-slate-200"
      }`}
    >
      <p className="text-sm font-semibold text-slate-500">
        {label}
      </p>

      <p
        className={`mt-2 text-3xl font-bold ${colour}`}
      >
        {value}
      </p>

      <p className="mt-1 text-xs text-slate-400">
        {description}
      </p>
    </button>
  );
}

export default function ReportsPage() {
  const [records, setRecords] = useState<
    MonitoredRecord[]
  >([]);

  const [snapshot, setSnapshot] =
    useState<ConsultantWorkSnapshot>({
      organisations: [],
      people: [],
      tasks: [],
      checklists: [],
      recurring: [],
      completed: [],
      exceptions: [],
    });

  const [
    communications,
    setCommunications,
  ] = useState<CommunicationEvent[]>([]);
  const [recurringTasks, setRecurringTasks] = useState<RecurringTask[]>([]);
  const [taskOccurrences, setTaskOccurrences] = useState<TaskOccurrence[]>([]);

  const [search, setSearch] = useState("");
  const [organisation, setOrganisation] =
    useState("All");
  const [reportType, setReportType] =
    useState<ConsultantReportType>("expired-records");
  const [reportMonth, setReportMonth] =
    useState(() => clientBusinessToday().slice(0, 7));
  const [generatedAt, setGeneratedAt] =
    useState("");

  const [categoryOne, setCategoryOne] =
    useState<"All" | CategoryOne>("All");

  const [categoryTwo, setCategoryTwo] =
    useState("All");

  const [risk, setRisk] =
    useState<RiskFilter>("All");

  const [status, setStatus] =
    useState<StatusFilter>("All");

  const [period, setPeriod] =
    useState<PeriodFilter>("all");

  const [summaryFilter, setSummaryFilter] =
    useState<SummaryFilter>("all");

  const [
    selectedRecordId,
    setSelectedRecordId,
  ] = useState<string | null>(null);

  const [notice, setNotice] = useState("");
  const [recordLoadError, setRecordLoadError] = useState("");

  async function loadData() {
    setGeneratedAt(new Date().toLocaleString("en-ZA"));
    try {
      const [savedRecords, organisations] = await Promise.all([
        loadAccessibleMonitoredRecords(),
        loadAccessibleOrganisations(),
      ]);
      const workSnapshot = loadConsultantWorkSnapshot(
        clientBusinessToday(),
        savedRecords,
        organisations.map(({ id, name }) => ({ id, name })),
      );
      setRecordLoadError("");
      setSnapshot(workSnapshot);
      setRecords(savedRecords);
      setCommunications(getCommunications());
      setRecurringTasks(workSnapshot.recurring.map((schedule) => schedule.task));
      setTaskOccurrences(
        Array.from(
          new Map(
            workSnapshot.tasks
              .flatMap((item) => item.occurrence ? [item.occurrence] : [])
              .map((occurrence) => [occurrence.id, occurrence])
          ).values()
        )
      );
    } catch (cause: unknown) {
      setRecordLoadError(
        cause instanceof Error ? cause.message : "Canonical monitored records could not be loaded.",
      );
    }
  }

  useEffect(() => {
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

  const organisations = useMemo(() => {
    return snapshot.organisations;
  }, [snapshot.organisations]);

  const scopedRecords = useMemo(
    () => records.filter((record) =>
      organisation === "All" ||
      record.organisationId === organisation
    ),
    [records, organisation]
  );

  const scopedRecurringTasks = useMemo(
    () => recurringTasks.filter((task) =>
      organisation === "All" ||
      task.organisationId === organisation
    ),
    [recurringTasks, organisation]
  );

  const scopedTaskOccurrences = useMemo(
    () => taskOccurrences.filter((occurrence) =>
      organisation === "All" ||
      occurrence.organisationId === organisation
    ),
    [taskOccurrences, organisation]
  );

  const scopedWorkItems = useMemo(
    () => snapshot.tasks.filter((item) =>
      organisation === "All" ||
      item.organisationId === organisation
    ),
    [snapshot.tasks, organisation]
  );

  const scopedCompletedWork = useMemo(
    () => snapshot.completed.filter((item) =>
      organisation === "All" ||
      item.organisationId === organisation
    ),
    [snapshot.completed, organisation]
  );

  const categoryOneOptions = useMemo(
    () => Array.from(new Set(
      scopedRecords.map((record) => record.category)
    )).sort(),
    [scopedRecords]
  );

  const availableCalendarActivities = useMemo(
    () => getConsultantActivities(snapshot),
    [snapshot]
  );

  const scopedCalendarActivities = useMemo(
    () => filterConsultantActivities(
      availableCalendarActivities,
      { organisationId: organisation === "All" ? "all" : organisation }
    ),
    [availableCalendarActivities, organisation]
  );

  const monthlyCalendarActivities = useMemo(
    () => getActivitiesForMonth(scopedCalendarActivities, reportMonth),
    [scopedCalendarActivities, reportMonth]
  );

  const categoryTwoOptions = useMemo(() => {
    if (categoryOne === "All") {
      return Array.from(
      new Set(
        scopedRecords.map(
          (record) => record.category2
        )
      )
      ).sort();
    }

    return Array.from(new Set(
      scopedRecords
        .filter((record) => record.category === categoryOne)
        .map((record) => record.category2)
    )).sort();
  }, [scopedRecords, categoryOne]);

  const metrics = useMemo(() => {
    return {
      total: scopedRecords.length,

      requiresAction:
      scopedRecords.filter(requiresAction).length,

      highRisk: scopedRecords.filter(
      (record) =>
        record.risk === "High"
      ).length,

      current: scopedRecords.filter(
      (record) =>
        getOperationalStatus(record) ===
        "Current"
      ).length,

      dueSoon: scopedRecords.filter(
      (record) =>
        getOperationalStatus(record) ===
        "Due soon"
      ).length,

      expired: scopedRecords.filter(
      (record) =>
        getOperationalStatus(record) ===
        "Expired"
      ).length,

      awaiting: scopedRecords.filter(
      (record) =>
        getOperationalStatus(record) ===
        "Awaiting client"
      ).length,

      completed: scopedRecords.filter(
      (record) =>
        getOperationalStatus(record) ===
        "Completed"
      ).length,
    };
  }, [scopedRecords]);

  const taskStatusCounts = useMemo(() => {
    const occurrenceCounts: Record<OccurrenceStatus, number> = {
      upcoming: 0,
      due_today: 0,
      in_progress: 0,
      completed: 0,
      skipped: 0,
      failed: 0,
      overdue: 0,
      cancelled: 0,
    };
    scopedTaskOccurrences.forEach((occurrence) => {
      occurrenceCounts[occurrence.status] += 1;
    });
    return {
      activeSchedules: scopedRecurringTasks.filter((task) => task.status === "active").length,
      pausedSchedules: scopedRecurringTasks.filter((task) => task.status === "paused").length,
      cancelledSchedules: scopedRecurringTasks.filter((task) => task.status === "cancelled").length,
      occurrenceCounts,
    };
  }, [scopedRecurringTasks, scopedTaskOccurrences]);

  const filteredRecords = useMemo(() => {
    return [...scopedRecords]
      .filter((record) => {
        const searchable = `
          ${record.name}
          ${record.organisation}
          ${record.category}
          ${record.category2}
          ${record.contact}
          ${record.contactEmail}
        `.toLowerCase();

        return searchable.includes(
          search.toLowerCase()
        );
      })
      .filter(
        (record) =>
          categoryOne === "All" ||
          record.category === categoryOne
      )
      .filter(
        (record) =>
          categoryTwo === "All" ||
          record.category2 === categoryTwo
      )
      .filter(
        (record) =>
          risk === "All" ||
          record.risk === risk
      )
      .filter((record) => {
        const operationalStatus =
          getOperationalStatus(record);

        return (
          status === "All" ||
          operationalStatus === status
        );
      })
      .filter((record) => {
        const operationalStatus =
          getOperationalStatus(record);

        if (
          summaryFilter ===
          "requires-action"
        ) {
          return requiresAction(record);
        }

        if (
          summaryFilter === "high-risk"
        ) {
          return record.risk === "High";
        }

        if (
          summaryFilter === "current"
        ) {
          return operationalStatus === "Current";
        }

        if (
          summaryFilter === "due-soon"
        ) {
          return operationalStatus === "Due soon";
        }

        if (
          summaryFilter === "expired"
        ) {
          return operationalStatus === "Expired";
        }

        if (
          summaryFilter === "awaiting-client"
        ) {
          return (
            operationalStatus ===
            "Awaiting client"
          );
        }

        if (
          summaryFilter === "completed"
        ) {
          return operationalStatus === "Completed";
        }

        return true;
      })
      .filter((record) => {
        const days = daysUntil(
          record.expiryDate
        );

        if (period === "expired") {
          return days < 0;
        }

        if (period === "today") {
          return days === 0;
        }

        if (period === "7") {
          return days >= 0 && days <= 7;
        }

        if (period === "14") {
          return days >= 0 && days <= 14;
        }

        if (period === "30") {
          return days >= 0 && days <= 30;
        }

        if (period === "60") {
          return days >= 0 && days <= 60;
        }

        return true;
      })
      .sort(
        (first, second) =>
          getPriority(first) -
          getPriority(second)
      );
  }, [
    scopedRecords,
    search,
    categoryOne,
    categoryTwo,
    risk,
    status,
    period,
    summaryFilter,
  ]);

  const clientSummaries = useMemo(() => {
    return organisations
      .filter((company) =>
        organisation === "All" ||
        company.id === organisation
      )
      .map((company) => {
        const clientRecords =
          scopedRecords.filter(
            (record) =>
              record.organisationId === company.id
          );

        return {
          organisationId: company.id,
          organisation: company.name,

          total: clientRecords.length,

          current: clientRecords.filter(
            (record) =>
              getOperationalStatus(record) ===
              "Current"
          ).length,

          dueSoon: clientRecords.filter(
            (record) =>
              getOperationalStatus(record) ===
              "Due soon"
          ).length,

          expired: clientRecords.filter(
            (record) =>
              getOperationalStatus(record) ===
              "Expired"
          ).length,

          awaiting: clientRecords.filter(
            (record) =>
              getOperationalStatus(record) ===
              "Awaiting client"
          ).length,

          highRisk: clientRecords.filter(
            (record) =>
              record.risk === "High"
          ).length,

          requiresAction:
            clientRecords.filter(
              requiresAction
            ).length,
        };
      })
      .sort(
        (first, second) =>
          second.requiresAction -
            first.requiresAction ||
          second.highRisk -
            first.highRisk
      );
  }, [scopedRecords, organisations, organisation]);

  const selectedRecord =
    selectedRecordId
      ? scopedRecords.find(
          (record) =>
            record.id === selectedRecordId
        ) || null
      : null;

  /*
    The current prototype may already contain duplicated
    communication events in localStorage.

    This removes identical duplicate rows from the report.
  */
  const uniqueCommunications =
    useMemo(() => {
      const seen = new Set<string>();

      return communications.filter(
        (communication) => {
          const key = [
            communication.organisation || "",
            communication.recordId,
            communication.relatedTaskId || "",
            communication.type,
            communication.recipient,
            communication.outcome,
            communication.nextFollowUp,
            communication.message,
          ].join("|");

          if (seen.has(key)) {
            return false;
          }

          seen.add(key);

          return true;
        }
      );
    }, [communications]);

  const clientCommunications =
    useMemo(() => {
      const organisationsByName = new Map(
        organisations.reduce((entries, item) => {
          const name = item.name.trim().toLocaleLowerCase();
          entries.set(name, [...(entries.get(name) || []), item]);
          return entries;
        }, new Map<string, typeof organisations>())
      );
      return uniqueCommunications
        .filter((communication) => {
          const matchingOrganisations = organisationsByName.get(
            (communication.organisation || "")
              .trim()
              .toLocaleLowerCase()
          ) || [];
          if (matchingOrganisations.length !== 1) return false;
          const matchedOrganisation = matchingOrganisations[0];
          if (
            organisation !== "All" &&
            matchedOrganisation.id !== organisation
          ) {
            return false;
          }
          if (
            communication.recordId &&
            !records.some((record) =>
              record.id === communication.recordId &&
              record.organisationId === matchedOrganisation.id
            )
          ) {
            return false;
          }
          if (
            communication.relatedTaskId &&
            !recurringTasks.some((task) =>
              task.id === communication.relatedTaskId &&
              task.organisationId === matchedOrganisation.id
            )
          ) {
            return false;
          }
          return true;
        })
        .sort(
          (left, right) =>
            Date.parse(right.date) - Date.parse(left.date)
        );
    }, [
      uniqueCommunications,
      organisation,
      records,
      recurringTasks,
      organisations,
    ]);

  const selectedReportRows = useMemo(() => {
    const organisationNames = new Map(
      organisations.map((item) => [item.id, item.name])
    );
    const selectedOrganisations = organisations.filter((item) =>
      organisation === "All" || item.id === organisation
    );
    const reportRecords = scopedRecords;
    const reportCommunications = clientCommunications;
    const dateIsInReportMonth = (date: string) =>
      Boolean(date) && date.slice(0, 7) === reportMonth;

    const recordRow = (record: MonitoredRecord): ClientReportRow => {
      const operationalStatus = getOperationalStatus(record);
      return createReportRow({
        id: `record:${record.organisationId}:${record.id}`,
        organisationId: record.organisationId,
        type: "Record",
        status: operationalStatus,
        dueDate: record.expiryDate,
        category: `${record.category} · ${record.category2}`,
        person: record.contact || "Unassigned",
        priority: record.risk,
        cells: {
          Organisation: organisationNames.get(record.organisationId) || record.organisation,
          Record: record.name,
          Category: `${record.category} · ${record.category2}`,
          "Expiry Date": record.expiryDate || "—",
          Risk: record.risk,
          "Responsible Person": record.contact || "Unassigned",
          Status: operationalStatus,
          "Next Action": record.nextAction || "Review monitored record",
        },
      });
    };

    const workRow = (
      item: ConsultantWorkSnapshot["tasks"][number]
    ): ClientReportRow => createReportRow({
      id: item.id,
      organisationId: item.organisationId,
      type: item.kind === "record"
        ? "Record action"
        : item.kind === "checklist"
          ? "Checklist item"
          : "Recurring task",
      status: item.status,
      dueDate: item.dueDate,
      category: item.source,
      person: item.responsible || "Unassigned",
      priority: item.priority,
      cells: {
        Organisation: item.organisation,
        Task: item.task,
        "Tracker / Related Record": item.related,
        "Responsible Person": item.responsible || "Unassigned",
        "Due Date": item.dueDate || "—",
        "Due Time": item.dueTime || "—",
        "Completion Date": item.completedDate || "—",
        Priority: item.priority || "—",
        Status: item.status,
        "Next Action": item.nextAction || "Review assigned work",
      },
    });

    const reportRows: ClientReportRow[] = [];
    if (reportType === "expired-records") {
      reportRows.push(
        ...reportRecords
          .filter((record) => getOperationalStatus(record) === "Expired")
          .map(recordRow)
      );
    } else if (reportType === "expiring-records") {
      reportRows.push(
        ...reportRecords
          .filter((record) => {
            const days = daysUntil(record.expiryDate);
            return days > 0 &&
              days <= 30 &&
              !["Completed", "Paused"].includes(record.status);
          })
          .map(recordRow)
      );
    } else if (reportType === "overdue-work") {
      reportRows.push(
        ...scopedWorkItems
          .filter((item) => item.status === "Overdue")
          .map(workRow)
      );
    } else if (reportType === "completed-work") {
      reportRows.push(...scopedCompletedWork.map(workRow));
    } else if (reportType === "monthly-calendar") {
      reportRows.push(
        ...monthlyCalendarActivities.map((activity) =>
          createReportRow({
            id: activity.id,
            organisationId: activity.organisationId,
            type: activityTypeLabel(activity.activityType),
            status: activityStatusLabel(activity),
            dueDate: activity.date,
            category: activityTypeLabel(activity.activityType),
            person: activity.responsiblePerson || "Unassigned",
            priority: activity.priority
              ? activity.priority[0].toUpperCase() + activity.priority.slice(1)
              : "",
            cells: {
              Organisation: organisationNames.get(activity.organisationId) || activity.organisationId,
              Date: activity.date,
              Time: activity.time || "All day",
              Activity: activity.title,
              "Activity Type": activityTypeLabel(activity.activityType),
              "Related Record / Tracker": activity.relatedName || "—",
              "Responsible Person": activity.responsiblePerson || "Unassigned",
              Priority: activity.priority
                ? activity.priority[0].toUpperCase() + activity.priority.slice(1)
                : "—",
              Status: activityStatusLabel(activity),
              "Next Action": activity.nextAction || "—",
            },
          })
        )
      );
    } else if (reportType === "notification-history") {
      reportRows.push(
        ...reportCommunications.map((communication) => {
          const company = organisations.find(
            (item) =>
              item.name.trim().toLocaleLowerCase() ===
              (communication.organisation || "").trim().toLocaleLowerCase()
          );
          const linkedRecord = records.find(
            (record) =>
              record.id === communication.recordId &&
              record.organisationId === company?.id
          );
          const linkedTask = recurringTasks.find(
            (task) =>
              task.id === communication.relatedTaskId &&
              task.organisationId === company?.id
          );
          return createReportRow({
            id: `communication:${communication.id}`,
            organisationId: company?.id || "",
            type: communication.type,
            status: communication.deliveryStatus,
            dueDate: communication.date,
            category: communication.type,
            person: "",
            priority: "",
            cells: {
              Organisation: company?.name || "",
              Date: communication.date,
              Subject: communication.subject || "—",
              Type: communication.type,
              "Related Record / Task":
                linkedRecord?.name || linkedTask?.name || "—",
              "Delivery / Status":
                communication.outcome || communication.deliveryStatus,
              "Next Follow-up": communication.nextFollowUp || "—",
            },
          });
        })
      );
    } else {
      reportRows.push(
        ...selectedOrganisations.flatMap((item) => {
          const clientRecords = reportRecords.filter(
            (record) => record.organisationId === item.id
          );
          const monthWork = snapshot.tasks.filter(
            (work) =>
              work.organisationId === item.id &&
              dateIsInReportMonth(work.dueDate)
          );
          const monthCompleted = snapshot.completed.filter(
            (work) =>
              work.organisationId === item.id &&
              dateIsInReportMonth(work.dueDate)
          );
          const monthActivities = monthlyCalendarActivities.filter(
            (activity) => activity.organisationId === item.id
          );
          const monthNotifications = reportCommunications.filter(
            (communication) =>
              communication.organisation?.trim().toLocaleLowerCase() ===
                item.name.trim().toLocaleLowerCase() &&
              dateIsInReportMonth(communication.date)
          );
          const monthExpiring = clientRecords.filter(
            (record) =>
              dateIsInReportMonth(record.expiryDate) &&
              !["Completed", "Paused"].includes(record.status)
          );
          const monthExpired = monthExpiring.filter(
            (record) => getOperationalStatus(record) === "Expired"
          );
          if (
            clientRecords.length === 0 &&
            monthWork.length === 0 &&
            monthCompleted.length === 0 &&
            monthNotifications.length === 0
          ) {
            return [];
          }
          return [createReportRow({
            id: `summary:${item.id}:${reportMonth}`,
            organisationId: item.id,
            type: "Monthly summary",
            status: "Current",
            category: "Management",
            person: "",
            priority: "",
            cells: {
              Organisation: item.name,
              "Reporting Month": formatCalendarMonth(reportMonth),
              "Monitored Records": clientRecords.length,
              "Expired Records": monthExpired.length,
              "Expiring Records": monthExpiring.length - monthExpired.length,
              "Overdue Work": monthWork.filter((work) => work.status === "Overdue").length,
              "Completed Work": monthCompleted.length,
              "Calendar Activities": monthActivities.length,
              Notifications: monthNotifications.length,
            },
          })];
        })
      );
    }

    return reportRows;
  }, [
    organisations,
    organisation,
    scopedRecords,
    clientCommunications,
    reportType,
    reportMonth,
    scopedWorkItems,
    scopedCompletedWork,
    monthlyCalendarActivities,
    records,
    recurringTasks,
    snapshot.tasks,
    snapshot.completed,
  ]);

  const selectedReportName =
    consultantReportTypes.find((item) => item.id === reportType)?.label ||
    "Operational Report";
  const selectedOrganisationName =
    organisation === "All"
      ? "All authorised organisations"
      : organisations.find((item) => item.id === organisation)?.name ||
        "All authorised organisations";
  const selectedReportPeriod =
    reportType === "monthly-calendar" ||
    reportType === "monthly-monitoring-summary"
      ? formatCalendarMonth(reportMonth)
      : reportType === "expiring-records"
        ? `Next 30 days from ${clientBusinessToday()}`
        : reportType === "notification-history"
          ? "All available history"
          : "Current monitoring position";

  function clearFilters() {
    setSearch("");
    setOrganisation("All");
    setCategoryOne("All");
    setCategoryTwo("All");
    setRisk("All");
    setStatus("All");
    setPeriod("all");
    setSummaryFilter("all");
    setSelectedRecordId(null);
  }

  function selectMetric(
    value: SummaryFilter
  ) {
    setSummaryFilter((current) =>
      current === value ? "all" : value
    );

    setStatus("All");
    setPeriod("all");
  }

  function changeCategoryOne(
    value: "All" | CategoryOne
  ) {
    setCategoryOne(value);
    setCategoryTwo("All");
  }

  function selectClientStatus(
    organisationId: string,
    selectedStatus:
      | SummaryFilter
      | "high-risk"
      | "requires-action"
  ) {
    setOrganisation(organisationId);
    setCategoryOne("All");
    setCategoryTwo("All");
    setRisk("All");
    setSummaryFilter(selectedStatus);
    setStatus("All");
    setPeriod("all");

    document
      .getElementById("report-filters")
      ?.scrollIntoView({
        behavior: "smooth",
      });
  }

  async function exportSelectedReport(
    format: ClientReportFormat
  ) {
    if (!selectedReportRows.length) {
      setNotice("No items match this report.");
      return;
    }

    try {
      await exportClientReport({
        format,
        organisation: selectedOrganisationName,
        reportTitle: selectedReportName,
        periodLabel: selectedReportPeriod,
        columns: consultantReportColumns[reportType].map((column) =>
          column === "Organisation" ? "Organisation Name" : column
        ),
        rows: selectedReportRows.map((row) => ({
          ...row,
          cells: {
            ...row.cells,
            "Organisation Name": row.cells.Organisation || "",
          },
        })),
      });
      setNotice(`${selectedReportName} was downloaded.`);
    } catch (error) {
      console.error("Could not export the selected consultant report.", error);
      setNotice("The report could not be downloaded. Please try again.");
    }
  }

  function printSelectedReport() {
    if (!selectedReportRows.length) {
      setNotice("No items match this report.");
      return;
    }

    const cleanup = () => {
      document.body.classList.remove("consultant-report-print-active");
    };
    document.body.classList.add("consultant-report-print-active");
    window.addEventListener("afterprint", cleanup, { once: true });
    window.print();
    window.setTimeout(cleanup, 1000);
  }

  function exportReport() {
    void exportSelectedReport("csv");
  }

  function exportClientSummary() {
    downloadCsv(
      "deadline-monitor-client-summary.csv",
      [
        [
          "Organisation",
          "Total",
          "Current",
          "Due Soon",
          "Expired",
          "Awaiting Client",
          "High Risk",
          "Requires Action",
        ],

        ...clientSummaries.map(
          (item) => [
            item.organisation,
            String(item.total),
            String(item.current),
            String(item.dueSoon),
            String(item.expired),
            String(item.awaiting),
            String(item.highRisk),
            String(item.requiresAction),
          ]
        ),
      ]
    );

    setNotice(
      "The client summary was downloaded."
    );
  }

  function exportRecurringTaskReport() {
    downloadCsv("deadline-monitor-recurring-tasks.csv", [
      ["Task", "Organisation", "Owner", "Reviewer", "Recurrence", "Schedule Status", "Occurrences", "Completed", "Overdue", "Failed"],
      ...scopedRecurringTasks.map((task) => {
        const occurrences = scopedTaskOccurrences.filter((item) =>
          item.organisationId === task.organisationId &&
          item.recurringTaskId === task.id
        );
        return [
          task.name,
          organisations.find((item) => item.id === task.organisationId)?.name || task.organisationId,
          task.ownerId,
          task.reviewerId || "",
          task.recurrence.frequency,
          task.status,
          String(occurrences.length),
          String(occurrences.filter((item) => item.status === "completed").length),
          String(occurrences.filter((item) => item.status === "overdue").length),
          String(occurrences.filter((item) => item.status === "failed").length),
        ];
      }),
    ]);
    setNotice("The recurring task report was downloaded.");
  }

  function generateClientReport() {
    if (organisation === "All") {
      setNotice(
        "Select a client before generating a client report."
      );

      return;
    }

    setNotice(`Print view prepared for ${selectedOrganisationName}.`);
    printSelectedReport();
  }

  return (
    <WorkspaceShell
      eyebrow="Reports and Audit"
      title="Reports"
      actions={
        <div className="flex flex-wrap gap-3 print:hidden">
          <button
            type="button"
            onClick={exportReport}
            disabled={!selectedReportRows.length}
            className="min-h-[44px] rounded-xl border border-teal-600 bg-white px-5 font-semibold text-teal-700 hover:bg-teal-50"
          >
            Export CSV
          </button>

          <button
            type="button"
            onClick={() => void exportSelectedReport("xlsx")}
            disabled={!selectedReportRows.length}
            className="min-h-[44px] rounded-xl border border-slate-300 bg-white px-5 font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Export Excel
          </button>

          <button
            type="button"
            onClick={() => void exportSelectedReport("docx")}
            disabled={!selectedReportRows.length}
            className="min-h-[44px] rounded-xl border border-slate-300 bg-white px-5 font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Export Word
          </button>

          <button
            type="button"
            onClick={() => void exportSelectedReport("pdf")}
            disabled={!selectedReportRows.length}
            className="min-h-[44px] rounded-xl border border-slate-300 bg-white px-5 font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Download PDF
          </button>

          {organisation !== "All" && (
            <button
              type="button"
              onClick={generateClientReport}
              className="min-h-[44px] rounded-xl border border-slate-300 bg-white px-5 font-semibold text-slate-700 hover:bg-slate-50"
            >
              Generate Client Report
            </button>
          )}

          <button
            type="button"
            onClick={printSelectedReport}
            disabled={!selectedReportRows.length}
            className="min-h-[44px] rounded-xl bg-teal-600 px-5 font-semibold text-white hover:bg-teal-700"
          >
            Print Report
          </button>
        </div>
      }
    >
      <style jsx global>{`
        @media print {
          aside {
            display: none !important;
          }

          main {
            height: auto !important;
            overflow: visible !important;
          }

          body {
            background: white !important;
          }

          .report-print-header {
            display: block !important;
          }

          .report-page-break {
            break-before: page;
          }

          body.consultant-report-print-active #reports-content > :not(#selected-report-preview) {
            display: none !important;
          }

          body.consultant-report-print-active #selected-report-preview {
            display: block !important;
            border: 0 !important;
            box-shadow: none !important;
          }

          @page {
            margin: 16mm;
          }
        }
      `}</style>

      <div id="reports-content" className="space-y-6 p-5 lg:p-7">
        {recordLoadError && (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            Report record data is unavailable: {recordLoadError}
          </div>
        )}
        {/* PRINT HEADER */}
        <section className="report-print-header hidden border-b-2 border-teal-600 pb-5">
          <p className="text-sm font-bold uppercase tracking-wider text-teal-700">
            Deadline-Monitor
          </p>

          <h1 className="mt-1 text-3xl font-bold text-slate-950">
            Monthly Monitoring Report
          </h1>

          <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
            <p>
              <strong>Client:</strong>{" "}
              {selectedOrganisationName}
            </p>

            <p>
              <strong>Generated:</strong>{" "}
              {generatedDate()}
            </p>

            <p>
              <strong>Reporting period:</strong>{" "}
              Current monitoring position
            </p>

            <p>
              <strong>Prepared by:</strong>{" "}
              Hlokomela Ramaoto
            </p>
          </div>
        </section>

        {notice && (
          <div
            role="status"
            className="flex justify-between gap-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 font-medium text-emerald-800 print:hidden"
          >
            <span>{notice}</span>

            <button
              type="button"
              onClick={() => setNotice("")}
              aria-label="Close message"
              className="font-bold"
            >
              ×
            </button>
          </div>
        )}

        <section
          aria-label="Report scope and selection"
          className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-2 xl:grid-cols-3 print:hidden"
        >
          <label className="grid gap-2 text-sm font-semibold text-slate-700">
            Organisation
            <select
              value={organisation}
              onChange={(event) => {
                setOrganisation(event.target.value);
                setCategoryOne("All");
                setCategoryTwo("All");
                setRisk("All");
                setStatus("All");
                setPeriod("all");
                setSummaryFilter("all");
                setSelectedRecordId(null);
              }}
              className="min-h-[46px] cursor-pointer rounded-xl border border-slate-300 bg-white px-4"
            >
              <option value="All">All authorised organisations</option>
              {organisations.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-2 text-sm font-semibold text-slate-700">
            Report
            <select
              value={reportType}
              onChange={(event) =>
                setReportType(event.target.value as ConsultantReportType)
              }
              className="min-h-[46px] cursor-pointer rounded-xl border border-slate-300 bg-white px-4"
            >
              {consultantReportTypes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          {(reportType === "monthly-calendar" ||
            reportType === "monthly-monitoring-summary") && (
            <label className="grid gap-2 text-sm font-semibold text-slate-700">
              Reporting month
              <input
                type="month"
                value={reportMonth}
                onChange={(event) => setReportMonth(event.target.value)}
                className="min-h-[46px] cursor-pointer rounded-xl border border-slate-300 bg-white px-4"
              />
            </label>
          )}
        </section>

        <section
          id="selected-report-preview"
          aria-labelledby="selected-report-heading"
          className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
        >
          <div className="border-b border-slate-200 p-5">
            <p className="text-sm font-bold uppercase tracking-wider text-teal-700">
              Deadline-Monitor
            </p>
            <h2
              id="selected-report-heading"
              className="mt-1 text-xl font-bold text-slate-950"
            >
              {selectedOrganisationName}
            </h2>
            <p className="mt-1 text-lg font-semibold text-slate-800">
              {selectedReportName}
            </p>
            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-500">
              <span>Period: {selectedReportPeriod}</span>
              <span>Generated: {generatedAt || "—"}</span>
              <span>{selectedReportRows.length} items</span>
            </div>
          </div>

          {selectedReportRows.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
                  <tr>
                    {consultantReportColumns[reportType].map((column) => (
                      <th key={column} scope="col" className="px-4 py-3">
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {selectedReportRows.map((row) => (
                    <tr key={row.id}>
                      {consultantReportColumns[reportType].map((column) => (
                        <td key={column} className="px-4 py-3 align-top text-slate-700">
                          {String(row.cells[column] ?? "—")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="p-8 text-center font-medium text-slate-600">
              No items match this report.
            </p>
          )}

          <p className="border-t border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
            {reportDisclaimer}
          </p>
        </section>

        {/* METRICS */}
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Requires Action"
            value={metrics.requiresAction}
            description="Expired, due or outstanding"
            colour="text-red-600"
            active={
              summaryFilter ===
              "requires-action"
            }
            onClick={() =>
              selectMetric("requires-action")
            }
          />

          <MetricCard
            label="High Risk"
            value={metrics.highRisk}
            description="Show high-risk records"
            colour="text-red-600"
            active={
              summaryFilter === "high-risk"
            }
            onClick={() =>
              selectMetric("high-risk")
            }
          />

          <MetricCard
            label="Current"
            value={metrics.current}
            description="Show current records"
            colour="text-emerald-600"
            active={
              summaryFilter === "current"
            }
            onClick={() =>
              selectMetric("current")
            }
          />

          <MetricCard
            label="Due Soon"
            value={metrics.dueSoon}
            description="Show upcoming renewals"
            colour="text-amber-600"
            active={
              summaryFilter === "due-soon"
            }
            onClick={() =>
              selectMetric("due-soon")
            }
          />

          <MetricCard
            label="Expired"
            value={metrics.expired}
            description="Show expired records"
            colour="text-red-600"
            active={
              summaryFilter === "expired"
            }
            onClick={() =>
              selectMetric("expired")
            }
          />

          <MetricCard
            label="Awaiting Client"
            value={metrics.awaiting}
            description="Show outstanding responses"
            colour="text-cyan-700"
            active={
              summaryFilter ===
              "awaiting-client"
            }
            onClick={() =>
              selectMetric("awaiting-client")
            }
          />

          <MetricCard
            label="Completed"
            value={metrics.completed}
            description="Show completed records"
            colour="text-slate-600"
            active={
              summaryFilter === "completed"
            }
            onClick={() =>
              selectMetric("completed")
            }
          />

          <MetricCard
            label="Total Records"
            value={metrics.total}
            description="Show all records"
            colour="text-slate-950"
            active={summaryFilter === "all"}
            onClick={() =>
              selectMetric("all")
            }
          />
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 p-5">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Recurring Task Status</h2>
              <p className="mt-1 text-sm text-slate-500">Prototype schedule and occurrence counts. Generation does not send reminders.</p>
            </div>
            <button type="button" onClick={exportRecurringTaskReport} disabled={scopedRecurringTasks.length === 0} className="min-h-[42px] rounded-xl border border-slate-300 px-4 font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50">Export Task CSV</button>
          </div>
          <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-5">
            {[
              ["Active schedules", taskStatusCounts.activeSchedules],
              ["Paused schedules", taskStatusCounts.pausedSchedules],
              ["Cancelled schedules", taskStatusCounts.cancelledSchedules],
              ["Completed occurrences", taskStatusCounts.occurrenceCounts.completed],
              ["Overdue / failed", taskStatusCounts.occurrenceCounts.overdue + taskStatusCounts.occurrenceCounts.failed],
            ].map(([label, value]) => <div key={label} className="rounded-xl bg-slate-50 p-4"><p className="text-sm text-slate-500">{label}</p><p className="mt-1 text-2xl font-bold text-slate-950">{value}</p></div>)}
          </div>
          <div className="divide-y divide-slate-200">
            {scopedRecurringTasks.map((task) => {
              const occurrences = scopedTaskOccurrences.filter((item) =>
                item.organisationId === task.organisationId &&
                item.recurringTaskId === task.id
              );
              const company = organisations.find((item) => item.id === task.organisationId)?.name || task.organisationId;
              return <article key={`${task.organisationId}:${task.id}`} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"><div><Link href={`/recurring-tasks/${task.id}`} className="font-semibold text-teal-700">{task.name}</Link><p className="mt-1 text-sm text-slate-500">{company} · {task.recurrence.frequency} · {task.status}</p></div><p className="text-sm text-slate-600">{occurrences.length} occurrence{occurrences.length === 1 ? "" : "s"} · {occurrences.filter((item) => item.status === "completed").length} completed · {occurrences.filter((item) => item.status === "failed" || item.status === "overdue").length} overdue/failed</p></article>;
            })}
            {scopedRecurringTasks.length === 0 && <p className="p-8 text-center text-slate-500">No recurring task data to report yet.</p>}
          </div>
        </section>

        {/* CLIENT SUMMARY */}
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 p-5">
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                Client Summary
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Select a company or individual
                statistic to filter the report.
              </p>
            </div>

            <button
              type="button"
              onClick={exportClientSummary}
              className="rounded-xl border border-slate-300 px-5 py-3 font-semibold text-slate-700 hover:bg-slate-50 print:hidden"
            >
              Export Summary
            </button>
          </div>

          <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
            {clientSummaries.map((client) => (
              <article
                key={client.organisationId}
                className={`rounded-xl border p-5 ${
                  organisation ===
                  client.organisationId
                    ? "border-teal-600 bg-teal-50 ring-2 ring-teal-100"
                    : "border-slate-200"
                }`}
              >
                <button
                  type="button"
                  onClick={() =>
                    selectClientStatus(
                      client.organisationId,
                      "all"
                    )
                  }
                  className="w-full text-left"
                >
                  <h3 className="font-bold text-slate-900">
                    {client.organisation}
                  </h3>

                  <p className="mt-1 text-sm text-slate-500">
                    {client.total} monitored records
                  </p>
                </button>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      selectClientStatus(
                        client.organisationId,
                        "requires-action"
                      )
                    }
                    className="rounded-lg bg-red-50 p-2 text-left text-sm font-semibold text-red-700"
                  >
                    Action: {client.requiresAction}
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      selectClientStatus(
                        client.organisationId,
                        "high-risk"
                      )
                    }
                    className="rounded-lg bg-red-50 p-2 text-left text-sm font-semibold text-red-700"
                  >
                    High Risk: {client.highRisk}
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      selectClientStatus(
                        client.organisationId,
                        "current"
                      )
                    }
                    className="rounded-lg bg-emerald-50 p-2 text-left text-sm font-semibold text-emerald-700"
                  >
                    Current: {client.current}
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      selectClientStatus(
                        client.organisationId,
                        "due-soon"
                      )
                    }
                    className="rounded-lg bg-amber-50 p-2 text-left text-sm font-semibold text-amber-700"
                  >
                    Due: {client.dueSoon}
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      selectClientStatus(
                        client.organisationId,
                        "expired"
                      )
                    }
                    className="rounded-lg bg-red-50 p-2 text-left text-sm font-semibold text-red-700"
                  >
                    Expired: {client.expired}
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      selectClientStatus(
                        client.organisationId,
                        "awaiting-client"
                      )
                    }
                    className="rounded-lg bg-cyan-50 p-2 text-left text-sm font-semibold text-cyan-700"
                  >
                    Awaiting: {client.awaiting}
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* FILTERS */}
        <section
          id="report-filters"
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm print:hidden"
        >
          <div className="flex justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                Report Filters
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Refine the report before exporting.
              </p>
            </div>

            <button
              type="button"
              onClick={clearFilters}
              className="font-semibold text-teal-700"
            >
              Clear All
            </button>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <input
              type="search"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search document, organisation or contact..."
              className="min-h-[46px] rounded-xl border border-slate-300 px-4"
            />

            <select
              value={categoryOne}
              onChange={(event) =>
                changeCategoryOne(
                  event.target.value as
                    | "All"
                    | CategoryOne
                )
              }
              className="min-h-[46px] rounded-xl border border-slate-300 bg-white px-4"
            >
              <option value="All">
                All Category 1
              </option>

              {categoryOneOptions.map(
                (category) => (
                  <option
                    key={category}
                    value={category}
                  >
                    {category}
                  </option>
                )
              )}
            </select>

            <select
              value={categoryTwo}
              onChange={(event) =>
                setCategoryTwo(
                  event.target.value
                )
              }
              className="min-h-[46px] rounded-xl border border-slate-300 bg-white px-4"
            >
              <option value="All">
                All Category 2
              </option>

              {categoryTwoOptions.map(
                (category) => (
                  <option
                    key={category}
                    value={category}
                  >
                    {category}
                  </option>
                )
              )}
            </select>

            <select
              value={risk}
              onChange={(event) =>
                setRisk(
                  event.target.value as RiskFilter
                )
              }
              className="min-h-[46px] rounded-xl border border-slate-300 bg-white px-4"
            >
              <option value="All">
                All Risks
              </option>
              <option value="High">High</option>
              <option value="Medium">
                Medium
              </option>
              <option value="Low">Low</option>
            </select>

            <select
              value={status}
              onChange={(event) =>
                setStatus(
                  event.target.value as StatusFilter
                )
              }
              className="min-h-[46px] rounded-xl border border-slate-300 bg-white px-4"
            >
              <option value="All">
                All Statuses
              </option>
              <option value="Current">
                Current
              </option>
              <option value="Due soon">
                Due soon
              </option>
              <option value="Expired">
                Expired
              </option>
              <option value="Awaiting client">
                Awaiting client
              </option>
              <option value="Completed">
                Completed
              </option>
            </select>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {[
              ["all", "All Dates"],
              ["expired", "Expired"],
              ["today", "Today"],
              ["7", "7 Days"],
              ["14", "14 Days"],
              ["30", "30 Days"],
              ["60", "60 Days"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() =>
                  setPeriod(
                    value as PeriodFilter
                  )
                }
                className={`min-h-[40px] rounded-lg px-4 text-sm font-semibold ${
                  period === value
                    ? "bg-teal-600 text-white"
                    : "bg-slate-100 text-slate-700"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </section>

        {/* MONITORING REPORT */}
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap justify-between gap-4 border-b border-slate-200 p-5">
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                Monitoring Report
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                {filteredRecords.length} records
                included
              </p>
            </div>

            <Link
              href="/monitored-records"
              className="font-semibold text-teal-700 print:hidden"
            >
              Open Record Register →
            </Link>
          </div>

          <div className="hidden lg:block">
            <table className="dm-data-table w-full table-fixed">
              <thead className="bg-slate-50">
                <tr>
                  <th className="w-[25%] p-4 text-left">
                    Document
                  </th>
                  <th className="w-[22%] p-4 text-left">
                    Organisation
                  </th>
                  <th className="w-[16%] p-4 text-left">
                    Expiry
                  </th>
                  <th className="w-[10%] p-4 text-left">
                    Risk
                  </th>
                  <th className="w-[14%] p-4 text-left">
                    Status
                  </th>
                  <th className="w-[13%] p-4 text-right print:hidden">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-200">
                {filteredRecords.map(
                  (record) => {
                    const action =
                      getAction(record);

                    return (
                      <tr
                        key={record.id}
                        onClick={() =>
                          setSelectedRecordId(
                            record.id
                          )
                        }
                        className="cursor-pointer hover:bg-slate-50"
                      >
                        <td className="p-4">
                          <Link
                            href={`/monitored-records/${record.id}`}
                            onClick={(event) =>
                              event.stopPropagation()
                            }
                            className="font-bold text-slate-900 hover:text-teal-700"
                          >
                            {record.name}
                          </Link>

                          <p className="mt-1 text-sm text-slate-500">
                            {record.category} ·{" "}
                            {record.category2}
                          </p>
                        </td>

                        <td className="break-words p-4 text-slate-600">
                          {record.organisation}
                        </td>

                        <td className="p-4">
                          <p className="font-medium">
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
                                : "text-slate-500"
                            }`}
                          >
                            {dueDescription(
                              record.expiryDate
                            )}
                          </p>
                        </td>

                        <td className="p-4">
                          <RiskBadge
                            risk={record.risk}
                          />
                        </td>

                        <td className="p-4">
                          <StatusBadge
                            status={getOperationalStatus(
                              record
                            )}
                          />
                        </td>

                        <td className="p-4 text-right print:hidden">
                          <Link
                            href={action.href}
                            onClick={(event) =>
                              event.stopPropagation()
                            }
                            className={`inline-flex min-h-[42px] items-center rounded-xl px-4 font-semibold ${action.classes}`}
                          >
                            {action.label}
                          </Link>
                        </td>
                      </tr>
                    );
                  }
                )}
              </tbody>
            </table>
          </div>

          <div className="divide-y divide-slate-200 lg:hidden">
            {filteredRecords.map((record) => {
              const action =
                getAction(record);

              return (
                <article
                  key={record.id}
                  className="space-y-4 p-5"
                >
                  <div>
                    <Link
                      href={`/monitored-records/${record.id}`}
                      className="font-bold text-slate-900"
                    >
                      {record.name}
                    </Link>

                    <p className="mt-1 text-sm text-slate-600">
                      {record.organisation}
                    </p>

                    <p className="mt-1 text-sm text-slate-500">
                      {record.category} ·{" "}
                      {record.category2}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <RiskBadge
                      risk={record.risk}
                    />

                    <StatusBadge
                      status={getOperationalStatus(
                        record
                      )}
                    />
                  </div>

                  <Link
                    href={action.href}
                    className={`inline-flex min-h-[44px] w-full items-center justify-center rounded-xl px-5 font-semibold ${action.classes}`}
                  >
                    {action.label}
                  </Link>
                </article>
              );
            })}
          </div>

          {!filteredRecords.length && (
            <div className="p-12 text-center">
              <p className="font-semibold">
                No matching records found.
              </p>

              <button
                type="button"
                onClick={clearFilters}
                className="mt-3 font-semibold text-teal-700 print:hidden"
              >
                Clear filters
              </button>
            </div>
          )}
        </section>

        {/* SELECTED RECORD */}
        {selectedRecord && (
          <section className="rounded-2xl border border-teal-200 bg-white p-5 shadow-sm print:hidden">
            <div className="flex flex-wrap justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">
                  Selected Record
                </p>

                <h2 className="mt-1 text-xl font-bold">
                  {selectedRecord.name}
                </h2>

                <p className="mt-1 text-slate-500">
                  {selectedRecord.organisation}
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setSelectedRecordId(null)
                }
                className="font-bold text-slate-500"
              >
                × Close
              </button>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href={`/monitored-records/${selectedRecord.id}`}
                className="rounded-xl bg-slate-950 px-5 py-3 font-semibold text-white"
              >
                View Record
              </Link>

              <Link
                href={`/reminders?record=${encodeURIComponent(
                  selectedRecord.id
                )}&action=review`}
                className="rounded-xl bg-teal-600 px-5 py-3 font-semibold text-white"
              >
                Review Reminder
              </Link>

              <Link
                href={`/audit-history?record=${encodeURIComponent(
                  selectedRecord.id
                )}`}
                className="rounded-xl border border-slate-300 px-5 py-3 font-semibold"
              >
                Audit History
              </Link>
            </div>
          </section>
        )}

        {/* NOTIFICATION HISTORY */}
        <section className="report-page-break rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold">
                Notification History
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Deduplicated reminders and
                follow-ups.
              </p>
            </div>

            <Link
              href="/reminders"
              className="font-semibold text-teal-700 print:hidden"
            >
              Open Reminder Workspace →
            </Link>
          </div>

          <div className="mt-5 divide-y divide-slate-200">
            {clientCommunications
              .slice(0, 10)
              .map((communication) => {
                const record = records.find(
                  (item) =>
                    item.id ===
                    communication.recordId &&
                    item.organisationId ===
                      organisations.find((company) =>
                        company.name.trim().toLocaleLowerCase() ===
                        (communication.organisation || "").trim().toLocaleLowerCase()
                      )?.id
                );

                return (
                  <article
                    key={communication.id}
                    className="flex flex-col gap-3 py-4 sm:flex-row sm:justify-between"
                  >
                    <div>
                      <Link
                        href={`/monitored-records/${communication.recordId}`}
                        className="font-bold text-slate-900 hover:text-teal-700"
                      >
                        {record?.name ||
                          communication.recordId}
                      </Link>

                      <div className="mt-2 flex flex-wrap gap-2">
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                          {communication.type}
                        </span>

                        <DeliveryBadge
                          outcome={
                            communication.outcome
                          }
                        />
                      </div>

                      <p className="mt-2 text-sm text-slate-500">
                        Recipient:{" "}
                        {communication.recipient}
                      </p>
                    </div>

                    <div className="text-sm text-slate-500 sm:text-right">
                      <p>{communication.date}</p>

                      <p className="mt-1">
                        Next follow-up:{" "}
                        {displayDate(
                          communication.nextFollowUp
                        )}
                      </p>

                      <Link
                        href={`/monitored-records/${communication.recordId}`}
                        className="mt-2 inline-block font-semibold text-teal-700 print:hidden"
                      >
                        View Record →
                      </Link>
                    </div>
                  </article>
                );
              })}
          </div>

          {!clientCommunications.length && (
            <p className="mt-5 text-sm text-slate-500">
              No notification activity found.
            </p>
          )}
        </section>

        {/* DISCLAIMER */}
        <footer className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
          <strong>Important:</strong> Deadline-Monitor
          provides record monitoring and reminder
          services. The client remains responsible
          for renewal, record accuracy and regulatory
          compliance.
        </footer>
      </div>
    </WorkspaceShell>
  );
}