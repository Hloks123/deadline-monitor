"use client";

import { useEffect, useRef, useState } from "react";
import ClientHeader from "./ClientHeader";
import ClientSidebar from "./ClientSidebar";
import { resolvePrototypeClientForOrganisation } from "@/lib/clientStore";
import {
  clearAuthenticatedClientOrganisation,
  setAuthenticatedClientOrganisation,
  type AuthenticatedClientOrganisation,
} from "@/lib/clientWorkspaceConstants";

type ClientWorkspaceShellProps = {
  children: React.ReactNode;
  title: string;
  actions?: React.ReactNode;
};

export default function ClientWorkspaceShell({ children, title, actions }: ClientWorkspaceShellProps) {
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);
  const previousNavigationState = useRef(false);
  const [contextState, setContextState] = useState<
    | { status: "loading" }
    | { status: "error"; message: string }
    | {
        status: "ready";
        organisationName: string;
        userName: string;
        jobTitle: string;
        isSeniorManager: boolean;
      }
  >({ status: "loading" });

  useEffect(() => {
    let active = true;
    clearAuthenticatedClientOrganisation();

    async function loadOrganisationContext() {
      try {
        const response = await fetch("/api/client/workspace", { cache: "no-store" });
        const result: unknown = await response.json();
        if (!active) return;
        if (!response.ok || !isClientWorkspaceResponse(result)) {
          setContextState({
            status: "error",
            message:
              result &&
              typeof result === "object" &&
              "status" in result &&
              result.status === "ambiguous_membership"
                ? "Your account has access to more than one client organisation. Contact Deadline-Monitor support to resolve the assignment."
                : "We could not verify your client organisation access. Please sign in again or contact support.",
          });
          return;
        }

        const context: AuthenticatedClientOrganisation = {
          id: result.organisation.id,
          name: result.organisation.name,
          role: result.organisation.role,
          isPrimary: result.organisation.isSeniorManager,
          userId: result.user.id,
          userName: result.user.name,
          userEmail: result.user.email,
        };
        const prototypeClient = resolvePrototypeClientForOrganisation(
          context.id,
          context.name,
        );
        setAuthenticatedClientOrganisation(context, prototypeClient?.id);
        setContextState({
          status: "ready",
          organisationName: context.name,
          userName: context.userName,
          jobTitle: result.organisation.jobTitle,
          isSeniorManager: result.organisation.isSeniorManager,
        });
      } catch {
        if (active) {
          setContextState({
            status: "error",
            message: "We could not load your client organisation. Please try again.",
          });
        }
      }
    }

    void loadOrganisationContext();
    return () => {
      active = false;
      clearAuthenticatedClientOrganisation();
    };
  }, []);

  useEffect(() => {
    if (mobileNavigationOpen) {
      document.querySelector<HTMLElement>("#client-workspace-sidebar nav a")?.focus();
    } else if (previousNavigationState.current) {
      document.querySelector<HTMLButtonElement>("#client-navigation-toggle")?.focus();
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
    const sidebar = document.getElementById("client-workspace-sidebar");
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
    <div className="flex h-[100dvh] overflow-hidden bg-slate-50" onKeyDown={handleNavigationKeyDown}>
      {mobileNavigationOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setMobileNavigationOpen(false)}
          className="fixed inset-0 z-40 bg-slate-950/40 md:hidden"
        />
      )}
      <ClientSidebar
        mobileOpen={mobileNavigationOpen}
        onNavigate={() => setMobileNavigationOpen(false)}
        userName={contextState.status === "ready" ? contextState.userName : ""}
        jobTitle={contextState.status === "ready" ? contextState.jobTitle : ""}
        isSeniorManager={contextState.status === "ready" && contextState.isSeniorManager}
      />
      <div inert={mobileNavigationOpen} className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <ClientHeader
          title={title}
          actions={actions}
          mobileNavigationOpen={mobileNavigationOpen}
          onOpenNavigation={() => setMobileNavigationOpen(true)}
        />
        <main className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden bg-slate-50">
          {process.env.NODE_ENV !== "production" && (
            <p className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-950 sm:px-6">
              Development environment — do not enter real or confidential information. Company records and task assignments are server-backed; legacy checklist and recurring-work data may remain browser-local.
            </p>
          )}
          {contextState.status === "loading" ? (
            <p role="status" className="p-8 text-slate-600">
              Loading your organisation workspace...
            </p>
          ) : contextState.status === "error" ? (
            <p role="alert" className="m-6 rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-950">
              {contextState.message}
            </p>
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  );
}

function isClientWorkspaceResponse(value: unknown): value is {
  status: "authorized";
  organisation: {
    id: string;
    name: string;
    role: "client_administrator" | "client_user";
    isSeniorManager: boolean;
    jobTitle: string;
  };
  user: { id: string; name: string; email: string };
} {
  if (!value || typeof value !== "object") return false;
  const response = value as Record<string, unknown>;
  if (response.status !== "authorized") return false;
  const organisation = response.organisation;
  const user = response.user;
  return Boolean(
    organisation &&
      typeof organisation === "object" &&
      "id" in organisation &&
      typeof organisation.id === "string" &&
      "name" in organisation &&
      typeof organisation.name === "string" &&
      "role" in organisation &&
      (organisation.role === "client_user" ||
        organisation.role === "client_administrator") &&
      "isSeniorManager" in organisation &&
      typeof organisation.isSeniorManager === "boolean" &&
      "jobTitle" in organisation &&
      typeof organisation.jobTitle === "string" &&
      user &&
      typeof user === "object" &&
      "id" in user &&
      typeof user.id === "string" &&
      "name" in user &&
      typeof user.name === "string" &&
      "email" in user &&
      typeof user.email === "string",
  );
}
