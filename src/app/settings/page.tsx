"use client";

import Link from "next/link";
import {
  ReactNode,
  useEffect,
  useState,
} from "react";

import WorkspaceShell from "@/components/workspace/WorkspaceShell";
import UsersAccessPanel from "@/components/settings/UsersAccessPanel";
import AccountSecurityPanel from "@/components/account/AccountSecurityPanel";

import {
  CategoryConfig,
  createSettingId,
  defaultSettings,
  EmailTemplate,
  getSettings,
  saveSettings,
  SettingsData,
} from "@/lib/settingsStore";
import { addAuditEvent } from "@/lib/recordStore";

const inputClass =
  "mt-2 min-h-[46px] w-full rounded-xl border border-slate-300 bg-white px-4 text-slate-900 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100";

const textareaClass =
  "mt-2 w-full rounded-xl border border-slate-300 bg-white p-4 text-slate-900 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100";

/* =========================================================
   ACCORDION
========================================================= */

function Accordion({
  title,
  description,
  children,
  defaultOpen = false,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] =
    useState(defaultOpen);

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() =>
          setOpen(
            (current) =>
              !current
          )
        }
        aria-expanded={open}
        className={`flex w-full items-center justify-between gap-6 px-6 py-5 text-left transition ${
          open
            ? "bg-teal-600 text-white"
            : "bg-white text-slate-900 hover:bg-slate-50"
        }`}
      >
        <div>
          <h2 className="text-lg font-bold">
            {title}
          </h2>

          {description && (
            <p
              className={`mt-1 text-sm ${
                open
                  ? "text-teal-50"
                  : "text-slate-500"
              }`}
            >
              {description}
            </p>
          )}
        </div>

        <span
          className={`text-xl transition-transform ${
            open
              ? "rotate-180"
              : ""
          }`}
        >
          ↓
        </span>
      </button>

      {open && (
        <div className="border-t border-slate-200">
          {children}
        </div>
      )}
    </section>
  );
}

/* =========================================================
   TEMPLATE PREVIEW
========================================================= */

function replaceVariables(
  value: string
) {
  return value
    .replaceAll(
      "{{contact}}",
      "Primary Authorised Contact"
    )
    .replaceAll(
      "{{organisation}}",
      "Demo Construction (Pty) Ltd"
    )
    .replaceAll(
      "{{document}}",
      "COIDA Letter of Good Standing"
    )
    .replaceAll(
      "{{category1}}",
      "COIDA"
    )
    .replaceAll(
      "{{category2}}",
      "Letter of Good Standing"
    )
    .replaceAll(
      "{{issueDate}}",
      "08 Nov 2025"
    )
    .replaceAll(
      "{{expiryDate}}",
      "08 Nov 2026"
    )
    .replaceAll(
      "{{daysRemaining}}",
      "14"
    )
    .replaceAll(
      "{{followUpDate}}",
      "15 Nov 2026"
    )
    .replaceAll(
      "{{risk}}",
      "High"
    );
}

/* =========================================================
   PAGE
========================================================= */

