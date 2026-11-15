"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import WorkspaceShell from "@/components/workspace/WorkspaceShell";
import { defaultClients, type Client } from "@/lib/clientStore";

type OrganisationOption = { id: string; name: string };
type LegacyScope = { prefix: string; label: string };
type SourcePayload = {
  organisationId: string;
  legacyClientId: string;
  sourceDeviceId: string;
  includeSuspectedFixtures: boolean;
  contacts: unknown[];
  records: unknown[];
  communications: unknown[];
  auditEvents: unknown[];
};
type PreviewResult = {
  runId: string;
  sourceChecksum: string;
  rawCounts: Record<string, number>;
  validCounts: Record<string, number>;
  skippedCounts: Record<string, number>;
  errors: Array<{ entity: string; legacyId?: string; message: string }>;
  warnings: string[];
  includedFixtures: string[];
  contactCounts: {
    found: number;
    automaticallyMatched: number;
    newlyCreated: number;
    ambiguous: number;
    unresolved: number;
    duplicates: number;
  };
  recordsReferencingUnresolvedContacts: number;
};

const storageKeys = {
  records: "doc-monitor-records",
  communications: "doc-monitor-communications",
  auditEvents: "doc-monitor-audit-events",
};
const clientsKey = "doc-monitor-clients";
const profilePrefix = "docmon_client_profile_v1:";
const privacyAcknowledgement =
  "I reviewed the selected client's record, communication and audit data and authorise sending it to the application server for preview.";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseStoredJson(key: string): unknown {
  const raw = localStorage.getItem(key);
  if (raw === null) return null;
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(`Saved browser data in ${key} is not valid JSON.`);
  }
}

function findLegacyScopes(): LegacyScope[] {
  const prefixes = new Set<string>([""]);
  const knownKeys = Object.values(storageKeys);
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key || !key.startsWith(profilePrefix)) continue;
    for (const baseKey of knownKeys) {
      const suffix = `:${baseKey}`;
      if (key.endsWith(suffix)) {
        prefixes.add(key.slice(0, -baseKey.length));
      }
    }
  }
  return [...prefixes].map((prefix, index) => ({
    prefix,
    label: prefix ? `Profile-scoped workspace ${index}` : "Consultant workspace",
  }));
}

function readLegacyClients(): Client[] {
  const value = parseStoredJson(clientsKey);
  if (!Array.isArray(value)) {
    throw new Error(
      "No saved legacy client list was found. This page does not create demo defaults.",
    );
  }
  if (
    value.some(
      (client) =>
        !isObject(client) ||
        typeof client.id !== "string" ||
        typeof client.company !== "string",
    )
  ) {
    throw new Error("The saved legacy client list contains invalid entries.");
  }
  return value as Client[];
}

function readArray(value: unknown, label: string): unknown[] {
  if (value === null) return [];
  if (!Array.isArray(value)) throw new Error(`${label} must be a saved list.`);
  return value;
}

function collectSelectedClient(
  scope: LegacyScope,
  legacyClientId: string,
  organisationId: string,
  sourceDeviceId: string,
  includeSuspectedFixtures: boolean,
  contacts: Client["contacts"],
): SourcePayload {
  const recordsValue = parseStoredJson(`${scope.prefix}${storageKeys.records}`);
  if (recordsValue !== null && !isObject(recordsValue)) {
    throw new Error("Saved monitored records are not in the expected format.");
  }
  const allRecords = recordsValue ? Object.values(recordsValue) : [];
  if (allRecords.some((record) => !isObject(record))) {
    throw new Error("Saved monitored records contain invalid entries.");
  }
  const records = allRecords.filter(
    (record) => isObject(record) && record.organisationId === legacyClientId,
  );
  const recordIds = new Set(
    records
      .filter(isObject)
      .map((record) => record.id)
      .filter((id): id is string => typeof id === "string"),
  );
  const recordRows = records
    .filter(isObject)
    .map((record) => ({
      ...record,
      id: typeof record.id === "string" ? record.id : "",
    }));

  const allCommunications = readArray(
    parseStoredJson(`${scope.prefix}${storageKeys.communications}`),
    "Saved communication history",
  );
  if (allCommunications.some((event) => !isObject(event))) {
    throw new Error("Saved communication history contains invalid entries.");
  }
  const communications = allCommunications.filter(
    (event) => isObject(event) && recordIds.has(String(event.recordId || "")),
  );
  const allAuditEvents = readArray(
    parseStoredJson(`${scope.prefix}${storageKeys.auditEvents}`),
    "Saved audit history",
  );
  if (allAuditEvents.some((event) => !isObject(event))) {
    throw new Error("Saved audit history contains invalid entries.");
  }
  const auditEvents = allAuditEvents
    .filter((event) => {
      if (!isObject(event)) return false;
      const recordId =
        typeof event.recordId === "string" && event.recordId
          ? event.recordId
          : event.entityType === "record" && typeof event.entityId === "string"
            ? event.entityId
            : "";
      return recordIds.has(recordId);
    })
    .map((event) => {
      if (!isObject(event)) return event;
      const recordId =
        typeof event.recordId === "string" && event.recordId
          ? event.recordId
          : typeof event.entityId === "string"
            ? event.entityId
            : "";
      return { ...event, recordId };
    });

  return {
    organisationId,
    legacyClientId,
    sourceDeviceId,
    includeSuspectedFixtures,
    contacts: contacts.map((contact) => ({
      id: contact.id,
      name: contact.name,
      role: contact.role,
      email: contact.email,
      phone: contact.phone || "",
      primary: contact.primary,
      authorised: contact.authorised,
    })),
    records: recordRows,
    communications,
    auditEvents,
  };
}

