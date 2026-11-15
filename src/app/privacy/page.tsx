import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";

const privacySections = [
  {
    id: "purpose",
    title: "Purpose and scope",
    paragraphs: [
      "This draft explains how personal information may be processed when people visit the Deadline Monitor website, make an enquiry, or use the business monitoring application. It is for review and is not final legal advice or a final privacy commitment.",
      "Deadline Monitor is a software-enabled business monitoring application. Version 1 does not store clients' underlying confidential company documents.",
    ],
  },
  {
    id: "who-we-are",
    title: "Who we are",
    paragraphs: [
      "Deadline Monitor is the service and trading name. The legal entity is pending CIPC registration and no registration number is available for publication.",
      "The current contact email is consultant1@compimento.co.za. It is a temporary contact address; a dedicated @deadlinemonitor.co.za address is not configured.",
    ],
  },
  {
    id: "roles",
    title: "POPIA roles",
    paragraphs: [
      "The roles of the client organisation and the entity that will operate Deadline Monitor depend on the processing activity and must be confirmed in the applicable agreement after legal review. A client may determine the purpose and means of processing for its organisation; a service provider may process information on documented instructions.",
      "The final legal entity and the Information Officer have not been confirmed. This draft does not make a final determination of any party's legal role.",
    ],
  },
  {
    id: "information",
    title: "Personal information collected",
    paragraphs: ["Depending on how the service is used, information may include:"],
    bullets: [
      "Business and organisation details, including business contact information.",
      "Account, workspace, role and organisation-membership information for authorised people.",
      "Monitored company-record metadata, including categories, issue and expiry dates, status, risk, responsible contacts and follow-up dates.",
      "Reminder, calendar, reporting and audit-history information associated with application activity.",
      "Information entered into legacy operational areas, which may remain in browser localStorage.",
      "Technical and security information needed to authenticate users, authorize access and operate the service.",
    ],
  },
  {
    id: "not-collected",
    title: "Information excluded from Version 1",
    paragraphs: ["Do not upload or enter the following into the application or enquiry:"],
    bullets: [
      "Underlying confidential company documents or document files.",
      "Full identity numbers, bank statements, tax returns or confidential document contents.",
      "Passwords, authentication codes, SARS or CIPC credentials, or other third-party login credentials.",
      "Unnecessary special personal information.",
    ],
    emphasis: true,
  },
  {
    id: "collection",
    title: "Collection methods",
    paragraphs: [
      "Information may be provided by an organisation or its authorised users through the application or through direct contact. The public enquiry form opens a prefilled email; the website does not independently transmit or store that enquiry.",
      "Authentication, workspace and application activity may also produce technical or audit information. Final provider-specific collection details remain subject to the provider register and legal review.",
    ],
  },
  {
    id: "purposes",
    title: "Purposes for processing",
    paragraphs: [
      "Information may be used to respond to enquiries, provide access to the application, manage organisation workspaces, monitor approved record metadata and dates, support reminders and follow-ups, produce reports and audit history, protect the service, and meet applicable legal obligations.",
    ],
  },
  {
    id: "lawful-grounds",
    title: "Lawful grounds",
    paragraphs: [
      "The appropriate lawful ground must be determined for each processing purpose and documented by the responsible party or operator as applicable. This draft does not assert that a particular ground applies to every activity; legal review is pending.",
    ],
  },
  {
    id: "special-information",
    title: "Special personal information and children",
    paragraphs: [
      "The service is intended for business use and is not intended to collect children's information or special personal information. Do not submit such information unless a separately reviewed lawful requirement and approved feature expressly allow it.",
    ],
  },
  {
    id: "cookies",
    title: "Cookies and similar technologies",
    paragraphs: [
      "The authenticated application may use browser storage or cookies required for authentication and functionality. Some legacy operational domains continue to use browser localStorage. The public enquiry form itself does not store its contents. Optional analytics or advertising technologies must not be enabled without an appropriate review and notice.",
    ],
  },
  {
    id: "sharing",
    title: "Sharing of personal information",
    paragraphs: [
      "Information may be accessible to authorised users within the relevant organisation and to authorised service personnel as required to provide, support or secure the service. It may also be disclosed to service providers, professional advisers or public authorities where lawfully required. The final provider register and contractual arrangements remain pending.",
    ],
  },
  {
    id: "cross-border",
    title: "Cross-border processing",
    paragraphs: [
      "Provider locations, international access and any applicable cross-border safeguards have not been fully confirmed. A provider and transborder-processing assessment must be completed before production processing.",
    ],
  },
  {
    id: "security",
    title: "Security safeguards",
    paragraphs: [
      "Supabase authentication, workspace roles and organisation memberships, authenticated server access checks and row-level security (RLS) for shared Supabase data are implemented. Monitored-record create, read, update and delete operations and their history have been migrated and locally verified.",
      "Some legacy operational domains still use browser localStorage. Recurring-task migration has an approved design but is not implemented. Production database deployment, production configuration and a final security-readiness assessment remain pending. These facts do not amount to a certification or guarantee.",
    ],
  },
  {
    id: "retention",
    title: "Retention and deletion",
    paragraphs: [
      "Information should be retained only as long as needed for its documented purpose and applicable legal obligations. Final retention periods, export arrangements, deletion procedures and backup handling have not been approved or configured in this draft.",
    ],
  },
  {
    id: "rights",
    title: "Data-subject rights",
    paragraphs: [
      "Individuals may have rights under applicable law to request access to, correction of or deletion of personal information, or to raise an objection, subject to the law and circumstances. A request involving information processed for a client may need to be handled with that client.",
    ],
  },
  {
    id: "requests",
    title: "Privacy-request process",
    paragraphs: [
      "Send a privacy question or request to consultant1@compimento.co.za or call 073 501 9603. Requests will be directed to the appropriate responsible party or authorised contact. The final verification, response and escalation procedure remains to be documented.",
    ],
  },
  {
    id: "marketing",
    title: "Direct marketing",
    paragraphs: [
      "This draft does not establish a direct-marketing programme. Any direct marketing must be reviewed for a lawful basis, required notices, consent and a practical opt-out process before it begins.",
    ],
  },
  {
    id: "incidents",
    title: "Information incidents and breach notification",
    paragraphs: [
      "Suspected loss of or unauthorised access to personal information should be escalated promptly through the applicable incident process. The parties must assess containment, investigation and any notification duties under applicable law. The final contacts, timing and responsibilities remain pending confirmation of the legal entity and Information Officer.",
    ],
  },
  {
    id: "third-parties",
    title: "Third-party links and services",
    paragraphs: [
      "The website may link to third-party services. Their privacy practices are governed by their own notices. Hosting, database, authentication, email, backup and support providers, their locations and applicable agreements must be listed and reviewed before production use.",
    ],
  },
  {
    id: "client-responsibilities",
    title: "Client responsibilities",
    paragraphs: [
      "Client organisations are responsible for ensuring that information they provide is accurate, lawfully obtained and appropriate for the agreed monitoring purpose; for notifying users; for maintaining authorised-user access; and for keeping underlying confidential documents in their own approved environment.",
    ],
  },
  {
    id: "changes",
    title: "Changes to this policy",
    paragraphs: [
      "This draft may be revised as the product, providers and legal arrangements change. A final effective date and process for notifying affected people must be set before the policy is approved.",
    ],
  },
  {
    id: "complaints",
    title: "Complaints and contact information",
    paragraphs: [
      "For a privacy question or complaint, use the temporary contact email or telephone number below. The legal entity and Information Officer are pending confirmation. Current Information Regulator contact details must be independently verified before publication; none are invented here.",
    ],
    bullets: [
      "Service/trading name: Deadline Monitor.",
      "Legal entity: Pending CIPC registration.",
      "Registration number: Pending registration.",
      "Email: consultant1@compimento.co.za.",
      "Telephone: 073 501 9603.",
      "Address: 5 Second Street, Arboretum, Bloemfontein, 9301, South Africa.",
      "Information Officer: Pending confirmation.",
    ],
  },
  {
    id: "publication-checklist",
    title: "Publication checklist",
    paragraphs: [
      "Before approval, confirm the registered legal entity and number, Information Officer, final effective date, retention periods, provider register, transborder-processing assessment, verified Information Regulator details, privacy-request process and qualified South African legal/privacy review.",
    ],
  },
  {
    id: "document-control",
    title: "Document control",
    paragraphs: [
      "Status: Draft for legal and privacy review. Updated 15 November 2026. Effective date: Pending. This document must not be treated as approved for commercial use.",
    ],
  },
];

