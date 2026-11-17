"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!email.trim() || pending) return;

    setPending(true);
    setError("");

    try {
      const callbackUrl = new URL("/auth/callback", window.location.origin);
      callbackUrl.searchParams.set("flow", "recovery");
callbackUrl.searchParams.set("next", "/update-password");

      const { error: resetError } = await createClient().auth.resetPasswordForEmail(
        email.trim(),
        { redirectTo: callbackUrl.toString() },
      );

      if (resetError) {
        setError("We could not submit your request. Please try again later.");
        return;
      }

      setSubmitted(true);
    } catch {
      setError("We could not submit your request. Please try again later.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      {/* HEADER */}
      <header className="border-b border-slate-700 bg-slate-900 text-white shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <Link
            href="/"
            className="flex min-w-0 items-center gap-2 sm:gap-4"
          >
            <div className="rounded-xl bg-white p-1.5 sm:p-2">
              <Image
                src="/deadline-monitor-logo.png"
                alt="Deadline Monitor logo"
                width={48}
                height={48}
                priority
                className="h-10 w-10 object-contain sm:h-12 sm:w-12"
              />
            </div>

            <div className="min-w-0">
              <p className="truncate text-base font-bold sm:text-xl">
                Deadline Monitor
              </p>

              <p className="hidden text-sm font-medium text-teal-400 sm:block">
                Know what&apos;s due. Before it&apos;s overdue.
              </p>
            </div>
          </Link>

          <Link
            href="/login"
            className="min-h-11 shrink-0 rounded-xl border border-slate-600 px-3 py-2 text-xs font-semibold text-white transition hover:border-teal-400 hover:text-teal-400 sm:px-5 sm:py-3 sm:text-sm"
          >
            Back to Login
          </Link>
        </div>
      </header>

      {/* MAIN AREA */}
      <section className="mx-auto grid min-h-[calc(100vh-157px)] max-w-7xl lg:grid-cols-2">
        {/* LEFT: PASSWORD RESET */}
        <div className="flex items-center px-6 py-12 lg:px-12">
          <div className="mx-auto w-full max-w-md">
            {!submitted ? (
              <>
                <p className="text-sm font-bold uppercase tracking-[0.2em] text-teal-700">
                  Account Recovery
                </p>

                <h1 className="mt-4 text-4xl font-bold leading-tight text-slate-900">
                  Reset your Deadline Monitor password
                </h1>

                <p className="mt-4 leading-7 text-slate-600">
                  Enter the email address associated with your Deadline Monitor
                  account. If an eligible account exists, password-reset
                  instructions will be sent to that address.
                </p>

                <form
                  onSubmit={handleSubmit}
                  className="mt-10 space-y-6"
                >
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
                      value={email}
                      onChange={(event) =>
                        setEmail(event.target.value)
                      }
                      placeholder="name@company.co.za"
                      aria-describedby="password-reset-help"
                      className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3.5 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                    />
                    <p id="password-reset-help" className="mt-2 text-sm text-slate-600">
                      If an eligible account exists, we will show a confirmation
                      without revealing whether the address is registered.
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={pending}
                    className="w-full cursor-pointer rounded-xl bg-teal-700 px-6 py-4 font-semibold text-white shadow-sm transition hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {pending ? "Sending…" : "Send Reset Instructions"}
                  </button>
                  {error && (
                    <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
                      {error}
                    </p>
                  )}
                </form>

                <div className="mt-8 border-t border-slate-200 pt-6">
                  <p className="text-center text-sm text-slate-600">
                    Remember your password?{" "}
                    <Link
                      href="/login"
                      className="font-semibold text-teal-700 transition hover:text-teal-800"
                    >
                      Return to Login
                    </Link>
                  </p>
                </div>
              </>
            ) : (
              <ResetRequested
                onTryAgain={() => {
                  setSubmitted(false);
                  setEmail("");
                }}
              />
            )}

            {/* SECURITY MESSAGE */}
            <div className="mt-8 rounded-2xl border border-teal-200 bg-teal-50 p-5">
              <p className="font-bold text-teal-950">
                Protect your account
              </p>

              <p className="mt-2 text-sm leading-6 text-teal-800">
                Deadline Monitor will never ask you to send your password by
                email, telephone or through the enquiry form.
              </p>
            </div>
          </div>
        </div>

        {/* RIGHT: INFORMATION */}
        <div className="hidden bg-slate-900 px-12 py-14 text-white lg:flex lg:items-center">
          <div className="mx-auto max-w-lg">
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-teal-400">
              Secure Account Recovery
            </p>

            <h2 className="mt-5 text-4xl font-bold leading-tight">
              Regain access without compromising account security.
            </h2>

            <p className="mt-5 text-lg leading-8 text-slate-300">
              Password recovery is available for eligible accounts.
            </p>

            <div className="mt-10 space-y-5">
              <RecoveryStep
                number="01"
                title="Enter your account email"
                text="Use the email address associated with your Deadline Monitor account."
              />

              <RecoveryStep
                number="02"
                title="Check your email"
                text="If the account is eligible, a secure password-reset link will be sent to the registered email address."
              />

              <RecoveryStep
                number="03"
                title="Choose a new password"
                text="Open the authorised reset link and choose a new account password."
              />

              <RecoveryStep
                number="04"
                title="Sign in again"
                text="Return to the secure login page using your updated credentials."
              />
            </div>

            <div className="mt-10 rounded-2xl border border-slate-700 bg-slate-800 p-6">
              <p className="font-bold text-white">
                Didn&apos;t request a password reset?
              </p>

              <p className="mt-3 text-sm leading-6 text-slate-300">
                Do not use a reset link you did not request. If you believe
                someone is attempting to access your account, contact{" "}
                <a className="font-semibold text-teal-300 underline underline-offset-2" href="mailto:consultant1@compimento.co.za">
                  consultant1@compimento.co.za
                </a>
                .
              </p>
            </div>

            <div className="mt-6 rounded-2xl border border-teal-800 bg-teal-950/50 p-6">
              <p className="font-bold text-teal-100">
                Privileged accounts
              </p>

              <p className="mt-3 text-sm leading-6 text-teal-100">
                Use only the account access controls configured for your pilot.
                No additional authentication feature is promised by this page.
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
            <Link
              href="/privacy"
              className="transition hover:text-teal-400"
            >
              Privacy
            </Link>

            <Link
              href="/terms"
              className="transition hover:text-teal-400"
            >
              Terms
            </Link>

            <Link
              href="/login"
              className="transition hover:text-teal-400"
            >
              Login
            </Link>

            <span className="text-slate-500">
              © 2026 Deadline Monitor
            </span>
          </div>
        </div>
      </footer>
    </main>
  );
}

