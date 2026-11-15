"use client";

import { useCallback, useEffect, useState } from "react";
import ClientWorkspaceShell from "@/components/client/ClientWorkspaceShell";

type Member = {
  id: string;
  name: string;
  email: string;
  active: boolean;
  isSeniorManager: boolean;
  jobTitle: string;
  role: "client_administrator" | "client_user";
};

const fieldClass = "min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-slate-900";

export default function ClientTeamPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadMembers = useCallback(async () => {
    try {
      const response = await fetch("/api/client/team", { cache: "no-store" });
      const result: unknown = await response.json();
      if (!response.ok || !isRecord(result) || !Array.isArray(result.members)) {
        throw new Error(errorFrom(result, "Company users could not be loaded."));
      }
      setMembers(result.members.filter(isMember));
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Company users could not be loaded.");
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadMembers(), 0);
    return () => window.clearTimeout(timer);
  }, [loadMembers]);

  async function saveMember(member: Member) {
    setBusy(member.id);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/client/team", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: member.id,
          name: member.name,
          jobTitle: member.jobTitle,
          active: member.active,
        }),
      });
      const result: unknown = await response.json();
      if (!response.ok) throw new Error(errorFrom(result, "The user profile could not be updated."));
      setNotice(`${member.name}'s profile was updated.`);
      await loadMembers();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "The user profile could not be updated.");
    } finally {
      setBusy("");
    }
  }

  function updateMember(id: string, update: Partial<Member>) {
    setMembers((current) => current.map((member) => member.id === id ? { ...member, ...update } : member));
  }

  return (
    <ClientWorkspaceShell title="Manage users">
      <div className="space-y-5 p-4 sm:p-6 lg:p-8">
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-2xl font-bold text-slate-950">Company user profiles</h2>
          <p className="mt-2 text-sm text-slate-600">
            Update existing employees&apos; names and job titles, or suspend and restore their company access. This page cannot invite or create accounts. Email changes require the verified account process.
          </p>
        </section>
        {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">{error}</p>}
        {notice && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">{notice}</p>}
        <section aria-label="Company users" className="space-y-4">
          {members.map((member) => (
            <article key={member.id} className="grid gap-4 rounded-xl border border-slate-200 bg-white p-5 md:grid-cols-2">
              <div className="md:col-span-2 flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-bold text-slate-950">{member.isSeniorManager ? `${member.name} (Senior Manager)` : member.name}</h3>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-800">
                    {member.role === "client_administrator" ? "Client administrator" : "Client user"}
                  </span>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${member.active ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-700"}`}>{member.active ? "Active" : "Suspended"}</span>
                </div>
              </div>
              <label className="text-sm font-semibold text-slate-700">Name
                <input disabled={member.isSeniorManager || busy === member.id} maxLength={120} value={member.name} onChange={(event) => updateMember(member.id, { name: event.target.value })} className={`${fieldClass} mt-1 disabled:bg-slate-100`} />
              </label>
              <label className="text-sm font-semibold text-slate-700">Job title
                <input disabled={member.isSeniorManager || busy === member.id} maxLength={120} value={member.jobTitle} onChange={(event) => updateMember(member.id, { jobTitle: event.target.value })} className={`${fieldClass} mt-1 disabled:bg-slate-100`} />
              </label>
              <label className="text-sm font-semibold text-slate-700">Sign-in email
                <input readOnly value={member.email} className={`${fieldClass} mt-1 bg-slate-50`} />
              </label>
              <label className="flex items-center gap-3 self-end pb-2 text-sm font-semibold text-slate-700">
                <input
                  type="checkbox"
                  disabled={member.isSeniorManager || busy === member.id}
                  checked={member.active}
                  onChange={(event) => updateMember(member.id, { active: event.target.checked })}
                  className="h-4 w-4 accent-teal-700"
                />
                Company access active
              </label>
              {!member.isSeniorManager && (
                <div className="md:col-span-2">
                  <button disabled={busy === member.id} type="button" onClick={() => void saveMember(member)} className="min-h-11 rounded-lg bg-teal-700 px-5 font-semibold text-white disabled:opacity-50">
                    {busy === member.id ? "Saving..." : "Save profile"}
                  </button>
                </div>
              )}
            </article>
          ))}
          {members.length === 0 && !error && <p role="status" className="rounded-xl border border-slate-200 bg-white p-6 text-slate-600">No company users were found.</p>}
        </section>
      </div>
    </ClientWorkspaceShell>
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function errorFrom(value: unknown, fallback: string) {
  return isRecord(value) && typeof value.error === "string" ? value.error : fallback;
}

function isMember(value: unknown): value is Member {
  return isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.email === "string" &&
    typeof value.active === "boolean" &&
    typeof value.isSeniorManager === "boolean" &&
    typeof value.jobTitle === "string" &&
    (value.role === "client_administrator" || value.role === "client_user");
}
