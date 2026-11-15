"use client";

import { FormEvent, useState } from "react";
import type {
  ManagedOrganisation,
  ManagedOrganisationContact,
} from "@/lib/admin/organisations";

type OrganisationFormProps = {
  initialOrganisation?: ManagedOrganisation;
  lockName?: boolean;
  onSaved: () => void;
};

const fieldClass =
  "mt-2 min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3 text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100";

type ContactDraft = {
  key: string;
  name: string;
  email: string;
  phone: string;
  role_title: string;
  authorised: boolean;
  primary_contact: boolean;
};

function contactDraft(contact?: ManagedOrganisationContact): ContactDraft {
  return {
    key: contact?.id || crypto.randomUUID(),
    name: contact?.name || "",
    email: contact?.email || "",
    phone: contact?.phone || "",
    role_title: contact?.role_title || "",
    authorised: contact?.authorised ?? true,
    primary_contact: contact?.primary_contact ?? true,
  };
}

function preferredReminderChannel(value: unknown) {
  if (
    typeof value === "object" &&
    value !== null &&
    "preferredChannel" in value &&
    typeof value.preferredChannel === "string" &&
    ["email", "phone", "whatsapp"].includes(value.preferredChannel)
  ) {
    return value.preferredChannel;
  }
  return "email";
}

