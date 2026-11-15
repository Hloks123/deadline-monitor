"use client";

import Link from "next/link";

import {
  Suspense,
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useSearchParams } from "next/navigation";

import WorkspaceShell from "@/components/workspace/WorkspaceShell";

import {
  addAuditEvent,
  addCommunication,
  CommunicationEvent,
  getCommunications,
  MonitoredRecord,
  saveCommunicationReview,
} from "@/lib/recordStore";
import {
  findAccessibleMonitoredRecord,
  httpMonitoredRecordRepository,
  loadAccessibleMonitoredRecords,
  type MonitoredRecordEntity,
} from "@/lib/monitoredRecords/repository";

type ReminderFilter =
  | "all"
  | "review"
  | "follow-up"
  | "awaiting-client"
  | "overdue"
  | "critical";

type WorkflowMode =
  | "queue"
  | "review"
  | "follow-up";

type ReminderTaskType =
  | "Review Required"
  | "Follow-up"
  | "Awaiting Client"
  | "Overdue"
  | "Critical";

type ReminderItem = {
  record: MonitoredRecordEntity;
  taskType: ReminderTaskType;
  priority: number;
  reviewClosed: boolean;
};

function parseDate(value: string) {
  if (!value) {
    return null;
  }

  const date = new Date(
    `${value}T00:00:00`
  );

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function todayDate() {
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
    (date.getTime() -
      todayDate().getTime()) /
      (1000 * 60 * 60 * 24)
  );
}

function displayDate(value: string) {
  const date = parseDate(value);

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

function expiryDescription(value: string) {
  const days = daysUntil(value);

  if (!Number.isFinite(days)) {
    return "No expiry date";
  }

  if (days < 0) {
    const overdueDays =
      Math.abs(days);

    return `${overdueDays} day${
      overdueDays === 1 ? "" : "s"
    } overdue`;
  }

  if (days === 0) {
    return "Due today";
  }

  return `${days} day${
    days === 1 ? "" : "s"
  } remaining`;
}

function getTaskType(
  record: MonitoredRecord
): ReminderTaskType {
  const expiryDays = daysUntil(
    record.expiryDate
  );

  const followUpDays = daysUntil(
    record.followUp
  );

  if (
    record.escalationLevel ===
    "Critical"
  ) {
    return "Critical";
  }

  if (
    record.status === "Expired" ||
    expiryDays < 0
  ) {
    return "Overdue";
  }

  if (
    record.status ===
      "Awaiting client" &&
    followUpDays <= 0
  ) {
    return "Follow-up";
  }

  if (
    record.status ===
    "Awaiting client"
  ) {
    return "Awaiting Client";
  }

  return "Review Required";
}

function getPriority(
  record: MonitoredRecord
) {
  const taskType =
    getTaskType(record);

  if (taskType === "Critical") {
    return 1;
  }

  if (
    taskType === "Overdue" &&
    record.risk === "High"
  ) {
    return 2;
  }

  if (taskType === "Overdue") {
    return 3;
  }

  if (
    taskType ===
      "Review Required" &&
    record.risk === "High"
  ) {
    return 4;
  }

  if (taskType === "Follow-up") {
    return 5;
  }

  if (
    taskType ===
    "Review Required"
  ) {
    return 6;
  }

  return 7;
}

function RiskBadge({
  risk,
}: {
  risk: MonitoredRecord["risk"];
}) {
  const styles = {
    High: "bg-red-100 text-red-700",
    Medium:
      "bg-amber-100 text-amber-700",
    Low: "bg-emerald-100 text-emerald-700",
  };

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ${styles[risk]}`}
    >
      {risk} Risk
    </span>
  );
}

function TaskBadge({
  taskType,
}: {
  taskType: ReminderTaskType;
}) {
  const styles = {
    Critical:
      "bg-red-600 text-white",

    Overdue:
      "bg-red-100 text-red-700",

    "Review Required":
      "bg-amber-100 text-amber-800",

    "Follow-up":
      "bg-teal-100 text-teal-800",

    "Awaiting Client":
      "bg-cyan-100 text-cyan-800",
  };

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ${styles[taskType]}`}
    >
      {taskType}
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
      "bg-slate-100 text-slate-700",

    "Follow-up required":
      "bg-amber-100 text-amber-800",

    Escalated:
      "bg-orange-100 text-orange-800",

    Critical:
      "bg-red-600 text-white",
  };

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ${styles[level]}`}
    >
      {level}
    </span>
  );
}

function DeliveryBadge({
  status,
}: {
  status:
    CommunicationEvent["deliveryStatus"];
}) {
  const styles = {
    Draft:
      "bg-slate-100 text-slate-700",

    Approved:
      "bg-blue-100 text-blue-700",

    Sent:
      "bg-cyan-100 text-cyan-700",

    Delivered:
      "bg-emerald-100 text-emerald-700",

    Failed:
      "bg-red-100 text-red-700",

    Bounced:
      "bg-orange-100 text-orange-700",

    Suppressed:
      "bg-slate-200 text-slate-700",
  };

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${styles[status]}`}
    >
      {status}
    </span>
  );
}

