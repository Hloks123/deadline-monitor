import Image from "next/image";

const folders = [
  {
    name: "COIDA Documents",
    colour: "bg-amber-50 text-amber-800",
    items: [
      "Letters of Good Standing",
      "Return of Earnings",
      "Claims and registrations",
    ],
  },
  {
    name: "CIPC Documents",
    colour: "bg-blue-50 text-blue-800",
    items: [
      "Company registration",
      "Annual returns",
      "Director records",
    ],
  },
  {
    name: "SARS Documents",
    colour: "bg-teal-50 text-teal-800",
    items: ["Tax compliance", "VAT records", "PAYE and UIF"],
  },
];

const industries = [
  {
    title: "Construction",
    text: "Monitor COIDA, B-BBEE, insurance, contracts, vehicle and supplier records.",
  },
  {
    title: "Transport",
    text: "Track vehicle licences, permits, insurance, driver records and service agreements.",
  },
  {
    title: "Property",
    text: "Organise leases, insurance, municipal records and supplier contracts.",
  },
  {
    title: "Professional Services",
    text: "Monitor registrations, professional indemnity, CIPC and tax records.",
  },
];

const workflow = [
  {
    number: "01",
    title: "Register",
    text: "Capture approved business-record information and important dates.",
  },
  {
    number: "02",
    title: "Organise",
    text: "Group records into COIDA, CIPC, SARS and other folders.",
  },
  {
    number: "03",
    title: "Monitor",
    text: "Track expiry dates, renewal dates and upcoming actions.",
  },
  {
    number: "04",
    title: "Remind",
    text: "Review reminders before important dates become urgent.",
  },
  {
    number: "05",
    title: "Renew",
    text: "Confirm the new date and begin the next monitoring cycle.",
  },
];