async function responseJson<T>(response: Response): Promise<T> {
  const body: unknown = await response.json();
  if (!response.ok) {
    const message =
      isObject(body) && typeof body.error === "string"
        ? body.error
        : "The migration request could not be completed.";
    throw new Error(message);
  }
  return body as T;
}

export default function LocalStorageMigrationPage() {
  const [organisations, setOrganisations] = useState<OrganisationOption[]>([]);
  const [legacyClients, setLegacyClients] = useState<Client[]>([]);
  const [scopes, setScopes] = useState<LegacyScope[]>([]);
  const [organisationId, setOrganisationId] = useState("");
  const [legacyClientId, setLegacyClientId] = useState("");
  const [scopePrefix, setScopePrefix] = useState("");
  const [sourceDeviceId, setSourceDeviceId] = useState("");
  const [includeSuspectedFixtures, setIncludeSuspectedFixtures] = useState(false);
  const [privacyConfirmed, setPrivacyConfirmed] = useState(false);
  const [importConfirmed, setImportConfirmed] = useState(false);
  const [sourcePayload, setSourcePayload] = useState<SourcePayload | null>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [reconciliation, setReconciliation] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    let active = true;
    void fetch("/api/migrations/monitored-records/targets", {
      cache: "no-store",
    })
      .then((response) =>
        responseJson<{ organisations: OrganisationOption[] }>(response),
      )
      .then((result) => {
        if (!active) return;
        const clients = readLegacyClients();
        const availableScopes = findLegacyScopes();
        setOrganisations(result.organisations);
        setLegacyClients(clients);
        setScopes(availableScopes);
        setScopePrefix(availableScopes[0]?.prefix || "");
        setSourceDeviceId(crypto.randomUUID());
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Migration access could not be verified.",
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const selectedClient = useMemo(
    () => legacyClients.find((client) => client.id === legacyClientId) ?? null,
    [legacyClients, legacyClientId],
  );
  const selectedClientLooksLikeFixture = Boolean(
    selectedClient &&
      defaultClients.some(
        (client) =>
          client.id === selectedClient.id &&
          client.company === selectedClient.company,
      ),
  );

  function resetPreview() {
    setSourcePayload(null);
    setPreview(null);
    setReconciliation(null);
    setImportConfirmed(false);
    setNotice("");
  }

  async function handlePreview() {
    setWorking(true);
    setError("");
    setNotice("");
    resetPreview();
    try {
      if (!organisationId || !legacyClientId || !sourceDeviceId) {
        throw new Error("Select both the legacy client and its canonical organisation.");
      }
      if (!privacyConfirmed) {
        throw new Error("Confirm the privacy notice before previewing data.");
      }
      const scope = scopes.find((candidate) => candidate.prefix === scopePrefix);
      if (!scope) throw new Error("Choose a saved browser data scope.");

      const payload = collectSelectedClient(
        scope,
        legacyClientId,
        organisationId,
        sourceDeviceId,
        includeSuspectedFixtures,
        readLegacyClients().find((client) => client.id === legacyClientId)?.contacts || [],
      );
      const result = await responseJson<PreviewResult>(
        await fetch("/api/migrations/monitored-records/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }),
      );
      setSourcePayload(payload);
      setPreview(result);
      setNotice("Preview created. No monitored records have been imported yet.");
    } catch (cause: unknown) {
      setError(
        cause instanceof Error ? cause.message : "Migration preview failed.",
      );
    } finally {
      setWorking(false);
    }
  }

  async function handleImport() {
    if (!preview || !sourcePayload) return;
    setWorking(true);
    setError("");
    setNotice("");
    try {
      const currentScope = scopes.find(
        (candidate) => candidate.prefix === scopePrefix,
      );
      if (!currentScope) throw new Error("The selected browser data scope is unavailable.");
      const currentPayload = collectSelectedClient(
        currentScope,
        sourcePayload.legacyClientId,
        sourcePayload.organisationId,
        sourcePayload.sourceDeviceId,
        sourcePayload.includeSuspectedFixtures,
        readLegacyClients().find((client) => client.id === sourcePayload.legacyClientId)?.contacts || [],
      );
      if (JSON.stringify(currentPayload) !== JSON.stringify(sourcePayload)) {
        throw new Error("The local data changed after preview. Run the preview again.");
      }
      if (!importConfirmed) {
        throw new Error("Confirm the import after reviewing the preview.");
      }
      if (
        Object.values(preview.validCounts).reduce((total, count) => total + count, 0) === 0
      ) {
        throw new Error("There are no valid rows to import.");
      }
      await responseJson<{ result: unknown }>(
        await fetch("/api/migrations/monitored-records/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...sourcePayload,
            runId: preview.runId,
            sourceChecksum: preview.sourceChecksum,
          }),
        }),
      );
      const reconciled = await responseJson<{ run: { reconciliation_summary: unknown; status: string } }>(
        await fetch(`/api/migrations/monitored-records/runs/${preview.runId}`, {
          cache: "no-store",
        }),
      );
      setReconciliation(JSON.stringify(reconciled.run, null, 2));
      setNotice(
        reconciled.run.status === "reconciled"
          ? "Import completed and all imported rows reconciled."
          : "Import completed, but reconciliation needs review.",
      );
    } catch (cause: unknown) {
      setError(
        cause instanceof Error ? cause.message : "Migration import failed.",
      );
    } finally {
      setWorking(false);
    }
  }

  const isSuspectedClient = selectedClientLooksLikeFixture;

  return (
    <WorkspaceShell title="Monitored-record migration">
      <main className="space-y-6 p-5 lg:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">
              One-time import
            </p>
            <h2 className="mt-1 text-2xl font-bold text-slate-950">
              Preview and import monitored records
            </h2>
          </div>
          <Link
            href="/settings"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
          >
            Back to settings
          </Link>
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm leading-6 text-slate-600">
            Only the selected legacy client&apos;s monitored records and their
            linked communication and audit history are sent for preview. The
            preview stores counts, validation messages and checksums, not the
            original browser payload. Local browser data is not deleted.
          </p>
          {loading ? (
            <p className="mt-4 text-sm text-slate-600">Verifying migration access…</p>
          ) : error && !organisations.length ? (
            <p role="alert" className="mt-4 text-sm font-medium text-red-700">{error}</p>
          ) : (
            <div className="mt-5 grid gap-5 md:grid-cols-2">
              <label className="text-sm font-semibold text-slate-800">
                Canonical Supabase organisation
                <select
                  value={organisationId}
                  onChange={(event) => {
                    setOrganisationId(event.target.value);
                    resetPreview();
                  }}
                  className="mt-2 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 font-normal"
                >
                  <option value="">Select an organisation</option>
                  {organisations.map((organisation) => (
                    <option key={organisation.id} value={organisation.id}>
                      {organisation.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-semibold text-slate-800">
                Legacy client
                <select
                  value={legacyClientId}
                  onChange={(event) => {
                    setLegacyClientId(event.target.value);
                    resetPreview();
                  }}
                  className="mt-2 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 font-normal"
                >
                  <option value="">Select a saved legacy client</option>
                  {legacyClients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.company}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-semibold text-slate-800">
                Browser data scope
                <select
                  value={scopePrefix}
                  onChange={(event) => {
                    setScopePrefix(event.target.value);
                    resetPreview();
                  }}
                  className="mt-2 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 font-normal"
                >
                  {scopes.map((scope) => (
                    <option key={scope.label} value={scope.prefix}>
                      {scope.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 md:col-span-2">
                {isSuspectedClient ? (
                  <p>
                    This legacy client matches an embedded example client. Review
                    its records carefully; built-in demo records are excluded
                    unless explicitly included below.
                  </p>
                ) : (
                  <p>
                    Built-in demo record IDs are identified during preview and
                    excluded by default. Review all counts and exceptions before
                    importing.
                  </p>
                )}
              </div>
              <label className="flex items-start gap-3 text-sm text-slate-700 md:col-span-2">
                <input
                  type="checkbox"
                  checked={includeSuspectedFixtures}
                  onChange={(event) => {
                    setIncludeSuspectedFixtures(event.target.checked);
                    resetPreview();
                  }}
                  className="mt-1 h-4 w-4 accent-teal-700"
                />
                <span>
                  Include suspected built-in demo records. Select only if these
                  records were reviewed and are genuine data to migrate.
                </span>
              </label>
              <label className="flex items-start gap-3 text-sm text-slate-700 md:col-span-2">
                <input
                  type="checkbox"
                  checked={privacyConfirmed}
                  onChange={(event) => setPrivacyConfirmed(event.target.checked)}
                  className="mt-1 h-4 w-4 accent-teal-700"
                />
                <span>{privacyAcknowledgement}</span>
              </label>
              <div className="md:col-span-2">
                <button
                  type="button"
                  disabled={working || loading || !organisations.length}
                  onClick={() => void handlePreview()}
                  className="rounded-lg bg-teal-700 px-5 py-3 text-sm font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {working ? "Working…" : "Create preview"}
                </button>
              </div>
            </div>
          )}
        </section>

        {error && organisations.length > 0 && (
          <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            {notice}
          </p>
        )}

        {preview && (
          <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div>
              <h3 className="text-lg font-bold text-slate-950">Preview results</h3>
              <p className="mt-1 text-xs text-slate-500">Run ID: {preview.runId}</p>
            </div>
            <dl className="grid gap-3 sm:grid-cols-3">
              {Object.entries(preview.validCounts).map(([label, count]) => (
                <div key={label} className="rounded-lg bg-slate-50 p-4">
                  <dt className="text-sm capitalize text-slate-600">{label}</dt>
                  <dd className="mt-1 text-2xl font-bold text-slate-950">{count}</dd>
                </div>
              ))}
            </dl>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <h4 className="font-semibold">Responsible-contact reconciliation</h4>
              <p className="mt-2">
                Found {preview.contactCounts.found}; matched {preview.contactCounts.automaticallyMatched};
                {" "}to create {preview.contactCounts.newlyCreated}; ambiguous {preview.contactCounts.ambiguous};
                {" "}unresolved {preview.contactCounts.unresolved}; duplicate matches {preview.contactCounts.duplicates}.
              </p>
              <p className="mt-1">
                Records referencing unresolved contacts: {preview.recordsReferencingUnresolvedContacts}.
                {" "}Those records will be imported with no responsible contact and a migration warning.
              </p>
            </div>
            <div className="text-sm text-slate-700">
              Skipped: {Object.entries(preview.skippedCounts)
                .map(([label, count]) => `${label}: ${count}`)
                .join(" · ")}
            </div>
            {preview.warnings.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                <h4 className="font-semibold">Warnings</h4>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {preview.warnings.map((warning) => <li key={warning}>{warning}</li>)}
                </ul>
              </div>
            )}
            {preview.errors.length > 0 && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900">
                <h4 className="font-semibold">
                  Exceptions ({preview.errors.length}); invalid rows will be skipped
                </h4>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {preview.errors.slice(0, 20).map((issue, index) => (
                    <li key={`${issue.entity}-${issue.legacyId || index}`}>
                      {issue.entity} {issue.legacyId ? `(${issue.legacyId})` : ""}: {issue.message}
                    </li>
                  ))}
                </ul>
                {preview.errors.length > 20 && (
                  <p className="mt-2">Showing the first 20 exceptions.</p>
                )}
              </div>
            )}
            {preview.includedFixtures.length > 0 && (
              <p className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
                Demo records explicitly included: {preview.includedFixtures.join(", ")}.
              </p>
            )}
            {reconciliation !== null && (
              <pre className="overflow-auto rounded-lg bg-slate-950 p-4 text-xs text-slate-100">
                {reconciliation}
              </pre>
            )}
            {reconciliation === null && (
              <div className="space-y-3 border-t border-slate-200 pt-4">
                <label className="flex items-start gap-3 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={importConfirmed}
                    onChange={(event) => setImportConfirmed(event.target.checked)}
                    className="mt-1 h-4 w-4 accent-teal-700"
                  />
                  <span>
                    I reviewed the preview and want to import the valid rows into
                    the selected organisation.
                  </span>
                </label>
                <button
                  type="button"
                  disabled={
                    working ||
                    !importConfirmed ||
                    Object.values(preview.validCounts).reduce((total, count) => total + count, 0) === 0
                  }
                  onClick={() => void handleImport()}
                  className="rounded-lg bg-slate-950 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {working ? "Importing…" : "Import reviewed data"}
                </button>
              </div>
            )}
          </section>
        )}
      </main>
    </WorkspaceShell>
  );
}