function SummaryCard({
  label,
  value,
  colour,
  active,
  onClick,
}: {
  label: string;
  value: number;
  colour: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-2xl border bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-teal-500 ${
        active
          ? "border-teal-600 ring-2 ring-teal-100"
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

      <p className="mt-2 text-xs text-slate-400">
        Click to filter
      </p>
    </button>
  );
}

function RemindersContent() {
  const searchParams =
    useSearchParams();

  const requestedRecordId =
    searchParams.get("record") || "";

  const requestedAction =
    searchParams.get("action") ===
    "follow-up"
      ? "follow-up"
      : "review";
  const requestedFilter = searchParams.get("filter");

  const [records, setRecords] =
    useState<MonitoredRecordEntity[]>([]);

  const [
    communications,
    setCommunications,
  ] = useState<
    CommunicationEvent[]
  >([]);

  const [
    selectedRecord,
    setSelectedRecord,
  ] =
    useState<MonitoredRecordEntity | null>(
      null
    );

  const [mode, setMode] =
    useState<WorkflowMode>("queue");

  const [filter, setFilter] =
    useState<ReminderFilter>(
      requestedFilter === "review" ||
      requestedFilter === "follow-up" ||
      requestedFilter === "awaiting-client" ||
      requestedFilter === "overdue" ||
      requestedFilter === "critical"
        ? requestedFilter
        : "all"
    );

  const [search, setSearch] =
    useState("");

  const [subject, setSubject] =
    useState("");

  const [message, setMessage] =
    useState("");

  const [outcome, setOutcome] =
    useState("");

  const [
    nextFollowUp,
    setNextFollowUp,
  ] = useState("");

  const [notice, setNotice] =
    useState("");

  const [noticeType, setNoticeType] =
    useState<"success" | "error">(
      "success"
    );

  const [saving, setSaving] =
    useState(false);
  const [recordLoadError, setRecordLoadError] = useState("");

  async function loadData() {
    try {
      const savedRecords = await loadAccessibleMonitoredRecords();
      setRecords(savedRecords);
      setCommunications(getCommunications());
      setRecordLoadError("");
      return savedRecords;
    } catch (cause: unknown) {
      setRecordLoadError(
        cause instanceof Error ? cause.message : "Monitored records could not be loaded.",
      );
      return [];
    }
  }

  function showNotice(
    text: string,
    type:
      | "success"
      | "error" = "success"
  ) {
    setNotice(text);
    setNoticeType(type);
  }

  function prepareRecord(
    record: MonitoredRecordEntity,
    selectedMode:
      | "review"
      | "follow-up"
  ) {
    setSelectedRecord(record);
    setMode(selectedMode);
    setNotice("");
    setOutcome("");
    setSaving(false);

    setNextFollowUp(
      record.followUp
    );

    if (
      selectedMode === "review"
    ) {
      const urgent =
        record.status === "Expired" ||
        record.escalationLevel ===
          "Critical";

      setSubject(
        urgent
          ? `Urgent: ${record.name} requires attention`
          : `Reminder: ${record.name} requires attention`
      );

      setMessage(
        `Dear ${record.contact},

This is a reminder that ${record.name} for ${record.organisation} requires attention.

Current expiry date: ${displayDate(
          record.expiryDate
        )}
Current status: ${record.status}
Risk: ${record.risk}
Escalation: ${record.escalationLevel}

Please confirm the replacement or updated expiry date.

Regards,
Deadline-Monitor`
      );
    } else {
      setSubject(
        `Follow-up: ${record.name}`
      );

      setMessage(
        `Follow-up regarding ${record.name} for ${record.organisation}.

Current expiry date: ${displayDate(
          record.expiryDate
        )}
Current status: ${record.status}

Please confirm the current position and provide the replacement expiry date where applicable.`
      );
    }
  }

  useEffect(() => {
    let active = true;
    const refresh = () => void loadData();
    const initialLoad = async () => {
      const savedRecords = await loadData();
      if (requestedRecordId) {
        const requestedRecord = savedRecords.find(
          (record) => record.id === requestedRecordId,
        ) || await findAccessibleMonitoredRecord(requestedRecordId);
        if (active && requestedRecord) prepareRecord(requestedRecord, requestedAction);
      }
    };
    const frame = window.requestAnimationFrame(() => {
      void initialLoad().catch((cause: unknown) => {
        if (active) {
          setRecordLoadError(
            cause instanceof Error ? cause.message : "The requested record could not be loaded.",
          );
        }
      });
    });

    window.addEventListener(
      "deadline-monitor-updated",
      refresh
    );

    return () => {
      active = false;
      window.cancelAnimationFrame(frame);
      window.removeEventListener(
        "deadline-monitor-updated",
        refresh
      );
    };
  }, [
    requestedRecordId,
    requestedAction,
  ]);

  const reminderItems =
    useMemo<ReminderItem[]>(() => {
      return records
        .filter(
          (record) =>
            record.status !==
            "Completed"
        )
        .map((record) => ({
          record,

          taskType:
            getTaskType(record),

          priority:
            getPriority(record),
          reviewClosed: communications.some((communication) =>
            communication.recordId === record.id &&
            communication.type === "Reminder" &&
            (communication.decision === "approved" ||
              communication.decision === "suppressed" ||
              communication.deliveryStatus === "Approved" ||
              communication.deliveryStatus === "Suppressed") &&
            communication.nextFollowUp === record.followUp
          ),
        }))
        .sort(
          (first, second) =>
            first.priority -
            second.priority
        );
    }, [records, communications]);

  const counts = useMemo(() => {
    return {
      review:
        reminderItems.filter(
          (item) =>
            ["Review Required", "Overdue", "Critical"].includes(item.taskType) &&
            !item.reviewClosed
        ).length,

      followUp:
        reminderItems.filter(
          (item) =>
            item.taskType ===
            "Follow-up"
        ).length,

      awaiting:
        reminderItems.filter(
          (item) =>
            item.taskType ===
            "Awaiting Client"
        ).length,

      overdue:
        reminderItems.filter(
          (item) =>
            item.taskType ===
            "Overdue"
        ).length,

      critical:
        reminderItems.filter(
          (item) =>
            item.taskType ===
            "Critical"
        ).length,
    };
  }, [reminderItems]);

  const filteredItems =
    useMemo(() => {
      return reminderItems.filter(
        (item) => {
          const matchesFilter =
            filter === "all" ||
            (filter === "review" &&
              ["Review Required", "Overdue", "Critical"].includes(item.taskType) &&
              !item.reviewClosed) ||
            (filter ===
              "follow-up" &&
              item.taskType ===
                "Follow-up") ||
            (filter ===
              "awaiting-client" &&
              item.taskType ===
                "Awaiting Client") ||
            (filter ===
              "overdue" &&
              item.taskType ===
                "Overdue") ||
            (filter ===
              "critical" &&
              item.taskType ===
                "Critical");

          const searchableText = `
            ${item.record.name}
            ${item.record.organisation}
            ${item.record.category}
            ${item.record.category2}
            ${item.record.contact}
            ${item.record.contactEmail}
            ${item.record.status}
            ${item.record.risk}
            ${item.record.escalationLevel}
          `.toLowerCase();

          const matchesSearch =
            searchableText.includes(
              search.toLowerCase()
            );

          return (
            matchesFilter &&
            matchesSearch
          );
        }
      );
    }, [
      reminderItems,
      filter,
      search,
    ]);

  const uniqueCommunications =
    useMemo(() => {
      const seen =
        new Set<string>();

      return communications.filter(
        (communication) => {
          const key =
            communication.uniqueKey ||
            [
              communication.recordId,
              communication.type,
              communication.recipient,
              communication.nextFollowUp,
            ].join("|");

          if (seen.has(key)) {
            return false;
          }

          seen.add(key);

          return true;
        }
      );
    }, [communications]);

  function closeWorkflow() {
    setSelectedRecord(null);
    setMode("queue");
    setNotice("");
    setOutcome("");
    setSaving(false);
  }

  function clearFilters() {
    setSearch("");
    setFilter("all");
  }

  async function approveReminder(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (
      !selectedRecord ||
      !subject.trim() ||
      !message.trim() ||
      !nextFollowUp
    ) {
      showNotice(
        "Complete the subject, message and next follow-up date.",
        "error"
      );

      return;
    }

    setSaving(true);

    try {
      const savedRecord = await httpMonitoredRecordRepository.update(
        selectedRecord.organisationId,
        selectedRecord.id,
        selectedRecord.version,
        {
          status: "Awaiting client",
          followUp: nextFollowUp,
        },
      );
      const result = addCommunication({
        recordId:
          selectedRecord.id,

        type: "Reminder",

        recipient:
          selectedRecord.contactEmail ?? "",

        subject:
          subject.trim(),

        message:
          message.trim(),

        outcome:
          "Approved for manual sending; no message was sent.",

        deliveryStatus:
          "Approved",

        nextFollowUp,
        organisation: selectedRecord.organisation,
        decision: "approved",
        reviewer: "Prototype Consultant",
        reviewedAt: new Date().toISOString(),
        messageVersion: "inline-v1",
      });

      setSelectedRecord(savedRecord);
      if (!result.success) {
        setSaving(false);
        showNotice(result.message, "error");
        return;
      }

      setSaving(false);
      showNotice("Reminder approved for manual sending. No message was sent.");
      void loadData();
    } catch (cause: unknown) {
      setSaving(false);
      showNotice(
        cause instanceof Error ? cause.message : "The record update failed.",
        "error",
      );
    }
  }

  function suppressReminder() {
    if (!selectedRecord) {
      return;
    }

    const reviewDate =
      nextFollowUp ||
      selectedRecord.followUp ||
      selectedRecord.expiryDate;
    if (!subject.trim() || !message.trim() || !reviewDate) {
      showNotice("Enter the subject, message and follow-up date before recording the suppression decision.", "error");
      return;
    }

    saveCommunicationReview({
      recordId: selectedRecord.id,
      type: "Reminder",
      recipient: selectedRecord.contactEmail ?? "",
      subject: subject.trim(),
      message: message.trim(),
      outcome: "Suppressed by consultant; no message sent.",
      deliveryStatus: "Suppressed",
      nextFollowUp: reviewDate,
      organisation: selectedRecord.organisation,
      decision: "suppressed",
      reviewer: "Prototype Consultant",
      reviewedAt: new Date().toISOString(),
      messageVersion: "inline-v1",
    });

    addAuditEvent({
      recordId:
        selectedRecord.id,

      recordName:
        selectedRecord.name,

      organisation:
        selectedRecord.organisation,

      user:
        "Hlokomela Ramaoto",

      action:
        "Reminder suppressed",

      field:
        "notification",

      previousValue:
        "Pending consultant review",

      newValue:
        "Suppressed",
      entityType: "reminder",
      entityId: selectedRecord.id,
      entityName: selectedRecord.name,
      context: `Recipient ${selectedRecord.contactEmail ?? ""}; next follow-up ${reviewDate}`,
    });

    void loadData();
    showNotice(
      "Reminder suppression recorded. No message was sent."
    );
  }

  async function logFollowUp(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (
      !selectedRecord ||
      !message.trim() ||
      !outcome ||
      !nextFollowUp
    ) {
      showNotice(
        "Complete the notes, outcome and next follow-up date.",
        "error"
      );

      return;
    }

    setSaving(true);

    const newStatus:
      MonitoredRecord["status"] =
        outcome ===
        "Replacement confirmed"
          ? "Current"
          : "Awaiting client";

    const updatedRecord: MonitoredRecord =
      {
        ...selectedRecord,

        status:
          newStatus,

        followUp:
          nextFollowUp,

        lastConfirmed:
          outcome ===
          "Replacement confirmed"
            ? new Date()
                .toISOString()
                .slice(0, 10)
            : selectedRecord.lastConfirmed,

        confirmedBy:
          outcome ===
          "Replacement confirmed"
            ? selectedRecord.contact
            : selectedRecord.confirmedBy,
      };

    try {
      const savedRecord = await httpMonitoredRecordRepository.update(
        selectedRecord.organisationId,
        selectedRecord.id,
        selectedRecord.version,
        {
          status: updatedRecord.status,
          followUp: updatedRecord.followUp,
          lastConfirmed: updatedRecord.lastConfirmed,
          confirmedBy: updatedRecord.confirmedBy,
        },
      );
      const result = addCommunication({
        recordId: selectedRecord.id,
        type: "Follow-up",
        recipient: selectedRecord.contactEmail ?? "",
        subject: subject.trim() || `Follow-up: ${selectedRecord.name}`,
        message: message.trim(),
        outcome,
        deliveryStatus: "Draft",
        nextFollowUp,
        organisation: selectedRecord.organisation,
        decision: "draft",
        reviewer: "Prototype Consultant",
        messageVersion: "inline-v1",
      });
      setSelectedRecord(savedRecord);
      if (!result.success) {
        setSaving(false);
        showNotice(result.message, "error");
        return;
      }
    } catch (cause: unknown) {
      setSaving(false);
      showNotice(
        cause instanceof Error ? cause.message : "The follow-up update failed.",
        "error",
      );
      return;
    }

    setSaving(false);
    setOutcome("");

    showNotice(
      "Follow-up logged successfully."
    );

    void loadData();
  }

  return (
    <WorkspaceShell
      eyebrow="Reminder Workspace"
      title={
        selectedRecord
          ? selectedRecord.name
          : "Reminders"
      }
      actions={
        selectedRecord ? (
          <button
            type="button"
            onClick={closeWorkflow}
            className="rounded-xl border border-slate-300 bg-white px-5 py-3 font-semibold text-slate-700 hover:bg-slate-50"
          >
            Back to Queue
          </button>
        ) : (
          <Link
            href="/monitored-records"
            className="rounded-xl border border-slate-300 bg-white px-5 py-3 font-semibold text-slate-700 hover:bg-slate-50"
          >
            View Records
          </Link>
        )
      }
    >
      <div className="space-y-7 p-5 lg:p-7">
        {recordLoadError && (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            Reminder record data is unavailable: {recordLoadError}
          </div>
        )}
        {notice && (
          <div
            role={
              noticeType === "error"
                ? "alert"
                : "status"
            }
            className={`flex items-center justify-between gap-4 rounded-xl border p-4 font-medium ${
              noticeType === "error"
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-emerald-200 bg-emerald-50 text-emerald-800"
            }`}
          >
            <span>{notice}</span>

            <button
              type="button"
              onClick={() =>
                setNotice("")
              }
              aria-label="Close message"
              className="font-bold"
            >
              ×
            </button>
          </div>
        )}

        {mode === "queue" && (
          <>
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              <SummaryCard
                label="Critical"
                value={counts.critical}
                colour="text-red-600"
                active={
                  filter === "critical"
                }
                onClick={() =>
                  setFilter(
                    filter === "critical"
                      ? "all"
                      : "critical"
                  )
                }
              />

              <SummaryCard
                label="Pending Review"
                value={counts.review}
                colour="text-amber-600"
                active={
                  filter === "review"
                }
                onClick={() =>
                  setFilter(
                    filter === "review"
                      ? "all"
                      : "review"
                  )
                }
              />

              <SummaryCard
                label="Follow-ups"
                value={counts.followUp}
                colour="text-teal-600"
                active={
                  filter ===
                  "follow-up"
                }
                onClick={() =>
                  setFilter(
                    filter ===
                      "follow-up"
                      ? "all"
                      : "follow-up"
                  )
                }
              />

              <SummaryCard
                label="Awaiting Client"
                value={counts.awaiting}
                colour="text-cyan-700"
                active={
                  filter ===
                  "awaiting-client"
                }
                onClick={() =>
                  setFilter(
                    filter ===
                      "awaiting-client"
                      ? "all"
                      : "awaiting-client"
                  )
                }
              />

              <SummaryCard
                label="Overdue"
                value={counts.overdue}
                colour="text-red-600"
                active={
                  filter === "overdue"
                }
                onClick={() =>
                  setFilter(
                    filter === "overdue"
                      ? "all"
                      : "overdue"
                  )
                }
              />
            </section>

            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">
                      Consultant Action Queue
                    </h2>

                    <p className="mt-1 text-sm text-slate-500">
                      Review reminders and
                      client follow-ups.
                    </p>
                  </div>

                  <span
                    aria-live="polite"
                    className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-600"
                  >
                    {filteredItems.length}{" "}
                    action
                    {filteredItems.length ===
                    1
                      ? ""
                      : "s"}
                  </span>
                </div>

                <div className="mt-5 flex flex-col gap-3 lg:flex-row">
                  <input
                    type="search"
                    value={search}
                    onChange={(event) =>
                      setSearch(
                        event.target.value
                      )
                    }
                    placeholder="Search document, company or contact..."
                    className="min-h-[46px] min-w-0 flex-1 rounded-xl border border-slate-300 px-4 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                  />

                  <select
                    value={filter}
                    onChange={(event) =>
                      setFilter(
                        event.target
                          .value as ReminderFilter
                      )
                    }
                    className="min-h-[46px] rounded-xl border border-slate-300 bg-white px-4"
                  >
                    <option value="all">
                      All Actions
                    </option>

                    <option value="critical">
                      Critical
                    </option>

                    <option value="review">
                      Review Required
                    </option>

                    <option value="follow-up">
                      Follow-up
                    </option>

                    <option value="awaiting-client">
                      Awaiting Client
                    </option>

                    <option value="overdue">
                      Overdue
                    </option>
                  </select>

                  <button
                    type="button"
                    onClick={clearFilters}
                    className="min-h-[46px] rounded-xl border border-slate-300 px-5 font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Clear
                  </button>
                </div>
              </div>

              <div className="divide-y divide-slate-200">
                {filteredItems.map(
                  (item) => (
                    <article
                      key={
                        item.record.id
                      }
                      className="p-5 hover:bg-slate-50 lg:p-6"
                    >
                      <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
                        <div className="min-w-0">
                          <Link
                            href={`/monitored-records/${item.record.id}`}
                            className="text-lg font-bold text-slate-900 hover:text-teal-700"
                          >
                            {
                              item.record
                                .name
                            }
                          </Link>

                          <p className="mt-1 text-slate-600">
                            {
                              item.record
                                .organisation
                            }
                          </p>

                          <p className="mt-1 text-sm text-slate-500">
                            {
                              item.record
                                .category
                            }{" "}
                            ·{" "}
                            {
                              item.record
                                .category2
                            }
                          </p>

                          <div className="mt-3 grid gap-2 text-sm text-slate-500 sm:grid-cols-2">
                            <p>
                              <strong>
                                Expiry:
                              </strong>{" "}
                              {displayDate(
                                item.record
                                  .expiryDate
                              )}
                            </p>

                            <p>
                              <strong>
                                Due:
                              </strong>{" "}
                              {expiryDescription(
                                item.record
                                  .expiryDate
                              )}
                            </p>

                            <p>
                              <strong>
                                Follow-up:
                              </strong>{" "}
                              {displayDate(
                                item.record
                                  .followUp
                              )}
                            </p>

                            <p>
                              <strong>
                                Contact:
                              </strong>{" "}
                              {
                                item.record
                                  .contact
                              }
                            </p>
                          </div>

                          <div className="mt-4 flex flex-wrap gap-2">
                            <RiskBadge
                              risk={
                                item.record
                                  .risk
                              }
                            />

                            <TaskBadge
                              taskType={
                                item.taskType
                              }
                            />

                            <EscalationBadge
                              level={
                                item.record
                                  .escalationLevel
                              }
                            />
                          </div>
                        </div>

                        <div className="flex shrink-0 flex-wrap gap-3">
                          {(item.taskType ===
                            "Review Required" ||
                            item.taskType ===
                              "Overdue" ||
                            item.taskType ===
                              "Critical") && (
                            <button
                              type="button"
                              onClick={() =>
                                prepareRecord(
                                  item.record,
                                  "review"
                                )
                              }
                              className="min-h-[44px] rounded-xl bg-slate-950 px-5 font-semibold text-white hover:bg-slate-800"
                            >
                              Review
                            </button>
                          )}

                          {(item.taskType ===
                            "Follow-up" ||
                            item.taskType ===
                              "Awaiting Client") && (
                            <button
                              type="button"
                              onClick={() =>
                                prepareRecord(
                                  item.record,
                                  "follow-up"
                                )
                              }
                              className="min-h-[44px] rounded-xl bg-teal-600 px-5 font-semibold text-white hover:bg-teal-700"
                            >
                              Follow Up
                            </button>
                          )}

                          <Link
                            href={`/monitored-records/${item.record.id}`}
                            className="inline-flex min-h-[44px] items-center rounded-xl border border-slate-300 px-5 font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            View Record
                          </Link>
                        </div>
                      </div>
                    </article>
                  )
                )}
              </div>

              {!filteredItems.length && (
                <div className="p-12 text-center">
                  <p className="font-semibold text-slate-900">
                    No reminder
                    actions found.
                  </p>

                  <button
                    type="button"
                    onClick={
                      clearFilters
                    }
                    className="mt-3 font-semibold text-teal-700"
                  >
                    Clear filters
                  </button>
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">
                    Notification History
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Recent unique
                    reminders and
                    follow-ups.
                  </p>
                </div>

                <Link
                  href="/audit-history"
                  className="font-semibold text-teal-700"
                >
                  View Audit History →
                </Link>
              </div>

              <div className="mt-5 divide-y divide-slate-200">
                {uniqueCommunications
                  .slice(0, 8)
                  .map(
                    (
                      communication
                    ) => {
                      const record =
                        records.find(
                          (item) =>
                            item.id ===
                            communication.recordId
                        );

                      return (
                        <article
                          key={
                            communication.id
                          }
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
                                {
                                  communication.type
                                }
                              </span>

                              <DeliveryBadge
                                status={
                                  communication.deliveryStatus
                                }
                              />
                            </div>

                            <p className="mt-2 text-sm text-slate-600">
                              {
                                communication.outcome
                              }
                            </p>

                            <p className="mt-1 text-sm text-slate-500">
                              To:{" "}
                              {
                                communication.recipient
                              }
                            </p>
                          </div>

                          <div className="text-sm text-slate-500 sm:text-right">
                            <p>
                              {
                                communication.date
                              }
                            </p>

                            <p className="mt-1">
                              Next:{" "}
                              {displayDate(
                                communication.nextFollowUp
                              )}
                            </p>
                          </div>
                        </article>
                      );
                    }
                  )}
              </div>

              {!uniqueCommunications.length && (
                <p className="mt-5 text-sm text-slate-500">
                  No communication
                  activity has been
                  logged.
                </p>
              )}
            </section>
          </>
        )}

        {selectedRecord &&
          mode !== "queue" && (
            <>
              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-500">
                      Organisation
                    </p>

                    <p className="mt-1 font-medium text-slate-900">
                      {
                        selectedRecord.organisation
                      }
                    </p>
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-slate-500">
                      Recipient
                    </p>

                    <p className="mt-1 break-all font-medium text-slate-900">
                      {
                        selectedRecord.contactEmail ?? ""
                      }
                    </p>
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-slate-500">
                      Expiry
                    </p>

                    <p className="mt-1 font-medium text-slate-900">
                      {displayDate(
                        selectedRecord.expiryDate
                      )}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-slate-500">
                      Escalation
                    </p>

                    <div className="mt-2">
                      <EscalationBadge
                        level={
                          selectedRecord.escalationLevel
                        }
                      />
                    </div>
                  </div>
                </div>
              </section>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setMode(
                      "review"
                    )
                  }
                  className={`rounded-xl px-5 py-3 font-semibold ${
                    mode ===
                    "review"
                      ? "bg-teal-600 text-white"
                      : "bg-slate-200 text-slate-700"
                  }`}
                >
                  Review Reminder
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setMode(
                      "follow-up"
                    )
                  }
                  className={`rounded-xl px-5 py-3 font-semibold ${
                    mode ===
                    "follow-up"
                      ? "bg-teal-600 text-white"
                      : "bg-slate-200 text-slate-700"
                  }`}
                >
                  Follow Up
                </button>

                <Link
                  href={`/monitored-records/${selectedRecord.id}`}
                  className="inline-flex items-center rounded-xl border border-slate-300 px-5 py-3 font-semibold text-slate-700"
                >
                  View Record
                </Link>
              </div>
            </>
          )}

        {selectedRecord &&
          mode === "review" && (
            <form
              onSubmit={
                approveReminder
              }
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <h2 className="text-xl font-bold text-slate-900">
                Review Reminder
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Review and edit the
                notification before
                approval.
              </p>

              <label className="mt-6 block font-semibold text-slate-700">
                Subject

                <input
                  required
                  value={subject}
                  onChange={(event) =>
                    setSubject(
                      event.target
                        .value
                    )
                  }
                  className="mt-2 min-h-[46px] w-full rounded-xl border border-slate-300 px-4 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                />
              </label>

              <label className="mt-5 block font-semibold text-slate-700">
                Reminder Message

                <textarea
                  required
                  rows={10}
                  value={message}
                  onChange={(event) =>
                    setMessage(
                      event.target
                        .value
                    )
                  }
                  className="mt-2 w-full rounded-xl border border-slate-300 p-4 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                />
              </label>

              <label className="mt-5 block font-semibold text-slate-700">
                Next Follow-up

                <input
                  type="date"
                  required
                  value={
                    nextFollowUp
                  }
                  onChange={(event) =>
                    setNextFollowUp(
                      event.target
                        .value
                    )
                  }
                  className="mt-2 min-h-[46px] w-full rounded-xl border border-slate-300 px-4"
                />
              </label>

              <div className="mt-6 flex flex-wrap justify-end gap-3">
                <button
                  type="button"
                  onClick={
                    suppressReminder
                  }
                  disabled={saving}
                  className="rounded-xl border border-red-300 px-6 py-3 font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                >
                  Suppress
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-teal-600 px-6 py-3 font-semibold text-white hover:bg-teal-700 disabled:opacity-60"
                >
                  {saving
                    ? "Approving..."
                    : "Approve Reminder"}
                </button>
              </div>
            </form>
          )}

        {selectedRecord &&
          mode ===
            "follow-up" && (
            <form
              onSubmit={
                logFollowUp
              }
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <h2 className="text-xl font-bold text-slate-900">
                Log Client Follow-up
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Record the communication
                outcome and next action.
              </p>

              <label className="mt-6 block font-semibold text-slate-700">
                Subject

                <input
                  required
                  value={subject}
                  onChange={(event) =>
                    setSubject(
                      event.target
                        .value
                    )
                  }
                  className="mt-2 min-h-[46px] w-full rounded-xl border border-slate-300 px-4"
                />
              </label>

              <label className="mt-5 block font-semibold text-slate-700">
                Follow-up Notes

                <textarea
                  required
                  rows={6}
                  value={message}
                  onChange={(event) =>
                    setMessage(
                      event.target
                        .value
                    )
                  }
                  className="mt-2 w-full rounded-xl border border-slate-300 p-4 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                />
              </label>

              <label className="mt-5 block font-semibold text-slate-700">
                Outcome

                <select
                  required
                  value={outcome}
                  onChange={(event) =>
                    setOutcome(
                      event.target
                        .value
                    )
                  }
                  className="mt-2 min-h-[46px] w-full rounded-xl border border-slate-300 bg-white px-4"
                >
                  <option value="">
                    Select outcome
                  </option>

                  <option>
                    Client contacted
                  </option>

                  <option>
                    No response
                  </option>

                  <option>
                    Replacement pending
                  </option>

                  <option>
                    Replacement confirmed
                  </option>

                  <option>
                    Escalation required
                  </option>
                </select>
              </label>

              <label className="mt-5 block font-semibold text-slate-700">
                Next Follow-up

                <input
                  type="date"
                  required
                  value={
                    nextFollowUp
                  }
                  onChange={(event) =>
                    setNextFollowUp(
                      event.target
                        .value
                    )
                  }
                  className="mt-2 min-h-[46px] w-full rounded-xl border border-slate-300 px-4"
                />
              </label>

              <div className="mt-6 flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-teal-600 px-6 py-3 font-semibold text-white hover:bg-teal-700 disabled:opacity-60"
                >
                  {saving
                    ? "Saving..."
                    : "Log Follow-up"}
                </button>
              </div>
            </form>
          )}
      </div>
    </WorkspaceShell>
  );
}

export default function RemindersPage() {
  return (
    <Suspense fallback={<p className="p-8 text-slate-600" role="status">Loading reminders...</p>}>
      <RemindersContent />
    </Suspense>
  );
}