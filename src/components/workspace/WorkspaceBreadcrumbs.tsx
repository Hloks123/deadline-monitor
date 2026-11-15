"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type WorkspaceBreadcrumbsProps = {
  workspace: "Consultant Workspace" | "Client Workspace";
  title: string;
};

const routeLabels: Record<string, string> = {
  account: "Account",
  "audit-history": "Audit History",
  clients: "Clients",
  dashboard: "Overview",
  edit: "Edit",
  "monitored-records": "Monitored Records",
  notifications: "Notifications",
  records: "My Records",
  recurring: "Recurring Tasks",
  "recurring-tasks": "Recurring Tasks",
  reminders: "Reminders",
  reports: "Reports",
  settings: "Settings",
  tasks: "My Tasks",
  "work-tracker": "Work Tracker",
};

export default function WorkspaceBreadcrumbs({ workspace, title }: WorkspaceBreadcrumbsProps) {
  const pathname = usePathname();
  const isClient = pathname.startsWith("/client/");
  const root = isClient ? "/client/dashboard" : "/dashboard";
  const route = isClient ? pathname.slice("/client".length) : pathname;
  const segments = route.split("/").filter(Boolean);
  const items = segments.map((segment, index) => ({
    href: `${isClient ? "/client" : ""}/${segments.slice(0, index + 1).join("/")}`,
    label: index === segments.length - 1
      ? title
      : routeLabels[segment] || segment.replace(/-/g, " "),
  }));

  return (
    <nav aria-label="Breadcrumb" className="min-w-0 overflow-x-auto border-b border-slate-800 px-4 py-2 text-xs sm:px-6 lg:px-8">
      <ol className="flex min-w-max items-center gap-2 text-slate-400">
        <li className="flex items-center gap-2">
          <Link
            href={root}
            className="rounded-sm font-medium text-teal-400 hover:text-teal-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
          >
            {workspace}
          </Link>
          {items.length > 0 && <span aria-hidden="true" className="text-slate-600">›</span>}
        </li>
        {items.map((item, index) => {
          const current = index === items.length - 1;
          return (
            <li key={item.href} className="flex items-center gap-2">
              {current
                ? <span aria-current="page" className="cursor-default font-semibold text-white">{item.label}</span>
                : <Link href={item.href} className="rounded-sm hover:text-teal-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400">{item.label}</Link>}
              {!current && <span aria-hidden="true" className="text-slate-600">›</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
