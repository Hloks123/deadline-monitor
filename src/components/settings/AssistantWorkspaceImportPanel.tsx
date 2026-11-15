"use client";

import { useEffect, useMemo, useState } from "react";
import {
  buildLegacyClientSnapshot,
  getImportableClients,
} from "@/lib/assistantWorkspaceImport";
import type { AssistantWorkspaceImportOrganisation } from "@/lib/assistantWorkspaceTypes";
import type { Client } from "@/lib/clientStore";

export default function AssistantWorkspaceImportPanel() {
  const [clients, setClients] = useState<Client[]>([]);
  const [organisations, setOrganisations] = useState<
    AssistantWorkspaceImportOrganisation[]
  >([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    void fetch("/api/admin/organisations?includeInactive=true", {
      cache: "no-store",
    })
      .then(async (response) => {
        const result = (await response.json()) as {
          error?: string;
          organisations?: AssistantWorkspaceImportOrganisation[];
        };
        if (!response.ok || !Array.isArray(result.organisations)) {
          throw new Error(result.error || "Client organisations could not be loaded.");
        }
        if (!active) return;
        const localClients = getImportableClients();
        setClients(localClients);
        const activeOrganisations = result.organisations.filter(
          (organisation) => organisation.status === "active",
        );
        setOrganisations(activeOrganisations);
        const byId = new Map(
          activeOrganisations.map((organisation) => [organisation.id, organisation.id]),
        );
        setMapping(
          Object.fromEntries(
            localClients.map((client) => [
              client.id,
              byId.get(client.canonicalOrganisationId || client.id) || "",
            ]),
          ),
        );
      })
      .catch((loadError: unknown) => {
        if (!active) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Client organisations could not be loaded.",
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const mappedOrganisationIds = useMemo(
    () => Object.entries(mapping).filter(([, id]) => id).map(([, id]) => id),
    [mapping],
  );
  const duplicateMappings = useMemo(
    () => new Set(mappedOrganisationIds.filter((id, index) => mappedOrganisationIds.indexOf(id) !== index)),
    [mappedOrganisationIds],
  );

  async function importSelectedClients() {
    if (busy) return;
    setError("");
    setNotice("");
    const selected = clients.filter((client) => mapping[client.id]);
    if (!confirmed) {
      setError("Confirm that you want to import data from this browser.");
      return;
    }
    if (!selected.length) {
      setError("Map at least one browser client to an organisation.");
      return;
    }
    if (duplicateMappings.size) {
      setError("Each organisation can be mapped to only one browser client.");
      return;
    }

    setBusy(true);
    const failures: string[] = [];
    let imported = 0;
    try {
      for (const client of selected) {
        const organisation = organisations.find(
          (candidate) => candidate.id === mapping[client.id],
        );
        if (!organisation) {
          failures.push(`${client.company}: selected organisation is unavailable.`);
          continue;
        }

        try {
          const snapshot = buildLegacyClientSnapshot(client, organisation);
          const response = await fetch("/api/assistant/workspace", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              organisationId: organisation.id,
              snapshot,
            }),
          });
          const result = (await response.json()) as { error?: string };
          if (!response.ok) {
            failures.push(
              `${client.company}: ${result.error || "import failed."}`,
            );
            continue;
          }
          imported += 1;
        } catch (importError: unknown) {
          failures.push(
            `${client.company}: ${
              importError instanceof Error
                ? importError.message
                : "import failed."
            }`,
          );
        }
      }

      if (failures.length) {
        setError(
          `${imported} organisation${imported === 1 ? "" : "s"} imported. ${failures.join(" ")}`,
        );
      } else {
        setNotice(
          `${imported} organisation${imported === 1 ? "" : "s"} imported. Assistants assigned to those clients can now use the imported workspace.`,
        );
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div>
        <h2 className="text-lg font-bold text-slate-950">
          Import assistant workspace data
        </h2>
        <p className="mt-1 text-sm leading-6 text-slate-600">
          Map each browser client to its database organisation. Only the selected
          client’s records, work, calendar items and history are imported.
          Assistant changes are saved in the organisation workspace; importing
          again replaces the snapshot, including those assistant changes.
        </p>
      </div>

      {error && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          {notice}
        </p>
      )}

      {loading ? (
        <p role="status" className="text-sm text-slate-600">
          Loading browser clients and active organisations…
        </p>
      ) : (
        <>
          {clients.length === 0 || organisations.length === 0 ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
              Import requires at least one browser client and one active database
              organisation.
            </p>
          ) : (
            <div className="space-y-3">
              {clients.map((client) => (
                <label
                  key={client.id}
                  className="grid gap-2 rounded-xl border border-slate-200 p-3 text-sm font-semibold text-slate-700 sm:grid-cols-[minmax(0,1fr)_minmax(16rem,1fr)] sm:items-center"
                >
                  <span>{client.company || "Unnamed browser client"}</span>
                  <select
                    value={mapping[client.id] || ""}
                    onChange={(event) =>
                      setMapping((current) => ({
                        ...current,
                        [client.id]: event.target.value,
                      }))
                    }
                    className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 font-normal"
                  >
                    <option value="">Do not import this client</option>
                    {organisations.map((organisation) => (
                      <option
                        key={organisation.id}
                        value={organisation.id}
                        disabled={
                          mappedOrganisationIds.includes(organisation.id) &&
                          mapping[client.id] !== organisation.id
                        }
                      >
                        {organisation.name}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          )}

          <label className="flex items-start gap-3 text-sm leading-6 text-slate-700">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
              className="mt-1 h-4 w-4"
            />
            <span>
              I verified the mappings. Importing replaces each selected
              organisation’s current assistant workspace, including changes
              made by assigned assistant consultants, with this browser’s data.
            </span>
          </label>

          <button
            type="button"
            onClick={() => void importSelectedClients()}
            disabled={
              loading ||
              busy ||
              clients.length === 0 ||
              organisations.length === 0
            }
            className="min-h-11 rounded-xl bg-teal-700 px-5 font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? "Importing…" : "Import selected client data"}
          </button>
        </>
      )}
    </section>
  );
}
