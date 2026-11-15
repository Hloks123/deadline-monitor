"use client";

import { FormEvent, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type AccountProfile = {
  name: string;
  email: string | null;
  active: boolean;
  roles: string[];
};

const fieldClass =
  "mt-2 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-slate-900";

const roleLabels: Record<string, string> = {
  main_consultant: "Main consultant",
  administrator: "Administrator",
  assistant_consultant: "Assistant Consultant",
  client_administrator: "Client Administrator",
  client_user: "Client User",
};

export default function AccountSecurityPanel() {
  const [profile, setProfile] = useState<AccountProfile>();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordNotice, setPasswordNotice] = useState("");

  useEffect(() => {
    let active = true;
    void fetch("/api/account", { cache: "no-store" })
      .then(async (response) => {
        const result = (await response.json()) as {
          error?: string;
          profile?: AccountProfile;
        };
        if (!response.ok || !result.profile) {
          throw new Error(result.error || "Your account could not be loaded.");
        }
        if (active) setProfile(result.profile);
      })
      .catch((loadError: unknown) => {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Your account could not be loaded.",
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile || busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: profile.name }),
      });
      const result = (await response.json()) as {
        error?: string;
        profile?: AccountProfile;
      };
      if (!response.ok || !result.profile) {
        setError(result.error || "Your profile could not be updated.");
        return;
      }
      setProfile((current) => current ? { ...current, ...result.profile } : undefined);
      setNotice("Your profile was updated.");
    } catch {
      setError("Your profile could not be updated. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const currentPassword = String(data.get("currentPassword") || "");
    const newPassword = String(data.get("newPassword") || "");
    const confirmation = String(data.get("confirmPassword") || "");
    if (newPassword.length < 8) {
      setPasswordError("Choose a password with at least 8 characters.");
      setPasswordNotice("");
      return;
    }
    if (newPassword !== confirmation) {
      setPasswordError("The new passwords do not match.");
      setPasswordNotice("");
      return;
    }
    if (!profile?.email) {
      setPasswordError("Your account email could not be verified.");
      setPasswordNotice("");
      return;
    }

    setBusy(true);
    setPasswordError("");
    setPasswordNotice("");
    try {
      const supabase = createClient();
      const { error: reauthenticationError } =
        await supabase.auth.signInWithPassword({
          email: profile.email,
          password: currentPassword,
        });
      if (reauthenticationError) {
        setPasswordError("Your current password could not be verified.");
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (updateError) {
        setPasswordError("Your password could not be changed. Try again.");
        return;
      }
      form.reset();
      setPasswordNotice("Your password was changed.");
    } catch {
      setPasswordError("Your password could not be changed. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5 p-5 sm:p-6">
      {loading ? (
        <p role="status" className="text-sm text-slate-600">Loading your account…</p>
      ) : (
        <>
          {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">{error}</p>}
          {notice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">{notice}</p>}
          <form onSubmit={saveProfile} className="grid gap-4 rounded-xl border border-slate-200 p-5 sm:grid-cols-2">
            <h3 className="text-lg font-bold sm:col-span-2">Account profile</h3>
            <label className="text-sm font-semibold text-slate-700">
              Display name
              <input
                required
                maxLength={120}
                value={profile?.name || ""}
                onChange={(event) => setProfile((current) => current ? { ...current, name: event.target.value } : current)}
                className={fieldClass}
              />
            </label>
            <div className="text-sm font-semibold text-slate-700">
              Email address
              <p className="mt-2 min-h-11 break-all rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 font-normal text-slate-700">
                {profile?.email || "Not available"}
              </p>
            </div>
            <div className="text-sm font-semibold text-slate-700">
              Access
              <p className="mt-2 min-h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 font-normal text-slate-700">
                {profile?.active ? "Active" : "Inactive"}
                {profile?.roles.length
                  ? ` · ${profile.roles.map((role) => roleLabels[role] || role).join(", ")}`
                  : ""}
              </p>
            </div>
            <button type="submit" disabled={busy} className={`min-h-11 self-end rounded-xl bg-teal-600 px-5 font-semibold text-white ${busy ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}>
              {busy ? "Saving…" : "Save profile"}
            </button>
          </form>

          <form onSubmit={changePassword} className="grid gap-4 rounded-xl border border-slate-200 p-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <h3 className="text-lg font-bold">Change password</h3>
              <p className="mt-1 text-sm text-slate-600">Your password is securely handled and is never saved in Deadline-Monitor.</p>
            </div>
            {passwordError && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900 sm:col-span-2">{passwordError}</p>}
            {passwordNotice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 sm:col-span-2">{passwordNotice}</p>}
            <label className="text-sm font-semibold text-slate-700 sm:col-span-2">
              Current password
              <input name="currentPassword" type="password" autoComplete="current-password" required className={fieldClass} />
            </label>
            <label className="text-sm font-semibold text-slate-700">
              New password
              <input name="newPassword" type="password" autoComplete="new-password" minLength={8} required className={fieldClass} />
            </label>
            <label className="text-sm font-semibold text-slate-700">
              Confirm new password
              <input name="confirmPassword" type="password" autoComplete="new-password" minLength={8} required className={fieldClass} />
            </label>
            <button type="submit" disabled={busy} className={`min-h-11 rounded-xl border border-teal-700 px-5 font-semibold text-teal-800 ${busy ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}>
              {busy ? "Updating…" : "Change password"}
            </button>
          </form>
        </>
      )}
    </div>
  );
}
