import Image from "next/image";
import Link from "next/link";

const sections = [
  { id: "about", label: "About this notice" },
  { id: "information", label: "Information we collect" },
  { id: "not-collected", label: "Information we do not collect" },
  { id: "purpose", label: "How we use information" },
  { id: "legal-basis", label: "Why we process information" },
  { id: "sharing", label: "Who information may be shared with" },
  { id: "security", label: "How we protect information" },
  { id: "retention", label: "How long we keep information" },
  { id: "rights", label: "Your privacy rights" },
  { id: "cookies", label: "Cookies and website information" },
  { id: "children", label: "Children's information" },
  { id: "changes", label: "Changes to this notice" },
  { id: "contact", label: "Contact us" },
];

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      {/* HEADER */}
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

          <div className="flex items-center gap-3">
            <Link
              href="/get-started"
              className="hidden rounded-xl bg-teal-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-teal-600 sm:inline-block"
            >
              Get Started
            </Link>

            <Link
              href="/"
              className="rounded-xl border border-slate-600 px-5 py-3 text-sm font-semibold text-white transition hover:border-teal-400 hover:text-teal-400"
            >
              Back to Home
            </Link>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-12">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-teal-600">
            Privacy
          </p>

          <h1 className="mt-4 max-w-4xl text-4xl font-bold leading-tight text-slate-900 md:text-5xl">
            Privacy Notice
          </h1>

          <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-600">
            This Privacy Notice explains how Doc Monitor SA collects, uses,
            protects, retains and manages personal information when you use
            our website, contact us or use our record-monitoring services.
          </p>

          <div className="mt-7 flex flex-wrap gap-3 text-sm">
            <span className="rounded-full bg-teal-50 px-4 py-2 font-semibold text-teal-800">
              Minimum-data approach
            </span>

            <span className="rounded-full bg-blue-50 px-4 py-2 font-semibold text-blue-800">
              Secure access controls
            </span>

            <span className="rounded-full bg-slate-100 px-4 py-2 font-semibold text-slate-700">
              Metadata-focused service
            </span>
          </div>

          <p className="mt-6 text-sm text-slate-500">
            Last updated: 7 November 2026
          </p>
        </div>
      </section>

      {/* IMPORTANT MESSAGE */}
      <section className="border-b border-teal-200 bg-teal-50">
        <div className="mx-auto max-w-7xl px-6 py-8">
          <p className="text-lg font-bold text-teal-950">
            Your documents stay with you.
          </p>

          <p className="mt-3 max-w-4xl leading-7 text-teal-900">
            Doc Monitor SA is designed to monitor approved record information,
            important dates, status and follow-up actions. The service does not
            require you to upload the underlying confidential company
            documents as part of the Version 1 monitoring service.
          </p>
        </div>
      </section>

      {/* CONTENT */}
      <section className="mx-auto grid max-w-7xl gap-10 px-6 py-12 lg:grid-cols-[280px_1fr]">
        {/* TABLE OF CONTENTS */}
        <aside className="lg:sticky lg:top-28 lg:self-start">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="font-bold text-slate-900">
              On this page
            </p>

            <nav
              aria-label="Privacy Notice sections"
              className="mt-4 flex flex-col gap-1"
            >
              {sections.map((section) => (
                <a
                  key={section.id}
                  href={`#${section.id}`}
                  className="rounded-lg px-3 py-2 text-sm text-slate-600 transition hover:bg-teal-50 hover:text-teal-800"
                >
                  {section.label}
                </a>
              ))}
            </nav>
          </div>
        </aside>

        {/* PRIVACY CONTENT */}
        <article className="space-y-8">
          <PrivacySection
            id="about"
            number="01"
            title="About this Privacy Notice"
          >
            <p>
              Doc Monitor SA provides business-record monitoring and
              information-management services. This notice explains our
              approach to personal information that may be processed when
              someone visits the website, makes an enquiry, becomes an
              authorised user, or uses the Doc Monitor SA service.
            </p>

            <p>
              The service is intended primarily for businesses and their
              authorised representatives. We aim to collect only the
              information reasonably required to provide and administer the
              requested service.
            </p>
          </PrivacySection>

          <PrivacySection
            id="information"
            number="02"
            title="Information we may collect"
          >
            <p>
              Depending on how you interact with Doc Monitor SA, we may
              process information such as:
            </p>

            <BulletList
              items={[
                "Your name and business contact details.",
                "Company name and business sector.",
                "Email address and telephone number.",
                "Your role or relationship to the client organisation.",
                "Authorised-user and account-access information.",
                "The service package and account status.",
                "Monitoring preferences and authorised contact preferences.",
                "Approved monitored-record metadata.",
                "Record names, categories and folders.",
                "Issue dates, expiry dates and renewal dates.",
                "Record status and risk classification.",
                "Responsible-contact and follow-up information.",
                "Notification, reminder and communication history.",
                "Client confirmations and corrections.",
                "Audit information showing material system changes.",
                "Technical and security information reasonably required to operate and protect the service.",
              ]}
            />
          </PrivacySection>

          <PrivacySection
            id="not-collected"
            number="03"
            title="Information the monitoring service is not designed to collect"
          >
            <p>
              Doc Monitor SA uses a metadata-focused design. Customers should
              not provide unnecessary confidential or sensitive document
              contents through the enquiry form or normal monitoring process.
            </p>

            <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-5">
              <p className="font-bold text-red-900">
                Please do not submit:
              </p>

              <BulletList
                colour="text-red-700"
                items={[
                  "Copies of the underlying confidential company documents.",
                  "Full identity document numbers unless specifically and lawfully required for an approved purpose.",
                  "Bank statements or banking credentials.",
                  "Tax returns.",
                  "Passwords or authentication credentials.",
                  "Sensitive document contents that are not required for monitoring.",
                ]}
              />
            </div>

            <p>
              Where Doc Monitor SA later introduces functionality that requires
              additional categories of information, the privacy and security
              requirements for that functionality should be reviewed before
              collection begins.
            </p>
          </PrivacySection>

          <PrivacySection
            id="purpose"
            number="04"
            title="How we use information"
          >
            <p>
              Personal and business information may be used for purposes
              including:
            </p>

            <BulletList
              items={[
                "Responding to enquiries.",
                "Assessing monitoring requirements and preparing service proposals.",
                "Creating and administering client organisations and authorised accounts.",
                "Providing the agreed monitoring service.",
                "Tracking important dates and follow-up actions.",
                "Preparing and reviewing reminder communications.",
                "Maintaining notification and audit history.",
                "Producing authorised monitoring reports.",
                "Responding to support requests.",
                "Maintaining account and service security.",
                "Managing billing, service administration and contractual obligations.",
                "Complying with applicable legal obligations.",
                "Establishing, exercising or defending legal claims where necessary.",
              ]}
            />
          </PrivacySection>

          <PrivacySection
            id="legal-basis"
            number="05"
            title="Why we process information"
          >
            <p>
              Doc Monitor SA intends to process personal information only where
              there is a lawful and appropriate purpose for doing so.
            </p>

            <p>
              Depending on the circumstances, processing may be necessary to
              respond to a request, enter into or perform a service agreement,
              meet an applicable legal obligation, protect legitimate business
              and security interests, or process information under an
              authorised mandate.
            </p>

            <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-5">
              <p className="font-bold text-amber-950">
                Client and operator responsibilities
              </p>

              <p className="mt-2 text-sm leading-6 text-amber-900">
                Depending on the service and the information being processed,
                the client organisation may determine the purpose for which
                information is processed and Doc Monitor SA may process
                information on the client&apos;s authorised instructions. The
                applicable responsibilities should be addressed in the service
                and data-processing terms.
              </p>
            </div>
          </PrivacySection>

          <PrivacySection
            id="sharing"
            number="06"
            title="Who information may be shared with"
          >
            <p>
              Doc Monitor SA should not sell personal information. Information
              may, where necessary, be made available to carefully selected
              service providers that support the operation of the platform.
            </p>

            <BulletList
              items={[
                "Hosting and web-application service providers.",
                "Database and authentication service providers.",
                "Transactional email providers.",
                "Security, backup and error-monitoring providers.",
                "Professional advisers where reasonably necessary.",
                "Authorities or other parties where disclosure is lawfully required.",
              ]}
            />

            <p>
              Access should be limited to what is reasonably necessary for the
              relevant purpose, and contractual and security safeguards should
              be applied where appropriate.
            </p>
          </PrivacySection>

          <PrivacySection
            id="security"
            number="07"
            title="How we protect information"
          >
            <p>
              Doc Monitor SA is designed around layered technical and
              organisational safeguards. Planned controls include:
            </p>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <SecurityCard
                title="Organisation separation"
                text="Client information is separated so authorised users can access only the organisations and records they are permitted to use."
              />

              <SecurityCard
                title="Role-based access"
                text="Administrator, consultant and client functions are separated according to approved permissions."
              />

              <SecurityCard
                title="Secure authentication"
                text="Secure sessions, password controls and multi-factor authentication for privileged users form part of the production security design."
              />

              <SecurityCard
                title="Encryption"
                text="Reputable managed providers should protect information in transit and at rest using appropriate encryption controls."
              />

              <SecurityCard
                title="Audit history"
                text="Material changes to monitored dates, status and communications may be recorded for accountability and troubleshooting."
              />

              <SecurityCard
                title="Backups and recovery"
                text="Managed backups, controlled exports and tested restoration procedures form part of the production operating controls."
              />
            </div>

            <p>
              No internet-connected system can be guaranteed to be completely
              secure. Security controls should therefore be reviewed and
              improved as the service develops.
            </p>
          </PrivacySection>

          <PrivacySection
            id="retention"
            number="08"
            title="How long we keep information"
          >
            <p>
              Doc Monitor SA aims to keep personal information only for as
              long as it is reasonably required for the purpose for which it
              was collected, to provide the requested service, to meet
              applicable legal or contractual obligations, or to establish,
              exercise or defend a legal claim.
            </p>

            <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
              <RetentionRow
                title="Website enquiries"
                text="Kept only for an appropriate period needed to respond, follow up and maintain reasonable business records, after which information should be deleted or anonymised where it is no longer required."
              />

              <RetentionRow
                title="Active client information"
                text="Kept while reasonably required to provide and administer the agreed service."
              />

              <RetentionRow
                title="Monitoring and notification history"
                text="Retained according to the approved service terms and retention schedule so authorised history, renewal activity and communications can be supported."
              />

              <RetentionRow
                title="Financial, contractual and audit records"
                text="Certain records may be retained for up to seven years where that period is appropriate or legally required."
              />

              <RetentionRow
                title="Legal disputes or claims"
                text="Relevant information may be retained for as long as reasonably necessary to establish, exercise or defend a legal claim."
                last
              />
            </div>

            <div className="mt-5 rounded-2xl border border-teal-200 bg-teal-50 p-5">
              <p className="font-bold text-teal-950">
                Seven years is not a universal retention period
              </p>

              <p className="mt-2 text-sm leading-6 text-teal-900">
                Doc Monitor SA does not intend to keep every enquiry or every
                category of personal information automatically for seven
                years. Information that is no longer reasonably required
                should be securely deleted, destroyed or anonymised, subject
                to applicable legal and contractual requirements.
              </p>
            </div>
          </PrivacySection>

          <PrivacySection
            id="rights"
            number="09"
            title="Your privacy rights"
          >
            <p>
              Subject to applicable law and the circumstances of the request,
              people whose personal information is processed may be able to:
            </p>

            <BulletList
              items={[
                "Ask whether Doc Monitor SA holds personal information about them.",
                "Request access to personal information where applicable.",
                "Request correction or updating of inaccurate information.",
                "Request deletion or destruction where information is no longer lawfully required.",
                "Object to certain processing where applicable.",
                "Ask questions about how personal information is being used.",
                "Raise a privacy or security concern.",
              ]}
            />

            <p>
              Where information is processed on behalf of a client
              organisation, a request may need to be handled together with
              that organisation depending on the respective responsibilities.
            </p>
          </PrivacySection>

          <PrivacySection
            id="cookies"
            number="10"
            title="Cookies and website information"
          >
            <p>
              The public website may use cookies or similar technologies that
              are necessary for security, session management and basic website
              operation.
            </p>

            <p>
              If analytics, advertising cookies or other optional tracking
              technologies are introduced later, the website&apos;s cookie
              information and consent controls should be updated before those
              technologies are enabled.
            </p>
          </PrivacySection>

          <PrivacySection
            id="children"
            number="11"
            title="Children's information"
          >
            <p>
              Doc Monitor SA is a business-focused service and is not intended
              to be used by children. The website and monitoring service
              should not knowingly request personal information directly from
              children for ordinary service registration.
            </p>
          </PrivacySection>

          <PrivacySection
            id="changes"
            number="12"
            title="Changes to this Privacy Notice"
          >
            <p>
              This Privacy Notice may be updated when the Doc Monitor SA
              service, technology, suppliers, legal obligations or processing
              activities change.
            </p>

            <p>
              The date displayed at the top of this page should be updated
              whenever a material revision is published.
            </p>
          </PrivacySection>

          <PrivacySection
            id="contact"
            number="13"
            title="Contact us"
          >
            <p>
              Questions about this Privacy Notice, personal information, data
              corrections or other privacy concerns can be directed to Doc
              Monitor SA.
            </p>

            <div className="mt-5 rounded-2xl bg-slate-900 p-6 text-white">
              <p className="text-lg font-bold">
                Doc Monitor SA
              </p>

              <p className="mt-2 text-slate-300">
                Bloemfontein, Free State, South Africa
              </p>

              <p className="mt-4 text-sm leading-6 text-slate-300">
                A dedicated privacy email address and other formal contact
                details should be published here before commercial launch.
              </p>
            </div>
          </PrivacySection>

          {/* LEGAL REVIEW NOTICE */}
          <div className="rounded-3xl border border-amber-300 bg-amber-50 p-7">
            <p className="font-bold text-amber-950">
              Important legal notice
            </p>

            <p className="mt-3 leading-7 text-amber-900">
              This page is a working privacy-notice draft for the Doc Monitor
              SA product. The final Privacy Notice, retention schedule,
              operator arrangements and customer terms should be reviewed by
              an appropriately qualified South African legal professional
              before the service processes live customer information.
            </p>
          </div>
        </article>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-slate-800 bg-slate-950 text-slate-300">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 py-10 md:grid-cols-3">
          <div className="flex items-start gap-3">
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

              <p className="mt-1 text-xs text-teal-400">
                Your documents. Monitored.
              </p>
            </div>
          </div>

          <div>
            <p className="font-semibold text-white">
              Legal
            </p>

            <div className="mt-4 flex flex-col gap-3 text-sm">
              <Link
                href="/privacy"
                className="text-teal-400"
              >
                Privacy Notice
              </Link>

              <Link
                href="/terms"
                className="transition hover:text-teal-400"
              >
                Terms of Service
              </Link>
            </div>
          </div>

          <div>
            <p className="font-semibold text-white">
              Service
            </p>

            <div className="mt-4 flex flex-col gap-3 text-sm">
              <Link
                href="/"
                className="transition hover:text-teal-400"
              >
                Home
              </Link>

              <Link
                href="/get-started"
                className="transition hover:text-teal-400"
              >
                Get Started
              </Link>

              <Link
                href="/login"
                className="transition hover:text-teal-400"
              >
                Login
              </Link>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-800 px-6 py-6 text-center text-sm text-slate-500">
          © 2026 Doc Monitor SA. All rights reserved.
        </div>
      </footer>
    </main>
  );
}

