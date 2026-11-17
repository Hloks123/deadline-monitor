"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type WorkspaceResponse = {
  status?: string;
  destination?: string;
};

export default function LoginForm({ initialError = "" }: { initialError?: string }) {
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(initialError);
  const [pending, setPending] = useState(false);
  const router = useRouter();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    setPending(true);
    setError("");
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const supabase = createClient();

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError("Invalid email or password.");
        return;
      }

      const response = await fetch("/api/auth/workspace", {
        cache: "no-store",
      });
      const result: WorkspaceResponse = await response.json();

      if (!response.ok || !result.destination) {
        const { error: signOutError } = await supabase.auth.signOut();
        const accessMessages: Record<string, string> = {
          profile_inactive: "Your account is inactive.",
          profile_missing:
            "Your account does not currently have organisation access. Contact consultant1@compimento.co.za.",
          no_membership:
            "Your account does not currently have access to an organisation. Contact consultant1@compimento.co.za.",
          unavailable:
            "We could not verify your account access. Please try again.",
        };
        setError(
          signOutError
            ? "We could not complete account verification. Please try again."
            : accessMessages[result.status ?? ""] ??
                "Your account does not currently have access to an organisation. Contact consultant1@compimento.co.za.",
        );
        return;
      }

      router.replace(result.destination);
      router.refresh();
    } catch {
      setError("We could not complete sign in. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      {/* HEADER */}
      <header className="border-b border-slate-700 bg-slate-900 text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <Link href="/login" className="flex min-w-0 items-center gap-2 sm:gap-4">
            <div className="rounded-xl bg-white p-1.5 sm:p-2">
              <Image
                src="/deadline-monitor-logo.png"
                alt="Deadline Monitor logo"
                width={48}
                height={48}
                priority
                className="h-9 w-9 object-contain sm:h-12 sm:w-12"
              />
            </div>

            <div>
              <p className="truncate text-base font-bold sm:text-xl">
                Deadline Monitor
              </p>

              <p className="hidden text-sm font-medium text-teal-400 sm:block">
                Know what&apos;s due. Before it&apos;s overdue.
              </p>
            </div>
          </Link>

        </div>
      </header>

      {/* MAIN LOGIN AREA */}
      <section className="mx-auto grid min-h-[calc(100vh-157px)] max-w-7xl lg:grid-cols-2">
        {/* LEFT PANEL */}
        <div className="flex items-center px-6 py-12 lg:px-12">
          <div className="mx-auto w-full max-w-md">
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-teal-700">
              Secure Account Access
            </p>

            <h1 className="mt-4 text-4xl font-bold leading-tight text-slate-900">
              Welcome back.
            </h1>

            <p className="mt-4 leading-7 text-slate-600">
              Sign in to access your Deadline Monitor account and monitored
              business records.
            </p>

            {/* LOGIN FORM */}
            <form
              onSubmit={handleSubmit}
              className="mt-10 space-y-6"
            >
              {/* EMAIL */}
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-semibold text-slate-700"
                >
                  Email address
                  <span className="text-red-600"> *</span>
                </label>

                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="name@company.co.za"
                  className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3.5 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                />
              </div>

              {/* PASSWORD */}
              <div>
                <div className="flex items-center justify-between gap-4">
                  <label
                    htmlFor="password"
                    className="block text-sm font-semibold text-slate-700"
                  >
                    Password
                    <span className="text-red-600"> *</span>
                  </label>

                  <Link
                    href="/forgot-password"
                    className="text-sm font-semibold text-teal-700 transition hover:text-teal-800"
                  >
                    Forgot password?
                  </Link>
                </div>

                <div className="relative mt-2">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    placeholder="Enter your password"
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3.5 pr-24 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setShowPassword((current) => !current)
                    }
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-teal-700 hover:text-teal-800"
                    aria-label={
                      showPassword
                        ? "Hide password"
                        : "Show password"
                    }
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              {/* REMEMBER ME */}
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  name="rememberMe"
                  className="h-4 w-4 rounded border-slate-300 accent-teal-600"
                />

                <span className="text-sm text-slate-600">
                  Remember my email address on this device
                </span>
              </label>

              {/* SIGN IN */}
              <button
                type="submit"
                disabled={pending}
                className="w-full cursor-pointer rounded-xl bg-teal-700 px-6 py-4 font-semibold text-white shadow-sm transition hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {pending ? "Signing In…" : "Sign In"}
              </button>

              {error && (
                <div
                  role="alert"
                  aria-live="assertive"
                  className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-900"
                >
                  {error}
                </div>
              )}
            </form>

            {/* SUPPORT */}
            <div className="mt-8 border-t border-slate-200 pt-6">
              <p className="text-sm leading-6 text-slate-500">
                Need help accessing your account? Email{" "}
                <a
                  href="mailto:consultant1@compimento.co.za"
                  className="font-semibold text-teal-700 hover:text-teal-800"
                >
                  consultant1@compimento.co.za
                </a>
              </p>
              <p className="mt-3 text-sm text-slate-500">
                Accounts are provisioned for the controlled pilot; public
                account registration is not available.
              </p>
            </div>

            {/* SECURITY NOTE */}
            <div className="mt-6 rounded-2xl border border-teal-200 bg-teal-50 p-5">
              <p className="font-bold text-teal-950">
                Your account security matters
              </p>

              <p className="mt-2 text-sm leading-6 text-teal-800">
                Never share your Deadline Monitor password or authentication
                details with another person.
              </p>
            </div>
          </div>
        </div>

        {/* RIGHT INFORMATION PANEL */}
        <div className="hidden bg-slate-900 px-12 py-14 text-white lg:flex lg:items-center">
          <div className="mx-auto max-w-lg">
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-teal-400">
              Deadline Monitor Portal
            </p>

            <h2 className="mt-5 text-4xl font-bold leading-tight">
              Records, deadlines and recurring work, clearly monitored.
            </h2>

            <p className="mt-5 text-lg leading-8 text-slate-300">
              Review monitored records, upcoming deadlines, assigned tasks and
              recurring operational work from one workspace.
            </p>

            <div className="mt-10 space-y-5">
              <PortalBenefit
                title="Monitored records"
                text="Keep important record names, dates, status and follow-up visible."
              />

              <PortalBenefit
                title="Tasks and checklists"
                text="See who is responsible, what is due and what remains outstanding."
              />

              <PortalBenefit
                title="Recurring work"
                text="Track scheduled operational activities and their occurrences."
              />

              <PortalBenefit
                title="Clear responsibility"
                text="Bring deadlines, follow-ups and next actions into view."
              />
            </div>

            {/* DOCUMENT MESSAGE */}
            <div className="mt-10 rounded-2xl border border-slate-700 bg-slate-800 p-6">
              <p className="font-bold text-white">
                Your documents stay with you.
              </p>

              <p className="mt-3 text-sm leading-6 text-slate-300">
                Deadline Monitor monitors approved record information,
                important dates and follow-up actions. Your underlying
                confidential documents remain in your own environment.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-slate-800 bg-slate-950 text-slate-300">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-5 px-6 py-6 sm:flex-row">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-white p-1.5">
              <Image
                src="/deadline-monitor-logo.png"
                alt="Deadline Monitor logo"
                width={40}
                height={40}
                className="h-8 w-8 object-contain"
              />
            </div>

            <div>
              <p className="text-sm font-bold text-white">
                Deadline Monitor
              </p>

              <p className="text-xs text-teal-400">
                Know what&apos;s due. Before it&apos;s overdue.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-5 text-sm">
            <span className="text-slate-500">
              © 2026 Deadline Monitor
            </span>
          </div>
        </div>
      </footer>
    </main>
  );
}

function PortalBenefit({
  title,
  text,
}: {
  title: string;
  text: string;
}) {
  return (
    <div className="flex gap-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-700 font-bold text-white">
        ✓
      </div>

      <div>
        <p className="font-bold text-white">
          {title}
        </p>

        <p className="mt-1 text-sm leading-6 text-slate-300">
          {text}
        </p>
      </div>
    </div>
  );
}