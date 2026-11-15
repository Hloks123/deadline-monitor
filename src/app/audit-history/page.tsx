"use client";

import {
  Suspense,
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import WorkspaceShell from "@/components/workspace/WorkspaceShell";
import { getAuditEvents } from "@/lib/recordStore";
import type { AuditEvent } from "@/lib/recordStore";
import {
  findAccessibleMonitoredRecord,
  httpMonitoredRecordRepository,
  MonitoredRecordHistoryError,
} from "@/lib/monitoredRecords/repository";
import type {
  MonitoredRecordAuditChange,
  MonitoredRecordAuditEvent,
} from "@/lib/monitoredRecords/auditHistory";
import { selectAuditHistorySource } from "@/lib/monitoredRecords/auditHistory";

type AuditCategory =
  | "All"
  | "Records"
  | "Recurring Tasks"
  | "Reminders"
  | "Clients"
  | "Users"
  | "Exports"
  | "Exceptions"
  | "Other";

type AuditEventView = AuditEvent & {
  category?: string;
  entityType?: string;
  entityId?: string;
  entityName?: string;
  context?: string;
  summary?: string;
  changes?: MonitoredRecordAuditChange[];
  dateKind?: "timestamp" | "legacy_text";
};

type RecordAuditStatus = "ready" | "error";
type RecordAuditErrorKind =
  | "unauthenticated"
  | "forbidden"
  | "not_found"
  | "unavailable";
type LoadedRecordAudit = {
  recordId: string;
  status: RecordAuditStatus;
  error?: RecordAuditErrorKind;
  events: AuditEventView[];
  truncated: boolean;
};

function formatAuditDate(value: string, legacyText = false) {
  if (!value) return "—";
  if (legacyText) return `Legacy date: ${value}`;
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-ZA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

function normaliseValue(value: unknown) {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return "—";
  }

  if (typeof value === "string") {
    return value;
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function getEventCategory(
  event: AuditEventView
): AuditCategory {
  const type = (
    event.entityType ||
    event.category ||
    ""
  ).toLowerCase();

  const action = event.action.toLowerCase();

  if (
    action.includes("failed") ||
    action.includes("failure") ||
    action.includes("exception")
  ) {
    return "Exceptions";
  }

  if (
    type.includes("task") ||
    action.includes("task") ||
    action.includes("schedule") ||
    action.includes("pause") ||
    action.includes("resume") ||
    action.includes("skip")
  ) {
    return "Recurring Tasks";
  }

  if (
    type.includes("reminder") ||
    type.includes("notification") ||
    action.includes("reminder") ||
    action.includes("notification") ||
    action.includes("approve") ||
    action.includes("suppress") ||
    action.includes("send")
  ) {
    return "Reminders";
  }

  if (
    type.includes("client") ||
    type.includes("organisation") ||
    action.includes("client") ||
    action.includes("organisation")
  ) {
    return "Clients";
  }

  if (
    type.includes("user") ||
    action.includes("user") ||
    action.includes("suspend") ||
    action.includes("role")
  ) {
    return "Users";
  }

  if (
    type.includes("export") ||
    action.includes("export")
  ) {
    return "Exports";
  }

  if (
    type.includes("record") ||
    event.recordId ||
    event.recordName
  ) {
    return "Records";
  }

  return "Other";
}

function getEntityLabel(event: AuditEventView) {
  return (
    event.entityName ||
    event.recordName ||
    event.entityType ||
    "System activity"
  );
}

function getEntityId(event: AuditEventView) {
  return event.entityId || event.recordId || "";
}

function toRecordAuditEventView(
  event: MonitoredRecordAuditEvent,
  organisation: string,
): AuditEventView {
  return {
    id: event.id,
    recordId: event.recordId,
    recordName: event.recordName,
    organisation,
    user: event.actorLabel,
    action: event.action,
    field: event.changes.map((change) => change.label).join(", "),
    previousValue: event.changes
      .map((change) => change.previousValue || "")
      .filter(Boolean)
      .join(" "),
    newValue: event.changes
      .map((change) => change.newValue || "")
      .filter(Boolean)
      .join(" "),
    date: event.date,
    dateKind: event.dateKind,
    entityType: "record",
    entityName: event.recordName,
    summary: event.summary,
    changes: event.changes,
  };
}

function recordAuditErrorMessage(kind: RecordAuditErrorKind) {
  switch (kind) {
    case "unauthenticated":
      return "Sign in to view this record's audit history.";
    case "forbidden":
      return "You are not authorised to view this record's audit history.";
    case "not_found":
      return "This record or its audit history was not found.";
    default:
      return "Record audit history could not be loaded. Try again.";
  }
}

function getActionBadgeClasses(category: AuditCategory) {
  switch (category) {
    case "Records":
      return "bg-blue-50 text-blue-700 ring-blue-600/20";

    case "Recurring Tasks":
      return "bg-violet-50 text-violet-700 ring-violet-600/20";

    case "Reminders":
      return "bg-amber-50 text-amber-800 ring-amber-600/20";

    case "Clients":
      return "bg-teal-50 text-teal-700 ring-teal-600/20";

    case "Users":
      return "bg-slate-100 text-slate-700 ring-slate-500/20";

    case "Exports":
      return "bg-emerald-50 text-emerald-700 ring-emerald-600/20";

    default:
      return "bg-slate-50 text-slate-700 ring-slate-500/20";
  }
}

const categories: AuditCategory[] = [
  "All",
  "Records",
  "Recurring Tasks",
  "Reminders",
  "Clients",
  "Users",
  "Exports",
  "Exceptions",
  "Other",
];
const emptyRecordEvents: AuditEventView[] = [];

function AuditHistoryContent() {
  const searchParams = useSearchParams();

  const selectedRecord =
    searchParams.get("record") || "";
  const selectedOrganisation =
    searchParams.get("organisation") || "";
  const requestedCategory = searchParams.get("category");

  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [recordAudit, setRecordAudit] = useState<LoadedRecordAudit | null>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] =
    useState<AuditCategory>(
      categories.includes(requestedCategory as AuditCategory)
        ? requestedCategory as AuditCategory
        : "All"
    );

  useEffect(() => {
    if (selectedRecord) {
      let disposed = false;

      void (async () => {
        try {
          let organisationId = selectedOrganisation;
          if (!organisationId) {
            const record = await findAccessibleMonitoredRecord(selectedRecord);
            if (!record) throw new MonitoredRecordHistoryError("not_found");
            organisationId = record.organisationId;
          }
          const history = await httpMonitoredRecordRepository.auditHistory(
            organisationId,
            selectedRecord,
          );
          if (disposed) return;
          setRecordAudit({
            recordId: selectedRecord,
            status: "ready",
            events: history.events.map((event) =>
              toRecordAuditEventView(event, history.organisationName),
            ),
            truncated: history.truncated,
          });
        } catch (error) {
          if (disposed) return;
          setRecordAudit({
            recordId: selectedRecord,
            status: "error",
            error:
              error instanceof MonitoredRecordHistoryError &&
                error.kind !== "invalid_response"
                ? error.kind
                : "unavailable",
            events: [],
            truncated: false,
          });
        }
      })();

      return () => {
        disposed = true;
      };
    }

    function loadEvents() {
      setEvents(getAuditEvents());
    }

    loadEvents();

    window.addEventListener(
      "deadline-monitor-updated",
      loadEvents
    );

    return () => {
      window.removeEventListener(
        "deadline-monitor-updated",
        loadEvents
      );
    };
  }, [selectedRecord, selectedOrganisation]);

  const activeRecordAudit = recordAudit?.recordId === selectedRecord
    ? recordAudit
    : null;
  const activeRecordAuditStatus = selectedRecord
    ? activeRecordAudit?.status || "loading"
    : "idle";
  const auditEvents = selectAuditHistorySource(
    selectedRecord,
    events as AuditEventView[],
    activeRecordAudit?.events || emptyRecordEvents,
  );

  const filteredEvents = useMemo(() => {
    const query = search.trim().toLowerCase();

    return auditEvents.filter((event) => {
      const entityId = getEntityId(event);
      const eventCategory =
        getEventCategory(event);

      if (
        selectedRecord &&
        event.recordId !== selectedRecord &&
        entityId !== selectedRecord
      ) {
        return false;
      }

      if (
        category !== "All" &&
        eventCategory !== category
      ) {
        return false;
      }

      if (!query) {
        return true;
      }

      const searchableText = [
        event.recordName,
        event.organisation,
        event.action,
        event.user,
        event.previousValue,
        event.newValue,
        event.category,
        event.entityType,
        event.entityId,
        event.entityName,
        event.context,
        event.summary,
        event.changes?.map((change) => `${change.label} ${change.summary}`).join(" "),
        eventCategory,
      ]
        .map(normaliseValue)
        .join(" ")
        .toLowerCase();

      return searchableText.includes(query);
    });
  }, [
    auditEvents,
    search,
    category,
    selectedRecord,
  ]);

  const summary = useMemo(() => {
    const recurringTaskEvents =
      auditEvents.filter(
        (event) =>
          getEventCategory(event) ===
          "Recurring Tasks"
      ).length;

    const reminderEvents =
      auditEvents.filter(
        (event) =>
          getEventCategory(event) === "Reminders"
      ).length;

    const recordEvents =
      auditEvents.filter(
        (event) =>
          getEventCategory(event) === "Records"
      ).length;

    return {
      total: auditEvents.length,
      recordEvents,
      recurringTaskEvents,
      reminderEvents,
      exceptions: auditEvents.filter(
        (event) => getEventCategory(event) === "Exceptions"
      ).length,
    };
  }, [auditEvents]);

  const clearFilters = () => {
    setSearch("");
    setCategory("All");
  };

  const hasFilters =
    Boolean(search) ||
    category !== "All" ||
    Boolean(selectedRecord);

  return (
    <WorkspaceShell
      eyebrow="Reports & Audit"
      title={
        selectedRecord
          ? "Record Audit History"
          : "Audit History"
      }
      actions={
        selectedRecord ? (
          <Link
            href={`/monitored-records/${selectedRecord}`}
            className="inline-flex min-h-[46px] items-center rounded-xl border border-slate-300 bg-white px-5 py-3 font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Back to Record
          </Link>
        ) : null
      }
    >
      <div className="space-y-6 p-6 lg:p-8">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">
              Deadline-Monitor
            </p>

            <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">
              Immutable operational history
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-600">
              Review material changes across monitored
              records, recurring tasks, reminders,
              clients and user administration.
            </p>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              Audit history provides operational
              traceability. It is not proof of legal,
              tax or regulatory compliance.
            </p>
          </div>
        </section>

        {selectedRecord && (
          <div className="rounded-xl border border-teal-200 bg-teal-50 p-4 text-sm text-teal-900">
            <span>
              Showing audit history for record:
            </span>

            <strong className="ml-1">
              {selectedRecord}
            </strong>
          </div>
        )}
        {selectedRecord && activeRecordAuditStatus === "loading" && (
          <p role="status" className="rounded-xl border border-slate-200 bg-white p-4 text-slate-600">
            Loading record audit history...
          </p>
        )}
        {selectedRecord && activeRecordAuditStatus === "error" && (
          <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {recordAuditErrorMessage(activeRecordAudit?.error || "unavailable")}
          </p>
        )}
        {selectedRecord && activeRecordAuditStatus === "ready" && activeRecordAudit?.truncated && (
          <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            The displayed audit history is limited to the most recent events.
          </p>
        )}

        <section
          aria-label="Audit history summary"
          className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
        >
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">
              Total Events
            </p>

            <p className="mt-2 text-3xl font-bold text-slate-950">
              {summary.total}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">
              Record Changes
            </p>

            <p className="mt-2 text-3xl font-bold text-blue-700">
              {summary.recordEvents}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">
              Recurring Tasks
            </p>

            <p className="mt-2 text-3xl font-bold text-violet-700">
              {summary.recurringTaskEvents}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">
              Reminder Activity
            </p>

            <p className="mt-2 text-3xl font-bold text-amber-700">
              {summary.reminderEvents}
            </p>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="grid gap-5 lg:grid-cols-[1fr_240px_auto] lg:items-end">
            <div>
              <label
                htmlFor="audit-search"
                className="text-sm font-semibold text-slate-700"
              >
                Search Audit History
              </label>

              <input
                id="audit-search"
                type="search"
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Search action, entity, organisation or user..."
                className="mt-2 min-h-[46px] w-full rounded-xl border border-slate-300 bg-white px-4 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-teal-600 focus:ring-4 focus:ring-teal-600/10"
              />
            </div>

            <div>
              <label
                htmlFor="audit-category"
                className="text-sm font-semibold text-slate-700"
              >
                Activity Type
              </label>

              <select
                id="audit-category"
                value={category}
                onChange={(event) =>
                  setCategory(
                    event.target
                      .value as AuditCategory
                  )
                }
                className="mt-2 min-h-[46px] w-full rounded-xl border border-slate-300 bg-white px-4 text-slate-900 outline-none transition focus:border-teal-600 focus:ring-4 focus:ring-teal-600/10"
              >
                {categories.map((item) => (
                  <option
                    key={item}
                    value={item}
                  >
                    {item}
                  </option>
                ))}
              </select>
            </div>

            {hasFilters && (
              <div>
                {selectedRecord ? (
                  <Link
                    href="/audit-history"
                    onClick={clearFilters}
                    className="inline-flex min-h-[46px] w-full items-center justify-center rounded-xl border border-slate-300 px-5 font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Clear Filters
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="inline-flex min-h-[46px] w-full items-center justify-center rounded-xl border border-slate-300 px-5 font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Clear Filters
                  </button>
                )}
              </div>
            )}
          </div>
        </section>

        {(!selectedRecord || activeRecordAuditStatus === "ready") && (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-2 border-b border-slate-200 p-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-950">
                Change History
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Who changed what, when it changed and
                the recorded before-and-after values.
              </p>
            </div>

            <p
              className="text-sm font-medium text-slate-500"
              aria-live="polite"
            >
              {filteredEvents.length} event
              {filteredEvents.length !== 1
                ? "s"
                : ""}
            </p>
          </div>

          {filteredEvents.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="dm-data-table w-full min-w-[1180px]">
                <thead className="bg-slate-50">
                  <tr className="border-b border-slate-200">
                    <th className="p-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Date & Time
                    </th>

                    <th className="p-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Actor
                    </th>

                    <th className="p-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Activity
                    </th>

                    <th className="p-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Entity
                    </th>

                    <th className="p-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Organisation
                    </th>

                    <th className="p-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Previous
                    </th>

                    <th className="p-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      New
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-200">
                  {filteredEvents.map((event) => {
                    const eventCategory =
                      getEventCategory(event);

                    const entityId =
                      getEntityId(event);

                    const isRecordEvent =
                      eventCategory === "Records" &&
                      Boolean(event.recordId);

                    return (
                      <tr
                        key={event.id}
                        className="align-top"
                      >
                        <td className="whitespace-nowrap p-4 text-sm text-slate-500">
                          {formatAuditDate(event.date, event.dateKind === "legacy_text")}
                        </td>

                        <td className="p-4">
                          <p className="font-medium text-slate-900">
                            {event.user || (selectedRecord ? "—" : "System")}
                          </p>
                        </td>

                        <td className="p-4">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${getActionBadgeClasses(
                              eventCategory
                            )}`}
                          >
                            {eventCategory}
                          </span>

                          <p className="mt-2 font-semibold text-slate-900">
                            {event.action}
                          </p>
                          {event.field && (
                            <p className="mt-1 text-xs text-slate-500">
                              Field: {event.field}
                            </p>
                          )}
                          {event.summary && (
                            <p className="mt-1 max-w-[320px] text-xs text-slate-600">
                              {event.summary}
                            </p>
                          )}
                          {event.context && (
                            <p className="mt-1 max-w-[320px] whitespace-pre-wrap text-xs text-slate-500">
                              {event.context}
                            </p>
                          )}
                        </td>

                        <td className="p-4">
                          {isRecordEvent ? (
                            <Link
                              href={`/monitored-records/${event.recordId}`}
                              className="font-semibold text-teal-700 hover:text-teal-800 hover:underline"
                            >
                              {getEntityLabel(
                                event
                              )}
                            </Link>
                          ) : (
                            <p className="font-semibold text-slate-900">
                              {getEntityLabel(
                                event
                              )}
                            </p>
                          )}

                          {entityId && (
                            <p className="mt-1 max-w-[220px] truncate font-mono text-xs text-slate-400">
                              {entityId}
                            </p>
                          )}
                        </td>

                        <td className="p-4 text-sm text-slate-600">
                          {event.organisation ||
                            "—"}
                        </td>

                        <td className="p-4">
                          <div className="max-w-[260px] rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
                            {event.changes
                              ? event.changes
                                  .filter((change) => change.previousValue !== null)
                                  .map((change) => `${change.label}: ${change.previousValue}`)
                                  .join("; ") || "—"
                              : normaliseValue(event.previousValue)}
                          </div>
                        </td>

                        <td className="p-4">
                          <div className="max-w-[260px] rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                            {event.changes
                              ? event.changes
                                  .filter((change) => change.newValue !== null)
                                  .map((change) => `${change.label}: ${change.newValue}`)
                                  .join("; ") || "—"
                              : normaliseValue(event.newValue)}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-12 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-xl">
                ↺
              </div>

              <p className="mt-4 font-semibold text-slate-900">
                No audit events found
              </p>

              <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">
                Audit events will appear when records,
                recurring schedules, task outcomes,
                reminder decisions, users or other
                monitored activity changes.
              </p>

              {hasFilters && (
                <div className="mt-5">
                  {selectedRecord ? (
                    <Link
                      href="/audit-history"
                      onClick={clearFilters}
                      className="inline-flex min-h-[44px] items-center rounded-xl border border-slate-300 px-5 font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      View All Audit Events
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={clearFilters}
                      className="inline-flex min-h-[44px] items-center rounded-xl border border-slate-300 px-5 font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Clear Filters
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </section>
        )}

        <aside className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <h3 className="font-semibold text-amber-950">
            Audit trail control
          </h3>

          <p className="mt-2 text-sm leading-6 text-amber-900">
            Audit entries should be append-only for
            authorised users. Corrections should create
            a new event rather than altering the
            historical event.
          </p>
        </aside>
      </div>
    </WorkspaceShell>
  );
}

export default function AuditHistoryPage() {
  return (
    <Suspense fallback={<p className="p-8 text-slate-600" role="status">Loading audit history...</p>}>
      <AuditHistoryContent />
    </Suspense>
  );
}