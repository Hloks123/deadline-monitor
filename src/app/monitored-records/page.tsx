"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Suspense,
  useEffect,
  useMemo,
  useState,
} from "react";

import WorkspaceShell from "@/components/workspace/WorkspaceShell";

import {
  CategoryOne,
  categoryOptions,
  MonitoredRecord,
} from "@/lib/recordStore";
import { loadAccessibleMonitoredRecords } from "@/lib/monitoredRecords/repository";

type StatusFilter =
  | "All"
  | MonitoredRecord["status"];

type RiskFilter =
  | "All"
  | MonitoredRecord["risk"];

type TimeFilter =
  | "all"
  | "expired"
  | "today"
  | "7"
  | "30"
  | "60";

const categoryOneOptions = Object.keys(
  categoryOptions
) as CategoryOne[];

function parseDate(value: string) {
  return new Date(`${value}T00:00:00`);
}

function todayDate() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return today;
}

function daysUntil(value: string) {
  const date = parseDate(value);
  const today = todayDate();

  return Math.ceil(
    (date.getTime() - today.getTime()) /
      (1000 * 60 * 60 * 24)
  );
}

function displayDate(value: string) {
  const date = parseDate(value);

  if (Number.isNaN(date.getTime())) {
    return "Not set";
  }

  return date.toLocaleDateString("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function dueDescription(expiryDate: string) {
  const days = daysUntil(expiryDate);

  if (days < 0) {
    const overdueDays = Math.abs(days);

    return `${overdueDays} day${
      overdueDays !== 1 ? "s" : ""
    } overdue`;
  }

  if (days === 0) {
    return "Due today";
  }

  return `${days} day${
    days !== 1 ? "s" : ""
  } remaining`;
}

function priority(record: MonitoredRecord) {
  const days = daysUntil(record.expiryDate);

  if (days < 0 && record.risk === "High") {
    return 1;
  }

  if (days < 0) {
    return 2;
  }

  if (days === 0) {
    return 3;
  }

  if (
    record.status === "Due soon" &&
    record.risk === "High"
  ) {
    return 4;
  }

  if (record.status === "Due soon") {
    return 5;
  }

  if (record.status === "Awaiting client") {
    return 6;
  }

  if (record.status === "Current") {
    return 7;
  }

  return 8;
}

function actionDetails(record: MonitoredRecord) {
  const expired =
    record.status === "Expired" ||
    daysUntil(record.expiryDate) < 0;

  if (expired) {
    return {
      label: "Resolve",
      href: `/monitored-records/${record.id}#confirm-replacement`,
      className:
        "bg-red-600 text-white hover:bg-red-700",
    };
  }

  if (record.status === "Due soon") {
    return {
      label: "Review",
      href: `/reminders?record=${encodeURIComponent(
        record.id
      )}&action=review`,
      className:
        "bg-slate-950 text-white hover:bg-slate-800",
    };
  }

  if (record.status === "Awaiting client") {
    return {
      label: "Follow Up",
      href: `/reminders?record=${encodeURIComponent(
        record.id
      )}&action=follow-up`,
      className:
        "bg-teal-600 text-white hover:bg-teal-700",
    };
  }

  return {
    label: "View",
    href: `/monitored-records/${record.id}`,
    className:
      "bg-slate-950 text-white hover:bg-slate-800",
  };
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
    "Awaiting client": "bg-cyan-100 text-cyan-800",
    "Awaiting confirmation": "bg-violet-100 text-violet-800",
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

      <p className={`mt-3 text-3xl font-bold ${colour}`}>
        {value}
      </p>

      <p className="mt-2 text-xs text-slate-400">
        Click to filter
      </p>
    </button>
  );
}

