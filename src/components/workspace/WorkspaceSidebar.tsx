"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import SignOutButton from "@/components/auth/SignOutButton";

type WorkspaceSidebarProps = {
  onNavigate?: () => void;
  mobileOpen?: boolean;
  canManageSettings?: boolean;
};

type IconProps = {
  children: ReactNode;
};

function Icon({ children }: IconProps) {
  return (
    <span
      aria-hidden="true"
      className="flex h-5 w-5 shrink-0 items-center justify-center"
    >
      {children}
    </span>
  );
}

/* =========================
   ICONS
========================= */

function DashboardIcon() {
  return (
    <Icon>
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        className="h-5 w-5"
      >
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    </Icon>
  );
}

function ClientsIcon() {
  return (
    <Icon>
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        className="h-5 w-5"
      >
        <circle cx="9" cy="8" r="4" />
        <path d="M3 21v-2a6 6 0 0 1 12 0v2" />
        <path d="M16 4.5a4 4 0 0 1 0 7" />
        <path d="M17 15a6 6 0 0 1 4 5.7" />
      </svg>
    </Icon>
  );
}

function RecordsIcon() {
  return (
    <Icon>
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        className="h-5 w-5"
      >
        <path d="M6 2h9l4 4v16H6z" />
        <path d="M14 2v5h5" />
        <path d="M9 12h6M9 16h6" />
      </svg>
    </Icon>
  );
}

function RecurringTasksIcon() {
  return (
    <Icon>
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        className="h-5 w-5"
      >
        <path d="M20 7v5h-5" />
        <path d="M4 17v-5h5" />
        <path d="M5.6 9a7 7 0 0 1 11.6-2L20 12" />
        <path d="M18.4 15a7 7 0 0 1-11.6 2L4 12" />
      </svg>
    </Icon>
  );
}

function CalendarIcon() {
  return (
    <Icon>
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        className="h-5 w-5"
      >
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M16 3v4M8 3v4M3 10h18" />
      </svg>
    </Icon>
  );
}

function BellIcon() {
  return (
    <Icon>
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        className="h-5 w-5"
      >
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
        <path d="M10 21h4" />
      </svg>
    </Icon>
  );
}

function ReportsIcon() {
  return (
    <Icon>
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        className="h-5 w-5"
      >
        <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
      </svg>
    </Icon>
  );
}

function AuditIcon() {
  return (
    <Icon>
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        className="h-5 w-5"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
    </Icon>
  );
}

function SettingsIcon() {
  return (
    <Icon>
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        className="h-5 w-5"
      >
        <circle cx="12" cy="12" r="3" />

        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6 1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" />
      </svg>
    </Icon>
  );
}

/* =========================
   MENU
========================= */

const workspaceItems = [
  {
    name: "Overview",
    href: "/dashboard",
    icon: <DashboardIcon />,
  },
  {
    name: "Clients",
    href: "/clients",
    icon: <ClientsIcon />,
  },
  {
    name: "Monitored Records",
    href: "/monitored-records",
    icon: <RecordsIcon />,
  },
  {
    name: "Work",
    href: "/work",
    icon: <RecurringTasksIcon />,
  },
  {
    name: "Calendar",
    href: "/calendar",
    icon: <CalendarIcon />,
  },
  {
    name: "Reminders",
    href: "/reminders",
    icon: <BellIcon />,
    count: 3,
  },
];

const insightItems = [
  {
    name: "Reports",
    href: "/reports",
    icon: <ReportsIcon />,
  },
  {
    name: "Audit History",
    href: "/audit-history",
    icon: <AuditIcon />,
  },
];

const administrationItems = [
  {
    name: "Settings",
    href: "/settings",
    icon: <SettingsIcon />,
  },
  {
    name: "Account",
    href: "/account",
    icon: <SettingsIcon />,
  },
];

/* =========================
   SIDEBAR
========================= */

