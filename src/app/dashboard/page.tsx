"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";

type ActionItem = {
  id: number;
  record: string;
  organisation: string;
  folder: string;
  due: string;
  status: string;
  risk: "High" | "Medium" | "Low";
  action: string;
};

const actions: ActionItem[] = [
  {
    id: 1,
    record: "COIDA Letter of Good Standing",
    organisation: "Demo Construction (Pty) Ltd",
    folder: "COIDA Documents",
    due: "Today",
    status: "Due soon",
    risk: "High",
    action: "Review",
  },
  {
    id: 2,
    record: "Vehicle Licence GP 123-456",
    organisation: "Sample Logistics (Pty) Ltd",
    folder: "Vehicle Records",
    due: "Today",
    status: "Expired",
    risk: "High",
    action: "Follow Up",
  },
  {
    id: 3,
    record: "CIPC Annual Return",
    organisation: "Example Services (Pty) Ltd",
    folder: "CIPC Documents",
    due: "2 days",
    status: "Due soon",
    risk: "Medium",
    action: "Review",
  },
  {
    id: 4,
    record: "Public Liability Insurance",
    organisation: "Example Property (Pty) Ltd",
    folder: "Insurance",
    due: "5 days",
    status: "Awaiting client",
    risk: "Medium",
    action: "Follow Up",
  },
  {
    id: 5,
    record: "Tax Compliance Status",
    organisation: "Demo Transport (Pty) Ltd",
    folder: "SARS Documents",
    due: "7 days",
    status: "Due soon",
    risk: "High",
    action: "Review",
  },
  {
    id: 6,
    record: "B-BBEE Affidavit",
    organisation: "Demo Construction (Pty) Ltd",
    folder: "Corporate Records",
    due: "14 days",
    status: "Current",
    risk: "Low",
    action: "View",
  },
];

const recentActivity = [
  {
    title: "Replacement date confirmed",
    detail: "COIDA Letter of Good Standing",
    organisation: "Demo Construction (Pty) Ltd",
    time: "Today, 09:15",
  },
  {
    title: "Reminder approved",
    detail: "CIPC Annual Return",
    organisation: "Example Services (Pty) Ltd",
    time: "Today, 08:42",
  },
  {
    title: "Record moved to another folder",
    detail: "Public Liability Insurance",
    organisation: "Example Property (Pty) Ltd",
    time: "Yesterday, 16:30",
  },
  {
    title: "Client contact updated",
    detail: "Primary authorised contact",
    organisation: "Sample Logistics (Pty) Ltd",
    time: "Yesterday, 14:10",
  },
];

const navigation = [
  { label: "Overview", href: "/dashboard", active: true },
  { label: "Clients", href: "/clients", active: false },
  { label: "Monitored Records", href: "/records", active: false },
  { label: "Reminders", href: "/reminders", active: false },
  { label: "Reports", href: "/reports", active: false },
  { label: "Audit History", href: "/audit-history", active: false },
  { label: "Settings", href: "/settings", active: false },
];