function MonitoredRecordsContent() {
  const searchParams = useSearchParams();
  const requestedStatus = searchParams.get("status");
  const requestedWindow = searchParams.get("window");
  const requestedOrganisation = searchParams.get("organisation");
  const [records, setRecords] = useState<
    MonitoredRecord[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [search, setSearch] = useState("");
  const [organisation, setOrganisation] =
    useState(requestedOrganisation || "All");

  const [categoryOne, setCategoryOne] =
    useState<"All" | CategoryOne>("All");

  const [categoryTwo, setCategoryTwo] =
    useState("All");

  const [risk, setRisk] =
    useState<RiskFilter>("All");

  const [status, setStatus] =
    useState<StatusFilter>(
      requestedStatus === "Current" ||
      requestedStatus === "Due soon" ||
      requestedStatus === "Expired" ||
      requestedStatus === "Awaiting client" ||
      requestedStatus === "Completed"
        ? requestedStatus
        : "All"
    );

  const [timeFilter, setTimeFilter] =
    useState<TimeFilter>(
      requestedWindow === "expired" ||
      requestedWindow === "today" ||
      requestedWindow === "7" ||
      requestedWindow === "30" ||
      requestedWindow === "60"
        ? requestedWindow
        : "all"
    );

  async function loadRecords() {
    setLoadError("");
    try {
      const saved = await loadAccessibleMonitoredRecords();
      setRecords(saved);
    } catch (cause: unknown) {
      setLoadError(
        cause instanceof Error ? cause.message : "Monitored records could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      void loadRecords();
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const organisations = useMemo(
    () =>
      Array.from(
        new Set(
          records.map(
            (record) => record.organisation
          )
        )
      ).sort(),
    [records]
  );

  const categoryTwoOptions = useMemo(() => {
    if (categoryOne === "All") {
      return Array.from(
        new Set(
          records.map(
            (record) => record.category2
          )
        )
      ).sort();
    }

    return categoryOptions[categoryOne];
  }, [records, categoryOne]);

  const counts = useMemo(
    () => ({
      total: records.length,

      current: records.filter(
        (record) => record.status === "Current"
      ).length,

      dueSoon: records.filter(
        (record) => record.status === "Due soon"
      ).length,

      expired: records.filter(
        (record) =>
          record.status === "Expired" ||
          daysUntil(record.expiryDate) < 0
      ).length,

      awaiting: records.filter(
        (record) =>
          record.status === "Awaiting client"
      ).length,
    }),
    [records]
  );

  const filteredRecords = useMemo(() => {
    return [...records]
      .filter((record) => {
        const searchableText = `
          ${record.name}
          ${record.organisation}
          ${record.category}
          ${record.category2}
          ${record.contact}
          ${record.contactEmail}
        `.toLowerCase();

        return searchableText.includes(
          search.toLowerCase()
        );
      })
      .filter(
        (record) =>
          organisation === "All" ||
          record.organisation === organisation
      )
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
      .filter(
        (record) =>
          status === "All" ||
          record.status === status
      )
      .filter((record) => {
        const days = daysUntil(
          record.expiryDate
        );

        if (timeFilter === "expired") {
          return days < 0;
        }

        if (timeFilter === "today") {
          return days === 0;
        }

        if (timeFilter === "7") {
          return days >= 0 && days <= 7;
        }

        if (timeFilter === "30") {
          return days >= 0 && days <= 30;
        }

        if (timeFilter === "60") {
          return days >= 0 && days <= 60;
        }

        return true;
      })
      .sort(
        (first, second) =>
          priority(first) - priority(second)
      );
  }, [
    records,
    search,
    organisation,
    categoryOne,
    categoryTwo,
    risk,
    status,
    timeFilter,
  ]);

  function clearFilters() {
    setSearch("");
    setOrganisation("All");
    setCategoryOne("All");
    setCategoryTwo("All");
    setRisk("All");
    setStatus("All");
    setTimeFilter("all");
  }

  function changeCategoryOne(
    value: "All" | CategoryOne
  ) {
    setCategoryOne(value);
    setCategoryTwo("All");
  }

  const attentionCount = records.filter(
    (record) =>
      record.status === "Expired" ||
      record.status === "Due soon" ||
      record.status === "Awaiting client" ||
      daysUntil(record.expiryDate) <= 0
  ).length;

  return (
    <WorkspaceShell
      eyebrow="Document Monitoring"
      title="Monitored Records"
      actions={
        <Link
          href="/monitored-records/new"
          className="inline-flex min-h-[46px] items-center justify-center rounded-xl bg-teal-600 px-6 font-semibold text-white hover:bg-teal-700"
        >
          + Add Monitored Record
        </Link>
      }
    >
      <div className="space-y-7 p-5 lg:p-7">
        {loadError && (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {loadError}
            <button type="button" onClick={() => void loadRecords()} className="ml-3 font-semibold underline">
              Retry
            </button>
          </div>
        )}
        {loading && <p role="status" className="text-sm text-slate-600">Loading monitored records…</p>}
        {!loading && !loadError && records.length === 0 && (
          <p className="rounded-xl border border-slate-200 bg-white p-6 text-slate-600">
            No monitored records found for your accessible organisations.
          </p>
        )}
        {/* SUMMARY */}
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <SummaryCard
            label="Total Records"
            value={counts.total}
            colour="text-slate-900"
            active={
              status === "All" &&
              timeFilter === "all"
            }
            onClick={() => {
              setStatus("All");
              setTimeFilter("all");
            }}
          />

          <SummaryCard
            label="Current"
            value={counts.current}
            colour="text-emerald-600"
            active={status === "Current"}
            onClick={() =>
              setStatus(
                status === "Current"
                  ? "All"
                  : "Current"
              )
            }
          />

          <SummaryCard
            label="Due Soon"
            value={counts.dueSoon}
            colour="text-amber-600"
            active={status === "Due soon"}
            onClick={() =>
              setStatus(
                status === "Due soon"
                  ? "All"
                  : "Due soon"
              )
            }
          />

          <SummaryCard
            label="Expired"
            value={counts.expired}
            colour="text-red-600"
            active={timeFilter === "expired"}
            onClick={() =>
              setTimeFilter(
                timeFilter === "expired"
                  ? "all"
                  : "expired"
              )
            }
          />

          <SummaryCard
            label="Awaiting Client"
            value={counts.awaiting}
            colour="text-cyan-700"
            active={
              status === "Awaiting client"
            }
            onClick={() =>
              setStatus(
                status === "Awaiting client"
                  ? "All"
                  : "Awaiting client"
              )
            }
          />
        </section>

        {/* REGISTER */}
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  Record Register
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  {records.length} records ·{" "}
                  {attentionCount} require attention
                </p>
              </div>

              <span
                aria-live="polite"
                className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-600"
              >
                {filteredRecords.length} shown
              </span>
            </div>

            {/* SEARCH */}
            <div className="mt-5 flex flex-col gap-3 lg:flex-row">
              <input
                type="search"
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Search record, organisation, category or contact..."
                className="min-h-[46px] min-w-0 flex-1 rounded-xl border border-slate-300 px-4 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
              />

              <button
                type="button"
                onClick={clearFilters}
                className="min-h-[46px] rounded-xl border border-slate-300 px-5 font-semibold text-slate-700 hover:bg-slate-50"
              >
                Clear Filters
              </button>
            </div>

            {/* DROPDOWN FILTERS */}
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <select
                value={organisation}
                onChange={(event) =>
                  setOrganisation(
                    event.target.value
                  )
                }
                className="min-h-[44px] rounded-xl border border-slate-300 bg-white px-3"
              >
                <option value="All">
                  All Organisations
                </option>

                {organisations.map((item) => (
                  <option
                    key={item}
                    value={item}
                  >
                    {item}
                  </option>
                ))}
              </select>

              <select
                value={categoryOne}
                onChange={(event) =>
                  changeCategoryOne(
                    event.target.value as
                      | "All"
                      | CategoryOne
                  )
                }
                className="min-h-[44px] rounded-xl border border-slate-300 bg-white px-3"
              >
                <option value="All">
                  All Category 1
                </option>

                {categoryOneOptions.map(
                  (item) => (
                    <option
                      key={item}
                      value={item}
                    >
                      {item}
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
                className="min-h-[44px] rounded-xl border border-slate-300 bg-white px-3"
              >
                <option value="All">
                  All Category 2
                </option>

                {categoryTwoOptions.map(
                  (item) => (
                    <option
                      key={item}
                      value={item}
                    >
                      {item}
                    </option>
                  )
                )}
              </select>

              <select
                value={risk}
                onChange={(event) =>
                  setRisk(
                    event.target
                      .value as RiskFilter
                  )
                }
                className="min-h-[44px] rounded-xl border border-slate-300 bg-white px-3"
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
                    event.target
                      .value as StatusFilter
                  )
                }
                className="min-h-[44px] rounded-xl border border-slate-300 bg-white px-3"
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

            {/* TIME FILTERS */}
            <div className="mt-4 flex flex-wrap gap-2">
              {[
                ["all", "All"],
                ["expired", "Expired"],
                ["today", "Today"],
                ["7", "7 Days"],
                ["30", "30 Days"],
                ["60", "60 Days"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() =>
                    setTimeFilter(
                      value as TimeFilter
                    )
                  }
                  className={`min-h-[40px] rounded-lg px-4 text-sm font-semibold ${
                    timeFilter === value
                      ? "bg-teal-600 text-white"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* DESKTOP */}
          <div className="hidden xl:block">
            <table className="dm-data-table w-full table-fixed">
              <thead className="bg-slate-50">
                <tr>
                  <th className="w-[25%] p-4 text-left">
                    Record
                  </th>

                  <th className="w-[21%] p-4 text-left">
                    Organisation
                  </th>

                  <th className="w-[15%] p-4 text-left">
                    Expiry
                  </th>

                  <th className="w-[10%] p-4 text-left">
                    Risk
                  </th>

                  <th className="w-[15%] p-4 text-left">
                    Status
                  </th>

                  <th className="w-[14%] p-4 text-right">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-200">
                {filteredRecords.map((record) => {
                  const action =
                    actionDetails(record);

                  return (
                    <tr
                      key={record.id}
                      className="hover:bg-slate-50"
                    >
                      <td className="p-4">
                        <Link
                          href={`/monitored-records/${record.id}`}
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
                                  ) <= 7
                                ? "text-amber-600"
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
                          status={record.status}
                        />
                      </td>

                      <td className="p-4 text-right">
                        <Link
                          href={action.href}
                          className={`inline-flex min-h-[44px] items-center justify-center rounded-xl px-5 font-semibold ${action.className}`}
                        >
                          {action.label}
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* MOBILE AND TABLET */}
          <div className="divide-y divide-slate-200 xl:hidden">
            {filteredRecords.map((record) => {
              const action =
                actionDetails(record);

              return (
                <article
                  key={record.id}
                  className="space-y-4 p-5"
                >
                  <div>
                    <Link
                      href={`/monitored-records/${record.id}`}
                      className="font-bold text-slate-900 hover:text-teal-700"
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
                      status={record.status}
                    />

                    <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-600">
                      {displayDate(
                        record.expiryDate
                      )}
                    </span>
                  </div>

                  <p className="text-sm font-semibold text-slate-500">
                    {dueDescription(
                      record.expiryDate
                    )}
                  </p>

                  <Link
                    href={action.href}
                    className={`inline-flex min-h-[44px] w-full items-center justify-center rounded-xl px-5 font-semibold ${action.className}`}
                  >
                    {action.label}
                  </Link>
                </article>
              );
            })}
          </div>

          {filteredRecords.length === 0 && (
            <div className="p-12 text-center">
              <p className="font-semibold text-slate-900">
                No records found
              </p>

              <button
                type="button"
                onClick={clearFilters}
                className="mt-3 font-semibold text-teal-700"
              >
                Clear all filters
              </button>
            </div>
          )}
        </section>
      </div>
    </WorkspaceShell>
  );
}

export default function MonitoredRecordsPage() {
  return (
    <Suspense fallback={<p className="p-8 text-slate-600" role="status">Loading monitored records...</p>}>
      <MonitoredRecordsContent />
    </Suspense>
  );
}