export const metadata: Metadata = {
  title: "Privacy Notice",
  description: "Draft Privacy Notice for Deadline Monitor, pending legal and privacy review.",
  alternates: { canonical: "/privacy" },
  openGraph: {
    title: "Privacy Notice | Deadline Monitor",
    description: "Draft Privacy Notice for Deadline Monitor.",
    url: "/privacy",
  },
};

function Section({
  section,
  number,
}: {
  section: (typeof privacySections)[number];
  number: number;
}) {
  return (
    <section
      id={section.id}
      className={`scroll-mt-28 rounded-2xl border p-6 shadow-sm sm:p-8 ${
        section.emphasis
          ? "border-red-200 bg-red-50"
          : "border-slate-200 bg-white"
      }`}
    >
      <p className="text-sm font-bold uppercase tracking-wider text-teal-700">
        {String(number).padStart(2, "0")}
      </p>
      <h2 className="mt-2 text-xl font-bold text-slate-950 sm:text-2xl">
        {section.title}
      </h2>
      <div className="mt-4 space-y-4 leading-7 text-slate-700">
        {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
      </div>
      {section.bullets && (
        <ul className="mt-4 list-disc space-y-2 pl-6 leading-7 text-slate-700">
          {section.bullets.map((item) => <li key={item}>{item}</li>)}
        </ul>
      )}
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-700 bg-slate-900 text-white">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-3 px-5 py-4 sm:flex-row sm:items-center sm:gap-4">
          <Link href="/" className="flex items-center gap-3">
            <Image src="/deadline-monitor-logo.png" alt="Deadline Monitor logo" width={48} height={48} className="rounded-lg bg-white p-1" />
            <span className="text-lg font-bold">Deadline Monitor</span>
          </Link>
          <nav aria-label="Legal navigation" className="flex flex-wrap gap-4 text-sm font-semibold">
            <Link href="/terms" className="hover:text-teal-300">Terms</Link>
            <Link href="/" className="hover:text-teal-300">Home</Link>
          </nav>
        </div>
      </header>

      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-5xl px-5 py-12">
          <p className="font-bold uppercase tracking-[0.18em] text-teal-700">Draft for review · South Africa</p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl">Privacy Notice</h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-600">
            This draft describes how personal information may be handled by Deadline Monitor. It must receive qualified South African privacy and legal review before commercial use.
          </p>
          <p className="mt-5 text-sm text-slate-500">Last updated: 15 November 2026</p>
        </div>
      </section>

      <section className="border-b border-amber-200 bg-amber-50">
        <div className="mx-auto max-w-5xl px-5 py-6">
          <h2 className="font-bold text-amber-950">Draft — not approved for commercial launch</h2>
          <p className="mt-2 leading-7 text-amber-900">
            The legal entity and Information Officer are pending confirmation. Providers, cross-border arrangements and the final retention schedule remain to be confirmed. Do not treat this draft as confirmation that production safeguards or legal arrangements are in place.
          </p>
        </div>
      </section>

      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-5 py-10 lg:grid-cols-[260px_1fr]">
        <aside className="min-w-0 lg:sticky lg:top-6 lg:self-start">
          <nav aria-label="Privacy notice sections" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-bold">On this page</h2>
            <ul className="mt-3 space-y-2 text-sm text-teal-800">
              {privacySections.map((section) => (
                <li key={section.id}><a className="hover:underline" href={`#${section.id}`}>{section.title}</a></li>
              ))}
            </ul>
          </nav>
        </aside>
        <article className="min-w-0 space-y-5">
          {privacySections.map((section, index) => <Section key={section.id} section={section} number={index + 1} />)}
        </article>
      </div>

      <footer className="bg-slate-950 text-slate-300">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-8 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold text-white">Deadline Monitor · Legal entity pending CIPC registration</p>
            <a className="mt-2 inline-block text-sm text-teal-300 underline underline-offset-2" href="mailto:consultant1@compimento.co.za">consultant1@compimento.co.za</a>
            <a className="mt-1 block text-sm text-teal-300 underline underline-offset-2" href="tel:+27735019603">073 501 9603</a>
            <p className="mt-1 text-sm">5 Second Street, Arboretum, Bloemfontein, 9301, South Africa</p>
          </div>
          <nav aria-label="Footer legal navigation" className="flex gap-5 text-sm">
            <Link href="/privacy" className="text-teal-300">Privacy</Link>
            <Link href="/terms" className="hover:text-teal-300">Terms</Link>
          </nav>
        </div>
      </footer>
    </main>
  );
}
