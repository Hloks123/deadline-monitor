"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";

type ClientStatus =
  | "Prospect"
  | "Active"
  | "Suspended"
  | "Cancelled";

type ServicePlan =
  | "Starter"
  | "Standard"
  | "Managed"
  | "Custom";

type Client = {
  id: number;
  name: string;
  registrationNumber: string;
  industry: string;
  location: string;
  plan: ServicePlan;
  status: ClientStatus;
  records: number;
  expired: number;
  dueSoon: number;
  awaitingClient: number;
  primaryContact: string;
  contactEmail: string;
  contactPhone: string;
  assignedConsultant: string;
  reportingFrequency: string;
  reminderPreference: string;
  startDate: string;
};

const clients: Client[] = [
  {
    id: 1,
    name: "Demo Construction (Pty) Ltd",
    registrationNumber: "2022/123456/07",
    industry: "Construction",
    location: "Bloemfontein, Free State",
    plan: "Starter",
    status: "Active",
    records: 22,
    expired: 2,
    dueSoon: 5,
    awaitingClient: 1,
    primaryContact: "Thabo Demo",
    contactEmail: "thabo@example.co.za",
    contactPhone: "+27 51 000 1001",
    assignedConsultant: "Hlokomela Ramaoto",
    reportingFrequency: "Monthly",
    reminderPreference: "Email",
    startDate: "15 October 2026",
  },
  {
    id: 2,
    name: "Sample Logistics (Pty) Ltd",
    registrationNumber: "2020/234567/07",
    industry: "Transport & Fleet",
    location: "Bloemfontein, Free State",
    plan: "Standard",
    status: "Active",
    records: 70,
    expired: 4,
    dueSoon: 11,
    awaitingClient: 3,
    primaryContact: "Lerato Sample",
    contactEmail: "lerato@example.co.za",
    contactPhone: "+27 51 000 1002",
    assignedConsultant: "Hlokomela Ramaoto",
    reportingFrequency: "Monthly",
    reminderPreference: "Email and phone",
    startDate: "1 October 2026",
  },
  {
    id: 3,
    name: "Example Property (Pty) Ltd",
    registrationNumber: "2021/345678/07",
    industry: "Property & Real Estate",
    location: "Bloemfontein, Free State",
    plan: "Starter",
    status: "Active",
    records: 18,
    expired: 1,
    dueSoon: 4,
    awaitingClient: 3,
    primaryContact: "Naledi Example",
    contactEmail: "naledi@example.co.za",
    contactPhone: "+27 51 000 1003",
    assignedConsultant: "Hlokomela Ramaoto",
    reportingFrequency: "Monthly",
    reminderPreference: "Email",
    startDate: "20 September 2026",
  },
  {
    id: 4,
    name: "Example Services (Pty) Ltd",
    registrationNumber: "2019/456789/07",
    industry: "Professional Services",
    location: "Bloemfontein, Free State",
    plan: "Managed",
    status: "Active",
    records: 108,
    expired: 2,
    dueSoon: 16,
    awaitingClient: 4,
    primaryContact: "Kabelo Example",
    contactEmail: "kabelo@example.co.za",
    contactPhone: "+27 51 000 1004",
    assignedConsultant: "Hlokomela Ramaoto",
    reportingFrequency: "Monthly and quarterly review",
    reminderPreference: "Email and phone",
    startDate: "5 September 2026",
  },
  {
    id: 5,
    name: "Demo Transport (Pty) Ltd",
    registrationNumber: "2018/567890/07",
    industry: "Transport & Fleet",
    location: "Welkom, Free State",
    plan: "Standard",
    status: "Active",
    records: 64,
    expired: 3,
    dueSoon: 9,
    awaitingClient: 2,
    primaryContact: "Mpho Demo",
    contactEmail: "mpho@example.co.za",
    contactPhone: "+27 57 000 1005",
    assignedConsultant: "Hlokomela Ramaoto",
    reportingFrequency: "Monthly",
    reminderPreference: "Email",
    startDate: "12 August 2026",
  },
  {
    id: 6,
    name: "Sample Manufacturing (Pty) Ltd",
    registrationNumber: "2023/678901/07",
    industry: "Manufacturing",
    location: "Botshabelo, Free State",
    plan: "Starter",
    status: "Prospect",
    records: 0,
    expired: 0,
    dueSoon: 0,
    awaitingClient: 0,
    primaryContact: "Palesa Sample",
    contactEmail: "palesa@example.co.za",
    contactPhone: "+27 51 000 1006",
    assignedConsultant: "Hlokomela Ramaoto",
    reportingFrequency: "Not configured",
    reminderPreference: "Not configured",
    startDate: "Not onboarded",
  },
  {
    id: 7,
    name: "Example Security Services",
    registrationNumber: "2017/789012/07",
    industry: "Security Services",
    location: "Bloemfontein, Free State",
    plan: "Standard",
    status: "Suspended",
    records: 48,
    expired: 1,
    dueSoon: 6,
    awaitingClient: 5,
    primaryContact: "Boitumelo Example",
    contactEmail: "boitumelo@example.co.za",
    contactPhone: "+27 51 000 1007",
    assignedConsultant: "Hlokomela Ramaoto",
    reportingFrequency: "Monthly",
    reminderPreference: "Email",
    startDate: "3 July 2026",
  },
];

