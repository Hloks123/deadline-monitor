"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useRouter } from "next/navigation";

import WorkspaceShell from "@/components/workspace/WorkspaceShell";

import {
  calculateEscalation,
  calculateStatus,
  categoryOptions,
  CategoryOne,
  MonitoredRecord,
} from "@/lib/recordStore";
import {
  httpMonitoredRecordRepository,
  loadAccessibleOrganisations,
  type MonitoredOrganisation,
} from "@/lib/monitoredRecords/repository";
import { clientBusinessToday } from "@/lib/clientWorkspaceSelectors";

const inputClass =
  "mt-2 min-h-[46px] w-full rounded-xl border border-slate-300 bg-white px-4 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100";

const categoryOneOptions = Object.keys(
  categoryOptions
) as CategoryOne[];

export default function NewRecordPage() {
  const router = useRouter();

  const [saving, setSaving] =
    useState(false);

  const [error, setError] = useState("");

  const [clients, setClients] = useState<MonitoredOrganisation[]>([]);
  const [loadingOrganisations, setLoadingOrganisations] = useState(true);

  useEffect(() => {
    let active = true;
    void loadAccessibleOrganisations()
      .then((organisations) => {
        if (active) setClients(organisations);
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(cause instanceof Error ? cause.message : "Organisations could not be loaded.");
        }
      })
      .finally(() => {
        if (active) setLoadingOrganisations(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const [form, setForm] = useState({
    name: "",

    organisationId: "",
    organisation: "",

    category:
      "Company Documents" as CategoryOne,

    category2:
      categoryOptions[
        "Company Documents"
      ][0],

    issueDate: "",
    expiryDate: "",

    risk:
      "Low" as MonitoredRecord["risk"],

    contactId: "",
    contact: "",
    contactEmail: "",

    followUp: "",
    confirmedBy: "",
    confirmationMethod: "Email",
    dataSource:
      "Client-approved starting register",

    reminderDays: [
      60,
      30,
      14,
      7,
      0,
    ],
  });

  const contacts = useMemo(
    () => clients.find((client) => client.id === form.organisationId)
      ?.contacts.filter((contact) => contact.authorised) || [],
    [clients, form.organisationId]
  );

  function updateField(
    field: keyof typeof form,
    value:
      | string
      | number[]
      | CategoryOne
  ) {
    setError("");

    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function changeOrganisation(
    organisationId: string
  ) {
    const client = clients.find(
      (item) =>
        item.id === organisationId
    );

    const primaryContact =
      client?.contacts.find(
        (contact) =>
          contact.primary_contact &&
          contact.authorised
      ) ||
      client?.contacts.find(
        (contact) =>
          contact.authorised
      );

    setForm((current) => ({
      ...current,

      organisationId,

      organisation:
        client?.name || "",

      contactId:
        primaryContact?.id || "",

      contact:
        primaryContact?.name || "",

      contactEmail:
        primaryContact?.email || "",

      confirmedBy:
        primaryContact?.name || "",
    }));
  }

  function changeContact(
    contactId: string
  ) {
    const contact = contacts.find(
      (item) => item.id === contactId
    );

    setForm((current) => ({
      ...current,
      contactId,
      contact: contact?.name || "",
      contactEmail:
        contact?.email || "",
    }));
  }

  function changeCategory(
    category: CategoryOne
  ) {
    setForm((current) => ({
      ...current,
      category,
      category2:
        categoryOptions[category][0],
    }));
  }

  function toggleReminderDay(
    day: number
  ) {
    setForm((current) => {
      const exists =
        current.reminderDays.includes(day);

      const reminderDays = exists
        ? current.reminderDays.filter(
            (item) => item !== day
          )
        : [
            ...current.reminderDays,
            day,
          ].sort((a, b) => b - a);

      return {
        ...current,
        reminderDays,
      };
    });
  }

  async function save(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (
      !form.name.trim() ||
      !form.organisationId ||
      !form.contactId ||
      !form.issueDate ||
      !form.expiryDate ||
      !form.followUp
    ) {
      setError(
        "Complete all required fields."
      );

      return;
    }

    if (
      new Date(
        `${form.expiryDate}T00:00:00`
      ) <=
      new Date(
        `${form.issueDate}T00:00:00`
      )
    ) {
      setError(
        "Expiry Date must be later than Issue Date."
      );

      return;
    }

    setSaving(true);
    setError("");
    try {
      const initialStatus:
        MonitoredRecord["status"] =
          "Current";

      const baseRecord = {
        ...form,
        status: initialStatus,
        escalationLevel: "Normal",

        lastConfirmed: clientBusinessToday(),
      };

      const record = {
        ...baseRecord,

        status:
          calculateStatus(baseRecord),

        escalationLevel:
          calculateEscalation(
            baseRecord
          ),
      };

      const saved = await httpMonitoredRecordRepository.create(
        form.organisationId,
        record,
      );
      router.push(
        `/monitored-records/${saved.id}`
      );

      router.refresh();
    } catch (cause: unknown) {
      setSaving(false);
      setError(
        cause instanceof Error ? cause.message : "The record could not be created."
      );
    }
  }

  return (
    <WorkspaceShell
      eyebrow="Document Monitoring"
      title="Add Monitored Record"
    >
      <form
        onSubmit={save}
        className="p-6 lg:p-8"
      >
        <div className="mx-auto max-w-5xl space-y-6">
          {error && (
            <div
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 p-4 font-semibold text-red-700"
            >
              {error}
            </div>
          )}
          {loadingOrganisations && (
            <p role="status" className="text-sm text-slate-600">Loading organisations…</p>
          )}

          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 p-6">
              <h2 className="text-xl font-bold">
                Monitoring Information
              </h2>

              <p className="mt-1 text-slate-500">
                Enter approved metadata only.
              </p>
            </div>

            <div className="grid gap-6 p-6 sm:grid-cols-2">
              <label className="font-semibold text-slate-700">
                Document Name

                <input
                  required
                  value={form.name}
                  onChange={(event) =>
                    updateField(
                      "name",
                      event.target.value
                    )
                  }
                  className={inputClass}
                />
              </label>

              <label className="font-semibold text-slate-700">
                Organisation

                <select
                  required
                  value={
                    form.organisationId
                  }
                  onChange={(event) =>
                    changeOrganisation(
                      event.target.value
                    )
                  }
                  className={inputClass}
                >
                  <option value="">
                    Select organisation
                  </option>

                  {clients.map((client) => (
                    <option
                      key={client.id}
                      value={client.id}
                    >
                      {client.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="font-semibold text-slate-700">
                Category 1

                <select
                  value={form.category}
                  onChange={(event) =>
                    changeCategory(
                      event.target
                        .value as CategoryOne
                    )
                  }
                  className={inputClass}
                >
                  {categoryOneOptions.map(
                    (category) => (
                      <option
                        key={category}
                        value={category}
                      >
                        {category}
                      </option>
                    )
                  )}
                </select>
              </label>

              <label className="font-semibold text-slate-700">
                Category 2

                <select
                  value={form.category2}
                  onChange={(event) =>
                    updateField(
                      "category2",
                      event.target.value
                    )
                  }
                  className={inputClass}
                >
                  {categoryOptions[
                    form.category
                  ].map((category) => (
                    <option
                      key={category}
                      value={category}
                    >
                      {category}
                    </option>
                  ))}
                </select>
              </label>

              <label className="font-semibold text-slate-700">
                Responsible Contact

                <select
                  required
                  disabled={
                    !form.organisationId
                  }
                  value={form.contactId}
                  onChange={(event) =>
                    changeContact(
                      event.target.value
                    )
                  }
                  className={inputClass}
                >
                  <option value="">
                    Select authorised contact
                  </option>

                  {contacts.map(
                    (contact) => (
                      <option
                        key={contact.id}
                        value={contact.id}
                      >
                        {contact.name} ·{" "}
                        {contact.role_title || "Contact"}
                      </option>
                    )
                  )}
                </select>
              </label>

              <label className="font-semibold text-slate-700">
                Contact Email

                <input
                  readOnly
                  value={form.contactEmail}
                  className={`${inputClass} bg-slate-100`}
                />
              </label>

              <label className="font-semibold text-slate-700">
                Issue Date

                <input
                  type="date"
                  required
                  value={form.issueDate}
                  onChange={(event) =>
                    updateField(
                      "issueDate",
                      event.target.value
                    )
                  }
                  className={inputClass}
                />
              </label>

              <label className="font-semibold text-slate-700">
                Expiry Date

                <input
                  type="date"
                  required
                  value={form.expiryDate}
                  onChange={(event) =>
                    updateField(
                      "expiryDate",
                      event.target.value
                    )
                  }
                  className={inputClass}
                />
              </label>

              <label className="font-semibold text-slate-700">
                Risk

                <select
                  value={form.risk}
                  onChange={(event) =>
                    updateField(
                      "risk",
                      event.target
                        .value as MonitoredRecord["risk"]
                    )
                  }
                  className={inputClass}
                >
                  <option value="Low">
                    Low
                  </option>
                  <option value="Medium">
                    Medium
                  </option>
                  <option value="High">
                    High
                  </option>
                </select>
              </label>

              <label className="font-semibold text-slate-700">
                Next Follow-up

                <input
                  type="date"
                  required
                  value={form.followUp}
                  onChange={(event) =>
                    updateField(
                      "followUp",
                      event.target.value
                    )
                  }
                  className={inputClass}
                />
              </label>

              <label className="font-semibold text-slate-700">
                Confirmation Method

                <select
                  value={
                    form.confirmationMethod
                  }
                  onChange={(event) =>
                    updateField(
                      "confirmationMethod",
                      event.target.value
                    )
                  }
                  className={inputClass}
                >
                  <option>Email</option>
                  <option>Telephone</option>
                  <option>WhatsApp</option>
                  <option>Client portal</option>
                  <option>Signed register</option>
                </select>
              </label>

              <label className="font-semibold text-slate-700">
                Data Source

                <input
                  value={form.dataSource}
                  onChange={(event) =>
                    updateField(
                      "dataSource",
                      event.target.value
                    )
                  }
                  className={inputClass}
                />
              </label>
            </div>

            <div className="border-t border-slate-200 p-6">
              <p className="font-semibold text-slate-700">
                Reminder Days
              </p>

              <div className="mt-3 flex flex-wrap gap-3">
                {[60, 30, 14, 7, 0].map(
                  (day) => (
                    <label
                      key={day}
                      className="flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-3"
                    >
                      <input
                        type="checkbox"
                        checked={form.reminderDays.includes(
                          day
                        )}
                        onChange={() =>
                          toggleReminderDay(
                            day
                          )
                        }
                      />

                      {day === 0
                        ? "Expiry day"
                        : `${day} days`}
                    </label>
                  )
                )}
              </div>
            </div>
          </section>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() =>
                router.push(
                  "/monitored-records"
                )
              }
              className="rounded-xl border border-slate-300 px-6 py-3 font-semibold"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-teal-600 px-7 py-3 font-semibold text-white disabled:opacity-60"
            >
              {saving
                ? "Saving..."
                : "Add Record"}
            </button>
          </div>
        </div>
      </form>
    </WorkspaceShell>
  );
}