"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useState } from "react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!email.trim()) {
      return;
    }

    setSubmitted(true);
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      {/* HEADER */}
      <header className="border-b border-slate-700 bg-slate-900 text-white shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link
            href="/"
            className="flex items-center gap-4"
          >
            <div className="rounded-xl bg-white p-2">
              <Image
                src="/doc-monitor-logo.png"
                alt="Doc Monitor SA logo"
                width={64}
                height={64}
                priority
                className="h-12 w-12 object-contain"
              />
            </div>

            <div>
              <p className="text-xl font-bold">
                Doc Monitor SA
              </p>

              <p className="text-sm font-medium text-teal-400">
                Your documents. Monitored.
              </p>
            </div>
          </Link>

          <Link
            href="/login"
            className="rounded-xl border border-slate-600 px-5 py-3 text-sm font-semibold text-white transition hover:border-teal-400 hover:text-teal-400"
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
                <p className="text-sm font-bold uppercase tracking-[0.2em] text-teal-600">
                  Account Recovery
                </p>

                <h1 className="mt-4 text-4xl font-bold leading-tight text-slate-900">
                  Forgot your password?
                </h1>

                <p className="mt-4 leading-7 text-slate-600">
                  Enter the email address associated with your Doc Monitor SA
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
                      className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3.5 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full rounded-xl bg-teal-600 px-6 py-4 font-semibold text-white shadow-sm transition hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2"
                  >
                    Send Reset Instructions
                  </button>
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
                Doc Monitor SA will never ask you to send your password by
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
              Password recovery forms part of the secure account-access
              controls planned for the Doc Monitor SA platform.
            </p>

            <div className="mt-10 space-y-5">
              <RecoveryStep
                number="01"
                title="Enter your account email"
                text="Use the email address associated with your Doc Monitor SA account."
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
                someone is attempting to access your account, contact Doc
                Monitor SA through the official support channel.
              </p>
            </div>

            <div className="mt-6 rounded-2xl border border-teal-800 bg-teal-950/50 p-6">
              <p className="font-bold text-teal-100">
                Privileged accounts
              </p>

              <p className="mt-3 text-sm leading-6 text-teal-100">
                Administrator and consultant accounts will use additional
                security controls, including multi-factor authentication,
                when production authentication is enabled.
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
                src="/doc-monitor-logo.png"
                alt="Doc Monitor SA logo"
                width={40}
                height={40}
                className="h-8 w-8 object-contain"
              />
            </div>

            <div>
              <p className="text-sm font-bold text-white">
                Doc Monitor SA
              </p>

              <p className="text-xs text-teal-400">
                Your documents. Monitored.
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
              © 2026 Doc Monitor SA
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

      <p className="mt-7 text-sm font-bold uppercase tracking-[0.2em] text-teal-600">
        Request Received
      </p>

      <h1 className="mt-3 text-4xl font-bold leading-tight text-slate-900">
        Check your email.
      </h1>

      <p className="mt-5 leading-7 text-slate-600">
        If an eligible Doc Monitor SA account matches the email address you
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
            • Allow only official Doc Monitor SA reset messages to guide the
            recovery process.
          </li>
        </ul>
      </div>

      <div className="mt-7 flex flex-col gap-3 sm:flex-row">
        <Link
          href="/login"
          className="rounded-xl bg-teal-600 px-6 py-3.5 text-center font-semibold text-white transition hover:bg-teal-700"
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
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-500 text-sm font-bold text-white">
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