function ResetRequested({
  onTryAgain,
}: {
  onTryAgain: () => void;
}) {
  return (
    <div>
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-teal-100 text-2xl font-bold text-teal-700">
        ✓
      </div>

      <p className="mt-7 text-sm font-bold uppercase tracking-[0.2em] text-teal-700">
        Request Received
      </p>

      <h1 className="mt-3 text-4xl font-bold leading-tight text-slate-900">
        Check your email.
      </h1>

      <p className="mt-5 leading-7 text-slate-600">
        If an eligible Deadline Monitor account matches the email address you
        entered, password-reset instructions will be sent to that address.
      </p>

      <div className="mt-7 rounded-2xl border border-blue-200 bg-blue-50 p-5">
        <p className="font-bold text-blue-950">
          Didn&apos;t receive an email?
        </p>

        <ul className="mt-3 space-y-2 text-sm leading-6 text-blue-900">
          <li>• Check your spam or junk-email folder.</li>

          <li>
            • Confirm that you entered the email associated with your account.
          </li>

          <li>
            • Allow only official Deadline Monitor reset messages to guide the
            recovery process.
          </li>
        </ul>
      </div>

      <div className="mt-7 flex flex-col gap-3 sm:flex-row">
        <Link
          href="/login"
          className="rounded-xl bg-teal-700 px-6 py-3.5 text-center font-semibold text-white transition hover:bg-teal-800"
        >
          Return to Login
        </Link>

        <button
          type="button"
          onClick={onTryAgain}
          className="rounded-xl border border-slate-300 bg-white px-6 py-3.5 font-semibold text-slate-700 transition hover:border-teal-600 hover:text-teal-700"
        >
          Try another email
        </button>
      </div>
    </div>
  );
}

function RecoveryStep({
  number,
  title,
  text,
}: {
  number: string;
  title: string;
  text: string;
}) {
  return (
    <div className="flex gap-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-700 text-sm font-bold text-white">
        {number}
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