"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function UpdatePasswordPage() {
  const [ready, setReady] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const router = useRouter();

  useEffect(() => {
    let active = true;
    void createClient().auth.getUser().then(({ data, error: authError }) => {
      if (!active) return;
      if (authError || !data.user) {
        setError("This password-reset link is invalid or has expired. Request a new link.");
      } else {
        setReady(true);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const formData = new FormData(event.currentTarget);
    const password = String(formData.get("password") ?? "");
    const confirmation = String(formData.get("confirmPassword") ?? "");
    if (password.length < 8) {
      setError("Choose a password with at least 8 characters.");
      return;
    }
    if (password !== confirmation) {
      setError("The passwords do not match.");
      return;
    }

    setPending(true);
    setError("");
    setNotice("");

    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError("We could not update your password. Please try again.");
        return;
      }

      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) {
        setNotice("Your password was updated. Please sign in with your new password.");
      } else {
        router.replace("/login");
        router.refresh();
      }
    } catch {
      setError("We could not update your password. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-12 text-slate-900">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-teal-600">Account Recovery</p>
        <h1 className="mt-4 text-3xl font-bold">Reset your Deadline Monitor password</h1>
        <p className="mt-3 leading-7 text-slate-600">Set a new password for your Deadline Monitor account.</p>

        {ready ? (
          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <label className="block text-sm font-semibold text-slate-700">
              New password
              <input
                name="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
              />
            </label>
            <label className="block text-sm font-semibold text-slate-700">
              Confirm new password
              <input
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
              />
            </label>
            <button
              type="submit"
              disabled={pending}
              className="w-full cursor-pointer rounded-xl bg-teal-600 px-6 py-4 font-semibold text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending ? "Updating…" : "Update Password"}
            </button>
          </form>
        ) : !error ? (
          <p role="status" className="mt-8 text-sm text-slate-600">Verifying your reset link…</p>
        ) : null}

        {error && <p role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">{error}</p>}
        {notice && <p role="status" className="mt-6 rounded-xl border border-teal-200 bg-teal-50 p-4 text-sm text-teal-900">{notice}</p>}
        <Link href="/forgot-password" className="mt-6 inline-block font-semibold text-teal-700 hover:text-teal-800">
          Request another reset link
        </Link>
      </section>
    </main>
  );
}
