import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";

const GET_STARTED_HREF = "/get-started";

const folders = [
  {
    title: "Organisation and authorities",
    description:
      "Group monitored company records and approved metadata by authority or record category.",
  },
  {
    title: "Branches and business areas",
    description:
      "Use folders and nested subfolders to organise information around the way an organisation works.",
  },
  {
    title: "Related operational information",
    description:
      "Keep record metadata, important dates, responsibility and related follow-up information organised together.",
  },
];

export const metadata: Metadata = {
  title: {
    absolute: "Deadline Monitor | Know what's due. Before it's overdue.",
  },
  description:
    "A South African business deadline and operational monitoring service for company-record metadata, renewals, recurring tasks, reminders, responsible contacts and reporting.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Deadline Monitor | Know what's due. Before it's overdue.",
    description:
      "Monitor business record metadata, renewal dates and operational work in one organised workspace.",
    url: "/",
    type: "website",
    images: [
      {
        url: "/deadline-monitor-logo.png",
        width: 512,
        height: 512,
        alt: "Deadline Monitor",
      },
    ],
  },
};

const industries = [
  {
    title: "Construction",
    text: "COIDA, insurance, tenders, vehicles and supplier records.",
  },
  {
    title: "Transport and fleet",
    text: "Vehicle licences, permits, insurance and service schedules.",
  },
  {
    title: "Property",
    text: "Leases, insurance, municipal records and supplier contracts.",
  },
  {
    title: "Professional services",
    text: "Professional registrations, contracts, CIPC and tax records.",
  },
];

const workflow = [
  {
    number: "01",
    title: "Register",
    text: "Add approved record and work metadata.",
  },
  {
    number: "02",
    title: "Assign",
    text: "Set responsibility, due dates, priorities and schedules.",
  },
  {
    number: "03",
    title: "Monitor",
    text: "See upcoming, overdue, blocked and awaiting-confirmation items.",
  },
  {
    number: "04",
    title: "Act",
    text: "Complete work, confirm renewals and note brief evidence.",
  },
  {
    number: "05",
    title: "Report",
    text: "Review calendars, histories and monitoring summaries.",
  },
];

