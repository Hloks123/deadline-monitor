"use client";

import type { ReactNode } from "react";
import WorkspaceBreadcrumbs from "@/components/workspace/WorkspaceBreadcrumbs";
import WorkspaceCommandBar from "@/components/workspace/WorkspaceCommandBar";

type ClientHeaderProps = {
  title: string;
  actions?: ReactNode;
  mobileNavigationOpen: boolean;
  onOpenNavigation: () => void;
};

export default function ClientHeader({ title, actions, mobileNavigationOpen, onOpenNavigation }: ClientHeaderProps) {
  return (
    <header className="shrink-0 border-b border-slate-800 bg-slate-950 text-white">
      <WorkspaceBreadcrumbs workspace="Client Workspace" title={title} />
      <div className="flex min-h-[60px] items-center justify-between gap-3 px-4 py-2 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            id="client-navigation-toggle"
            aria-label="Open navigation"
            aria-controls="client-workspace-sidebar"
            aria-expanded={mobileNavigationOpen}
            onClick={onOpenNavigation}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-slate-300 hover:bg-slate-900 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 md:hidden"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <h1 className="truncate text-lg font-semibold tracking-tight text-white">{title}</h1>
        </div>
        {actions && <WorkspaceCommandBar>{actions}</WorkspaceCommandBar>}
      </div>
    </header>
  );
}
