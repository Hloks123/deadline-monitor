"use client";

import { FormEvent, useState } from "react";
import { Client, ClientContact, getClients, ServicePackage, saveClient } from "@/lib/clientStore";

type ClientFormProps = {
  initialClient?: Client;
  onSaved: (client: Client) => void;
};

const fieldClass = "mt-2 min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3 text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100";

function slug(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export default function ClientForm({ initialClient, onSaved }: ClientFormProps) {
  const [company, setCompany] = useState(initialClient?.company || "");
  const [servicePackage, setServicePackage] = useState<ServicePackage>(initialClient?.servicePackage || "Starter");
  const [status, setStatus] = useState<Client["status"]>(initialClient?.status || "Pilot");
  const [reminderPreference, setReminderPreference] = useState<Client["reminderPreference"]>(initialClient?.reminderPreference || "Email");
  const [contacts, setContacts] = useState<ClientContact[]>(initialClient?.contacts || [{
    id: "primary-contact",
    name: "",
    role: "",
    email: "",
    phone: "",
    primary: true,
    authorised: true,
  }]);
  const [error, setError] = useState("");

  function updateContact(index: number, patch: Partial<ClientContact>) {
    setContacts((current) => current.map((contact, item) => item === index ? { ...contact, ...patch } : contact));
  }

  function addContact() {
    setContacts((current) => [...current, {
      id: `contact-${crypto.randomUUID()}`,
      name: "",
      role: "",
      email: "",
      phone: "",
      primary: false,
      authorised: true,
    }]);
  }

  function makePrimary(index: number) {
    setContacts((current) => current.map((contact, item) => ({ ...contact, primary: item === index })));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const authorised = contacts.filter((contact) => contact.authorised);
    if (!company.trim() || authorised.length === 0 || !authorised.some((contact) => contact.email.trim())) {
      setError("Enter the organisation name and at least one authorised contact with an email address.");
      return;
    }
    if (contacts.some((contact) => contact.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email.trim()))) {
      setError("Enter a valid email address for each contact.");
      return;
    }
    const baseId = slug(company) || `client-${Date.now()}`;
    let id = initialClient?.id || baseId;
    let suffix = 2;
    const existingIds = new Set(getClients().map((client) => client.id));
    while (!initialClient && existingIds.has(id)) {
      id = `${baseId}-${suffix}`;
      suffix += 1;
    }
    const primaryIndex = contacts.findIndex((contact) => contact.primary && contact.authorised);
    const client: Client = {
      id,
      company: company.trim(),
      servicePackage,
      status,
      reminderPreference,
      contacts: contacts.map((contact, index) => ({ ...contact, primary: contact.authorised && index === (primaryIndex === -1 ? contacts.findIndex((item) => item.authorised) : primaryIndex) })),
    };
    try {
      saveClient(client);
      setError("");
      onSaved(client);
    } catch (saveError) {
      console.error("Could not save client.", saveError);
      setError("The client could not be saved. Check local storage availability and try again.");
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">{error}</p>}
      <section className="grid gap-5 rounded-2xl border border-slate-200 bg-white p-6 sm:grid-cols-2">
        <label className="font-semibold text-slate-700 sm:col-span-2">Organisation/company name<input required value={company} onChange={(event) => setCompany(event.target.value)} className={fieldClass} /></label>
        <label className="font-semibold text-slate-700">Service package<select value={servicePackage} onChange={(event) => setServicePackage(event.target.value as ServicePackage)} className={fieldClass}><option>Starter</option><option>Standard</option><option>Managed</option><option>Custom</option></select></label>
        <label className="font-semibold text-slate-700">Service status<select value={status} onChange={(event) => setStatus(event.target.value as Client["status"])} className={fieldClass}><option>Active</option><option>Pilot</option><option>Suspended</option></select></label>
        <label className="font-semibold text-slate-700 sm:col-span-2">Reminder preference<select value={reminderPreference} onChange={(event) => setReminderPreference(event.target.value as Client["reminderPreference"])} className={fieldClass}><option>Email</option><option>Phone</option><option>WhatsApp</option></select></label>
      </section>
      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-bold text-slate-950">Authorised contacts</h2><p className="mt-1 text-sm text-slate-500">Only collect business contact details needed for service.</p></div><button type="button" onClick={addContact} className="min-h-[40px] rounded-lg border border-slate-300 px-4 font-semibold text-slate-700">Add contact</button></div>
        {contacts.map((contact, index) => <fieldset key={contact.id} className="grid gap-4 rounded-xl border border-slate-200 p-4 sm:grid-cols-2"><legend className="px-2 font-semibold text-slate-700">Contact {index + 1}</legend>
          <label className="font-medium text-slate-700">Name<input required={contact.authorised} value={contact.name} onChange={(event) => updateContact(index, { name: event.target.value })} className={fieldClass} /></label>
          <label className="font-medium text-slate-700">Role<input value={contact.role} onChange={(event) => updateContact(index, { role: event.target.value })} className={fieldClass} /></label>
          <label className="font-medium text-slate-700">Business email<input type="email" required={contact.authorised} value={contact.email} onChange={(event) => updateContact(index, { email: event.target.value })} className={fieldClass} /></label>
          <label className="font-medium text-slate-700">Telephone (optional)<input type="tel" value={contact.phone || ""} onChange={(event) => updateContact(index, { phone: event.target.value })} className={fieldClass} /></label>
          <div className="flex flex-wrap gap-5 sm:col-span-2"><label className="flex items-center gap-2"><input type="checkbox" checked={contact.authorised} onChange={(event) => updateContact(index, { authorised: event.target.checked, primary: event.target.checked && contact.primary })} />Authorised</label><label className="flex items-center gap-2"><input type="radio" name={`primary-${initialClient?.id || "new"}`} checked={contact.primary} onChange={() => makePrimary(index)} />Primary contact</label>{contacts.length > 1 && <button type="button" onClick={() => setContacts((current) => current.filter((_, item) => item !== index))} className="font-semibold text-red-700">Remove contact</button>}</div>
        </fieldset>)}
      </section>
      <button type="submit" className="min-h-[46px] rounded-xl bg-teal-600 px-6 font-semibold text-white hover:bg-teal-700">{initialClient ? "Save Client" : "Create Client"}</button>
    </form>
  );
}
