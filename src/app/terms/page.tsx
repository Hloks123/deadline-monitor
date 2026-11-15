import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";

const termsSections = [
  {
    id: "status",
    title: "Status and application",
    paragraphs: [
      "These Terms of Service are a draft for review and are not approved terms for commercial use. The final legal entity, effective date and commercial arrangements remain to be confirmed. A written proposal or service order may set out terms for a particular customer, subject to a final agreement.",
      "Deadline Monitor is a software-enabled business monitoring application. These terms must receive qualified South African legal review before they are relied on.",
    ],
  },
  {
    id: "service",
    title: "Service scope",
    paragraphs: [
      "Depending on the applicable proposal and configuration, the service may support client organisations, monitored company-record metadata, issue and expiry dates, responsible contacts, risk and status, follow-ups, reminders, recurring operational tasks, consultant and assistant-consultant workflows, client workspaces, calendars, reports and audit history.",
      "The features, access, implementation, support and service levels available to a customer must be confirmed in the applicable written proposal or service order. Do not assume that a planned or described capability is available in every workspace.",
    ],
  },
  {
    id: "version-one",
    title: "Version 1 boundaries",
    paragraphs: [
      "Version 1 does not store clients' underlying confidential company documents.",
      "Some legacy operational areas continue to use browser localStorage. Recurring-task migration and production deployment remain pending; this draft is not a production-readiness or security guarantee.",
    ],
    bullets: [
      "Do not submit passwords, SARS or CIPC credentials, authentication codes, bank statements, tax returns, full identity numbers or confidential document contents.",
      "Reminder and follow-up features do not guarantee that a message will be delivered or that a deadline will be met.",
      "The service does not provide legal, tax, accounting or regulatory advice and does not automatically prepare or submit regulatory filings.",
    ],
  },
  {
    id: "accounts",
    title: "Accounts and authorised users",
    paragraphs: [
      "Customers must provide accurate account information, maintain the confidentiality of their credentials, use individual accounts as configured, and promptly notify the authorised administrator of suspected unauthorised access. Customer administrators are responsible for assigning and reviewing workspace roles and memberships.",
      "Access is subject to authentication, role, workspace and organisation authorization controls. Customers must not attempt to access another organisation's data or bypass access controls.",
    ],
  },
  {
    id: "responsibilities",
    title: "Client responsibilities",
    paragraphs: [
      "The client remains responsible for the accuracy and lawfulness of information it provides, its underlying documents, and deciding and acting on required renewals, submissions and other obligations.",
    ],
    bullets: [
      "Check the organisation register, record types, responsible contacts, issue dates, expiry dates and follow-up dates, and promptly correct errors.",
      "Keep original and replacement documents in the client's own approved environment; Deadline Monitor is not document storage.",
      "Monitor notifications and task queues, arrange renewals and follow-ups, and retain independent controls for critical dates.",
      "Maintain a current list of authorised users and contacts, and notify the service administrator when authority changes.",
      "Use only approved metadata and avoid putting sensitive or confidential details in notes or completion evidence.",
    ],
  },
  {
    id: "acceptable-use",
    title: "Acceptable use",
    paragraphs: [
      "Customers and users must use the service lawfully, provide only information they are authorised to provide, and not interfere with the service, bypass access controls, upload malicious content, or use the service to harm others.",
    ],
  },
  {
    id: "notifications",
    title: "Reminders, notifications and reports",
    paragraphs: [
      "Reminder dates and reports depend on the metadata and configuration entered into the service. They are operational aids and may be inaccurate, delayed or unavailable. No reminder delivery is guaranteed.",
      "Reports, dashboard statuses, task histories and audit histories do not verify underlying documents or confirm that a legal, tax, contractual or regulatory obligation has been met. Clients must independently verify important dates and outcomes.",
    ],
  },
  {
    id: "advice",
    title: "No compliance or professional-advice guarantee",
    paragraphs: [
      "Deadline Monitor does not guarantee legal, tax, accounting or regulatory compliance, and does not provide legal, tax or other professional advice. No reminder, report, task status or audit history should be treated as a compliance certificate or as a substitute for advice from a qualified professional.",
    ],
  },
  {
    id: "privacy",
    title: "Privacy and information handling",
    paragraphs: [
      "The handling of personal information is described in the draft Privacy Notice. The parties' roles, lawful instructions, access arrangements, security controls, retention and deletion terms, and any provider or cross-border processing arrangements must be confirmed before commercial use.",
    ],
  },
  {
    id: "fees",
    title: "Plans, fees and payment",
    paragraphs: [
      "Any setup fee, subscription, package limits, included features, taxes, invoice schedule, payment due dates, and changes or additional services will be stated in the applicable written proposal or service order. No fee or package term is established by this draft. If applicable, VAT and payment terms must be specified in that written agreement.",
    ],
  },
  {
    id: "intellectual-property",
    title: "Intellectual property",
    paragraphs: [
      "Rights in the application, service materials and customer-provided information must be addressed in the final customer agreement. Except for rights expressly granted in that agreement, no ownership or licence is created by this draft.",
    ],
  },
  {
    id: "confidentiality",
    title: "Confidentiality",
    paragraphs: [
      "Each party should protect information that the other party identifies as confidential and use it only for the agreed service purpose, subject to the final written agreement and applicable law. Detailed confidentiality obligations remain for legal review.",
    ],
  },
  {
    id: "availability",
    title: "Availability and support",
    paragraphs: [
      "Availability, maintenance, support hours, response times, backups, recovery objectives and service levels are not guaranteed by this draft. Any commitments must be stated in the applicable written agreement.",
    ],
  },
  {
    id: "suspension",
    title: "Suspension and termination",
    paragraphs: [
      "The final agreement must describe suspension and termination rights, notice, fees due, data export, retention and deletion at the end of service. Those rights and procedures are not established by this draft.",
    ],
  },
  {
    id: "disclaimers",
    title: "Disclaimers and liability",
    paragraphs: [
      "The service is an operational aid. Customers must independently verify critical dates, source information and required actions. The final terms must define appropriate warranties, exclusions, liability limits and remedies after legal review; this draft does not set those terms.",
    ],
  },
  {
    id: "law",
    title: "Governing law and disputes",
    paragraphs: [
      "The governing law, dispute-resolution process and jurisdiction must be confirmed in the final written agreement following legal review. No specific dispute process is created by this draft.",
    ],
  },
  {
    id: "changes",
    title: "Changes to the service or terms",
    paragraphs: [
      "The service may evolve. The final agreement must explain how changes to service features, terms and fees are communicated and when they take effect. This draft is not notice of a change to an existing customer agreement.",
    ],
  },
  {
    id: "contact",
    title: "Legal and support details",
    paragraphs: [
      "Deadline Monitor is the service and trading name. The legal entity and registration number are pending CIPC registration. The Information Officer is pending confirmation.",
    ],
    bullets: [
      "Service/brand: Deadline Monitor.",
      "Legal entity: Pending CIPC registration.",
      "Registration number: Pending registration.",
      "Temporary general, support and privacy contact: consultant1@compimento.co.za.",
      "Telephone: 073 501 9603.",
      "Address: 5 Second Street, Arboretum, Bloemfontein, 9301, South Africa.",
      "Information Officer: Pending confirmation.",
    ],
  },
  {
    id: "document-control",
    title: "Document control",
    paragraphs: [
      "Status: Draft for qualified South African legal review. Updated 15 November 2026. Effective date: Pending. Final proposal, service order and customer agreement: Pending.",
    ],
  },
];

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Draft Terms of Service for Deadline Monitor, pending qualified legal review.",
  alternates: { canonical: "/terms" },
  openGraph: {
    title: "Terms of Service | Deadline Monitor",
    description: "Draft Terms of Service for Deadline Monitor.",
    url: "/terms",
  },
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-50 border-b border-slate-700 bg-slate-900 text-white">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-3 px-5 py-4 sm:flex-row sm:items-center sm:gap-4">
          <Link href="/" className="flex items-center gap-3">
            <Image src="/deadline-monitor-logo.png" alt="Deadline Monitor logo" width={48} height={48} className="rounded-lg bg-white p-1" />
            <span className="text-lg font-bold">Deadline Monitor</span>
          </Link>
          <nav aria-label="Legal navigation" className="flex flex-wrap gap-4 text-sm font-semibold">
            <Link href="/privacy" className="hover:text-teal-300">Privacy</Link>
            <Link href="/" className="hover:text-teal-300">Home</Link>
          </nav>
        </div>
      </header>

      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-5xl px-5 py-12">
          <p className="font-bold uppercase tracking-[0.18em] text-teal-700">Draft for review</p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl">Terms of Service</h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-600">
            These draft terms describe the intended service boundaries and customer responsibilities. They are not approved for commercial use.
          </p>
          <p className="mt-5 text-sm text-slate-500">Last updated: 15 November 2026 · Republic of South Africa</p>
        </div>
      </section>

      <section className="border-b border-amber-200 bg-amber-50">
        <div className="mx-auto max-w-5xl px-5 py-6">
          <h2 className="font-bold text-amber-950">Draft — qualified South African legal review required</h2>
          <p className="mt-2 leading-7 text-amber-900">
            These terms are not final or approved for commercial use. Have the terms and privacy arrangements reviewed by qualified South African legal and privacy professionals before relying on them.
          </p>
        </div>
      </section>

      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-5 py-10 lg:grid-cols-[260px_1fr]">
        <aside className="min-w-0 lg:sticky lg:top-28 lg:self-start">
          <nav aria-label="Terms sections" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-bold">On this page</h2>
            <ul className="mt-3 space-y-2 text-sm text-teal-800">
              {termsSections.map((section) => (
                <li key={section.id}><a className="hover:underline" href={`#${section.id}`}>{section.title}</a></li>
              ))}
            </ul>
          </nav>
        </aside>

        <article className="min-w-0 space-y-5">
          {termsSections.map((section, index) => (
            <section key={section.id} id={section.id} className="scroll-mt-32 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <p className="text-sm font-bold uppercase tracking-wider text-teal-700">{String(index + 1).padStart(2, "0")}</p>
              <h2 className="mt-2 text-xl font-bold text-slate-950 sm:text-2xl">{section.title}</h2>
              <div className="mt-4 space-y-4 leading-7 text-slate-700">
                {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              </div>
              {section.id === "privacy" && (
                <p className="mt-4 leading-7 text-slate-700">
                  Read the <Link href="/privacy" className="font-semibold text-teal-800 underline underline-offset-2">Deadline Monitor Privacy Notice</Link>.
                </p>
              )}
              {section.bullets && (
                <ul className="mt-4 list-disc space-y-2 pl-6 leading-7 text-slate-700">
                  {section.bullets.map((item) => <li key={item}>{item}</li>)}
                </ul>
              )}
            </section>
          ))}
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
            <Link href="/privacy" className="hover:text-teal-300">Privacy</Link>
            <Link href="/terms" className="text-teal-300">Terms</Link>
          </nav>
        </div>
      </footer>
    </main>
  );
}
