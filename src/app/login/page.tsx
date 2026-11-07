"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useState } from "react";

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setMessage(
      "Secure account authentication will be connected to the Doc Monitor SA account system."
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      {/* HEADER */}
      <header className="border-b border-slate-700 bg-slate-900 text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-4">
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
            href="/"
            className="rounded-xl border border-slate-600 px-5 py-3 text-sm font-semibold text-white transition hover:border-teal-400 hover:text-teal-400"
          >
            Back to Home
          </Link>
        </div>
      </header>

      {/* MAIN LOGIN AREA */}
      <section className="mx-auto grid min-h-[calc(100vh-157px)] max-w-7xl lg:grid-cols-2">
        {/* LEFT PANEL */}
        <div className="flex items-center px-6 py-12 lg:px-12">
          <div className="mx-auto w-full max-w-md">
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-teal-600">
              Secure Account Access
            </p>

            <h1 className="mt-4 text-4xl font-bold leading-tight text-slate-900">
              Welcome back.
            </h1>

            <p className="mt-4 leading-7 text-slate-600">
              Sign in to access your Doc Monitor SA account and monitored
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
                className="w-full rounded-xl bg-teal-600 px-6 py-4 font-semibold text-white shadow-sm transition hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2"
              >
                Sign In
              </button>

              {/* PROTOTYPE MESSAGE */}
              {message && (
                <div
                  role="status"
                  aria-live="polite"
                  className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-900"
                >
                  {message}
                </div>
              )}
            </form>

            {/* SUPPORT */}
            <div className="mt-8 border-t border-slate-200 pt-6">
              <p className="text-sm leading-6 text-slate-500">
                Need help accessing your account?{" "}
                <Link
                  href="/get-started"
                  className="font-semibold text-teal-700 hover:text-teal-800"
                >
                  Contact Doc Monitor SA
                </Link>
              </p>
            </div>

            {/* SECURITY NOTE */}
            <div className="mt-6 rounded-2xl border border-teal-200 bg-teal-50 p-5">
              <p className="font-bold text-teal-950">
                Your account security matters
              </p>

              <p className="mt-2 text-sm leading-6 text-teal-800">
                Never share your Doc Monitor SA password or authentication
                details with another person.
              </p>
            </div>
          </div>
        </div>

        {/* RIGHT INFORMATION PANEL */}
        <div className="hidden bg-slate-900 px-12 py-14 text-white lg:flex lg:items-center">
          <div className="mx-auto max-w-lg">
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-teal-400">
              Doc Monitor SA Portal
            </p>

            <h2 className="mt-5 text-4xl font-bold leading-tight">
              Important business records, clearly monitored.
            </h2>

            <p className="mt-5 text-lg leading-8 text-slate-300">
              Access your monitoring workspace to review important dates,
              record status and outstanding actions.
            </p>

            <div className="mt-10 space-y-5">
              <PortalBenefit
                title="Organisation-level access"
                text="Authorised users access only the business information associated with their account."
              />

              <PortalBenefit
                title="Important dates in one place"
                text="View monitored records, status and upcoming renewal dates from an organised workspace."
              />

              <PortalBenefit
                title="Folders and subfolders"
                text="Browse COIDA, CIPC, SARS and other records using a clear folder structure."
              />

              <PortalBenefit
                title="Renewal confirmation"
                text="Confirm replacement dates without uploading the underlying confidential document."
              />
            </div>

            {/* DOCUMENT MESSAGE */}
            <div className="mt-10 rounded-2xl border border-slate-700 bg-slate-800 p-6">
              <p className="font-bold text-white">
                Your documents stay with you.
              </p>

              <p className="mt-3 text-sm leading-6 text-slate-300">
                Doc Monitor SA monitors approved record information,
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

            <span className="text-slate-500">
              © 2026 Doc Monitor SA
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
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-500 font-bold text-white">
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