function PrivacySection({
  id,
  number,
  title,
  children,
}: {
  id: string;
  number: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-32 rounded-3xl border border-slate-200 bg-white p-7 shadow-sm md:p-9"
    >
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-100 text-sm font-bold text-teal-800">
          {number}
        </div>

        <div>
          <h2 className="text-2xl font-bold text-slate-900">
            {title}
          </h2>
        </div>
      </div>

      <div className="mt-6 space-y-4 leading-7 text-slate-600">
        {children}
      </div>
    </section>
  );
}

function BulletList({
  items,
  colour = "text-teal-600",
}: {
  items: string[];
  colour?: string;
}) {
  return (
    <ul className="mt-4 space-y-3">
      {items.map((item) => (
        <li
          key={item}
          className="flex items-start gap-3"
        >
          <span className={`font-bold ${colour}`}>
            ✓
          </span>

          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function SecurityCard({
  title,
  text,
}: {
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
      <p className="font-bold text-slate-900">
        {title}
      </p>

      <p className="mt-2 text-sm leading-6 text-slate-600">
        {text}
      </p>
    </div>
  );
}

function RetentionRow({
  title,
  text,
  last = false,
}: {
  title: string;
  text: string;
  last?: boolean;
}) {
  return (
    <div
      className={`grid gap-2 bg-white p-5 md:grid-cols-[210px_1fr] ${
        !last ? "border-b border-slate-200" : ""
      }`}
    >
      <p className="font-bold text-slate-900">
        {title}
      </p>

      <p className="text-sm leading-6 text-slate-600">
        {text}
      </p>
    </div>
  );
}