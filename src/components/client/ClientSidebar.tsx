"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import SignOutButton from "@/components/auth/SignOutButton";

const navigation = [
  { label: "Overview", href: "/client/dashboard", icon: "▦" },
  { label: "My Records", href: "/client/records", icon: "▤" },
  { label: "My Work", href: "/client/work", icon: "☷" },
  { label: "Calendar", href: "/client/calendar", icon: "▦" },
  { label: "Notifications", href: "/client/notifications", icon: "♧" },
];

const insightNavigation = [
  { label: "Reports", href: "/client/reports", icon: "▥" },
];

type ClientSidebarProps = {
  mobileOpen?: boolean;
  onNavigate?: () => void;
  userName: string;
  jobTitle: string;
  isSeniorManager: boolean;
};

export default function ClientSidebar({
  mobileOpen = false,
  onNavigate,
  userName,
  jobTitle,
  isSeniorManager,
}: ClientSidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      id="client-workspace-sidebar"
      aria-label="Client workspace sidebar"
      role={mobileOpen ? "dialog" : undefined}
      aria-modal={mobileOpen ? "true" : undefined}
      className={`${mobileOpen ? "fixed inset-y-0 left-0 z-50 flex w-[264px] shadow-xl" : "hidden"} h-[100dvh] shrink-0 flex-col overflow-hidden bg-slate-950 text-white md:static md:z-auto md:flex md:w-[240px] md:shadow-none`}
    >
      <div className="shrink-0 border-b border-slate-800 px-4">
        <div className="flex min-h-[76px] items-center">
          <Link href="/client/dashboard" onClick={onNavigate} className="flex min-w-0 flex-1 items-center gap-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white p-1">
              <Image src="/deadline-monitor-logo.png" alt="Deadline-Monitor logo" width={44} height={44} priority className="h-full w-full object-contain" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[17px] font-bold tracking-tight">Deadline-Monitor</span>
              <span className="mt-1 block truncate text-[10px] font-bold uppercase tracking-wider text-teal-400">Client Workspace</span>
            </span>
            <span className="sr-only">Deadline-Monitor Client Workspace</span>
          </Link>
          {mobileOpen && (
            <button type="button" aria-label="Close navigation" onClick={onNavigate} className="ml-2 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-slate-300 hover:bg-slate-900 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 md:hidden">
              <span aria-hidden="true">×</span>
            </button>
          )}
        </div>
      </div>

      <nav aria-label="Client workspace navigation" className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-3">
        <p className="mb-2 cursor-default px-3 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Workspace</p>
        <div className="space-y-0.5">
          {navigation.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                aria-label={item.label}
                aria-current={active ? "page" : undefined}
                title={item.label}
                className={`group flex min-h-[40px] cursor-pointer items-center gap-3 rounded-lg border-l-2 px-3 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-teal-400 ${
                  active ? "border-teal-300 bg-teal-700 text-white" : "border-transparent text-slate-300 hover:bg-slate-900 hover:text-white"
                }`}
              >
                <span aria-hidden="true" className="flex h-5 w-5 shrink-0 items-center justify-center text-lg">{item.icon}</span>
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
              </Link>
            );
          })}
        </div>
        {isSeniorManager && (
          <Link
            href="/client/team"
            onClick={onNavigate}
            aria-current={pathname === "/client/team" ? "page" : undefined}
            className={`mt-2 flex min-h-[40px] cursor-pointer items-center gap-3 rounded-lg border-l-2 px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-teal-400 ${
              pathname === "/client/team" ? "border-teal-300 bg-teal-700 text-white" : "border-transparent text-slate-300 hover:bg-slate-900 hover:text-white"
            }`}
          >
            <span aria-hidden="true" className="flex h-5 w-5 shrink-0 items-center justify-center text-lg">♙</span>
            <span className="min-w-0 flex-1 truncate">Manage users</span>
          </Link>
        )}
        <div className="my-3 border-t border-slate-800" />
        <p className="mb-2 cursor-default px-3 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Insight</p>
        <div className="space-y-0.5">
          {insightNavigation.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-[40px] cursor-pointer items-center gap-3 rounded-lg border-l-2 px-3 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-teal-400 ${
                  active ? "border-teal-300 bg-teal-700 text-white" : "border-transparent text-slate-300 hover:bg-slate-900 hover:text-white"
                }`}
              >
                <span aria-hidden="true" className="flex h-5 w-5 shrink-0 items-center justify-center text-lg">{item.icon}</span>
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
      <div className="shrink-0 border-t border-slate-800 bg-slate-950 p-3">
        <div className="rounded-lg border border-slate-800 bg-slate-900 p-3">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-600 text-sm font-bold text-white">{userName.trim().split(/\s+/).slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join("") || "U"}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{userName || "Client user"}</span>
              <span className="mt-0.5 block truncate text-xs text-slate-400">{isSeniorManager ? "Senior Manager" : jobTitle || "Company user"}</span>
            </span>
          </div>
          <Link href="/" onClick={onNavigate} aria-label="Return to Deadline-Monitor website" className="mt-2 flex min-h-[36px] items-center text-sm font-semibold text-teal-400 hover:text-teal-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400">
            <span>Return to Website</span>
          </Link>
          <Link href="/client/account" onClick={onNavigate} aria-current={pathname === "/client/account" ? "page" : undefined} className={`mt-1 flex min-h-[36px] items-center gap-3 rounded-md px-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 ${pathname === "/client/account" ? "bg-slate-800 text-white" : "text-slate-300 hover:bg-slate-800 hover:text-white"}`}>
            <span aria-hidden="true">◉</span>
            Account
          </Link>
          <SignOutButton onNavigate={onNavigate} />
        </div>
      </div>
    </aside>
  );
}
