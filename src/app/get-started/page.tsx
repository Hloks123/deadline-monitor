"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

type CoverageGroup = {
  title: string;
  items: string[];
};

type Plan = {
  name: string;
  recordLimit: string;
  monthly: string;
  setup: string;
  description: string;
  coverage: CoverageGroup[];
};

const plans: Record<string, Plan> = {
  "1-25": {
    name: "Starter",
    recordLimit: "Up to 25 active monitored records",
    monthly: "R399 / month",
    setup: "R1,500 once-off setup",
    description:
      "For small businesses beginning to organise and monitor important recurring records.",
    coverage: [
      {
        title: "Account and access",
        items: [
          "One authorised user",
          "Secure account access",
          "Client-specific monitoring workspace",
        ],
      },
      {
        title: "Record organisation",
        items: [
          "Up to 25 active monitored records",
          "Record folders",
          "Nested subfolders",
        ],
      },
      {
        title: "Monitoring",
        items: [
          "Issue-date and expiry-date monitoring",
          "Record status and risk tracking",
          "Responsible-contact tracking",
          "Follow-up-date tracking",
        ],
      },
      {
        title: "Service and history",
        items: [
          "Monitoring dashboard",
          "Monthly reminder review",
          "Renewal and date-change history",
        ],
      },
    ],
  },

  "26-75": {
    name: "Standard",
    recordLimit: "Up to 75 active monitored records",
    monthly: "R799 / month",
    setup: "R2,500 once-off setup",
    description:
      "For growing businesses monitoring more records across multiple authorised users.",
    coverage: [
      {
        title: "Account and access",
        items: [
          "Up to three authorised users",
          "Secure account access",
          "Client-specific monitoring workspace",
        ],
      },
      {
        title: "Record organisation",
        items: [
          "Up to 75 active monitored records",
          "Record folders",
          "Nested subfolders",
        ],
      },
      {
        title: "Monitoring",
        items: [
          "Everything included in Starter",
          "Outstanding-action tracking",
          "Client confirmation of replacement dates",
        ],
      },
      {
        title: "Communication and reporting",
        items: [
          "Reviewed reminder emails",
          "Monthly monitoring report",
          "Notification history",
          "Renewal and monitored-record history",
        ],
      },
    ],
  },

  "76-150": {
    name: "Managed",
    recordLimit: "Up to 150 active monitored records",
    monthly: "R1,499 / month",
    setup: "R4,500 once-off setup",
    description:
      "For businesses requiring active monitoring, follow-up, reporting and higher-touch support.",
    coverage: [
      {
        title: "Account and access",
        items: [
          "Authorised users confirmed during onboarding",
          "Secure account access",
          "Client-specific monitoring workspace",
        ],
      },
      {
        title: "Record organisation",
        items: [
          "Up to 150 active monitored records",
          "Record folders",
          "Nested subfolders",
        ],
      },
      {
        title: "Active monitoring",
        items: [
          "Everything included in Standard",
          "Active follow-up on outstanding actions",
          "High-risk overdue-item escalation",
          "Client non-response follow-up",
        ],
      },
      {
        title: "Communication and reporting",
        items: [
          "Reviewed client reminder communications",
          "Monthly monitoring report",
          "Quarterly monitoring review",
          "Notification and communication history",
          "Higher-touch monitoring support",
        ],
      },
    ],
  },

  "150+": {
    name: "Custom",
    recordLimit: "More than 150 active monitored records",
    monthly: "From R2,500 / month",
    setup: "Setup quoted separately",
    description:
      "For higher record volumes, multiple branches or specialised monitoring requirements.",
    coverage: [
      {
        title: "Account and structure",
        items: [
          "User allocation based on requirements",
          "Multiple branches or operating entities",
          "Custom access requirements",
        ],
      },
      {
        title: "Record organisation",
        items: [
          "More than 150 active monitored records",
          "Custom record categories",
          "Custom folder structures",
        ],
      },
      {
        title: "Monitoring service",
        items: [
          "Active monitoring and follow-up",
          "Custom escalation arrangements",
          "Quarterly service reviews",
        ],
      },
      {
        title: "Configuration and reporting",
        items: [
          "Custom reporting requirements",
          "Bulk onboarding options",
          "Specialised configuration where agreed",
          "Integrations considered and quoted separately",
        ],
      },
    ],
  },
};

