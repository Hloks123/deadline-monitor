"use client";

import React, { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import WorkspaceSidebar from "./WorkspaceSidebar";
import WorkspaceBreadcrumbs from "./WorkspaceBreadcrumbs";
import WorkspaceCommandBar from "./WorkspaceCommandBar";
import AssistantWorkspaceAccess from "./AssistantWorkspaceAccess";

type WorkspaceShellProps = {
  children: React.ReactNode;
  eyebrow?: string;
  title?: string;
  actions?: React.ReactNode;
};

export default function WorkspaceShell({
  children,
  eyebrow,
  title,
  actions,
}: WorkspaceShellProps) {
  const pathname = usePathname();
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);
  const previousNavigationState = useRef(false);
  const [accessState, setAccessState] = useState<
    "checking" | "main_consultant" | "administrator" | "assistant_consultant" | "denied"
  >("checking");

  useEffect(() => {
    let active = true;
    void fetch("/api/auth/workspace", { cache: "no-store" })
      .then(async (response) => {
        const result = (await response.json()) as {
          status?: string;
          platformRoles?: string[];
          memberships?: Array<{ role: string }>;
        };
        if (!response.ok || result.status !== "authorized") {
          throw new Error("Workspace access could not be verified.");
        }
        if (!active) return;
        if (result.platformRoles?.includes("main_consultant")) {
          setAccessState("main_consultant");
        } else if (result.platformRoles?.includes("administrator")) {
          setAccessState("administrator");
        } else if (
          result.memberships?.some(
            (membership) => membership.role === "assistant_consultant",
          )
        ) {
          setAccessState("assistant_consultant");
        } else {
          setAccessState("denied");
        }
      })
      .catch(() => {
        if (active) setAccessState("denied");
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (mobileNavigationOpen) {
      document.querySelector<HTMLElement>("#consultant-workspace-sidebar nav a")?.focus();
    } else if (previousNavigationState.current) {
      document.querySelector<HTMLButtonElement>("#consultant-navigation-toggle")?.focus();
    }
    previousNavigationState.current = mobileNavigationOpen;
  }, [mobileNavigationOpen]);

  function handleNavigationKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (!mobileNavigationOpen) return;
    if (event.key === "Escape") {
      setMobileNavigationOpen(false);
      return;
    }
    if (event.key !== "Tab") return;
    const sidebar = document.getElementById("consultant-workspace-sidebar");
    const focusable = sidebar?.querySelectorAll<HTMLElement>('a[href], button:not(:disabled)');
    if (!focusable?.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;
    if (!sidebar?.contains(active)) {
      event.preventDefault();
      first.focus();
    } else if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div className="fixed inset-x-0 top-0 flex h-[100dvh] overflow-hidden bg-slate-50" onKeyDown={handleNavigationKeyDown}>
      {mobileNavigationOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setMobileNavigationOpen(false)}
          className="fixed inset-0 z-40 bg-slate-950/40 md:hidden"
        />
      )}
      <WorkspaceSidebar
        mobileOpen={mobileNavigationOpen}
        canManageSettings={
          accessState === "main_consultant" || accessState === "administrator"
        }
        onNavigate={() => setMobileNavigationOpen(false)}
      />
      <div inert={mobileNavigationOpen} className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {(title || actions) && (
          <header className="z-30 shrink-0 border-b border-slate-800 bg-slate-950 text-white">
            <WorkspaceBreadcrumbs workspace="Consultant Workspace" title={title || eyebrow || "Workspace"} />
            <div className="flex min-h-[60px] items-center justify-between gap-3 px-4 py-2 sm:px-6 lg:px-8">
              <div className="flex min-w-0 items-center gap-3">
                <button
                  type="button"
                  id="consultant-navigation-toggle"
                  aria-label="Open navigation"
                  aria-controls="consultant-workspace-sidebar"
                  aria-expanded={mobileNavigationOpen}
                  onClick={() => setMobileNavigationOpen(true)}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-slate-300 hover:bg-slate-900 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 md:hidden"
                >
                  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
                    <path d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
                <h1 className="truncate text-lg font-semibold tracking-tight text-white">
                  {title || eyebrow || "Workspace"}
                </h1>
              </div>
              {accessState === "main_consultant" && actions && (
                <WorkspaceCommandBar>{actions}</WorkspaceCommandBar>
              )}
            </div>
          </header>
        )}
        <main className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain bg-slate-50">
          {accessState === "checking" ? (
            <p role="status" className="m-5 rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
              Verifying workspace access…
            </p>
          ) : accessState === "assistant_consultant" ? (
            pathname === "/account" ? (
              children
            ) : (
              <AssistantWorkspaceAccess />
            )
          ) : accessState === "administrator" &&
            pathname !== "/settings" &&
            pathname !== "/account" ? (
            <section role="alert" className="m-5 rounded-xl border border-blue-200 bg-blue-50 p-5 text-sm text-blue-950">
              <h2 className="font-bold">Operational workspace access is not assigned</h2>
              <p className="mt-2">Platform administration does not automatically grant access to client operational data.</p>
            </section>
          ) : accessState === "denied" ? (
            <section role="alert" className="m-5 rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-900">
              Workspace access could not be verified. Refresh the page or contact support.
            </section>
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  );
}