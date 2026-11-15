"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import WorkspaceShell from "@/components/workspace/WorkspaceShell";
import OrganisationForm from "@/components/clients/OrganisationForm";
import type { ManagedOrganisation } from "@/lib/admin/organisations";

function ClientOrganisationForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const organisationId = searchParams.get("organisationId") || "";
  const lockName = searchParams.get("legacy") === "true";
  const [organisation, setOrganisation] = useState<ManagedOrganisation>();
  const [error, setError] = useState("");

  useEffect(() => {
    if (!organisationId) return;

    void fetch("/api/admin/organisations?includeInactive=true", { cache: "no-store" })
      .then(async (response) => {
        const result = (await response.json()) as {
          error?: string;
          organisations?: ManagedOrganisation[];
        };
        if (!response.ok) {
          throw new Error(result.error || "The organisation could not be loaded.");
        }
        const selected = result.organisations?.find((item) => item.id === organisationId);
        if (!selected) throw new Error("The organisation could not be found.");
        setOrganisation(selected);
      })
      .catch((loadError: unknown) => {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "The organisation could not be loaded.",
        );
      })
  }, [organisationId]);

  const loading = Boolean(organisationId) && !organisation && !error;

  return (
    <WorkspaceShell
      eyebrow="Client Management"
      title={organisationId ? "Edit Organisation" : "Add Client"}
    >
      <div className="mx-auto max-w-4xl space-y-4 p-5 lg:p-8">
        <Link href="/clients" className="inline-flex min-h-10 items-center font-semibold text-teal-800">
          ← Back to Clients
        </Link>
        {loading && <p role="status" className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">Loading organisation…</p>}
        {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
        {!loading && !error && (
          <OrganisationForm
            initialOrganisation={organisation}
            lockName={lockName}
            onSaved={() => router.push("/clients")}
          />
        )}
      </div>
    </WorkspaceShell>
  );
}

export default function NewClientPage() {
  return (
    <Suspense fallback={<p role="status" className="m-5 rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">Loading client form…</p>}>
      <ClientOrganisationForm />
    </Suspense>
  );
}
