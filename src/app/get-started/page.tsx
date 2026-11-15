"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";

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

const industries = [
  { value: "construction", label: "Construction" },
  { value: "transport", label: "Transport & Fleet" },
  { value: "property", label: "Property & Real Estate" },
  { value: "professional-services", label: "Professional Services" },
  { value: "manufacturing", label: "Manufacturing" },
  { value: "retail", label: "Retail" },
  { value: "wholesale", label: "Wholesale & Distribution" },
  { value: "hospitality", label: "Hospitality & Tourism" },
  { value: "agriculture", label: "Agriculture & Farming" },
  { value: "mining", label: "Mining & Resources" },
  { value: "engineering", label: "Engineering" },
  { value: "security", label: "Security Services" },
  { value: "cleaning", label: "Cleaning & Facilities Management" },
  { value: "healthcare", label: "Healthcare & Medical Services" },
  { value: "education", label: "Education & Training" },
  { value: "financial-services", label: "Financial & Accounting Services" },
  { value: "information-technology", label: "Information Technology" },
  { value: "telecommunications", label: "Telecommunications" },
  { value: "automotive", label: "Automotive" },
  { value: "logistics", label: "Logistics & Warehousing" },
  { value: "other", label: "Other" },
];

const plans: Record<string, Plan> = {
  "1-25": {
    name: "Starter",
    recordLimit: "Up to 25 active monitored records",
    monthly: "R399 / month",
    setup: "R500 once-off setup",
    description:
      "For small businesses beginning to organise and monitor important recurring records.",
    coverage: [
      {
        title: "Account and access",
        items: [
          "1 user",
          "Access scope agreed before onboarding",
          "Organisation-specific workspace",
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
    setup: "R1,000 once-off setup",
    description:
      "For growing businesses monitoring more records across multiple authorised users.",
    coverage: [
      {
        title: "Account and access",
        items: [
          "Up to 4 users",
          "Access scope agreed before onboarding",
          "Organisation-specific workspace",
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
          "Reminder review workflow",
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
    setup: "R2,000 once-off setup",
    description:
      "For businesses requiring active monitoring, follow-up, reporting and higher-touch support.",
    coverage: [
      {
        title: "Account and access",
        items: [
          "Up to 12 users",
          "Access scope agreed before onboarding",
          "Organisation-specific workspace",
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
          "Priority follow-up workflow",
          "Overdue-item review",
          "Non-response review",
        ],
      },
      {
        title: "Communication and reporting",
        items: [
          "Reviewed reminder workflow",
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

export default function GetStartedPage() {
  const [recordCount, setRecordCount] = useState("");
  const [enquiryNotice, setEnquiryNotice] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);

  const recommendedPlan = plans[recordCount] ?? null;
  const needsAssistance = recordCount === "not-sure";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmittingRef.current) return;

    const form = event.currentTarget;
    const formData = new FormData(form);
    const payload = {
      contactName: formData.get("contactName"),
      companyName: formData.get("companyName"),
      email: formData.get("email"),
      phone: formData.get("phone"),
      industry: formData.get("industry"),
      recordCount: formData.get("recordCount"),
      contactMethod: formData.get("contactMethod"),
      message: formData.get("message"),
      privacyConsent: formData.get("privacyConsent") === "on",
      website: formData.get("website"),
    };

    isSubmittingRef.current = true;
    setIsSubmitting(true);
    setEnquiryNotice("Sending enquiry...");
    try {
      const response = await fetch("/api/enquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (response.status !== 201) throw new Error("Enquiry was not accepted.");

      form.reset();
      setRecordCount("");
      setEnquiryNotice(
        "Thank you. Your enquiry has been sent successfully. We will contact you using the details provided.",
      );
    } catch {
      setEnquiryNotice(
        "We could not send your enquiry. Please email consultant1@compimento.co.za or call 073 501 9603.",
      );
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      {/* STICKY HEADER */}
      <header className="sticky top-0 z-50 border-b border-slate-700 bg-slate-900 text-white shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <Link href="/" className="flex min-w-0 items-center gap-2 sm:gap-4">
            <div className="rounded-xl bg-white p-2">
              <Image
                src="/deadline-monitor-logo.png"
                alt="Deadline Monitor logo"
                width={64}
                height={64}
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
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-teal-700">
            Business monitoring application
          </p>

          <h1 className="mt-4 max-w-4xl text-4xl font-bold leading-tight text-slate-900 md:text-5xl">
            Get Started
          </h1>

          <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-600">
            Share your business and monitoring requirements to start an
            onboarding enquiry. Initial onboarding may be limited while
            Deadline Monitor completes its controlled rollout.
          </p>
        </div>
      </section>

      {/* FORM AND SIDEBAR */}
      <section className="mx-auto grid max-w-7xl grid-cols-1 gap-10 px-4 py-8 sm:px-6 sm:py-12 lg:grid-cols-[1fr_390px]">
        {/* FORM */}
        <div className="min-w-0 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7 md:p-10">
          <form className="space-y-8" onSubmit={handleSubmit}>
            <div
              aria-hidden="true"
              className="absolute -left-[10000px] h-px w-px overflow-hidden"
            >
              <label htmlFor="website">Leave this field empty</label>
              <input
                id="website"
                name="website"
                type="text"
                tabIndex={-1}
                autoComplete="off"
              />
            </div>
            {/* CONTACT DETAILS */}
            <fieldset>
              <legend className="text-2xl font-bold text-slate-900">
                Your details
              </legend>

              <p className="mt-2 text-slate-600">
                Use business contact details where possible.
              </p>

              <div className="mt-6 grid gap-6 md:grid-cols-2">
                <FormField
                  id="contactName"
                  label="Contact name"
                  type="text"
                  placeholder="Your full name"
                  required
                  autoComplete="name"
                  maxLength={120}
                />

                <FormField
                  id="companyName"
                  label="Company"
                  type="text"
                  placeholder="Business name"
                  required
                  autoComplete="organization"
                  maxLength={160}
                />

                <FormField
                  id="email"
                  label="Business email"
                  type="email"
                  placeholder="name@company.co.za"
                  required
                  autoComplete="email"
                  maxLength={254}
                />

                <FormField
                  id="phone"
                  label="Telephone"
                  type="tel"
                  placeholder="+27"
                  required
                  autoComplete="tel"
                  maxLength={30}
                />

                <div>
                  <label
                    htmlFor="industry"
                    className="block text-sm font-semibold text-slate-700"
                  >
                    Industry <span className="text-red-600">*</span>
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
                      <option key={industry.value} value={industry.value}>
                        {industry.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </fieldset>

            <div className="border-t border-slate-200" />

            <fieldset>
              <legend className="text-2xl font-bold text-slate-900">
                About your monitoring needs
              </legend>

              <p className="mt-2 text-slate-600">
                Select the range that best matches the records you need
                monitored.
              </p>

              <div className="mt-6 grid gap-6 md:grid-cols-2">
                <div>
                  <label
                    htmlFor="recordCount"
                    className="block text-sm font-semibold text-slate-700"
                  >
                    How many active records need monitoring?{" "}
                    <span className="text-red-600">*</span>
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
                    The selected record range determines the package
                    recommendation; it does not change package user limits.
                  </p>
                </div>

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

              <section aria-labelledby="plan-pricing-heading" className="mt-8">
                <h2 id="plan-pricing-heading" className="text-xl font-bold text-slate-900">
                  Your Plan Recommendation
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Prices shown are indicative and subject to final service
                  terms. Fees exclude VAT where applicable.
                </p>

                {needsAssistance && <RecordCountAssistance />}
                {recommendedPlan && <RecommendedPlan plan={recommendedPlan} />}
              </section>
            </fieldset>

            <div>
              <label
                htmlFor="message"
                className="block text-sm font-semibold text-slate-700"
              >
                Message (optional)
              </label>
              <textarea
                id="message"
                name="message"
                rows={5}
                maxLength={2000}
                placeholder="What would you like to discuss?"
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
              />
            </div>

            {/* PRIVACY MESSAGE */}
            <div
              id="privacy-notice"
              className="rounded-2xl border border-teal-200 bg-teal-50 p-5"
            >
              <p className="font-bold text-teal-900">
                Your privacy matters
              </p>

              <p className="mt-2 text-sm leading-6 text-teal-800">
                We use the information you provide to respond to your enquiry.
                Do not include passwords, confidential documents or other
                sensitive information in your message.
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

            <label className="flex items-start gap-3 text-sm leading-6 text-slate-700">
              <input
                name="privacyConsent"
                type="checkbox"
                required
                className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 text-teal-700 focus:ring-teal-600"
              />
              <span>
                I consent to my supplied information being used to respond to
                this enquiry.
              </span>
            </label>

            <div className="border-t border-slate-200 pt-8">
              <button
                type="submit"
                disabled={isSubmitting}
                className="min-h-11 w-full rounded-xl bg-teal-700 px-8 py-3.5 font-semibold text-white shadow-sm transition hover:bg-teal-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 sm:w-auto"
              >
                {isSubmitting ? "Sending enquiry..." : "Submit Enquiry"}
              </button>

              <p
                aria-live="polite"
                role="status"
                className="mt-4 text-sm leading-6 text-slate-600"
              >
                {enquiryNotice}
              </p>
            </div>
          </form>
        </div>

        {/* STICKY SIDEBAR */}
        <aside className="min-w-0 space-y-6 lg:sticky lg:top-28 lg:self-start">
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
              Metadata monitoring, not document storage.
            </p>

            <p className="mt-3 text-sm leading-6 text-teal-800">
              Version 1 does not store clients&apos; underlying confidential
              company documents.
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
                <span className="font-bold text-teal-700">
                  ✓
                </span>
                Each separately monitored item counts as one record.
              </li>

              <li className="flex gap-3">
                <span className="font-bold text-teal-700">
                  ✓
                </span>
                Folders and subfolders do not count.
              </li>

              <li className="flex gap-3">
                <span className="font-bold text-teal-700">
                  ✓
                </span>
                Renewing an existing item does not create a new record.
              </li>

              <li className="flex gap-3">
                <span className="font-bold text-teal-700">
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
              the account portal.
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
                src="/deadline-monitor-logo.png"
                alt="Deadline Monitor logo"
                width={42}
                height={42}
                className="h-9 w-9 object-contain"
              />
            </div>

            <div>
              <p className="font-bold text-white">
                Deadline Monitor
              </p>

              <p className="text-xs text-teal-400">
                Know what&apos;s due. Before it&apos;s overdue.
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
              © 2026 Deadline Monitor. All rights reserved.
            </p>
          </div>
        </div>
        <div className="mx-auto max-w-7xl px-6 pb-8 text-center text-sm text-slate-400">
          <p>Legal entity: pending CIPC registration.</p>
          <a className="mt-2 inline-block text-teal-300 underline underline-offset-2" href="mailto:consultant1@compimento.co.za">
            consultant1@compimento.co.za
          </a>
          <a className="mt-1 block text-teal-300 underline underline-offset-2" href="tel:+27735019603">
            073 501 9603
          </a>
          <p className="mt-2">
            5 Second Street, Arboretum, Bloemfontein, 9301, South Africa
          </p>
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
          Indicative range
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
          Package features
        </h4>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Features and service details are subject to the applicable proposal
          or service order.
        </p>

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
            <span className="font-bold text-teal-700">
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
        Deadline Monitor may help prepare a starting register and identify
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
  autoComplete,
  maxLength,
}: {
  id: string;
  label: string;
  type: string;
  placeholder: string;
  required?: boolean;
  autoComplete?: string;
  maxLength?: number;
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
        autoComplete={autoComplete}
        maxLength={maxLength}
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