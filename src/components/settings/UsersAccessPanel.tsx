"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

type ManagedMembership = {
  organisationId: string;
  organisationName: string;
  role: string;
  active: boolean;
};

type ManagedUser = {
  id: string;
  name: string;
  email: string | null;
  active: boolean;
  platformRoles: Array<{ role: string; active: boolean }>;
  memberships: ManagedMembership[];
};

type OrganisationOption = { id: string; name: string; status: string };
type UserRole =
  | "administrator"
  | "assistant_consultant"
  | "client_administrator"
  | "client_user";

type AssignmentDraft = {
  organisationId: string;
  role: UserRole;
};

const roleLabels: Record<string, string> = {
  administrator: "Administrator",
  main_consultant: "Main consultant",
  assistant_consultant: "Assistant Consultant",
  client_administrator: "Client Administrator",
  client_user: "Client User",
};

const inputClass =
  "min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-slate-900";

export default function UsersAccessPanel() {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [organisations, setOrganisations] = useState<OrganisationOption[]>([]);
  const [assignmentDrafts, setAssignmentDrafts] = useState<
    Record<string, AssignmentDraft>
  >({});
  const [role, setRole] = useState<UserRole>("client_user");
  const [selectedOrganisations, setSelectedOrganisations] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [canAssignAdministrator, setCanAssignAdministrator] = useState(false);
  const [canManageAssistantAssignments, setCanManageAssistantAssignments] = useState(false);
  const [actorId, setActorId] = useState("");
  const [organisationsLoaded, setOrganisationsLoaded] = useState(false);
  const [organisationsError, setOrganisationsError] = useState("");
  const [usersError, setUsersError] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    try {
      const [accessResponse, usersResponse, organisationsResponse] = await Promise.all([
        fetch("/api/auth/workspace", { cache: "no-store" }),
        fetch("/api/admin/users", { cache: "no-store" }),
        fetch("/api/admin/organisations", { cache: "no-store" }),
      ]);
      const accessResult = (await accessResponse.json()) as {
        status?: string;
        platformRoles?: string[];
      };
      const usersResult = (await usersResponse.json()) as {
        error?: string;
        users?: ManagedUser[];
        capabilities?: { canAssignAdministrator: boolean; actorId: string };
      };
      const organisationsResult = (await organisationsResponse.json()) as {
        error?: string;
        organisations?: OrganisationOption[];
      };
      if (accessResponse.ok && accessResult.status === "authorized") {
        const platformRoles = accessResult.platformRoles ?? [];
        setCanAssignAdministrator(platformRoles.includes("main_consultant"));
        setCanManageAssistantAssignments(platformRoles.includes("main_consultant"));
      } else {
        setCanAssignAdministrator(false);
        setCanManageAssistantAssignments(false);
      }

      if (organisationsResponse.ok) {
        setOrganisations(organisationsResult.organisations ?? []);
        setOrganisationsError("");
      } else {
        setOrganisations([]);
        setOrganisationsError(
          organisationsResult.error || "Active organisations could not be loaded.",
        );
      }
      setOrganisationsLoaded(true);

      if (usersResponse.ok) {
        setUsers(usersResult.users ?? []);
        setUsersError("");
        setCanAssignAdministrator(
          accessResult.platformRoles?.includes("main_consultant") ??
            usersResult.capabilities?.canAssignAdministrator ??
            false,
        );
        setActorId(usersResult.capabilities?.actorId ?? "");
      } else {
        setUsers([]);
        setUsersError(
          usersResult.error ||
            "The user list is unavailable. Privileged user management may not be configured in this environment.",
        );
      }
    } catch {
      setOrganisationsLoaded(true);
      setOrganisationsError("Active organisations could not be loaded. Check your connection and try again.");
      setUsersError("The user list could not be loaded. Check your connection and try again.");
    }
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      void load();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [load]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (role === "assistant_consultant" && selectedOrganisations.length === 0) {
      setError("Select at least one organisation for this Assistant Consultant.");
      setNotice("");
      return;
    }
    if (
      (role === "client_administrator" || role === "client_user") &&
      selectedOrganisations.length !== 1
    ) {
      setError("Select exactly one organisation for this client user.");
      setNotice("");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          role,
          organisationIds: selectedOrganisations,
        }),
      });
      const result = (await response.json()) as {
        error?: string;
        recoveredExistingAuthUser?: boolean;
      };
      if (!response.ok) {
        setError(
          response.status === 503
            ? "Invitations are temporarily unavailable. Please try again or contact support."
            : result.error || "The invitation could not be sent. Try again or contact support.",
        );
        return;
      }
      setName("");
      setEmail("");
      setSelectedOrganisations([]);
      setNotice(
        result.recoveredExistingAuthUser
          ? "Existing account access is now set up. No new invitation was sent."
          : "Invitation sent. The user will receive an email to activate their Deadline-Monitor account and create a password.",
      );
      await load();
    } catch {
      setError("The invitation could not be sent. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function changeAccess(
    userId: string,
    change: Record<string, unknown>,
    successMessage: string,
  ) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(change),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(result.error || "The access change could not be saved.");
        return;
      }
      setNotice(successMessage);
      await load();
    } catch {
      setError("The access change could not be saved. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function requestPasswordReset(user: ManagedUser) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "password_reset" }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(result.error || "The reset email could not be sent.");
        return;
      }
      setNotice(`Password reset email requested for ${user.email || "the selected user"}.`);
    } catch {
      setError("The reset email could not be sent. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  function toggleOrganisation(id: string) {
    setSelectedOrganisations((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : role === "assistant_consultant"
          ? [...current, id]
          : [id],
    );
  }

  return (
    <div className="space-y-6 p-5 sm:p-6">
      <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
        Manage user invitations and organisation access securely from Deadline-Monitor. Audit history is not yet available.
      </p>
      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
      {notice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">{notice}</p>}
      {organisationsError && (
        <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          {organisationsError}
        </p>
      )}

      <form onSubmit={submit} className="grid gap-4 rounded-xl border border-slate-200 p-5 sm:grid-cols-2">
        <h3 className="text-lg font-bold sm:col-span-2">Invite user</h3>
        <label className="text-sm font-semibold text-slate-700">
          Name
          <input required maxLength={120} value={name} onChange={(event) => setName(event.target.value)} className={`${inputClass} mt-2`} />
        </label>
        <label className="text-sm font-semibold text-slate-700">
          Email
          <input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} className={`${inputClass} mt-2`} />
        </label>
        <label className="text-sm font-semibold text-slate-700 sm:col-span-2">
          Role
          <select value={role} onChange={(event) => { setRole(event.target.value as UserRole); setSelectedOrganisations([]); setError(""); }} className={`${inputClass} mt-2`}>
            {canAssignAdministrator && <option value="administrator">Administrator</option>}
            {canManageAssistantAssignments && <option value="assistant_consultant">Assistant Consultant</option>}
            <option value="client_administrator">Client Administrator</option>
            <option value="client_user">Client User</option>
          </select>
        </label>
        {role === "assistant_consultant" && canManageAssistantAssignments && (
          <fieldset className="space-y-3 sm:col-span-2">
            <legend className="text-sm font-semibold text-slate-700">
              Assigned organisations
            </legend>
            <div className="flex flex-wrap gap-3 text-sm">
              <button
                type="button"
                disabled={!organisations.length || busy}
                onClick={() => setSelectedOrganisations(organisations.map((organisation) => organisation.id))}
                className="cursor-pointer font-semibold text-teal-800 underline disabled:cursor-not-allowed disabled:opacity-50"
              >
                Select all
              </button>
              <button
                type="button"
                disabled={!selectedOrganisations.length || busy}
                onClick={() => setSelectedOrganisations([])}
                className="cursor-pointer font-semibold text-teal-800 underline disabled:cursor-not-allowed disabled:opacity-50"
              >
                Clear all
              </button>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {organisations.map((organisation) => (
                <label key={organisation.id} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-slate-200 px-3">
                  <input
                    type="checkbox"
                    name="assigned-organisations"
                    checked={selectedOrganisations.includes(organisation.id)}
                    onChange={() => toggleOrganisation(organisation.id)}
                  />
                  <span>{organisation.name}</span>
                </label>
              ))}
            </div>
            {organisationsLoaded && organisations.length === 0 && !organisationsError && (
              <p className="text-sm text-slate-600">No active client organisations are available to assign.</p>
            )}
          </fieldset>
        )}
        {(role === "client_administrator" || role === "client_user") && (
          <label className="text-sm font-semibold text-slate-700 sm:col-span-2">
            Organisation
            <select
              required
              value={selectedOrganisations[0] || ""}
              onChange={(event) => setSelectedOrganisations(event.target.value ? [event.target.value] : [])}
              className={`${inputClass} mt-2`}
            >
              <option value="">Select an organisation</option>
              {organisations.map((organisation) => (
                <option key={organisation.id} value={organisation.id}>{organisation.name}</option>
              ))}
            </select>
            {organisationsLoaded && organisations.length === 0 && !organisationsError && (
              <span className="mt-1 block text-xs font-normal text-slate-600">No active client organisations are available.</span>
            )}
          </label>
        )}
        {role === "administrator" && (
          <p className="text-sm text-slate-600 sm:col-span-2">
            Administrator is a platform role and does not receive organisation memberships from this invitation.
          </p>
        )}
        <button type="submit" disabled={busy} className={`min-h-11 rounded-xl bg-teal-600 px-5 font-semibold text-white ${busy ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}>
          {busy ? "Working…" : "Send Invitation"}
        </button>
        <p className="self-center text-xs text-slate-500">
          Main consultant access is provisioned only through a trusted platform workflow, never from this form.
        </p>
      </form>

      <div className="space-y-3">
        <h3 className="text-lg font-bold">Users and access</h3>
        {users.map((user) => {
          const platformRoles = user.platformRoles.filter((item) => item.active);
          const mainConsultant = platformRoles.some((item) => item.role === "main_consultant");
          const hasClientMembership = user.memberships.some(
            (item) =>
              item.role === "client_administrator" || item.role === "client_user",
          );
          const draft = assignmentDrafts[user.id] ?? {
            organisationId: "",
            role: hasClientMembership
              ? user.memberships.find((item) => item.role === "client_administrator" || item.role === "client_user")?.role as UserRole
              : canManageAssistantAssignments
                ? "assistant_consultant"
                : "client_user",
          };
          const assistantAssignments = user.memberships.filter(
            (item) => item.role === "assistant_consultant" && item.active,
          );
          const hasAssistantMembership = user.memberships.some(
            (item) => item.role === "assistant_consultant",
          );
          const roleSummary = platformRoles.length
            ? platformRoles.map((item) => roleLabels[item.role] || item.role).join(", ")
            : [...new Set(user.memberships.map((item) => roleLabels[item.role] || item.role))]
              .join(", ") || "No active role";
          const existingAssignment = user.memberships.some(
            (item) =>
              item.organisationId === draft.organisationId &&
              item.role === draft.role,
          );
          return (
            <article key={user.id} className="space-y-4 rounded-xl border border-slate-200 p-5">
              <div className="flex flex-col justify-between gap-3 sm:flex-row">
                <div>
                  <h4 className="font-bold text-slate-950">{user.name}</h4>
                  <p className="text-sm text-slate-600">{user.email || "No email on profile"}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {roleSummary}
                    {assistantAssignments.length > 0 && ` · ${assistantAssignments.length} ${assistantAssignments.length === 1 ? "client" : "clients"}`}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy || user.id === actorId || mainConsultant}
                    onClick={() => void changeAccess(user.id, { type: "profile", active: !user.active }, user.active ? "Account suspended." : "Account reactivated.")}
                    className={`min-h-10 rounded-lg border px-3 text-sm font-semibold ${busy || user.id === actorId || mainConsultant ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
                  >
                    {user.active ? "Suspend account" : "Reactivate account"}
                  </button>
                  <button type="button" disabled={busy || !user.email} onClick={() => void requestPasswordReset(user)} className={`min-h-10 rounded-lg border px-3 text-sm font-semibold ${busy || !user.email ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}>
                    Send password reset
                  </button>
                </div>
              </div>

              {user.platformRoles.filter((item) => item.role === "administrator").map((item) => (
                <div key={item.role} className="flex items-center justify-between gap-3 border-t border-slate-100 pt-3 text-sm">
                  <span>Administrator platform access · {item.active ? "Active" : "Inactive"}</span>
                  {canAssignAdministrator && (
                    <button type="button" disabled={busy} onClick={() => void changeAccess(user.id, { type: "platform_role", role: "administrator", active: !item.active }, "Administrator access updated.")} className={`font-semibold text-teal-800 ${busy ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}>
                      {item.active ? "Revoke" : "Restore"}
                    </button>
                  )}
                </div>
              ))}

              {user.memberships.map((membership) => (
                <div key={`${membership.organisationId}:${membership.role}`} className="flex flex-col justify-between gap-2 border-t border-slate-100 pt-3 text-sm sm:flex-row">
                  <span>
                    {membership.organisationName} · {roleLabels[membership.role] || membership.role} · {membership.active ? "Active" : "Inactive"}
                  </span>
                  <button
                    type="button"
                    disabled={busy || mainConsultant || (membership.role === "assistant_consultant" && !canManageAssistantAssignments)}
                    onClick={() => void changeAccess(user.id, { type: "membership", organisationId: membership.organisationId, role: membership.role, active: !membership.active }, "Organisation membership updated.")}
                    className={`font-semibold text-teal-800 ${busy || mainConsultant || (membership.role === "assistant_consultant" && !canManageAssistantAssignments) ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
                  >
                    {membership.active ? "Revoke assignment" : "Restore assignment"}
                  </button>
                </div>
              ))}

              {!mainConsultant &&
                !hasClientMembership &&
                (canManageAssistantAssignments || !hasAssistantMembership) && (
                <div className="grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-[1fr_1fr_auto]">
                  <label className="text-sm font-medium text-slate-700">
                    Add organisation
                    <select
                      value={draft.organisationId}
                      onChange={(event) => setAssignmentDrafts((current) => ({
                        ...current,
                        [user.id]: { ...draft, organisationId: event.target.value },
                      }))}
                      className={`${inputClass} mt-2`}
                    >
                      <option value="">Select an organisation</option>
                      {organisations.filter((organisation) => organisation.status === "active").map((organisation) => (
                        <option key={organisation.id} value={organisation.id}>{organisation.name}</option>
                      ))}
                    </select>
                  </label>
                  <label className="text-sm font-medium text-slate-700">
                    Scoped role
                    <select
                      value={draft.role}
                      onChange={(event) => setAssignmentDrafts((current) => ({
                        ...current,
                        [user.id]: { ...draft, role: event.target.value as UserRole },
                      }))}
                      className={`${inputClass} mt-2`}
                    >
                      {canManageAssistantAssignments && <option value="assistant_consultant">Assistant Consultant</option>}
                      {!hasAssistantMembership && <option value="client_administrator">Client Administrator</option>}
                      {!hasAssistantMembership && <option value="client_user">Client User</option>}
                    </select>
                  </label>
                  <button
                    type="button"
                    disabled={busy || !draft.organisationId || existingAssignment || (draft.role === "assistant_consultant" && !canManageAssistantAssignments)}
                    onClick={() => void changeAccess(user.id, {
                      type: "membership",
                      organisationId: draft.organisationId,
                      role: draft.role,
                      active: true,
                    }, "Organisation access assigned.")}
                    className={`min-h-11 self-end rounded-xl border border-teal-700 px-4 font-semibold text-teal-800 ${busy || !draft.organisationId || existingAssignment || (draft.role === "assistant_consultant" && !canManageAssistantAssignments) ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
                  >
                    Assign access
                  </button>
                </div>
              )}
            </article>
          );
        })}
        {usersError && <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">{usersError}</p>}
        {users.length === 0 && !usersError && <p className="rounded-xl border border-dashed border-slate-300 p-6 text-sm text-slate-600">No users are available to manage.</p>}
      </div>
    </div>
  );
}