const industries = [
  { value: "construction", label: "Construction" },
  { value: "transport", label: "Transport & Fleet" },
  { value: "property", label: "Property & Real Estate" },
  {
    value: "professional-services",
    label: "Professional Services",
  },
  { value: "manufacturing", label: "Manufacturing" },
  { value: "retail", label: "Retail" },
  {
    value: "wholesale",
    label: "Wholesale & Distribution",
  },
  {
    value: "hospitality",
    label: "Hospitality & Tourism",
  },
  {
    value: "agriculture",
    label: "Agriculture & Farming",
  },
  {
    value: "mining",
    label: "Mining & Resources",
  },
  { value: "engineering", label: "Engineering" },
  {
    value: "security",
    label: "Security Services",
  },
  {
    value: "cleaning",
    label: "Cleaning & Facilities Management",
  },
  {
    value: "healthcare",
    label: "Healthcare & Medical Services",
  },
  {
    value: "education",
    label: "Education & Training",
  },
  {
    value: "financial-services",
    label: "Financial & Accounting Services",
  },
  {
    value: "information-technology",
    label: "Information Technology",
  },
  {
    value: "telecommunications",
    label: "Telecommunications",
  },
  { value: "automotive", label: "Automotive" },
  {
    value: "logistics",
    label: "Logistics & Warehousing",
  },
  { value: "other", label: "Other" },
];