const navigation = [
  {
    label: "Overview",
    href: "/dashboard",
    active: false,
  },
  {
    label: "Clients",
    href: "/clients",
    active: true,
  },
  {
    label: "Monitored Records",
    href: "/records",
    active: false,
  },
  {
    label: "Reminders",
    href: "/reminders",
    active: false,
  },
  {
    label: "Reports",
    href: "/reports",
    active: false,
  },
  {
    label: "Audit History",
    href: "/audit-history",
    active: false,
  },
  {
    label: "Settings",
    href: "/settings",
    active: false,
  },
];

export default function ClientsPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [planFilter, setPlanFilter] = useState("All");
  const [industryFilter, setIndustryFilter] = useState("All");
  const [viewMode, setViewMode] = useState<"table" | "cards">(
    "table"
  );

  const industries = useMemo(() => {
    return [
      "All",
      ...Array.from(
        new Set(clients.map((client) => client.industry))
      ).sort(),
    ];
  }, []);

  const filteredClients = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return clients.filter((client) => {
      const matchesSearch =
        normalizedSearch.length === 0 ||
        client.name.toLowerCase().includes(normalizedSearch) ||
        client.registrationNumber
          .toLowerCase()
          .includes(normalizedSearch) ||
        client.primaryContact
          .toLowerCase()
          .includes(normalizedSearch) ||
        client.industry.toLowerCase().includes(normalizedSearch);

      const matchesStatus =
        statusFilter === "All" ||
        client.status === statusFilter;

      const matchesPlan =
        planFilter === "All" || client.plan === planFilter;

      const matchesIndustry =
        industryFilter === "All" ||
        client.industry === industryFilter;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesPlan &&
        matchesIndustry
      );
    });
  }, [
    searchTerm,
    statusFilter,
    planFilter,
    industryFilter,
  ]);

  const totals = useMemo(() => {
    const activeClients = clients.filter(
      (client) => client.status === "Active"
    );

    return {
      totalClients: clients.length,
      activeClients: activeClients.length,
      prospectClients: clients.filter(
        (client) => client.status === "Prospect"
      ).length,
      suspendedClients: clients.filter(
        (client) => client.status === "Suspended"
      ).length,
      monitoredRecords: activeClients.reduce(
        (total, client) => total + client.records,
        0
      ),
      expiredRecords: activeClients.reduce(
        (total, client) => total + client.expired,
        0
      ),
    };
  }, []);

  function clearFilters() {
    setSearchTerm("");
    setStatusFilter("All");
    setPlanFilter("All");
    setIndustryFilter("All");
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      {/* MOBILE HEADER */}
      <header className="sticky top-0 z-50 flex items-center justify-between border-b border-slate-700 bg-slate-900 px-5 py-4 text-white lg:hidden">
        <Link
          href="/dashboard"
          className="flex items-center gap-3"
        >
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
          aria-controls="clients-mobile-navigation"
          className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-semibold"
        >
          Menu
        </button>
      </header>

      {mobileMenuOpen && (
        <nav
          id="clients-mobile-navigation"
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

        {/* PAGE CONTENT */}
        <section className="min-w-0">
          {/* TOP BAR */}
          <header className="border-b border-slate-200 bg-white px-6 py-5 md:px-8">
            <div className="mx-auto flex max-w-7xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-teal-700">
                  Client Management
                </p>

                <h1 className="mt-1 text-2xl font-bold text-slate-900 md:text-3xl">
                  Clients
                </h1>
              </div>

              <div className="flex flex-wrap gap-3">
                <Link
                  href="/dashboard"
                  className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-teal-600 hover:text-teal-700"
                >
                  Back to Overview
                </Link>

                <Link
                  href="/clients/new"
                  className="rounded-xl bg-teal-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-teal-700"
                >
                  New Client
                </Link>
              </div>
            </div>
          </header>

          <div className="mx-auto max-w-7xl space-y-8 px-6 py-8 md:px-8">
            {/* DEMONSTRATION NOTICE */}
            <div className="flex flex-col gap-3 rounded-2xl border border-blue-200 bg-blue-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-bold text-blue-950">
                  Fictional client information
                </p>

                <p className="mt-1 text-sm text-blue-800">
                  The organisations and contacts shown on this page
                  are demonstration data for prototype testing.
                </p>
              </div>

              <span className="w-fit rounded-full bg-blue-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-blue-800">
                Prototype
              </span>
            </div>

            {/* SUMMARY METRICS */}
            <section>
              <h2 className="text-xl font-bold text-slate-900">
                Client Summary
              </h2>

              <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
                <SummaryCard
                  label="Total clients"
                  value={String(totals.totalClients)}
                  colour="blue"
                />

                <SummaryCard
                  label="Active"
                  value={String(totals.activeClients)}
                  colour="green"
                />

                <SummaryCard
                  label="Prospects"
                  value={String(totals.prospectClients)}
                  colour="indigo"
                />

                <SummaryCard
                  label="Suspended"
                  value={String(totals.suspendedClients)}
                  colour="amber"
                />

                <SummaryCard
                  label="Active records"
                  value={String(totals.monitoredRecords)}
                  colour="teal"
                />

                <SummaryCard
                  label="Expired records"
                  value={String(totals.expiredRecords)}
                  colour="red"
                />
              </div>
            </section>

            {/* FILTERS */}
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-5">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">
                      Client Register
                    </h2>

                    <p className="mt-1 text-sm text-slate-500">
                      Search and filter fictional client organisations.
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setViewMode("table")}
                      className={`rounded-lg px-4 py-2 text-sm font-semibold ${
                        viewMode === "table"
                          ? "bg-slate-900 text-white"
                          : "border border-slate-300 bg-white text-slate-600"
                      }`}
                    >
                      Table
                    </button>

                    <button
                      type="button"
                      onClick={() => setViewMode("cards")}
                      className={`rounded-lg px-4 py-2 text-sm font-semibold ${
                        viewMode === "cards"
                          ? "bg-slate-900 text-white"
                          : "border border-slate-300 bg-white text-slate-600"
                      }`}
                    >
                      Cards
                    </button>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                  <div>
                    <label
                      htmlFor="clientSearch"
                      className="block text-xs font-semibold text-slate-500"
                    >
                      Search
                    </label>

                    <input
                      id="clientSearch"
                      type="search"
                      value={searchTerm}
                      onChange={(event) =>
                        setSearchTerm(event.target.value)
                      }
                      placeholder="Company, contact or registration"
                      className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                    />
                  </div>

                  <FilterSelect
                    label="Status"
                    value={statusFilter}
                    onChange={setStatusFilter}
                    options={[
                      "All",
                      "Prospect",
                      "Active",
                      "Suspended",
                      "Cancelled",
                    ]}
                  />

                  <FilterSelect
                    label="Plan"
                    value={planFilter}
                    onChange={setPlanFilter}
                    options={[
                      "All",
                      "Starter",
                      "Standard",
                      "Managed",
                      "Custom",
                    ]}
                  />

                  <FilterSelect
                    label="Industry"
                    value={industryFilter}
                    onChange={setIndustryFilter}
                    options={industries}
                  />

                  <button
                    type="button"
                    onClick={clearFilters}
                    className="self-end rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-teal-600 hover:text-teal-700"
                  >
                    Clear Filters
                  </button>
                </div>

                <div className="flex items-center justify-between border-t border-slate-100 pt-4">
                  <p
                    className="text-sm text-slate-500"
                    aria-live="polite"
                  >
                    Showing {filteredClients.length} of{" "}
                    {clients.length} clients
                  </p>
                </div>
              </div>
            </section>

            {/* TABLE VIEW */}
            {viewMode === "table" && (
              <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1050px] border-collapse text-left">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                        <th className="px-5 py-4 font-semibold">
                          Client
                        </th>

                        <th className="px-5 py-4 font-semibold">
                          Plan
                        </th>

                        <th className="px-5 py-4 font-semibold">
                          Status
                        </th>

                        <th className="px-5 py-4 font-semibold">
                          Records
                        </th>

                        <th className="px-5 py-4 font-semibold">
                          Expired
                        </th>

                        <th className="px-5 py-4 font-semibold">
                          Due soon
                        </th>

                        <th className="px-5 py-4 font-semibold">
                          Awaiting
                        </th>

                        <th className="px-5 py-4 font-semibold">
                          Primary contact
                        </th>

                        <th className="px-5 py-4 font-semibold">
                          Action
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {filteredClients.map((client) => (
                        <tr
                          key={client.id}
                          className="border-b border-slate-100 text-sm last:border-0 hover:bg-slate-50"
                        >
                          <td className="px-5 py-5">
                            <p className="font-semibold text-slate-900">
                              {client.name}
                            </p>

                            <p className="mt-1 text-xs text-slate-500">
                              {client.industry}
                            </p>

                            <p className="mt-1 text-xs text-slate-400">
                              {client.registrationNumber}
                            </p>
                          </td>

                          <td className="px-5 py-5">
                            <PlanBadge plan={client.plan} />
                          </td>

                          <td className="px-5 py-5">
                            <ClientStatusBadge
                              status={client.status}
                            />
                          </td>

                          <td className="px-5 py-5 font-semibold text-slate-700">
                            {client.records}
                          </td>

                          <td className="px-5 py-5">
                            <CountBadge
                              value={client.expired}
                              colour="red"
                            />
                          </td>

                          <td className="px-5 py-5">
                            <CountBadge
                              value={client.dueSoon}
                              colour="amber"
                            />
                          </td>

                          <td className="px-5 py-5">
                            <CountBadge
                              value={client.awaitingClient}
                              colour="teal"
                            />
                          </td>

                          <td className="px-5 py-5">
                            <p className="font-medium text-slate-700">
                              {client.primaryContact}
                            </p>

                            <p className="mt-1 text-xs text-slate-500">
                              {client.contactEmail}
                            </p>
                          </td>

                          <td className="px-5 py-5">
                            <Link
                              href={`/clients/${client.id}`}
                              className="rounded-lg bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-teal-700"
                            >
                              View Client
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* CARD VIEW */}
            {viewMode === "cards" && (
              <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {filteredClients.map((client) => (
                  <ClientCard
                    key={client.id}
                    client={client}
                  />
                ))}
              </section>
            )}

            {/* EMPTY STATE */}
            {filteredClients.length === 0 && (
              <section className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
                <h2 className="text-xl font-bold text-slate-900">
                  No clients found
                </h2>

                <p className="mt-2 text-slate-500">
                  No fictional clients match the current search and
                  filters.
                </p>

                <button
                  type="button"
                  onClick={clearFilters}
                  className="mt-5 font-semibold text-teal-700 hover:text-teal-800"
                >
                  Clear all filters
                </button>
              </section>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function ClientCard({ client }: { client: Client }) {
  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">
            {client.industry}
          </p>

          <h2 className="mt-2 text-xl font-bold text-slate-900">
            {client.name}
          </h2>

          <p className="mt-2 text-xs text-slate-500">
            {client.registrationNumber}
          </p>
        </div>

        <ClientStatusBadge status={client.status} />
      </div>

      <div className="mt-5 flex items-center justify-between border-y border-slate-100 py-4">
        <PlanBadge plan={client.plan} />

        <p className="text-sm font-semibold text-slate-700">
          {client.records} records
        </p>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-3">
        <SmallMetric
          label="Expired"
          value={client.expired}
          colour="red"
        />

        <SmallMetric
          label="Due soon"
          value={client.dueSoon}
          colour="amber"
        />

        <SmallMetric
          label="Awaiting"
          value={client.awaitingClient}
          colour="teal"
        />
      </div>

      <div className="mt-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Primary contact
        </p>

        <p className="mt-2 font-semibold text-slate-800">
          {client.primaryContact}
        </p>

        <p className="mt-1 text-sm text-slate-500">
          {client.contactEmail}
        </p>

        <p className="mt-1 text-sm text-slate-500">
          {client.contactPhone}
        </p>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <Link
          href={`/clients/${client.id}`}
          className="rounded-xl bg-slate-900 px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-teal-700"
        >
          View Client
        </Link>

        <Link
          href={`/records?client=${client.id}`}
          className="rounded-xl border border-slate-300 px-4 py-3 text-center text-sm font-semibold text-slate-700 transition hover:border-teal-600 hover:text-teal-700"
        >
          View Records
        </Link>
      </div>
    </article>
  );
}

function SummaryCard({
  label,
  value,
  colour,
}: {
  label: string;
  value: string;
  colour:
    | "blue"
    | "green"
    | "indigo"
    | "amber"
    | "teal"
    | "red";
}) {
  const classes = {
    blue: "border-blue-200 bg-blue-50 text-blue-800",
    green:
      "border-green-200 bg-green-50 text-green-800",
    indigo:
      "border-indigo-200 bg-indigo-50 text-indigo-800",
    amber:
      "border-amber-200 bg-amber-50 text-amber-800",
    teal: "border-teal-200 bg-teal-50 text-teal-800",
    red: "border-red-200 bg-red-50 text-red-800",
  };

  return (
    <article
      className={`rounded-2xl border p-5 ${classes[colour]}`}
    >
      <p className="text-sm font-semibold">
        {label}
      </p>

      <p className="mt-3 text-3xl font-bold">
        {value}
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
        className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-700 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
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

function ClientStatusBadge({
  status,
}: {
  status: ClientStatus;
}) {
  const classes: Record<ClientStatus, string> = {
    Prospect: "bg-blue-100 text-blue-800",
    Active: "bg-green-100 text-green-800",
    Suspended: "bg-amber-100 text-amber-800",
    Cancelled: "bg-slate-200 text-slate-700",
  };

  return (
    <span
      className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-bold ${classes[status]}`}
    >
      {status}
    </span>
  );
}

function PlanBadge({
  plan,
}: {
  plan: ServicePlan;
}) {
  const classes: Record<ServicePlan, string> = {
    Starter: "bg-slate-100 text-slate-700",
    Standard: "bg-blue-100 text-blue-800",
    Managed: "bg-teal-100 text-teal-800",
    Custom: "bg-purple-100 text-purple-800",
  };

  return (
    <span
      className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-bold ${classes[plan]}`}
    >
      {plan}
    </span>
  );
}

function CountBadge({
  value,
  colour,
}: {
  value: number;
  colour: "red" | "amber" | "teal";
}) {
  const classes = {
    red:
      value > 0
        ? "bg-red-100 text-red-800"
        : "bg-slate-100 text-slate-500",
    amber:
      value > 0
        ? "bg-amber-100 text-amber-800"
        : "bg-slate-100 text-slate-500",
    teal:
      value > 0
        ? "bg-teal-100 text-teal-800"
        : "bg-slate-100 text-slate-500",
  };

  return (
    <span
      className={`inline-flex min-w-8 justify-center rounded-full px-2.5 py-1 text-xs font-bold ${classes[colour]}`}
    >
      {value}
    </span>
  );
}

function SmallMetric({
  label,
  value,
  colour,
}: {
  label: string;
  value: number;
  colour: "red" | "amber" | "teal";
}) {
  const classes = {
    red: "bg-red-50 text-red-800",
    amber: "bg-amber-50 text-amber-800",
    teal: "bg-teal-50 text-teal-800",
  };

  return (
    <div
      className={`rounded-xl p-3 text-center ${classes[colour]}`}
    >
      <p className="text-xl font-bold">
        {value}
      </p>

      <p className="mt-1 text-[11px] font-semibold">
        {label}
      </p>
    </div>
  );
}