export default function OrganisationForm({
  initialOrganisation,
  lockName = false,
  onSaved,
}: OrganisationFormProps) {
  const [name, setName] = useState(initialOrganisation?.name || "");
  const [registrationNumber, setRegistrationNumber] = useState(
    initialOrganisation?.registration_number || "",
  );
  const [servicePackage, setServicePackage] = useState(
    initialOrganisation?.service_package || "starter",
  );
  const [status, setStatus] = useState(initialOrganisation?.status || "pilot");
  const [timezone, setTimezone] = useState(
    initialOrganisation?.timezone || "Africa/Johannesburg",
  );
  const [reminderChannel, setReminderChannel] = useState(
    preferredReminderChannel(initialOrganisation?.reminder_preferences),
  );
  const [organisationId, setOrganisationId] = useState(initialOrganisation?.id || "");
  const [contacts, setContacts] = useState<ContactDraft[]>(() =>
    initialOrganisation?.contacts?.length
      ? initialOrganisation.contacts.map((contact) => contactDraft(contact))
      : [contactDraft()],
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function updateContact(index: number, patch: Partial<ContactDraft>) {
    setContacts((current) =>
      current.map((contact, item) =>
        item === index ? { ...contact, ...patch } : contact,
      ),
    );
  }

  function setPrimaryContact(index: number) {
    setContacts((current) =>
      current.map((contact, item) => ({
        ...contact,
        primary_contact: item === index,
      })),
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const authorisedContacts = contacts.filter((contact) => contact.authorised);
    if (
      contacts.some((contact) => !contact.name.trim()) ||
      authorisedContacts.length === 0 ||
      !authorisedContacts.some((contact) => contact.email.trim()) ||
      authorisedContacts.filter((contact) => contact.primary_contact).length !== 1
    ) {
      setError(
        "Add a name and valid email for at least one authorised contact, and choose exactly one primary contact.",
      );
      return;
    }

    setBusy(true);
    setError("");

    try {
      const response = await fetch(
        organisationId
          ? `/api/admin/organisations/${organisationId}`
          : "/api/admin/organisations",
        {
          method: organisationId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            registrationNumber,
            servicePackage,
            status,
            timezone,
            reminderChannel,
          }),
        },
      );
      const result = (await response.json()) as {
        error?: string;
        organisation?: { id: string };
      };
      if (!response.ok) {
        setError(result.error || "The organisation could not be saved.");
        return;
      }
      const savedOrganisationId = result.organisation?.id || organisationId;
      if (!savedOrganisationId) {
        setError("The organisation was saved, but its details could not be verified.");
        return;
      }
      setOrganisationId(savedOrganisationId);

      const contactsResponse = await fetch(
        `/api/admin/organisations/${savedOrganisationId}/contacts`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contacts: contacts.map((contact) => ({
              name: contact.name,
              email: contact.email,
              phone: contact.phone,
              roleTitle: contact.role_title,
              authorised: contact.authorised,
              primary: contact.primary_contact,
            })),
          }),
        },
      );
      const contactsResult = (await contactsResponse.json()) as { error?: string };
      if (!contactsResponse.ok) {
        setError(
          contactsResult.error ||
            "The organisation was saved, but its authorised contacts could not be saved. Review and retry.",
        );
        return;
      }
      onSaved();
    } catch {
      setError(
        organisationId
          ? "The organisation could not be saved. Check your connection and try again."
          : "The organisation or its contacts could not be saved. Check your connection and retry.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <p className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
        Organisation and authorised-contact details are stored in the secured client directory.
      </p>
      {initialOrganisation && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          Administrative changes prepare an audit event, but persistent audit history is not available until its canonical audit table is introduced.
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </p>
      )}
      <section className="grid gap-5 rounded-2xl border border-slate-200 bg-white p-6 sm:grid-cols-2">
        <label className="font-semibold text-slate-700 sm:col-span-2">
          Organisation name
          <input required maxLength={200} disabled={lockName} value={name} onChange={(event) => setName(event.target.value)} className={`${fieldClass} ${lockName ? "cursor-not-allowed bg-slate-100" : ""}`} />
        </label>
        <label className="font-semibold text-slate-700">
          Registration number
          <input maxLength={100} value={registrationNumber} onChange={(event) => setRegistrationNumber(event.target.value)} className={fieldClass} />
        </label>
        <label className="font-semibold text-slate-700">
          Service package
          <select value={servicePackage} onChange={(event) => setServicePackage(event.target.value)} className={fieldClass}>
            <option value="starter">Starter</option>
            <option value="standard">Standard</option>
            <option value="managed">Managed</option>
            <option value="custom">Custom</option>
          </select>
        </label>
        <label className="font-semibold text-slate-700">
          Service status
          <select value={status} onChange={(event) => setStatus(event.target.value)} className={fieldClass}>
            <option value="active">Active</option>
            <option value="pilot">Pilot</option>
            <option value="suspended">Suspended</option>
          </select>
        </label>
        <label className="font-semibold text-slate-700">
          Time zone
          <input required value={timezone} onChange={(event) => setTimezone(event.target.value)} className={fieldClass} />
        </label>
        <label className="font-semibold text-slate-700 sm:col-span-2">
          Reminder preference
          <select value={reminderChannel} onChange={(event) => setReminderChannel(event.target.value)} className={fieldClass}>
            <option value="email">Email</option>
            <option value="phone">Phone</option>
            <option value="whatsapp">WhatsApp</option>
          </select>
        </label>
      </section>
      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-slate-950">Authorised contacts</h2>
            <p className="mt-1 text-sm text-slate-500">At least one authorised contact with a business email is required.</p>
          </div>
          <button
            type="button"
            onClick={() =>
              setContacts((current) => [...current, contactDraft({
                id: "",
                name: "",
                email: "",
                phone: "",
                role_title: "",
                authorised: true,
                primary_contact: false,
              })])}
            className="min-h-10 cursor-pointer rounded-lg border border-slate-300 px-4 font-semibold text-slate-700"
          >
            Add contact
          </button>
        </div>
        {contacts.map((contact, index) => (
          <fieldset key={contact.key} className="grid gap-4 rounded-xl border border-slate-200 p-4 sm:grid-cols-2">
            <legend className="px-2 font-semibold text-slate-700">Contact {index + 1}</legend>
            <label className="font-medium text-slate-700">
              Name
              <input required value={contact.name} onChange={(event) => updateContact(index, { name: event.target.value })} className={fieldClass} />
            </label>
            <label className="font-medium text-slate-700">
              Role
              <input maxLength={80} value={contact.role_title} onChange={(event) => updateContact(index, { role_title: event.target.value })} className={fieldClass} />
            </label>
            <label className="font-medium text-slate-700">
              Business email
              <input type="email" required={contact.authorised} value={contact.email} onChange={(event) => updateContact(index, { email: event.target.value })} className={fieldClass} />
            </label>
            <label className="font-medium text-slate-700">
              Telephone
              <input type="tel" maxLength={40} value={contact.phone} onChange={(event) => updateContact(index, { phone: event.target.value })} className={fieldClass} />
            </label>
            <div className="flex flex-wrap items-center gap-5 sm:col-span-2">
              <label className="flex cursor-pointer items-center gap-2">
                <input type="checkbox" checked={contact.authorised} onChange={(event) => updateContact(index, { authorised: event.target.checked, primary_contact: event.target.checked && contact.primary_contact })} />
                Authorised
              </label>
              <label className="flex cursor-pointer items-center gap-2">
                <input type="radio" name="primary-contact" checked={contact.primary_contact} onChange={() => setPrimaryContact(index)} />
                Primary contact
              </label>
              {contacts.length > 1 && (
                <button
                  type="button"
                  onClick={() => setContacts((current) => current.filter((_, item) => item !== index))}
                  className="cursor-pointer font-semibold text-red-700"
                >
                  Remove contact
                </button>
              )}
            </div>
          </fieldset>
        ))}
      </section>
      <button
        type="submit"
        disabled={busy}
        className={`min-h-[46px] rounded-xl bg-teal-600 px-6 font-semibold text-white hover:bg-teal-700 ${busy ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
      >
        {busy ? "Saving…" : organisationId ? "Save Organisation" : "Create Organisation"}
      </button>
    </form>
  );
}