export default function DashboardPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [organisationFilter, setOrganisationFilter] = useState("All");
  const [riskFilter, setRiskFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");

  const filteredActions = useMemo(() => {
    return actions.filter((item) => {
      const organisationMatches =
        organisationFilter === "All" ||
        item.organisation === organisationFilter;

      const riskMatches =
        riskFilter === "All" || item.risk === riskFilter;

      const statusMatches =
        statusFilter === "All" || item.status === statusFilter;

      return organisationMatches && riskMatches && statusMatches;
    });
  }, [organisationFilter, riskFilter, statusFilter]);

  function clearFilters() {
    setOrganisationFilter("All");
    setRiskFilter("All");
    setStatusFilter("All");
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      {/* MOBILE HEADER */}
      <header className="sticky top-0 z-50 flex items-center justify-between border-b border-slate-700 bg-slate-900 px-5 py-4 text-white lg:hidden">
        <Link href="/dashboard" className="flex items-center gap-3">
          <div className="rounded-lg bg-white p-1.5">
            <Image
              src="/doc-monitor-logo.png"
              alt="Doc Monitor SA logo"
              width={42}
              height={42}
              priority
              className="h-9 w-9 object-contain"
            />
          </div>

          <div>
            <p className="font-bold">Doc Monitor SA</p>

            <p className="text-xs text-teal-400">
              Consultant Workspace
            </p>
          </div>
        </Link>

        <button
          type="button"
          onClick={() =>
            setMobileMenuOpen((current) => !current)
          }
          aria-expanded={mobileMenuOpen}
          aria-controls="mobile-navigation"
          className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-semibold"
        >
          Menu
        </button>
      </header>

      {mobileMenuOpen && (
        <nav
          id="mobile-navigation"
          className="border-b border-slate-700 bg-slate-900 px-5 pb-5 text-white lg:hidden"
        >
          <div className="space-y-2">
            {navigation.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`block rounded-xl px-4 py-3 text-sm font-medium ${
                  item.active
                    ? "bg-teal-600 text-white"
                    : "text-slate-300 hover:bg-slate-800"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </nav>
      )}

      <div className="min-h-screen lg:grid lg:grid-cols-[270px_1fr]">
        {/* DESKTOP SIDEBAR */}
        <aside className="hidden min-h-screen bg-slate-900 text-white lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col">
          <div className="border-b border-slate-700 px-6 py-6">
            <Link
              href="/dashboard"
              className="flex items-center gap-4"
            >
              <div className="rounded-xl bg-white p-2">
                <Image
                  src="/doc-monitor-logo.png"
                  alt="Doc Monitor SA logo"
                  width={56}
                  height={56}
                  priority
                  className="h-12 w-12 object-contain"
                />
              </div>

              <div>
                <p className="text-lg font-bold">
                  Doc Monitor SA
                </p>

                <p className="text-xs text-teal-400">
                  Consultant Workspace
                </p>
              </div>
            </Link>
          </div>

          <nav className="flex-1 space-y-2 px-4 py-6">
            {navigation.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className={`flex items-center rounded-xl px-4 py-3 text-sm font-medium transition ${
                  item.active
                    ? "bg-teal-600 text-white"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="border-t border-slate-700 p-4">
            <div className="rounded-2xl bg-slate-800 p-4">
              <p className="text-sm font-bold text-white">
                Hlokomela Ramaoto
              </p>

              <p className="mt-1 text-xs text-slate-400">
                Consultant
              </p>

              <Link
                href="/"
                className="mt-4 block text-xs font-semibold text-teal-400 hover:text-teal-300"
              >
                Return to Website
              </Link>
            </div>
          </div>
        </aside>

        {/* DASHBOARD CONTENT */}
        <section className="min-w-0">
          {/* TOP BAR */}
          <header className="border-b border-slate-200 bg-white px-6 py-5 md:px-8">
            <div className="mx-auto flex max-w-7xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-teal-700">
                  Consultant Dashboard
                </p>

                <h1 className="mt-1 text-2xl font-bold text-slate-900 md:text-3xl">
                  Monitoring Overview
                </h1>
              </div>

              <div className="flex flex-wrap gap-3">
                <Link
                  href="/records"
                  className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-teal-600 hover:text-teal-700"
                >
                  View Records
                </Link>

                <Link
                  href="/clients"
                  className="rounded-xl bg-teal-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-teal-700"
                >
                  Add Client
                </Link>
              </div>
            </div>
          </header>

          <div className="mx-auto max-w-7xl space-y-8 px-6 py-8 md:px-8">
            {/* DEMO NOTICE */}
            <div className="flex flex-col gap-3 rounded-2xl border border-blue-200 bg-blue-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-bold text-blue-950">
                  Fictional demonstration data
                </p>

                <p className="mt-1 text-sm text-blue-800">
                  This dashboard currently uses sample organisations and
                  records for prototype testing.
                </p>
              </div>

              <span className="w-fit rounded-full bg-blue-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-blue-800">
                Prototype
              </span>
            </div>

            {/* DATE AND SUMMARY */}
            <section>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">
                    Today&apos;s Summary
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Friday, 7 November 2026
                  </p>
                </div>

                <p className="text-sm text-slate-500">
                  Last daily scan: 06:00
                </p>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
                <MetricCard
                  label="Expired"
                  value="4"
                  helper="Requires attention"
                  colour="red"
                />

                <MetricCard
                  label="Due in 7 days"
                  value="9"
                  helper="Upcoming"
                  colour="amber"
                />

                <MetricCard
                  label="Due in 30 days"
                  value="18"
                  helper="Plan follow-up"
                  colour="blue"
                />

                <MetricCard
                  label="Due in 60 days"
                  value="24"
                  helper="Early warning"
                  colour="indigo"
                />

                <MetricCard
                  label="Awaiting client"
                  value="7"
                  helper="Response required"
                  colour="teal"
                />

                <MetricCard
                  label="Completed"
                  value="34"
                  helper="This month"
                  colour="green"
                />
              </div>
            </section>

            {/* FILTERS */}
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">
                    Actions Due Today
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Review records requiring action, follow-up or
                    consultant approval.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <FilterSelect
                    label="Organisation"
                    value={organisationFilter}
                    onChange={setOrganisationFilter}
                    options={[
                      "All",
                      "Demo Construction (Pty) Ltd",
                      "Sample Logistics (Pty) Ltd",
                      "Example Services (Pty) Ltd",
                      "Example Property (Pty) Ltd",
                      "Demo Transport (Pty) Ltd",
                    ]}
                  />

                  <FilterSelect
                    label="Risk"
                    value={riskFilter}
                    onChange={setRiskFilter}
                    options={[
                      "All",
                      "High",
                      "Medium",
                      "Low",
                    ]}
                  />

                  <FilterSelect
                    label="Status"
                    value={statusFilter}
                    onChange={setStatusFilter}
                    options={[
                      "All",
                      "Expired",
                      "Due soon",
                      "Awaiting client",
                      "Current",
                    ]}
                  />

                  <button
                    type="button"
                    onClick={clearFilters}
                    className="self-end rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-teal-600 hover:text-teal-700"
                  >
                    Clear Filters
                  </button>
                </div>
              </div>

              {/* ACTION TABLE */}
              <div className="mt-6 overflow-x-auto">
                <table className="w-full min-w-[900px] border-collapse text-left">
                  <thead>
                    <tr className="border-y border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                      <th className="px-4 py-4 font-semibold">
                        Record
                      </th>

                      <th className="px-4 py-4 font-semibold">
                        Organisation
                      </th>

                      <th className="px-4 py-4 font-semibold">
                        Folder
                      </th>

                      <th className="px-4 py-4 font-semibold">
                        Due
                      </th>

                      <th className="px-4 py-4 font-semibold">
                        Risk
                      </th>

                      <th className="px-4 py-4 font-semibold">
                        Status
                      </th>

                      <th className="px-4 py-4 font-semibold">
                        Action
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredActions.map((item) => (
                      <tr
                        key={item.id}
                        className="border-b border-slate-100 text-sm"
                      >
                        <td className="px-4 py-5">
                          <p className="font-semibold text-slate-900">
                            {item.record}
                          </p>
                        </td>

                        <td className="px-4 py-5 text-slate-600">
                          {item.organisation}
                        </td>

                        <td className="px-4 py-5 text-slate-600">
                          {item.folder}
                        </td>

                        <td className="px-4 py-5 font-medium text-slate-700">
                          {item.due}
                        </td>

                        <td className="px-4 py-5">
                          <RiskBadge risk={item.risk} />
                        </td>

                        <td className="px-4 py-5">
                          <StatusBadge status={item.status} />
                        </td>

                        <td className="px-4 py-5">
                          <Link
                            href={`/records/${item.id}`}
                            className="rounded-lg bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-teal-700"
                          >
                            {item.action}
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {filteredActions.length === 0 && (
                  <div className="py-12 text-center">
                    <p className="font-semibold text-slate-700">
                      No actions match the selected filters.
                    </p>

                    <button
                      type="button"
                      onClick={clearFilters}
                      className="mt-3 text-sm font-semibold text-teal-700"
                    >
                      Clear all filters
                    </button>
                  </div>
                )}
              </div>
            </section>

            {/* LOWER DASHBOARD */}
            <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
              {/* HIGH-RISK ITEMS */}
              <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">
                      High-Risk Overdue Items
                    </h2>

                    <p className="mt-1 text-sm text-slate-500">
                      Items requiring priority consultant review.
                    </p>
                  </div>

                  <span className="rounded-full bg-red-100 px-3 py-1 text-sm font-bold text-red-800">
                    4 items
                  </span>
                </div>

                <div className="mt-6 space-y-4">
                  <PriorityItem
                    record="Vehicle Licence GP 123-456"
                    organisation="Sample Logistics (Pty) Ltd"
                    overdue="3 days overdue"
                  />

                  <PriorityItem
                    record="Public Liability Insurance"
                    organisation="Example Property (Pty) Ltd"
                    overdue="2 days overdue"
                  />

                  <PriorityItem
                    record="COIDA Letter of Good Standing"
                    organisation="Demo Construction (Pty) Ltd"
                    overdue="1 day overdue"
                  />

                  <PriorityItem
                    record="Professional Indemnity Policy"
                    organisation="Example Services (Pty) Ltd"
                    overdue="1 day overdue"
                  />
                </div>
              </section>

              {/* OPERATIONAL CONTROLS */}
              <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">
                    Operational Controls
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Current automated-service indicators.
                  </p>
                </div>

                <div className="mt-6 space-y-4">
                  <ControlRow
                    label="Daily monitoring scan"
                    value="Completed at 06:00"
                    status="Healthy"
                  />

                  <ControlRow
                    label="Client reminder emails"
                    value="Consultant review required"
                    status="Review"
                  />

                  <ControlRow
                    label="Failed deliveries"
                    value="1 requires attention"
                    status="Warning"
                  />

                  <ControlRow
                    label="Latest database backup"
                    value="Successful"
                    status="Healthy"
                  />

                  <ControlRow
                    label="High-risk review"
                    value="4 items outstanding"
                    status="Warning"
                  />
                </div>
              </section>
            </div>

            {/* RECENT ACTIVITY */}
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">
                    Recent Activity
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Recent fictional changes and consultant actions.
                  </p>
                </div>

                <Link
                  href="/audit-history"
                  className="text-sm font-semibold text-teal-700 hover:text-teal-800"
                >
                  View Audit History →
                </Link>
              </div>

              <div className="mt-6 divide-y divide-slate-100">
                {recentActivity.map((activity) => (
                  <div
                    key={`${activity.title}-${activity.time}`}
                    className="grid gap-2 py-5 md:grid-cols-[1fr_190px]"
                  >
                    <div>
                      <p className="font-semibold text-slate-900">
                        {activity.title}
                      </p>

                      <p className="mt-1 text-sm text-slate-600">
                        {activity.detail}
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        {activity.organisation}
                      </p>
                    </div>

                    <p className="text-sm text-slate-500 md:text-right">
                      {activity.time}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}

function MetricCard({
  label,
  value,
  helper,
  colour,
}: {
  label: string;
  value: string;
  helper: string;
  colour:
    | "red"
    | "amber"
    | "blue"
    | "indigo"
    | "teal"
    | "green";
}) {
  const colours = {
    red: "border-red-200 bg-red-50 text-red-800",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    blue: "border-blue-200 bg-blue-50 text-blue-800",
    indigo:
      "border-indigo-200 bg-indigo-50 text-indigo-800",
    teal: "border-teal-200 bg-teal-50 text-teal-800",
    green: "border-green-200 bg-green-50 text-green-800",
  };

  return (
    <article
      className={`rounded-2xl border p-5 ${colours[colour]}`}
    >
      <p className="text-sm font-semibold">
        {label}
      </p>

      <p className="mt-3 text-3xl font-bold">
        {value}
      </p>

      <p className="mt-2 text-xs opacity-80">
        {helper}
      </p>
    </article>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-500">
        {label}
      </label>

      <select
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
        className="mt-1 w-full min-w-40 rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-700 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}

function RiskBadge({
  risk,
}: {
  risk: "High" | "Medium" | "Low";
}) {
  const classes = {
    High: "bg-red-100 text-red-800",
    Medium: "bg-amber-100 text-amber-800",
    Low: "bg-green-100 text-green-800",
  };

  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-bold ${classes[risk]}`}
    >
      {risk}
    </span>
  );
}

function StatusBadge({
  status,
}: {
  status: string;
}) {
  const classes: Record<string, string> = {
    Expired: "bg-red-100 text-red-800",
    "Due soon": "bg-amber-100 text-amber-800",
    "Awaiting client": "bg-teal-100 text-teal-800",
    Current: "bg-green-100 text-green-800",
  };

  return (
    <span
      className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${
        classes[status] ??
        "bg-slate-100 text-slate-700"
      }`}
    >
      {status}
    </span>
  );
}

function PriorityItem({
  record,
  organisation,
  overdue,
}: {
  record: string;
  organisation: string;
  overdue: string;
}) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-red-100 bg-red-50 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="font-semibold text-slate-900">
          {record}
        </p>

        <p className="mt-1 text-sm text-slate-600">
          {organisation}
        </p>
      </div>

      <span className="w-fit rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-800">
        {overdue}
      </span>
    </div>
  );
}

function ControlRow({
  label,
  value,
  status,
}: {
  label: string;
  value: string;
  status: "Healthy" | "Review" | "Warning";
}) {
  const styles = {
    Healthy: "bg-green-100 text-green-800",
    Review: "bg-blue-100 text-blue-800",
    Warning: "bg-amber-100 text-amber-800",
  };

  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4 last:border-0 last:pb-0">
      <div>
        <p className="font-semibold text-slate-800">
          {label}
        </p>

        <p className="mt-1 text-sm text-slate-500">
          {value}
        </p>
      </div>

      <span
        className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-bold ${styles[status]}`}
      >
        {status}
      </span>
    </div>
  );
}