const plans = [
  {
    name: "Starter",
    price: "R399",
    setup: "R500 once-off setup",
    records: "Up to 25 active records",
    users: "1 authorised user",
    features: [
      "Monitoring dashboard",
      "Record folders and nested subfolders",
      "Expiry-date monitoring",
      "Monthly reminder review",
    ],
    featured: false,
  },
  {
    name: "Standard",
    price: "R799",
    setup: "R1,000 once-off setup",
    records: "Up to 75 active records",
    users: "Up to 4 authorised users",
    features: [
      "Everything in Starter",
      "Reviewed reminder emails",
      "Monthly monitoring report",
      "Notification history",
    ],
    featured: true,
  },
  {
    name: "Managed",
    price: "R1,499",
    setup: "R2,000 once-off setup",
    records: "Up to 150 active records",
    users: "Up to 12 authorised users",
    features: [
      "Everything in Standard",
      "Active follow-up",
      "Monthly reporting",
      "Quarterly monitoring review",
      "Higher-touch monitoring support",
    ],
    featured: false,
  },
  {
    name: "Custom",
    price: "From R2,500",
    setup: "Setup quoted separately",
    records: "More than 150 active monitored records",
    users: "User allocation based on requirements",
    features: [
      "Multiple branches or operating entities",
      "Custom record categories and folder structures",
      "Active monitoring and follow-up",
      "Custom escalation arrangements",
      "Quarterly service reviews",
      "Custom reporting requirements",
      "Bulk onboarding options",
      "Integrations considered and quoted separately",
    ],
    featured: false,
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-50 border-b border-slate-700 bg-slate-900 text-white shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6 sm:py-3">
          <Link href="/" className="flex min-w-0 items-center gap-2 sm:gap-3">
            <div className="rounded-lg bg-white p-1.5">
              <Image
                src="/deadline-monitor-logo.png"
                alt="Deadline Monitor logo"
                width={72}
                height={72}
                priority
                className="h-10 w-10 shrink-0 object-contain sm:h-12 sm:w-12"
              />
            </div>

            <div className="min-w-0">
              <p className="truncate text-base font-bold text-white sm:text-xl">
                Deadline Monitor
              </p>

              <p className="truncate text-[10px] font-medium leading-4 text-teal-400 sm:text-sm">
                Know what&apos;s due. Before it&apos;s overdue.
              </p>
            </div>
          </Link>

          <nav
            aria-label="Main navigation"
            className="hidden items-center gap-3 text-sm font-medium lg:flex"
          >
            <Link
              href="/#how-it-works"
              className="cursor-pointer text-slate-200 transition hover:text-teal-400"
            >
              How It Works
            </Link>

            <Link
              href="/#features"
              className="cursor-pointer text-slate-200 transition hover:text-teal-400"
            >
              Features
            </Link>

            <Link
              href="/#folders"
              className="cursor-pointer text-slate-200 transition hover:text-teal-400"
            >
              Record Folders
            </Link>

            <Link
              href="/#pricing"
              className="cursor-pointer text-slate-200 transition hover:text-teal-400"
            >
              Pricing
            </Link>

            <Link
              href="/#contact"
              className="cursor-pointer text-slate-200 transition hover:text-teal-400"
            >
              Contact
            </Link>

            <Link
              href={GET_STARTED_HREF}
              className="cursor-pointer rounded-lg bg-teal-700 px-4 py-2.5 text-white transition hover:bg-teal-800"
            >
              Get Started
            </Link>

            <Link
              href="/login"
              className="cursor-pointer rounded-lg border border-teal-400 px-4 py-2.5 text-white transition hover:bg-teal-700"
            >
              Login
            </Link>
          </nav>

          <details className="relative lg:hidden">
            <summary className="flex min-h-11 shrink-0 cursor-pointer list-none items-center rounded-xl border border-slate-600 px-3 font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-400 sm:px-4">
              Menu
            </summary>
            <nav
              aria-label="Mobile navigation"
              className="absolute right-0 top-full z-50 mt-2 grid min-w-52 gap-1 rounded-xl border border-slate-700 bg-slate-900 p-2 text-sm shadow-xl"
            >
              <Link href="/#how-it-works" className="cursor-pointer rounded-lg px-3 py-3 text-white hover:bg-slate-800">How It Works</Link>
              <Link href="/#features" className="cursor-pointer rounded-lg px-3 py-3 text-white hover:bg-slate-800">Features</Link>
              <Link href="/#folders" className="cursor-pointer rounded-lg px-3 py-3 text-white hover:bg-slate-800">Record Folders</Link>
              <Link href="/#pricing" className="cursor-pointer rounded-lg px-3 py-3 text-white hover:bg-slate-800">Pricing</Link>
              <Link href="/#contact" className="cursor-pointer rounded-lg px-3 py-3 text-white hover:bg-slate-800">Contact</Link>
              <Link href={GET_STARTED_HREF} className="cursor-pointer rounded-lg bg-teal-700 px-3 py-3 font-semibold text-white hover:bg-teal-800">Get Started</Link>
              <Link href="/login" className="cursor-pointer rounded-lg px-3 py-3 text-teal-300 hover:bg-slate-800">Login</Link>
            </nav>
          </details>
        </div>
      </header>

      <section
        id="home"
        className="mx-auto grid max-w-7xl gap-6 px-6 py-8 sm:py-9 lg:grid-cols-2 lg:items-center lg:gap-8 lg:py-10"
      >
        <div>
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-teal-700 sm:text-sm">
            South African business deadline monitoring
          </p>

          <h1 className="max-w-3xl text-4xl font-bold leading-[1.1] text-slate-900 sm:text-[2.75rem] lg:text-5xl">
            Know what&apos;s due. Before it&apos;s overdue.
          </h1>

          <p className="mt-4 max-w-2xl text-base leading-6 text-slate-600 sm:text-lg">
            Deadline Monitor helps businesses keep company-record metadata,
            renewal and expiry dates, recurring operational tasks, reminders,
            follow-ups and responsible contacts in view.
          </p>

          <p className="mt-4 max-w-2xl rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-950">
            Initial onboarding may be limited while Deadline Monitor completes
            its controlled rollout.
          </p>

          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href={GET_STARTED_HREF}
              className="inline-flex min-h-11 cursor-pointer items-center rounded-lg bg-teal-700 px-5 py-2.5 font-semibold text-white transition hover:bg-teal-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
            >
              Get Started
            </Link>
            <Link
              href="/#how-it-works"
              className="inline-flex min-h-11 cursor-pointer items-center rounded-lg border border-slate-300 bg-white px-5 py-2.5 font-semibold text-slate-900 transition hover:border-teal-600 hover:text-teal-700"
            >
              See How It Works
            </Link>
          </div>

          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-slate-600 sm:text-sm">
            <span>Record metadata and renewal dates</span>
            <span>Recurring operational work</span>
            <span>Version 1 does not store underlying confidential documents</span>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-lg shadow-slate-200/50 sm:p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.15em] text-teal-700">
                What you can monitor
              </p>

              <h2 className="mt-1.5 text-lg font-bold sm:text-xl">
                One view of important dates and work
              </h2>
            </div>
          </div>

          <ul className="mt-5 grid gap-3 sm:grid-cols-2">
            {[
              "Company-record metadata",
              "Renewal and expiry dates",
              "Recurring operational tasks",
              "Reminders and follow-ups",
              "Responsible contacts",
              "Audit history and reports",
            ].map((item) => (
              <li key={item} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <span aria-hidden="true" className="mr-2 font-bold text-teal-700">✓</span>
                <span className="font-medium text-slate-800">{item}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 border-t border-slate-200 pt-3 text-xs leading-5 text-slate-500">
            Illustrative capabilities only. No client account or operational
            data is shown on this public page.
          </p>
        </div>
      </section>

      <section id="problem" className="border-y border-slate-200 bg-slate-100 py-10 sm:py-12">
        <div className="mx-auto grid max-w-7xl gap-4 px-6 md:grid-cols-2 md:items-center">
          <h2 className="text-2xl font-bold text-slate-900 md:text-3xl">
            Important dates are easy to miss when records and follow-ups are
            spread across different places.
          </h2>
          <p className="leading-7 text-slate-700">
            Deadline Monitor brings approved metadata, renewal dates, assigned
            responsibility, recurring work and change history into an
            operational view—without storing clients&apos; underlying
            confidential documents in Version 1.
          </p>
        </div>
      </section>

      <section id="features" className="scroll-mt-24 border-y border-slate-200 bg-white py-10 sm:py-12">
        <div className="mx-auto max-w-7xl px-6">
          <SectionHeading
            eyebrow="Features"
            title="Records and operational work, clearly monitored."
            description=""
          />

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <CapabilityCard
              title="Company-record metadata"
              text="Keep record type, issue and expiry dates, status, risk and follow-up metadata organised without storing the underlying document."
            />
            <CapabilityCard
              title="Renewals and expiry dates"
              text="See upcoming dates, responsible contacts and follow-up actions in one operational view."
            />
            <CapabilityCard
              title="Recurring operational tasks"
              text="Plan repeat work and track its schedule, owner, status and completion history."
            />
            <CapabilityCard
              title="Reminders and follow-ups"
              text="Organise reminder dates and follow-up activity. Reminder delivery is not guaranteed; keep independent controls for critical deadlines."
            />
            <CapabilityCard
              title="Responsibility and auditability"
              text="Record responsible contacts and retain a useful history of operational changes and actions."
            />
            <CapabilityCard
              title="Reporting"
              text="Review calendars, summaries and histories to support day-to-day operational oversight."
            />
          </div>

          <aside className="mt-4 flex flex-col gap-1.5 rounded-xl border border-teal-200 bg-teal-50 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-bold text-teal-950">Metadata, not document storage</h3>
              <p className="mt-1 text-sm leading-5 text-teal-900">
                Version 1 stores approved monitoring metadata such as names, dates, status, responsibility, tasks and reminder history. It does not store clients&apos; underlying confidential documents.
              </p>
            </div>
            <span className="cursor-default whitespace-nowrap rounded-full bg-white px-3 py-1 text-xs font-semibold text-teal-900">No confidential uploads</span>
          </aside>
        </div>
      </section>

      <section
        id="folders"
        className="scroll-mt-24 border-y border-slate-200 bg-slate-50 py-10 sm:py-12"
      >
        <div className="mx-auto max-w-7xl px-6">
          <SectionHeading
            eyebrow="Record Folders"
            title="Organise monitored records the way your business works."
            description="Folders and nested subfolders organise monitored records, approved metadata, categories and related operational information. Version 1 does not store the underlying confidential company documents."
          />
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {folders.map((folder) => (
              <article
                key={folder.title}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <h3 className="font-bold text-slate-900">{folder.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {folder.description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section
        id="how-it-works"
        className="scroll-mt-24 bg-slate-50 py-10 sm:py-12"
      >
        <div className="mx-auto max-w-7xl px-6">
          <SectionHeading
            eyebrow="How it works"
            title="A clear workflow from record to follow-up"
            description=""
          />

          <ol className="mt-5 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
            {workflow.map((step) => (
              <li key={step.number} className="cursor-default flex gap-2.5 rounded-lg border border-slate-200 bg-white p-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teal-100 text-xs font-bold text-teal-800">{step.number}</span>
                <div>
                  <h3 className="text-base font-bold">{step.title}</h3>
                  <p className="mt-0.5 text-sm leading-5 text-slate-600">{step.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* INDUSTRIES */}
      <section id="who-its-for" className="scroll-mt-24 bg-slate-900 py-10 text-white sm:py-12">
        <div className="mx-auto max-w-7xl px-6">
          <div className="max-w-3xl">
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-teal-400">
              Who It Is For
            </p>

            <h2 className="mt-2 text-2xl font-bold md:text-3xl">
              For South African businesses
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-300 sm:text-base">
              Designed for businesses managing company records, recurring renewals, operational deadlines and follow-up responsibilities.
            </p>
          </div>

          <div className="mt-5 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            {industries.map((industry) => (
              <article
                key={industry.title}
                className="cursor-default rounded-lg border border-slate-700 bg-slate-800 p-3"
              >
                <h3 className="font-bold">
                  {industry.title}
                </h3>

                <p className="mt-1 text-sm leading-5 text-slate-300">
                  {industry.text}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section
        id="pricing"
        className="scroll-mt-24 bg-white py-10 sm:py-12"
      >
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-teal-700">
              Plans &amp; Pricing
            </p>

            <h2 className="mt-2 text-2xl font-bold md:text-3xl">
              Choose the level of monitoring that fits your business.
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-600 sm:text-base">
              Select a plan based on your active monitored-record volume,
              number of users and level of monitoring support required.
            </p>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {plans.map((plan) => (
              <article
                key={plan.name}
                className={`relative flex cursor-default flex-col rounded-xl border p-4 ${
                  plan.featured
                    ? "border-teal-500 bg-slate-900 text-white shadow-lg"
                    : "border-slate-200 bg-white shadow-sm"
                }`}
              >
                {plan.featured && (
                  <span className="absolute right-3 top-3 rounded-full bg-teal-700 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                    Most Popular
                  </span>
                )}

                <h3 className="text-lg font-bold sm:text-xl">
                  {plan.name}
                </h3>

                <div className="mt-3">
                  <span className="text-2xl font-bold sm:text-3xl">
                    {plan.price}
                  </span>

                  <span
                    className={`text-sm ${
                      plan.featured
                        ? "text-slate-300"
                        : "text-slate-500"
                    }`}
                  >
                    {" "}
                    / month
                  </span>
                </div>

                <p
                  className={`mt-2 text-sm font-medium ${
                    plan.featured
                      ? "text-teal-300"
                      : "text-teal-700"
                  }`}
                >
                  {plan.setup}
                </p>

                <dl className={`mt-3 grid gap-2.5 text-sm ${plan.featured ? "text-slate-200" : "text-slate-700"}`}>
                  <div><dt className="font-semibold">Record allowance</dt><dd className="mt-0.5">{plan.records}</dd></div>
                  <div><dt className="font-semibold">User allowance</dt><dd className="mt-0.5">{plan.users}</dd></div>
                </dl>

                <ul className={`mt-4 space-y-2 border-t border-slate-200/50 pt-4 text-sm ${plan.featured ? "text-slate-200" : "text-slate-700"}`}>
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex gap-2">
                      <span aria-hidden="true" className="font-bold text-teal-600">✓</span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  href={GET_STARTED_HREF}
                  className={`mt-auto block min-h-10 cursor-pointer rounded-lg px-4 py-2.5 text-center text-sm font-semibold transition ${
                    plan.featured
                      ? "bg-teal-700 text-white hover:bg-teal-800"
                      : "bg-slate-900 text-white hover:bg-slate-800"
                  }`}
                >
                  Get Started
                </Link>
              </article>
            ))}
          </div>

          <p className="mt-4 text-center text-xs text-slate-500">
            Prices shown are indicative and subject to final service terms.
            Fees exclude VAT where applicable.
          </p>

        </div>
      </section>

      <section className="bg-teal-700 py-12 text-white sm:py-16">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-teal-100">
            Get Started
          </p>
          <h2 className="mt-4 text-3xl font-bold md:text-5xl">
            Ready to take control of your important business dates?
          </h2>
          <p className="mx-auto mt-5 max-w-3xl text-lg leading-8 text-teal-50">
            Keep important company records organised, monitored and followed
            up before they become urgent.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-4">
            <Link
              href={GET_STARTED_HREF}
              className="rounded-xl bg-white px-7 py-4 font-semibold text-teal-800 transition hover:bg-slate-100"
            >
              Get Started
            </Link>
            <Link
              href="/#pricing"
              className="rounded-xl border border-white px-7 py-4 font-semibold text-white transition hover:bg-white hover:text-teal-800"
            >
              View Pricing
            </Link>
          </div>
          <p className="mt-5 text-sm text-teal-100">
            Version 1 does not require confidential document uploads.
          </p>
        </div>
      </section>

      <section className="bg-slate-900 py-8 text-center text-white">
        <p className="text-sm text-slate-300">Already a client?</p>
        <Link
          href="/login"
          className="mt-3 inline-block font-semibold text-teal-400 transition hover:text-teal-300"
        >
          Go to Secure Login →
        </Link>
      </section>

      {/* FOOTER */}
      <footer id="contact" className="border-t border-slate-800 bg-slate-950 text-slate-300">
        <div className="mx-auto grid max-w-7xl gap-6 px-6 py-7 md:grid-cols-3">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-white p-1.5">
              <Image
                src="/deadline-monitor-logo.png"
                alt="Deadline Monitor logo"
                width={56}
                height={56}
                className="h-10 w-10 object-contain"
              />
            </div>

            <div>
              <p className="text-base font-bold text-white">
                Deadline Monitor
              </p>

              <p className="mt-1 text-sm text-teal-400">
                Know what&apos;s due. Before it&apos;s overdue.
              </p>
            </div>
          </div>

          <div>
            <p className="font-semibold text-white">
              Quick Links
            </p>

            <div className="mt-3 flex flex-col gap-2.5 text-sm">
              <Link
                href="/#features"
                className="cursor-pointer hover:text-teal-400"
              >
                Core Capabilities
              </Link>

              <Link
                href="/#how-it-works"
                className="cursor-pointer hover:text-teal-400"
              >
                How It Works
              </Link>

              <Link
                href="/#folders"
                className="cursor-pointer hover:text-teal-400"
              >
                Record Folders
              </Link>

              <Link
                href="/#pricing"
                className="cursor-pointer hover:text-teal-400"
              >
                Pricing
              </Link>

              <Link
                href="/#who-its-for"
                className="cursor-pointer hover:text-teal-400"
              >
                Who It&apos;s For
              </Link>

              <Link
                href={GET_STARTED_HREF}
                className="cursor-pointer hover:text-teal-400"
              >
                Get Started
              </Link>

              <Link
                href="/login"
                className="cursor-pointer hover:text-teal-400"
              >
                Login
              </Link>
            </div>
          </div>

          <div>
            <p className="font-semibold text-white">
              Important Information
            </p>

            <p className="mt-3 text-sm leading-5 text-slate-400">
              Deadline Monitor provides operational record monitoring and
              information-management services. Monitoring does not
              constitute legal, tax or regulatory advice.
            </p>
            <p className="mt-3 text-sm text-slate-400">Legal entity: pending CIPC registration.</p>
            <a className="mt-2 inline-block text-sm text-teal-300 underline underline-offset-2 hover:text-teal-200" href="mailto:consultant1@compimento.co.za">
              consultant1@compimento.co.za
            </a>
            <a className="mt-1 block text-sm text-teal-300 underline underline-offset-2 hover:text-teal-200" href="tel:+27735019603">
              073 501 9603
            </a>
            <p className="mt-2 text-sm leading-5 text-slate-400">
              5 Second Street, Arboretum, Bloemfontein, 9301, South Africa
            </p>

            <div className="mt-4 flex flex-wrap gap-4 text-sm">
              <Link
                href="/privacy"
                className="cursor-pointer hover:text-teal-400"
              >
                Privacy
              </Link>

              <Link
                href="/terms"
                className="cursor-pointer hover:text-teal-400"
              >
                Terms
              </Link>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-800 px-6 py-4 text-center text-sm text-slate-500">
          © 2026 Deadline Monitor. Know what&apos;s due. Before it&apos;s overdue.
        </div>
      </footer>
    </main>
  );
}

function CapabilityCard({
  title,
  text,
}: {
  title: string;
  text: string;
}) {
  return (
    <article className="cursor-default rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-base font-bold text-slate-900">
        {title}
      </h3>

      <p className="mt-2 text-sm leading-5 text-slate-600">
        {text}
      </p>
    </article>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="max-w-3xl">
      <p className="text-sm font-bold uppercase tracking-[0.2em] text-teal-700">
        {eyebrow}
      </p>

      <h2 className="mt-2 text-2xl font-bold text-slate-900 md:text-3xl">
        {title}
      </h2>

      {description && <p className="mt-3 text-base leading-6 text-slate-600">
        {description}
      </p>}
    </div>
  );
}