export default function SettingsPage() {
  const [
    settings,
    setSettings,
  ] =
    useState<SettingsData>(
      defaultSettings
    );

  const [
    notice,
    setNotice,
  ] =
    useState("");

  const [
    noticeType,
    setNoticeType,
  ] =
    useState<
      "success" | "error"
    >("success");

  const [
    saving,
    setSaving,
  ] =
    useState(false);

  const [
    lastSavedAt,
    setLastSavedAt,
  ] =
    useState("");

  const [
    previewTemplate,
    setPreviewTemplate,
  ] =
    useState<EmailTemplate | null>(
      null
    );

  const [
    newCategory,
    setNewCategory,
  ] =
    useState("");

  const [
    newChildValues,
    setNewChildValues,
  ] =
    useState<
      Record<string, string>
    >({});

  /* =======================================================
     LOAD
  ======================================================= */

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setSettings(getSettings());
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  /* =======================================================
     HELPERS
  ======================================================= */

  function showNotice(
    value: string,

    type:
      | "success"
      | "error" =
      "success"
  ) {
    setNotice(value);

    setNoticeType(type);
  }

  function update<
    K extends keyof SettingsData
  >(
    field: K,

    value: SettingsData[K]
  ) {
    setSettings(
      (current) => ({
        ...current,

        [field]: value,
      })
    );

    setNotice("");
  }

  /* =======================================================
     SAVE SETTINGS
  ======================================================= */

  function handleSave() {
    if (
      !settings.businessName.trim()
    ) {
      showNotice(
        "Business Name is required.",
        "error"
      );

      return;
    }

    if (
      !settings.supportEmail.trim()
    ) {
      showNotice(
        "Support Email is required.",
        "error"
      );

      return;
    }

    if (
      !settings.senderEmail.trim()
    ) {
      showNotice(
        "Sender Email is required.",
        "error"
      );

      return;
    }

    if (
      !Number.isFinite(
        settings.retentionMonths
      ) ||
      settings.retentionMonths <
        1 ||
      settings.retentionMonths >
        120
    ) {
      showNotice(
        "Data Retention must be between 1 and 120 months.",
        "error"
      );

      return;
    }

    setSaving(true);

    try {
      const previousSettings = getSettings();
      const saved =
        saveSettings(
          settings
        );

      if (!saved) {
        showNotice(
          "Settings could not be saved to local storage.",
          "error"
        );
        return;
      }

      /*
        Read settings back from storage
        to make sure the save succeeded.
      */

      const savedSettings =
        getSettings();

      setSettings(
        savedSettings
      );
      const changedFields = (
        Object.keys(settings) as Array<keyof SettingsData>
      ).filter((field) =>
        JSON.stringify(previousSettings[field]) !== JSON.stringify(savedSettings[field])
      );
      let auditFailed = false;
      try {
        for (const field of changedFields) {
          addAuditEvent({
            recordId: "",
            recordName: settings.businessName,
            organisation: settings.businessName,
            user: "Prototype Consultant",
            action: "System settings updated",
            field: String(field),
            previousValue: JSON.stringify(previousSettings[field]),
            newValue: JSON.stringify(savedSettings[field]),
            entityType: "settings",
            entityId: String(field),
            entityName: String(field),
          });
        }
      } catch (auditError) {
        console.error("Settings saved, but settings changes could not be added to audit history.", auditError);
        auditFailed = true;
      }

      const now =
        new Date().toLocaleTimeString(
          "en-ZA",
          {
            hour:
              "2-digit",
            minute:
              "2-digit",
          }
        );

      setLastSavedAt(now);

      showNotice(
        auditFailed
          ? `Settings saved at ${now}, but audit history could not be updated.`
          : `Settings saved successfully at ${now}.`,
        auditFailed ? "error" : "success"
      );
    } catch (error) {
      console.error("Could not save settings.", error);
      showNotice(
        "Settings could not be saved. Please try again.",
        "error"
      );
    } finally {
      setSaving(false);
    }
  }

  /* =======================================================
     RETENTION
  ======================================================= */

  function updateRetention(
    value: string
  ) {
    /*
      Allow the field to be edited.
      Invalid values are caught on Save.
    */

    const numericValue =
      Number(value);

    if (
      value === ""
    ) {
      update(
        "retentionMonths",
        0
      );

      return;
    }

    if (
      Number.isNaN(
        numericValue
      )
    ) {
      return;
    }

    update(
      "retentionMonths",
      numericValue
    );
  }

  /* =======================================================
     REMINDERS
  ======================================================= */

  function toggleReminderDay(
    day: number
  ) {
    const exists =
      settings.reminderDays.includes(
        day
      );

    const reminderDays =
      exists
        ? settings.reminderDays.filter(
            (item) =>
              item !== day
          )
        : [
            ...settings.reminderDays,
            day,
          ].sort(
            (
              first,
              second
            ) =>
              second -
              first
          );

    update(
      "reminderDays",
      reminderDays
    );
  }

  /* =======================================================
     TEMPLATES
  ======================================================= */

  function updateTemplate(
    templateId: string,

    field:
      | "name"
      | "subject"
      | "message"
      | "active",

    value:
      | string
      | boolean
  ) {
    update(
      "templates",

      settings.templates.map(
        (template) =>
          template.id ===
          templateId
            ? {
                ...template,

                [field]:
                  value,
              }
            : template
      )
    );
  }

  /* =======================================================
     CATEGORIES
  ======================================================= */

  function addCategory() {
    const value =
      newCategory.trim();

    if (!value) {
      showNotice(
        "Enter a Category 1 name.",
        "error"
      );

      return;
    }

    const duplicate =
      settings.categories.some(
        (category) =>
          category.name
            .toLowerCase() ===
          value.toLowerCase()
      );

    if (duplicate) {
      showNotice(
        "This category already exists.",
        "error"
      );

      return;
    }

    const category: CategoryConfig =
      {
        id:
          createSettingId(
            value
          ),

        name:
          value,

        active:
          true,

        children:
          [],
      };

    update(
      "categories",

      [
        ...settings.categories,

        category,
      ]
    );

    setNewCategory("");

    showNotice(
      "Category 1 added."
    );
  }

  function toggleCategory(
    categoryId: string
  ) {
    update(
      "categories",

      settings.categories.map(
        (category) =>
          category.id ===
          categoryId
            ? {
                ...category,

                active:
                  !category.active,
              }
            : category
      )
    );
  }

  function addCategoryChild(
    categoryId: string
  ) {
    const value =
      newChildValues[
        categoryId
      ]?.trim();

    if (!value) {
      showNotice(
        "Enter a Category 2 name.",
        "error"
      );

      return;
    }

    const category =
      settings.categories.find(
        (item) =>
          item.id ===
          categoryId
      );

    if (!category) {
      return;
    }

    const duplicate =
      category.children.some(
        (child) =>
          child.name
            .toLowerCase() ===
          value.toLowerCase()
      );

    if (duplicate) {
      showNotice(
        "This Category 2 already exists.",
        "error"
      );

      return;
    }

    update(
      "categories",

      settings.categories.map(
        (item) =>
          item.id ===
          categoryId
            ? {
                ...item,

                children: [
                  ...item.children,

                  {
                    id:
                      createSettingId(
                        `${item.id}-${value}`
                      ),

                    name:
                      value,

                    active:
                      true,
                  },
                ],
              }
            : item
      )
    );

    /*
      IMPORTANT:
      Clear only this Category's
      input after adding it.
    */

   setNewChildValues((current) => ({
  ...current,
  [categoryId]: "",
}));

    showNotice(
      "Category 2 added."
    );
  }

  function toggleCategoryChild(
    categoryId: string,

    childId: string
  ) {
    update(
      "categories",

      settings.categories.map(
        (category) =>
          category.id ===
          categoryId
            ? {
                ...category,

                children:
                  category.children.map(
                    (child) =>
                      child.id ===
                      childId
                        ? {
                            ...child,

                            active:
                              !child.active,
                          }
                        : child
                  ),
              }
            : category
      )
    );
  }

  /* =======================================================
     PACKAGES
  ======================================================= */

  function updatePackage(
    packageId: string,

    field:
      | "setupFee"
      | "monthlyFee"
      | "recordLimit"
      | "userLimit"
      | "active",

    value:
      | number
      | boolean
  ) {
    update(
      "packages",

      settings.packages.map(
        (item) =>
          item.id ===
          packageId
            ? {
                ...item,

                [field]:
                  value,
              }
            : item
      )
    );
  }

  /* =======================================================
     READINESS
  ======================================================= */

  const readinessItems =
    [
      {
        label:
          "Metadata-only design",

        complete:
          true,
      },

      {
        label:
          "Consultant approval workflow",

        complete:
          settings.reviewRequired,
      },

      {
        label:
          "Audit logging",

        complete:
          true,
      },

      {
        label:
          "Database connectivity",

        complete:
          false,
      },

      {
        label:
          "Authentication",

        complete:
          false,
      },

      {
        label:
          "Multi-factor authentication",

        complete:
          false,
      },

      {
        label:
          "Row Level Security",

        complete:
          false,
      },

      {
        label:
          "Verified Email Domain",

        complete:
          settings.senderDomainVerified,
      },

      {
        label:
          "Daily Backups",

        complete:
          false,
      },

      {
        label:
          "Restore Test",

        complete:
          false,
      },
    ];

  return (
    <WorkspaceShell
      eyebrow="Administration"
      title="Settings"
      actions={
        <button
          type="button"
          onClick={
            handleSave
          }
          disabled={
            saving
          }
          className="min-h-[46px] rounded-xl bg-teal-600 px-7 font-semibold text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving
            ? "Saving..."
            : "Save Settings"}
        </button>
      }
    >
      <div className="space-y-5 p-5 lg:p-7">

        <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-teal-200 bg-teal-50 p-5">
          <div>
            <h2 className="font-bold text-slate-950">
              Migrate monitored records
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Preview and explicitly import one legacy client&apos;s records into
              the selected Supabase organisation.
            </p>
          </div>
          <Link
            href="/settings/local-storage-migration"
            className="rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800"
          >
            Open migration
          </Link>
        </section>

        {/* NOTICE */}

        {notice && (
          <div
            role={
              noticeType ===
              "error"
                ? "alert"
                : "status"
            }
            className={`flex items-center justify-between gap-4 rounded-xl border p-4 font-medium ${
              noticeType ===
              "error"
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-emerald-200 bg-emerald-50 text-emerald-800"
            }`}
          >
            <span>
              {notice}
            </span>

            <button
              type="button"
              onClick={() =>
                setNotice("")
              }
              className="font-bold"
            >
              ×
            </button>
          </div>
        )}

        {/* =================================================
           GENERAL
        ================================================= */}

        <Accordion
          title="General"
          description="Application identity, support and continuity contacts."
          defaultOpen
        >
          <div className="grid gap-6 p-6 sm:grid-cols-2">

            <label className="font-semibold">
              Business Name

              <input
                value={
                  settings.businessName
                }
                onChange={(event) =>
                  update(
                    "businessName",
                    event.target.value
                  )
                }
                className={
                  inputClass
                }
              />
            </label>

            <label className="font-semibold">
              Time Zone

              <select
                value={
                  settings.timeZone
                }
                onChange={(event) =>
                  update(
                    "timeZone",
                    event.target.value
                  )
                }
                className={
                  inputClass
                }
              >
                <option value="Africa/Johannesburg">
                  South Africa
                  (Africa/Johannesburg)
                </option>
              </select>
            </label>

            <label className="font-semibold">
              Support Email

              <input
                type="email"
                value={
                  settings.supportEmail
                }
                onChange={(event) =>
                  update(
                    "supportEmail",
                    event.target.value
                  )
                }
                className={
                  inputClass
                }
              />
            </label>

            {/* DATA RETENTION */}

            <label className="font-semibold">
              Data Retention

              <div className="relative">
                <input
                  type="number"
                  min={1}
                  max={120}
                  step={1}
                  required
                  value={
                    settings.retentionMonths ||
                    ""
                  }
                  onChange={(event) =>
                    updateRetention(
                      event.target.value
                    )
                  }
                  className={`${inputClass} pr-20`}
                />

                <span className="pointer-events-none absolute bottom-[13px] right-4 text-sm font-semibold text-slate-500">
                  months
                </span>
              </div>

              <p className="mt-2 text-sm font-normal text-slate-500">
                Enter any value between
                1 and 120 months.
              </p>

              <div className="mt-3 flex flex-wrap gap-2">

                {[
                  12,
                  24,
                  36,
                  60,
                  84,
                  120,
                ].map(
                  (months) => (
                    <button
                      key={
                        months
                      }
                      type="button"
                      onClick={() =>
                        update(
                          "retentionMonths",
                          months
                        )
                      }
                      className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                        settings.retentionMonths ===
                        months
                          ? "bg-teal-600 text-white"
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      }`}
                    >
                      {months}
                    </button>
                  )
                )}

              </div>
            </label>

            <label className="font-semibold">
              Backup Administrator

              <input
                type="email"
                value={
                  settings.backupAdministrator
                }
                onChange={(event) =>
                  update(
                    "backupAdministrator",
                    event.target.value
                  )
                }
                className={
                  inputClass
                }
              />
            </label>

            <label className="font-semibold">
              Escalation Contact

              <input
                type="email"
                value={
                  settings.escalationContact
                }
                onChange={(event) =>
                  update(
                    "escalationContact",
                    event.target.value
                  )
                }
                className={
                  inputClass
                }
              />
            </label>

            <label className="font-semibold">
              Outage Contact

              <input
                type="email"
                value={
                  settings.outageContact
                }
                onChange={(event) =>
                  update(
                    "outageContact",
                    event.target.value
                  )
                }
                className={
                  inputClass
                }
              />
            </label>

            <label className="font-semibold">
              Support Contact

              <input
                type="email"
                value={
                  settings.supportContact
                }
                onChange={(event) =>
                  update(
                    "supportContact",
                    event.target.value
                  )
                }
                className={
                  inputClass
                }
              />
            </label>

          </div>
        </Accordion>

        {/* =================================================
           REMINDER RULES
        ================================================= */}

        <Accordion
          title="Reminder Rules"
          description="Configure reminder intervals and consultant approval."
        >
          <div className="space-y-6 p-6">

            <p className="font-bold">
              Reminder Intervals
            </p>

            <div className="flex flex-wrap gap-3">

              {[
                60,
                30,
                14,
                7,
                0,
              ].map((day) => (
                <label
                  key={day}
                  className="flex items-center gap-3 rounded-xl border border-slate-300 px-5 py-4"
                >
                  <input
                    type="checkbox"
                    checked={
                      settings.reminderDays.includes(
                        day
                      )
                    }
                    onChange={() =>
                      toggleReminderDay(
                        day
                      )
                    }
                  />

                  <span className="font-semibold">
                    {day === 0
                      ? "Expiry day"
                      : `${day} days`}
                  </span>
                </label>
              ))}

            </div>

            <label className="flex items-start gap-3 border-t border-slate-200 pt-6">
              <input
                type="checkbox"
                checked={
                  settings.dailyReview
                }
                onChange={(event) =>
                  update(
                    "dailyReview",
                    event.target.checked
                  )
                }
              />

              <span>
                <strong className="block">
                  Daily Exception Review
                </strong>

                <span className="text-sm text-slate-500">
                  Include overdue,
                  high-risk and
                  outstanding follow-ups.
                </span>
              </span>
            </label>

            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={
                  settings.reviewRequired
                }
                onChange={(event) =>
                  update(
                    "reviewRequired",
                    event.target.checked
                  )
                }
              />

              <span>
                <strong className="block">
                  Consultant Approval Required
                </strong>

                <span className="text-sm text-slate-500">
                  Reminder messages
                  require review before
                  sending.
                </span>
              </span>
            </label>

          </div>
        </Accordion>

        {/* =================================================
           EMAIL TEMPLATES
        ================================================= */}

        <Accordion
          title="Email Templates"
          description="Sender identity and approved reminder wording."
        >
          <div className="space-y-6 p-6">

            <div className="grid gap-5 sm:grid-cols-2">
              <label className="font-semibold">
                Sender Name

                <input
                  value={
                    settings.senderName
                  }
                  onChange={(event) =>
                    update(
                      "senderName",
                      event.target.value
                    )
                  }
                  className={
                    inputClass
                  }
                />
              </label>

              <label className="font-semibold">
                Sender Email

                <input
                  type="email"
                  value={
                    settings.senderEmail
                  }
                  onChange={(event) =>
                    update(
                      "senderEmail",
                      event.target.value
                    )
                  }
                  className={
                    inputClass
                  }
                />
              </label>
            </div>
            <p className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
              Sender identity is a placeholder for review templates only. This prototype does not connect to an email provider or send messages.
            </p>

            {settings.templates.map(
              (template) => (
                <article
                  key={
                    template.id
                  }
                  className="rounded-xl border border-slate-200 p-5"
                >
                  <div className="flex justify-between gap-4">

                    <h3 className="font-bold">
                      {
                        template.name
                      }
                    </h3>

                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={
                          template.active
                        }
                        onChange={(event) =>
                          updateTemplate(
                            template.id,
                            "active",
                            event.target.checked
                          )
                        }
                      />

                      Active
                    </label>

                  </div>

                  <label className="mt-5 block font-semibold">
                    Subject

                    <input
                      value={
                        template.subject
                      }
                      onChange={(event) =>
                        updateTemplate(
                          template.id,
                          "subject",
                          event.target.value
                        )
                      }
                      className={
                        inputClass
                      }
                    />
                  </label>

                  <label className="mt-5 block font-semibold">
                    Message

                    <textarea
                      rows={8}
                      value={
                        template.message
                      }
                      onChange={(event) =>
                        updateTemplate(
                          template.id,
                          "message",
                          event.target.value
                        )
                      }
                      className={
                        textareaClass
                      }
                    />
                  </label>

                  <button
                    type="button"
                    onClick={() =>
                      setPreviewTemplate(
                        template
                      )
                    }
                    className="mt-4 rounded-xl border border-teal-600 px-5 py-3 font-semibold text-teal-700"
                  >
                    Preview Template
                  </button>
                </article>
              )
            )}

          </div>
        </Accordion>

        <Accordion
          title="Users & Access"
          description="Invite users and manage organisation-scoped access."
        >
          <UsersAccessPanel />
        </Accordion>

        <Accordion
          title="Account & Security"
          description="Update your own profile and password."
        >
          <AccountSecurityPanel />
        </Accordion>

        {/* =================================================
           CATEGORIES
        ================================================= */}

        <Accordion
          title="Categories"
          description="Manage Category 1 and Category 2."
        >
          <div className="space-y-6 p-6">

            <div className="flex gap-3">
              <input
                value={
                  newCategory
                }
                onChange={(event) =>
                  setNewCategory(
                    event.target.value
                  )
                }
                placeholder="New Category 1"
                className="min-h-[46px] min-w-0 flex-1 rounded-xl border border-slate-300 px-4"
              />

              <button
                type="button"
                onClick={
                  addCategory
                }
                className="rounded-xl bg-teal-600 px-6 font-semibold text-white"
              >
                + Add
              </button>
            </div>

            {settings.categories.map(
              (category) => (
                <article
                  key={
                    category.id
                  }
                  className="rounded-xl border border-slate-200 p-5"
                >

                  <div className="flex justify-between gap-4">

                    <h3 className="font-bold">
                      {
                        category.name
                      }
                    </h3>

                    <button
                      type="button"
                      onClick={() =>
                        toggleCategory(
                          category.id
                        )
                      }
                      className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold"
                    >
                      {category.active
                        ? "Active"
                        : "Disabled"}
                    </button>

                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">

                    {category.children.map(
                      (child) => (
                        <button
                          key={
                            child.id
                          }
                          type="button"
                          onClick={() =>
                            toggleCategoryChild(
                              category.id,
                              child.id
                            )
                          }
                          className="rounded-xl border border-slate-200 p-4 text-left"
                        >
                          {
                            child.name
                          }
                          {" · "}
                          {child.active
                            ? "Active"
                            : "Disabled"}
                        </button>
                      )
                    )}

                  </div>

                  <div className="mt-5 flex gap-3">

                    <input
                      value={
                        newChildValues[
                          category.id
                        ] || ""
                      }
                      onChange={(event) =>
                        setNewChildValues(
                          (current) => ({
                            ...current,

                            [category.id]:
                              event.target.value,
                          })
                        )
                      }
                      placeholder="New Category 2"
                      className="min-h-[44px] min-w-0 flex-1 rounded-xl border border-slate-300 px-4"
                    />

                    <button
                      type="button"
                      onClick={() =>
                        addCategoryChild(
                          category.id
                        )
                      }
                      className="rounded-xl border border-teal-600 px-5 font-semibold text-teal-700"
                    >
                      + Add
                    </button>

                  </div>

                </article>
              )
            )}

          </div>
        </Accordion>

        {/* =================================================
           CLIENT PACKAGES
        ================================================= */}

        <Accordion
          title="Client Packages"
          description="Pricing, user limits and record limits."
        >
          <div className="grid gap-5 p-6 xl:grid-cols-2">

            {settings.packages.map(
              (item) => (
                <article
                  key={
                    item.id
                  }
                  className="rounded-xl border border-slate-200 p-5"
                >

                  <div className="flex justify-between">

                    <h3 className="text-xl font-bold">
                      {
                        item.name
                      }
                    </h3>

                    <input
                      type="checkbox"
                      checked={
                        item.active
                      }
                      onChange={(event) =>
                        updatePackage(
                          item.id,
                          "active",
                          event.target.checked
                        )
                      }
                    />

                  </div>

                  <div className="mt-4 grid gap-4 sm:grid-cols-2">

                    {[
                      {
                        label:
                          "Setup Fee",

                        field:
                          "setupFee" as const,
                      },

                      {
                        label:
                          "Monthly Fee",

                        field:
                          "monthlyFee" as const,
                      },

                      {
                        label:
                          "Record Limit",

                        field:
                          "recordLimit" as const,
                      },

                      {
                        label:
                          "User Limit",

                        field:
                          "userLimit" as const,
                      },
                    ].map(
                      (field) => (
                        <label
                          key={
                            field.field
                          }
                          className="font-semibold"
                        >
                          {
                            field.label
                          }

                          <input
                            type="number"
                            min={0}
                            value={
                              item[
                                field.field
                              ]
                            }
                            onChange={(event) =>
                              updatePackage(
                                item.id,
                                field.field,
                                Number(
                                  event.target.value
                                )
                              )
                            }
                            className={
                              inputClass
                            }
                          />
                        </label>
                      )
                    )}

                  </div>

                </article>
              )
            )}

          </div>
        </Accordion>

        {/* =================================================
           SECURITY
        ================================================= */}

        <Accordion
          title="Security & Retention"
          description="Production-readiness and reset controls."
        >
          <div className="space-y-6 p-6">

            <div className="grid gap-3 sm:grid-cols-2">

              {readinessItems.map(
                (item) => (
                  <div
                    key={
                      item.label
                    }
                    className="flex items-center gap-3 rounded-xl border border-slate-200 p-4"
                  >
                    <span
                      className={`flex h-8 w-8 items-center justify-center rounded-full font-bold ${
                        item.complete
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {item.complete
                        ? "✓"
                        : "○"}
                    </span>

                    {
                      item.label
                    }
                  </div>
                )
              )}

            </div>

            <div className="rounded-xl border border-blue-200 bg-blue-50 p-5">
              <h3 className="font-bold text-blue-950">Local data protection</h3>
              <p className="mt-2 text-sm leading-6 text-blue-900">
                Data-clearing controls are unavailable in this prototype. Settings do not automatically delete or expire local records, reminders, clients, tasks or audit history.
              </p>
            </div>

          </div>
        </Accordion>

        {/* =================================================
           SAVE
        ================================================= */}

        <div className="flex flex-wrap items-center justify-end gap-4 pb-8">

          {lastSavedAt && (
            <p className="text-sm font-medium text-emerald-700">
              Last saved at{" "}
              {lastSavedAt}
            </p>
          )}

          <button
            type="button"
            onClick={
              handleSave
            }
            disabled={
              saving
            }
            className="min-h-[48px] rounded-xl bg-teal-600 px-8 font-semibold text-white hover:bg-teal-700 disabled:opacity-60"
          >
            {saving
              ? "Saving..."
              : "Save Settings"}
          </button>

        </div>

      </div>

      {/* TEMPLATE PREVIEW */}

      {previewTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <section className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">

            <div className="flex justify-between border-b border-slate-200 p-6">

              <h2 className="text-xl font-bold">
                Template Preview
              </h2>

              <button
                type="button"
                onClick={() =>
                  setPreviewTemplate(
                    null
                  )
                }
                className="text-2xl font-bold"
              >
                ×
              </button>

            </div>

            <div className="p-6">

              <p className="text-sm font-semibold text-slate-500">
                Subject
              </p>

              <p className="mt-2 font-bold">
                {replaceVariables(
                  previewTemplate.subject
                )}
              </p>

              <p className="mt-6 text-sm font-semibold text-slate-500">
                Message
              </p>

              <div className="mt-2 whitespace-pre-wrap rounded-xl bg-slate-50 p-5">
                {replaceVariables(
                  previewTemplate.message
                )}
              </div>

            </div>

          </section>
        </div>
      )}

    </WorkspaceShell>
  );
}