export default function GetStartedPage() {
  const [recordCount, setRecordCount] = useState("");

  const recommendedPlan = plans[recordCount] ?? null;
  const needsAssistance = recordCount === "not-sure";

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      {/* STICKY HEADER */}
      <header className="sticky top-0 z-50 border-b border-slate-700 bg-slate-900 text-white shadow-sm">
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

      {/* COMPACT INTRODUCTION */}
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-10 md:py-12">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-teal-600">
            Get Started
          </p>

          <h1 className="mt-4 max-w-4xl text-4xl font-bold leading-tight text-slate-900 md:text-5xl">
            Let&apos;s find the right monitoring plan for your business.
          </h1>

          <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-600">
            Tell us about your business and the approximate number of
            records you need monitored. Doc Monitor SA will recommend the
            appropriate plan.
          </p>
        </div>
      </section>

      {/* FORM AND SIDEBAR */}
      <section className="mx-auto grid max-w-7xl gap-10 px-6 py-12 lg:grid-cols-[1fr_390px]">
        {/* FORM */}
        <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm md:p-10">
          <form className="space-y-10">
            {/* CONTACT DETAILS */}
            <fieldset>
              <legend className="text-2xl font-bold text-slate-900">
                Contact Details
              </legend>

              <p className="mt-2 text-slate-600">
                Tell us who we should contact about your enquiry.
              </p>

              <div className="mt-6 grid gap-6 md:grid-cols-2">
                <FormField
                  id="contactName"
                  label="Contact name"
                  type="text"
                  placeholder="Your full name"
                  required
                />

                <FormField
                  id="companyName"
                  label="Company name"
                  type="text"
                  placeholder="Business name"
                  required
                />

                <FormField
                  id="email"
                  label="Email address"
                  type="email"
                  placeholder="name@company.co.za"
                  required
                />

                <FormField
                  id="phone"
                  label="Phone number"
                  type="tel"
                  placeholder="+27"
                  required
                />
              </div>
            </fieldset>

            <div className="border-t border-slate-200" />

            {/* BUSINESS INFORMATION */}
            <fieldset>
              <legend className="text-2xl font-bold text-slate-900">
                Business Information
              </legend>

              <p className="mt-2 text-slate-600">
                This helps us understand the approximate scale of your
                monitoring requirements.
              </p>

              <div className="mt-6 grid gap-6 md:grid-cols-2">
                {/* INDUSTRY */}
                <div>
                  <label
                    htmlFor="industry"
                    className="block text-sm font-semibold text-slate-700"
                  >
                    Industry / Business Sector
                    <span className="text-red-600"> *</span>
                  </label>

                  <select
                    id="industry"
                    name="industry"
                    required
                    defaultValue=""
                    className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                  >
                    <option value="" disabled>
                      Select your industry
                    </option>

                    {industries.map((industry) => (
                      <option
                        key={industry.value}
                        value={industry.value}
                      >
                        {industry.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* RECORD COUNT */}
                <div>
                  <label
                    htmlFor="recordCount"
                    className="block text-sm font-semibold text-slate-700"
                  >
                    How many active records need monitoring?
                    <span className="text-red-600"> *</span>
                  </label>

                  <select
                    id="recordCount"
                    name="recordCount"
                    required
                    value={recordCount}
                    onChange={(event) =>
                      setRecordCount(event.target.value)
                    }
                    className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                  >
                    <option value="" disabled>
                      Select a range
                    </option>

                    <option value="1-25">
                      1–25 records
                    </option>

                    <option value="26-75">
                      26–75 records
                    </option>

                    <option value="76-150">
                      76–150 records
                    </option>

                    <option value="150+">
                      More than 150 records
                    </option>

                    <option value="not-sure">
                      Not sure
                    </option>
                  </select>

                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    Each separately monitored item counts as one record.
                    Folders, reminders, previous renewals and archived records
                    do not count.
                  </p>
                </div>

                {/* CONTACT METHOD */}
                <div>
                  <label
                    htmlFor="contactMethod"
                    className="block text-sm font-semibold text-slate-700"
                  >
                    Preferred contact method
                  </label>

                  <select
                    id="contactMethod"
                    name="contactMethod"
                    defaultValue="email"
                    className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                  >
                    <option value="email">Email</option>
                    <option value="phone">Phone</option>
                  </select>
                </div>
              </div>
            </fieldset>

            {/* PLAN RECOMMENDATION */}
            <section>
              <h2 className="text-2xl font-bold text-slate-900">
                Your Plan Recommendation
              </h2>

              {!recordCount && (
                <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6">
                  <p className="font-semibold text-slate-700">
                    Select your approximate number of active records.
                  </p>

                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    Your recommended plan and complete service coverage
                    will appear automatically.
                  </p>
                </div>
              )}

              {needsAssistance && (
                <RecordCountAssistance />
              )}

              {recommendedPlan && (
                <RecommendedPlan plan={recommendedPlan} />
              )}
            </section>

            {/* PRIVACY MESSAGE */}
            <div
              id="privacy-notice"
              className="rounded-2xl border border-teal-200 bg-teal-50 p-5"
            >
              <p className="font-bold text-teal-900">
                Your privacy matters
              </p>

              <p className="mt-2 text-sm leading-6 text-teal-800">
                Please do not include confidential documents or sensitive
                information. We only need your basic contact and business
                details to respond to your enquiry.
              </p>

              <p className="mt-3 text-xs leading-5 text-teal-800">
                Learn more in our{" "}
                <Link
                  href="/privacy"
                  className="font-semibold underline underline-offset-2"
                >
                  Privacy Notice
                </Link>
                .
              </p>
            </div>

            {/* SUBMIT */}
            <div className="border-t border-slate-200 pt-8">
              <button
                type="button"
                className="w-full rounded-xl bg-teal-600 px-8 py-4 font-semibold text-white shadow-sm transition hover:bg-teal-700 sm:w-auto"
              >
                Submit Enquiry
              </button>

              <p className="mt-4 text-sm text-slate-500">
                We will use your contact details only to respond to this
                enquiry.
              </p>
            </div>
          </form>
        </div>

        {/* STICKY SIDEBAR */}
        <aside className="space-y-6 lg:sticky lg:top-28 lg:self-start">
          {/* WHAT HAPPENS NEXT */}
          <div className="rounded-3xl bg-slate-900 p-7 text-white">
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-teal-400">
              What happens next?
            </p>

            <div className="mt-7 space-y-7">
              <NextStep
                number="01"
                title="We review your enquiry"
                text="We review your business information and estimated record volume."
              />

              <NextStep
                number="02"
                title="We confirm the record count"
                text="We identify which individual records require their own monitoring lifecycle."
              />

              <NextStep
                number="03"
                title="We confirm the service"
                text="The package, responsibilities, fees and onboarding approach are confirmed."
              />
            </div>
          </div>

          {/* DOCUMENT PRIVACY */}
          <div className="rounded-3xl border border-teal-200 bg-teal-50 p-7">
            <p className="font-bold text-teal-950">
              Your documents stay with you.
            </p>

            <p className="mt-3 text-sm leading-6 text-teal-800">
              Doc Monitor SA monitors approved record information and
              important dates. Your actual confidential company documents
              remain in your own environment.
            </p>
          </div>

          {/* COUNTING EXPLANATION */}
          <div className="rounded-3xl border border-slate-200 bg-white p-7">
            <p className="font-bold text-slate-900">
              How your plan is determined
            </p>

            <p className="mt-3 text-sm leading-6 text-slate-600">
              Your recommended plan is based on the number of active
              individual records that require monitoring.
            </p>

            <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
              <li className="flex gap-3">
                <span className="font-bold text-teal-600">
                  ✓
                </span>
                Each separately monitored item counts as one record.
              </li>

              <li className="flex gap-3">
                <span className="font-bold text-teal-600">
                  ✓
                </span>
                Folders and subfolders do not count.
              </li>

              <li className="flex gap-3">
                <span className="font-bold text-teal-600">
                  ✓
                </span>
                Renewing an existing item does not create a new record.
              </li>

              <li className="flex gap-3">
                <span className="font-bold text-teal-600">
                  ✓
                </span>
                Archived records do not count toward the active total.
              </li>
            </ul>
          </div>

          {/* OPTIONAL SUPPORT */}
          <div className="rounded-3xl border border-amber-200 bg-amber-50 p-7">
            <p className="font-bold text-amber-950">
              Optional support
            </p>

            <p className="mt-3 text-sm leading-6 text-amber-900">
              Record inventories, data clean-up, training and custom
              reporting can be added where required.
            </p>
          </div>

          {/* LOGIN */}
          <div className="rounded-3xl border border-slate-200 bg-white p-7">
            <p className="font-bold text-slate-900">
              Already a client?
            </p>

            <p className="mt-3 text-sm leading-6 text-slate-600">
              Access your monitored records and account information through
              the secure Doc Monitor SA portal.
            </p>

            <Link
              href="/login"
              className="mt-5 inline-block font-semibold text-teal-700 transition hover:text-teal-800"
            >
              Go to Login →
            </Link>
          </div>
        </aside>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-slate-800 bg-slate-950 text-slate-300">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-6 py-8 sm:flex-row">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-white p-1.5">
              <Image
                src="/doc-monitor-logo.png"
                alt="Doc Monitor SA logo"
                width={42}
                height={42}
                className="h-9 w-9 object-contain"
              />
            </div>

            <div>
              <p className="font-bold text-white">
                Doc Monitor SA
              </p>

              <p className="text-xs text-teal-400">
                Your documents. Monitored.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap justify-center gap-5 text-sm">
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

            <p className="text-slate-500">
              © 2026 Doc Monitor SA. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}

function RecommendedPlan({ plan }: { plan: Plan }) {
  return (
    <div className="mt-5 overflow-hidden rounded-3xl border border-teal-200 bg-teal-50">
      {/* PLAN SUMMARY */}
      <div className="border-b border-teal-200 p-7">
        <p className="text-sm font-bold uppercase tracking-[0.15em] text-teal-700">
          Recommended for your business
        </p>

        <div className="mt-3 flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-3xl font-bold text-teal-950">
              {plan.name}
            </h3>

            <p className="mt-2 font-semibold text-teal-800">
              {plan.recordLimit}
            </p>

            <p className="mt-3 max-w-xl leading-7 text-teal-900">
              {plan.description}
            </p>
          </div>

          <div className="min-w-52 rounded-2xl bg-white p-5 shadow-sm">
            <p className="whitespace-nowrap text-2xl font-bold text-slate-900">
              {plan.monthly}
            </p>

            <p className="mt-2 text-sm font-medium leading-6 text-teal-700">
              {plan.setup}
            </p>
          </div>
        </div>
      </div>

      {/* GROUPED COVERAGE */}
      <div className="bg-white p-7">
        <h4 className="text-xl font-bold text-slate-900">
          What this plan covers
        </h4>

        <div className="mt-6 grid gap-5 md:grid-cols-2">
          {plan.coverage.map((group) => (
            <CoverageGroupCard
              key={group.title}
              group={group}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function CoverageGroupCard({
  group,
}: {
  group: CoverageGroup;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
      <h5 className="font-bold text-slate-900">
        {group.title}
      </h5>

      <ul className="mt-4 space-y-3">
        {group.items.map((item) => (
          <li
            key={item}
            className="flex items-start gap-3 text-sm leading-6 text-slate-700"
          >
            <span className="font-bold text-teal-600">
              ✓
            </span>

            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function RecordCountAssistance() {
  return (
    <div className="mt-5 rounded-3xl border border-blue-200 bg-blue-50 p-7">
      <p className="text-sm font-bold uppercase tracking-[0.15em] text-blue-700">
        We will help you calculate it
      </p>

      <h3 className="mt-2 text-2xl font-bold text-blue-950">
        Record-count assessment required
      </h3>

      <p className="mt-3 leading-7 text-blue-900">
        Doc Monitor SA can help prepare a starting register and identify
        the individual records, assets or obligations that need their own
        monitoring lifecycle.
      </p>

      <div className="mt-5 rounded-2xl bg-white p-5">
        <p className="font-bold text-slate-900">
          How the count works
        </p>

        <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
          <li>
            ✓ Each separately monitored item counts as one record.
          </li>

          <li>
            ✓ Folders and nested subfolders do not count.
          </li>

          <li>
            ✓ Reminders and notification history do not count.
          </li>

          <li>
            ✓ Renewing an existing record does not create a new record.
          </li>

          <li>
            ✓ Archived records do not count toward the active total.
          </li>
        </ul>
      </div>
    </div>
  );
}

function FormField({
  id,
  label,
  type,
  placeholder,
  required = false,
}: {
  id: string;
  label: string;
  type: string;
  placeholder: string;
  required?: boolean;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="block text-sm font-semibold text-slate-700"
      >
        {label}

        {required && (
          <span className="text-red-600"> *</span>
        )}
      </label>

      <input
        id={id}
        name={id}
        type={type}
        required={required}
        placeholder={placeholder}
        className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
      />
    </div>
  );
}

function NextStep({
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