const plans = [
  {
    name: "Starter",
    price: "R399",
    setup: "R1,500 once-off setup",
    description:
      "For small businesses beginning to organise recurring records.",
    features: [
      "Up to 25 monitored records",
      "One user",
      "Monitoring dashboard",
      "Monthly reminder review",
    ],
    featured: false,
  },
  {
    name: "Standard",
    price: "R799",
    setup: "R2,500 once-off setup",
    description:
      "For businesses monitoring more records and working with multiple users.",
    features: [
      "Up to 75 monitored records",
      "Up to three users",
      "Reviewed reminder emails",
      "Monthly summary report",
    ],
    featured: true,
  },
  {
    name: "Managed",
    price: "R1,499",
    setup: "R4,500 once-off setup",
    description:
      "For businesses that want active monitoring, follow-up and reporting.",
    features: [
      "Up to 150 monitored records",
      "Active follow-up",
      "Monthly reporting",
      "Quarterly monitoring review",
    ],
    featured: false,
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      {/* HEADER */}
      <header className="sticky top-0 z-50 border-b border-slate-700 bg-slate-900 text-white shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <a href="#home" className="flex items-center gap-4">
            <div className="rounded-xl bg-white p-2">
              <Image
                src="/doc-monitor-logo.png"
                alt="Doc Monitor SA logo"
                width={72}
                height={72}
                priority
                className="h-14 w-14 object-contain"
              />
            </div>

            <div>
              <p className="text-xl font-bold text-white md:text-2xl">
                Doc Monitor SA
              </p>

              <p className="text-sm font-medium text-teal-400">
                Your documents. Monitored.
              </p>
            </div>
          </a>

          <nav
            aria-label="Main navigation"
            className="hidden items-center gap-7 text-sm font-medium lg:flex"
          >
            <a
              href="#how-it-works"
              className="text-slate-200 transition hover:text-teal-400"
            >
              How It Works
            </a>

            <a
              href="#features"
              className="text-slate-200 transition hover:text-teal-400"
            >
              Features
            </a>

            <a
              href="#folders"
              className="text-slate-200 transition hover:text-teal-400"
            >
              Record Folders
            </a>

            <a
              href="#pricing"
              className="text-slate-200 transition hover:text-teal-400"
            >
              Pricing
            </a>

            <a
              href="#contact"
              className="text-slate-200 transition hover:text-teal-400"
            >
              Contact
            </a>

            <a
              href="#login"
              className="rounded-xl border border-teal-400 px-5 py-3 text-white transition hover:bg-teal-500"
            >
              Login
            </a>
          </nav>
        </div>
      </header>

      {/* HERO */}
      <section
        id="home"
        className="mx-auto grid max-w-7xl gap-12 px-6 py-16 lg:grid-cols-2 lg:items-center lg:py-20"
      >
        <div>
          <p className="mb-4 text-sm font-bold uppercase tracking-[0.2em] text-teal-600">
            Smarter Business Record Monitoring
          </p>

          <h1 className="max-w-3xl text-4xl font-bold leading-tight text-slate-900 sm:text-5xl lg:text-6xl">
            Stay organised. Stay informed. Stay ahead of important dates.
          </h1>

          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
            Keep COIDA, CIPC, SARS, insurance and other important business
            records organised in one place, with clear expiry dates, reminders
            and follow-ups.
          </p>

          <div className="mt-8 flex flex-wrap gap-4">
            <a
              href="#contact"
              className="rounded-xl bg-teal-600 px-7 py-4 font-semibold text-white shadow-sm transition hover:bg-teal-700"
            >
              Get Started
            </a>

            <a
              href="#how-it-works"
              className="rounded-xl border border-slate-300 bg-white px-7 py-4 font-semibold text-slate-900 transition hover:border-teal-600 hover:text-teal-700"
            >
              See How It Works
            </a>
          </div>

          <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm text-slate-600">
            <span>✓ No document uploads</span>
            <span>✓ Reviewed reminders</span>
            <span>✓ Organised record folders</span>
          </div>
        </div>

        {/* DASHBOARD PREVIEW */}
        <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-xl shadow-slate-200/60">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.15em] text-teal-600">
                Monitoring Overview
              </p>

              <h2 className="mt-3 text-2xl font-bold">
                Important dates in one place
              </h2>
            </div>

            <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800">
              Demo data
            </span>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl bg-red-50 p-5">
              <p className="text-sm font-medium text-red-700">Expired</p>
              <p className="mt-2 text-3xl font-bold text-red-700">4</p>
            </div>

            <div className="rounded-2xl bg-amber-50 p-5">
              <p className="text-sm font-medium text-amber-700">
                Due in 7 days
              </p>
              <p className="mt-2 text-3xl font-bold text-amber-700">9</p>
            </div>

            <div className="rounded-2xl bg-blue-50 p-5">
              <p className="text-sm font-medium text-blue-700">
                Due in 30 days
              </p>
              <p className="mt-2 text-3xl font-bold text-blue-700">18</p>
            </div>

            <div className="rounded-2xl bg-teal-50 p-5">
              <p className="text-sm font-medium text-teal-700">
                Awaiting client
              </p>
              <p className="mt-2 text-3xl font-bold text-teal-700">7</p>
            </div>
          </div>

          <div className="mt-8 space-y-5 border-t border-slate-200 pt-6">
            <RecordRow
              title="COIDA Letter of Good Standing"
              company="Demo Construction (Pty) Ltd"
              status="Due soon"
              statusClass="bg-amber-100 text-amber-800"
            />

            <RecordRow
              title="CIPC Annual Return"
              company="Sample Services (Pty) Ltd"
              status="30 days"
              statusClass="bg-blue-100 text-blue-800"
            />

            <RecordRow
              title="Tax Compliance Status"
              company="Demo Transport (Pty) Ltd"
              status="Awaiting client"
              statusClass="bg-teal-100 text-teal-800"
            />
          </div>
        </div>
      </section>

      {/* PRIVACY MESSAGE */}
      <section className="border-y border-teal-800 bg-teal-700 py-9 text-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xl font-bold">Your documents stay with you.</p>

            <p className="mt-2 max-w-4xl leading-7 text-teal-50">
              Doc Monitor SA tracks only the approved record information and
              important dates needed for monitoring. Your actual confidential
              documents remain in your own environment.
            </p>
          </div>

          <span className="whitespace-nowrap rounded-full bg-white px-4 py-2 text-sm font-semibold text-teal-800">
            Metadata only
          </span>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="bg-white py-20">
        <div className="mx-auto max-w-7xl px-6">
          <SectionHeading
            eyebrow="Why Doc Monitor SA"
            title="Everything important, easier to monitor."
            description="Bring important dates, responsibilities and follow-up actions together in one clear monitoring workspace."
          />

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            <FeatureCard
              number="01"
              title="Your documents stay with you"
              text="Your actual files remain in your own environment. Doc Monitor SA tracks only the approved information required for monitoring."
              colour="bg-teal-100 text-teal-700"
            />

            <FeatureCard
              number="02"
              title="Reminders before dates become urgent"
              text="Upcoming actions are highlighted and reminders are reviewed before important dates become overdue."
              colour="bg-amber-100 text-amber-700"
            />

            <FeatureCard
              number="03"
              title="Know what needs attention"
              text="See expiry dates, status, responsible contacts and follow-up actions from one organised workspace."
              colour="bg-blue-100 text-blue-700"
            />
          </div>
        </div>
      </section>

      {/* FOLDERS */}
      <section
        id="folders"
        className="border-y border-slate-200 bg-slate-50 py-20"
      >
        <div className="mx-auto max-w-7xl px-6">
          <SectionHeading
            eyebrow="Organised Record Folders"
            title="Organise records the way your business works."
            description="Create folders and nested subfolders for different authorities, record types, branches and business areas."
          />

          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            {folders.map((folder) => (
              <article
                key={folder.name}
                className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm"
              >
                <div
                  className={`inline-flex rounded-xl px-4 py-2 text-sm font-bold ${folder.colour}`}
                >
                  Folder
                </div>

                <h3 className="mt-5 text-xl font-bold">{folder.name}</h3>

                <ul className="mt-5 space-y-3">
                  {folder.items.map((item) => (
                    <li
                      key={item}
                      className="flex items-center gap-3 rounded-lg bg-slate-50 px-4 py-3 text-slate-700"
                    >
                      <span className="font-bold text-teal-600">›</span>
                      {item}
                    </li>
                  ))}
                </ul>

                <div className="mt-6 border-t border-slate-100 pt-5 text-sm font-semibold text-teal-700">
                  + Create nested folder
                </div>
              </article>
            ))}
          </div>

          <div className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-slate-600">
            Create additional folders for Insurance, Contracts, Vehicles,
            Licences, Staff Records and other important business information.
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" className="bg-white py-20">
        <div className="mx-auto max-w-7xl px-6">
          <SectionHeading
            eyebrow="How It Works"
            title="A straightforward monitoring process."
            description="From initial record capture through to renewal, Doc Monitor SA gives each important date a clear monitoring cycle."
          />

          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
            {workflow.map((step) => (
              <article
                key={step.number}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-6"
              >
                <span className="text-sm font-bold text-teal-600">
                  {step.number}
                </span>

                <h3 className="mt-4 text-xl font-bold">{step.title}</h3>

                <p className="mt-3 leading-7 text-slate-600">{step.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* INDUSTRIES */}
      <section className="bg-slate-900 py-20 text-white">
        <div className="mx-auto max-w-7xl px-6">
          <div className="max-w-3xl">
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-teal-400">
              Who It Is For
            </p>

            <h2 className="mt-3 text-3xl font-bold md:text-4xl">
              Built for businesses with important recurring records.
            </h2>

            <p className="mt-4 text-lg leading-8 text-slate-300">
              Designed for South African businesses that need clearer
              visibility of renewal dates, responsibilities and outstanding
              actions.
            </p>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {industries.map((industry) => (
              <article
                key={industry.title}
                className="rounded-2xl border border-slate-700 bg-slate-800 p-6"
              >
                <h3 className="text-xl font-bold">{industry.title}</h3>

                <p className="mt-3 leading-7 text-slate-300">
                  {industry.text}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="bg-white py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-teal-600">
              Plans & Pricing
            </p>

            <h2 className="mt-3 text-3xl font-bold md:text-4xl">
              Choose the level of monitoring that fits your business.
            </h2>

            <p className="mt-4 text-lg leading-8 text-slate-600">
              Select a plan based on your record volume, number of users and
              level of monitoring support required.
            </p>
          </div>

          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            {plans.map((plan) => (
              <article
                key={plan.name}
                className={`relative rounded-3xl border p-8 ${
                  plan.featured
                    ? "border-teal-500 bg-slate-900 text-white shadow-xl"
                    : "border-slate-200 bg-white shadow-sm"
                }`}
              >
                {plan.featured && (
                  <span className="absolute right-6 top-6 rounded-full bg-teal-500 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">
                    Most Popular
                  </span>
                )}

                <h3 className="text-2xl font-bold">{plan.name}</h3>

                <p
                  className={`mt-4 min-h-16 leading-7 ${
                    plan.featured ? "text-slate-300" : "text-slate-600"
                  }`}
                >
                  {plan.description}
                </p>

                <div className="mt-7">
                  <span className="text-4xl font-bold">{plan.price}</span>

                  <span
                    className={
                      plan.featured ? "text-slate-300" : "text-slate-500"
                    }
                  >
                    {" "}
                    / month
                  </span>
                </div>

                <p
                  className={`mt-2 text-sm font-medium ${
                    plan.featured ? "text-teal-300" : "text-teal-700"
                  }`}
                >
                  {plan.setup}
                </p>

                <ul className="mt-7 space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex gap-3">
                      <span className="font-bold text-teal-500">✓</span>

                      <span
                        className={
                          plan.featured ? "text-slate-200" : "text-slate-700"
                        }
                      >
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>

                <a
                  href="#contact"
                  className={`mt-8 block rounded-xl px-5 py-3 text-center font-semibold transition ${
                    plan.featured
                      ? "bg-teal-500 text-white hover:bg-teal-600"
                      : "bg-slate-900 text-white hover:bg-slate-800"
                  }`}
                >
                  Get Started
                </a>
              </article>
            ))}
          </div>

          <p className="mt-7 text-center text-sm text-slate-500">
            Prices shown are indicative and subject to final service terms.
            Fees exclude VAT where applicable.
          </p>
        </div>
      </section>

      {/* GET STARTED */}
      <section id="contact" className="bg-teal-700 py-20 text-white">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-teal-100">
            Get Started
          </p>

          <h2 className="mt-4 text-3xl font-bold md:text-5xl">
            Ready to take control of your important business dates?
          </h2>

          <p className="mx-auto mt-6 max-w-3xl text-lg leading-8 text-teal-50">
            Keep important company records organised, monitored and followed
            up before they become urgent.
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <a
              href="mailto:hello@docmonitor.co.za"
              className="rounded-xl bg-white px-7 py-4 font-semibold text-teal-800 transition hover:bg-slate-100"
            >
              Get Started
            </a>

            <a
              href="#pricing"
              className="rounded-xl border border-white px-7 py-4 font-semibold text-white transition hover:bg-white hover:text-teal-800"
            >
              View Pricing
            </a>
          </div>

          <p className="mt-6 text-sm text-teal-100">
            Simple onboarding. No confidential document uploads required.
          </p>
        </div>
      </section>

      {/* LOGIN PLACEHOLDER */}
      <section id="login" className="bg-slate-900 py-10 text-center text-white">
        <p className="text-sm text-slate-300">
          Already a client? Secure account access will be available through the
          Doc Monitor SA client portal.
        </p>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-slate-800 bg-slate-950 text-slate-300">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 py-12 md:grid-cols-3">
          <div className="flex items-start gap-4">
            <div className="rounded-xl bg-white p-2">
              <Image
                src="/doc-monitor-logo.png"
                alt="Doc Monitor SA logo"
                width={56}
                height={56}
                className="h-12 w-12 object-contain"
              />
            </div>

            <div>
              <p className="text-lg font-bold text-white">Doc Monitor SA</p>

              <p className="mt-1 text-sm text-teal-400">
                Your documents. Monitored.
              </p>
            </div>
          </div>

          <div>
            <p className="font-semibold text-white">Quick Links</p>

            <div className="mt-4 flex flex-col gap-3 text-sm">
              <a href="#features" className="hover:text-teal-400">
                Features
              </a>

              <a href="#folders" className="hover:text-teal-400">
                Record Folders
              </a>

              <a href="#how-it-works" className="hover:text-teal-400">
                How It Works
              </a>

              <a href="#pricing" className="hover:text-teal-400">
                Pricing
              </a>

              <a href="#contact" className="hover:text-teal-400">
                Contact
              </a>
            </div>
          </div>

          <div>
            <p className="font-semibold text-white">
              Important Information
            </p>

            <p className="mt-4 text-sm leading-6 text-slate-400">
              Doc Monitor SA provides document-monitoring and
              information-management services. Monitoring does not constitute
              legal, tax or regulatory advice.
            </p>

            <div className="mt-5 flex flex-wrap gap-5 text-sm">
              <a href="#" className="hover:text-teal-400">
                Privacy
              </a>

              <a href="#" className="hover:text-teal-400">
                Terms
              </a>

              <a href="#contact" className="hover:text-teal-400">
                Contact
              </a>

              <a href="#login" className="hover:text-teal-400">
                Login
              </a>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-800 px-6 py-6 text-center text-sm text-slate-500">
          © 2026 Doc Monitor SA. Your documents. Monitored.
        </div>
      </footer>
    </main>
  );
}

function RecordRow({
  title,
  company,
  status,
  statusClass,
}: {
  title: string;
  company: string;
  status: string;
  statusClass: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-5 last:border-b-0 last:pb-0">
      <div>
        <p className="font-semibold text-slate-900">{title}</p>
        <p className="mt-1 text-sm text-slate-500">{company}</p>
      </div>

      <span
        className={`whitespace-nowrap rounded-full px-3 py-1 text-sm font-medium ${statusClass}`}
      >
        {status}
      </span>
    </div>
  );
}

function FeatureCard({
  number,
  title,
  text,
  colour,
}: {
  number: string;
  title: string;
  text: string;
  colour: string;
}) {
  return (
    <article className="rounded-2xl border border-slate-200 p-7 shadow-sm">
      <div
        className={`flex h-12 w-12 items-center justify-center rounded-xl text-lg font-bold ${colour}`}
      >
        {number}
      </div>

      <h3 className="mt-6 text-xl font-bold text-slate-900">{title}</h3>

      <p className="mt-3 leading-7 text-slate-600">{text}</p>
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
      <p className="text-sm font-bold uppercase tracking-[0.2em] text-teal-600">
        {eyebrow}
      </p>

      <h2 className="mt-3 text-3xl font-bold text-slate-900 md:text-4xl">
        {title}
      </h2>

      <p className="mt-4 text-lg leading-8 text-slate-600">{description}</p>
    </div>
  );
}