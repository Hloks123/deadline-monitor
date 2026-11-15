"use client";

import {
  FormEvent,
  useEffect,
  useState,
} from "react";

import {
  useParams,
  useRouter,
} from "next/navigation";

import WorkspaceShell from "@/components/workspace/WorkspaceShell";

import {
  categoryOptions,
  CategoryOne,
  MonitoredRecord,
} from "@/lib/recordStore";
import {
  findAccessibleMonitoredRecord,
  httpMonitoredRecordRepository,
  loadAccessibleOrganisations,
  type MonitoredOrganisation,
} from "@/lib/monitoredRecords/repository";

const inputClass =
  "mt-2 min-h-[46px] w-full rounded-xl border border-slate-300 bg-white px-4 text-slate-900 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100";

const categoryOneOptions = Object.keys(
  categoryOptions
) as CategoryOne[];

export default function EditRecordPage() {
  const params = useParams();
  const router = useRouter();

  const id = String(params.id);

  const [originalRecord, setOriginalRecord] =
    useState<MonitoredRecord | null>(null);
  const [originalVersion, setOriginalVersion] = useState<number | null>(null);

  const [form, setForm] =
    useState<MonitoredRecord | null>(null);

  const [error, setError] =
    useState("");

  const [saving, setSaving] =
    useState(false);

  const [clients, setClients] = useState<MonitoredOrganisation[]>([]);

  useEffect(() => {
    let active = true;
    const frame = window.requestAnimationFrame(() => {
      void Promise.all([
        findAccessibleMonitoredRecord(id),
        loadAccessibleOrganisations(),
      ])
        .then(([record, organisations]) => {
          if (!active) return;
          if (!record) {
            setError("Record not found or you do not have access.");
            return;
          }
          setClients(organisations);
          setOriginalVersion(record.version);
          setOriginalRecord({ ...record });
          setForm({
            ...record,
          });
        })
        .catch((cause: unknown) => {
          if (active) {
            setError(cause instanceof Error ? cause.message : "The record could not be loaded.");
          }
        });
    });
    return () => {
      active = false;
      window.cancelAnimationFrame(frame);
    };
  }, [id]);

  const contacts = (() => {
    if (!form?.organisation) {
      return [];
    }

    return clients.find((client) => client.id === form.organisationId)
      ?.contacts.filter((contact) => contact.authorised) || [];
  })();

  const categoryTwoOptions =
    form
      ? categoryOptions[form.category] || []
      : [];

  function updateField<
    K extends keyof MonitoredRecord
  >(
    field: K,
    value: MonitoredRecord[K]
  ) {
    setError("");

    setForm((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        [field]: value,
      };
    });
  }

  function changeContact(
    contactId: string
  ) {
    const contact = contacts.find(
      (item) =>
        item.id === contactId
    );

    if (!contact) {
      return;
    }

    setForm((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,

        contactId:
          contact.id,

        contact:
          contact.name,

        contactEmail:
          contact.email,
      };
    });
  }

  function changeCategoryOne(
    category: CategoryOne
  ) {
    const firstCategoryTwo =
      categoryOptions[category]?.[0] || "";

    setForm((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,

        category,

        category2:
          firstCategoryTwo,
      };
    });

    setError("");
  }

  /* =========================================
     CANCEL

     No data is saved.
     Goes back to the detail page.
  ========================================= */

  function handleCancel() {
    router.replace(
      `/monitored-records/${id}`
    );
  }

  /* =========================================
     SAVE
  ========================================= */

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (
      !form ||
      !originalRecord ||
      originalVersion === null
    ) {
      setError(
        "The record could not be loaded."
      );

      return;
    }

    if (!form.name.trim()) {
      setError(
        "Document Name is required."
      );

      return;
    }

    if (!form.category) {
      setError(
        "Category 1 is required."
      );

      return;
    }

    if (!form.category2) {
      setError(
        "Category 2 is required."
      );

      return;
    }

    if (!form.contact) {
      setError(
        "Responsible Contact is required."
      );

      return;
    }

    if (!form.contactEmail) {
      setError(
        "Contact Email is required."
      );

      return;
    }

    if (
      !form.issueDate ||
      !form.expiryDate
    ) {
      setError(
        "Issue Date and Expiry Date are required."
      );

      return;
    }

    const issueDate = new Date(
      `${form.issueDate}T00:00:00`
    );

    const expiryDate = new Date(
      `${form.expiryDate}T00:00:00`
    );

    if (
      expiryDate <= issueDate
    ) {
      setError(
        "Expiry Date must be later than Issue Date."
      );

      return;
    }

    if (!form.followUp) {
      setError(
        "Next Follow-up is required."
      );

      return;
    }

    setSaving(true);
    setError("");

    try {
      const saved = await httpMonitoredRecordRepository.update(
        originalRecord.organisationId,
        originalRecord.id,
        originalVersion,
        {
          name: form.name,
          category: form.category,
          category2: form.category2,
          issueDate: form.issueDate,
          expiryDate: form.expiryDate,
          status: form.status,
          risk: form.risk,
          escalationLevel: form.escalationLevel,
          contactId: form.contactId,
          followUp: form.followUp,
        },
      );

      router.replace(
        `/monitored-records/${saved.id}`
      );

      router.refresh();
    } catch (cause: unknown) {
      setSaving(false);
      setError(
        cause instanceof Error ? cause.message : "The record could not be saved."
      );
    }
  }

  if (!form) {
    return (
      <WorkspaceShell
        eyebrow="Document Monitoring"
        title="Edit Monitored Record"
      >
        <div className="p-8">
          {error ||
            "Loading record..."}
        </div>
      </WorkspaceShell>
    );
  }

  return (
    <WorkspaceShell
      eyebrow="Document Monitoring"
      title="Edit Monitored Record"
    >
      <form
        onSubmit={handleSubmit}
        className="p-5 lg:p-7"
      >
        <div className="mx-auto max-w-5xl space-y-6">

          {/* ERROR */}

          {error && (
            <div
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 p-4 font-semibold text-red-700"
            >
              {error}
            </div>
          )}

          {/* FORM */}

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

            <div className="border-b border-slate-200 p-6">
              <h2 className="text-xl font-bold text-slate-950">
                Monitoring Information
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Update the approved metadata for this record.
              </p>
            </div>

            <div className="grid gap-6 p-6 sm:grid-cols-2">

              {/* DOCUMENT NAME */}

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

              {/* ORGANISATION */}

              <label className="font-semibold text-slate-700">
                Organisation

                <select
                  required
                  disabled
                  value={
                    form.organisationId
                  }
                  className={inputClass}
                >
                  <option value="">
                    Select organisation
                  </option>

                  {clients.map(
                    (client) => (
                      <option
                        key={client.id}
                        value={client.id}
                      >
                        {client.name}
                      </option>
                    )
                  )}
                </select>
              </label>

              {/* CATEGORY 1 */}

              <label className="font-semibold text-slate-700">
                Category 1

                <select
                  required
                  value={form.category}
                  onChange={(event) =>
                    changeCategoryOne(
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

              {/* CATEGORY 2 */}

              <label className="font-semibold text-slate-700">
                Category 2

                <select
                  required
                  value={form.category2}
                  onChange={(event) =>
                    updateField(
                      "category2",
                      event.target.value
                    )
                  }
                  className={inputClass}
                >
                  {categoryTwoOptions.map(
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

              {/* CONTACT */}

              <label className="font-semibold text-slate-700">
                Responsible Contact

                <select
                  required
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

              {/* EMAIL */}

              <label className="font-semibold text-slate-700">
                Contact Email

                <input
                  readOnly
                  value={form.contactEmail ?? ""}
                  className={`${inputClass} cursor-not-allowed bg-slate-100`}
                />
              </label>

              {/* ISSUE DATE */}

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

              {/* EXPIRY DATE */}

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

              {/* STATUS */}

              <label className="font-semibold text-slate-700">
                Status

                <select
                  value={form.status}
                  onChange={(event) =>
                    updateField(
                      "status",
                      event.target
                        .value as MonitoredRecord["status"]
                    )
                  }
                  className={inputClass}
                >
                  <option value="Current">
                    Current
                  </option>

                  <option value="Due soon">
                    Due soon
                  </option>

                  <option value="Expired">
                    Expired
                  </option>

                  <option value="Awaiting client">
                    Awaiting client
                  </option>

                  <option value="Completed">
                    Completed
                  </option>
                </select>
              </label>

              {/* RISK */}

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

              {/* FOLLOW-UP */}

              <label className="font-semibold text-slate-700 sm:col-span-2">
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

            </div>
          </section>

          {/* PRIVACY */}

          <div className="rounded-xl border border-blue-200 bg-blue-50 p-5 text-sm text-blue-900">
            Do not upload the company document. Deadline-Monitor stores approved monitoring metadata only.
          </div>

          {/* BUTTONS */}

          <div className="flex flex-wrap justify-end gap-3 pb-5">

            <button
              type="button"
              onClick={handleCancel}
              disabled={saving}
              className="min-h-[48px] rounded-xl border border-slate-300 bg-white px-7 font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving}
              className="min-h-[48px] rounded-xl bg-teal-600 px-8 font-semibold text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving
                ? "Saving..."
                : "Save Changes"}
            </button>

          </div>

        </div>
      </form>
    </WorkspaceShell>
  );
}