export default function WorkspaceSidebar({
  onNavigate,
  mobileOpen = false,
  canManageSettings = false,
}: WorkspaceSidebarProps) {
  const pathname = usePathname();

  function isActive(href: string) {
    return (
      pathname === href ||
      pathname.startsWith(`${href}/`)
    );
  }

  return (
    <aside
      id="consultant-workspace-sidebar"
      aria-label="Consultant workspace sidebar"
      role={mobileOpen ? "dialog" : undefined}
      aria-modal={mobileOpen ? "true" : undefined}
      className={`${mobileOpen ? "fixed inset-y-0 left-0 z-50 flex w-[264px] shadow-xl" : "hidden"} h-[100dvh] shrink-0 flex-col overflow-hidden bg-slate-950 text-white md:static md:z-auto md:flex md:w-[240px] md:shadow-none`}
    >

      {/* BRAND */}
      <div className="shrink-0 border-b border-slate-800 px-4">

        <div className="flex min-h-[76px] items-center">

          <Link
            href="/dashboard"
            onClick={onNavigate}
            className="flex min-w-0 items-center gap-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400"
          >

            {/* LOGO */}
            <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white p-1">

              <Image
                src="/deadline-monitor-logo.png"
                alt="Deadline-Monitor logo"
                width={40}
                height={40}
                priority
                className="h-full w-full object-contain"
              />

            </div>

            {/* BRAND NAME */}
            <div className="min-w-0">

              <h2 className="truncate text-[17px] font-bold tracking-tight text-white">
                Deadline-Monitor
              </h2>

              <p className="mt-1 truncate text-[10px] font-bold uppercase tracking-wider text-teal-400">
                Consultant Workspace
              </p>

            </div>

          </Link>
          {mobileOpen && (
            <button
              type="button"
              aria-label="Close navigation"
              onClick={onNavigate}
              className="ml-2 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-slate-300 hover:bg-slate-900 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 md:hidden"
            >
              <span aria-hidden="true">×</span>
            </button>
          )}

        </div>

      </div>

      {/* SCROLLABLE MENU */}
      <nav aria-label="Consultant workspace navigation" className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-3">

        <p className="mb-2 cursor-default px-3 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
          Workspace
        </p>

        <div className="space-y-0.5">

          {workspaceItems.map((item) => {
            const active = isActive(
              item.href
            );

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                aria-current={
                  active
                    ? "page"
                    : undefined
                }
                className={`group flex min-h-[40px] cursor-pointer items-center gap-3 rounded-lg border-l-2 px-3 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-teal-400 ${
                  active
                    ? "border-teal-300 bg-teal-700 text-white"
                    : "border-transparent text-slate-300 hover:bg-slate-900 hover:text-white"
                }`}
              >

                <span
                  className={
                    active
                      ? "text-white"
                      : "text-slate-400 group-hover:text-white"
                  }
                >
                  {item.icon}
                </span>

                <span className="min-w-0 flex-1 truncate">
                  {item.name}
                </span>

                {item.count !== undefined && (
                  <span
                    className={`flex min-w-[24px] items-center justify-center rounded-full px-1.5 py-1 text-[11px] font-bold ${
                      active
                        ? "bg-white text-teal-700"
                        : "bg-red-500 text-white"
                    }`}
                  >
                    {item.count}
                  </span>
                )}

              </Link>
            );
          })}

        </div>

        <div className="my-3 border-t border-slate-800" />
        <p className="mb-2 cursor-default px-3 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
          Insight
        </p>
        <div className="space-y-0.5">
          {insightItems.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={`group flex min-h-[40px] cursor-pointer items-center gap-3 rounded-lg border-l-2 px-3 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-teal-400 ${
                  active ? "border-teal-300 bg-teal-700 text-white" : "border-transparent text-slate-300 hover:bg-slate-900 hover:text-white"
                }`}
              >
                <span className={active ? "text-white" : "text-slate-400 group-hover:text-white"}>{item.icon}</span>
                <span className="min-w-0 flex-1 truncate">{item.name}</span>
              </Link>
            );
          })}
        </div>

        {/* ADMINISTRATION */}
        <div className="my-4 border-t border-slate-800" />

        <p className="mb-2 cursor-default px-3 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
          Administration
        </p>

        <div className="space-y-0.5">

          {administrationItems
            .filter((item) => item.href !== "/settings" || canManageSettings)
            .map(
            (item) => {
              const active = isActive(
                item.href
              );

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={
                    active
                      ? "page"
                      : undefined
                  }
                  className={`group flex min-h-[40px] cursor-pointer items-center gap-3 rounded-lg border-l-2 px-3 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-teal-400 ${
                    active
                      ? "border-teal-300 bg-teal-700 text-white"
                      : "border-transparent text-slate-300 hover:bg-slate-900 hover:text-white"
                  }`}
                >

                  <span
                    className={
                      active
                        ? "text-white"
                        : "text-slate-400 group-hover:text-white"
                    }
                  >
                    {item.icon}
                  </span>

                  <span>
                    {item.name}
                  </span>

                </Link>
              );
            }
          )}

        </div>

      </nav>

      {/* PROFILE */}
      <div className="shrink-0 border-t border-slate-800 bg-slate-950 p-3">

        <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">

          <div className="flex items-center gap-3">

            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-600 text-sm font-bold text-white">
              HR
            </div>

            <div className="min-w-0">

              <p className="truncate text-sm font-semibold text-white">
                Hlokomela Ramaoto
              </p>

              <p className="mt-0.5 text-xs text-slate-400">
                Consultant
              </p>

            </div>

          </div>

          <Link
            href="/"
            onClick={onNavigate}
            className="mt-3 flex min-h-[36px] items-center text-sm font-semibold text-teal-400 hover:text-teal-300"
          >
            Return to Website
          </Link>

          <SignOutButton onNavigate={onNavigate} />

        </div>

      </div>

    </aside>
  );
}