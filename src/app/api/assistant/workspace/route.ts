import { NextResponse } from "next/server";
import {
  adminServiceUnavailable,
  invalidRequest,
  isRecord,
  readJson,
  requirePlatformRole,
  requireSameOrigin,
  safeBackendFailure,
} from "@/lib/admin/authorization";
import { isAssistantWorkspaceSnapshot } from "@/lib/assistantWorkspace";
import {
  applyAssistantWorkspaceMutation,
  parseAssistantWorkspaceMutation,
} from "@/lib/assistantWorkspaceMutations";
import { getWorkspaceAccess } from "@/lib/auth/workspace";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET() {
  const supabase = await createClient();
  const access = await getWorkspaceAccess(supabase);
  if (
    access.status !== "authorized" ||
    access.platformRoles.includes("main_consultant") ||
    !access.memberships.some(({ role }) => role === "assistant_consultant")
  ) {
    return NextResponse.json(
      { error: "You are not authorised to view assistant workspace data." },
      { status: access.status === "unauthenticated" ? 401 : 403 },
    );
  }

  const organisationIds = [
    ...new Set(
      access.memberships
        .filter(({ role }) => role === "assistant_consultant")
        .map(({ organisationId }) => organisationId),
    ),
  ];
  const { data: organisations, error: organisationsError } = organisationIds.length
    ? await supabase
        .from("organisations")
        .select("id, name")
        .in("id", organisationIds)
        .eq("status", "active")
        .order("name")
    : { data: [], error: null };
  if (organisationsError) return safeBackendFailure();

  const visibleIds = (organisations ?? []).map(({ id }) => id);
  if (!visibleIds.length) {
    return NextResponse.json(
      { organisations: [] },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
  const [contactsResult, snapshotsResult] = await Promise.all([
    supabase
      .from("organisation_contacts")
      .select("id, organisation_id, name, email, phone, role_title, authorised, primary_contact")
      .in("organisation_id", visibleIds)
      .eq("active", true),
    supabase
        .from("organisation_workspace_snapshots")
      .select("organisation_id, payload, imported_at, updated_at")
        .in("organisation_id", visibleIds),
  ]);
  if (contactsResult.error || snapshotsResult.error) {
    return safeBackendFailure();
  }

  const snapshotsByOrganisation = new Map(
    (snapshotsResult.data ?? []).map((row) => [row.organisation_id, row]),
  );
  const contactsByOrganisation = new Map<string, NonNullable<typeof contactsResult.data>>();
  for (const contact of contactsResult.data ?? []) {
    const organisationContacts =
      contactsByOrganisation.get(contact.organisation_id) ?? [];
    organisationContacts.push(contact);
    contactsByOrganisation.set(contact.organisation_id, organisationContacts);
  }
  const result: Array<{
    id: string;
    name: string;
    contacts: Array<{
      id: string;
      name: string;
      role: string;
      email: string;
      phone?: string;
      primary: boolean;
      authorised: boolean;
    }>;
    importedAt: string | null;
    snapshot: unknown;
    updatedAt: string | null;
  }> = [];
  for (const organisation of organisations ?? []) {
    const row = snapshotsByOrganisation.get(organisation.id);
    if (row && !isAssistantWorkspaceSnapshot(row.payload, organisation)) {
      return safeBackendFailure();
    }
    result.push({
      id: organisation.id,
      name: organisation.name,
      contacts: (contactsByOrganisation.get(organisation.id) ?? []).map(
        (contact) => ({
          id: contact.id,
          name: contact.name,
          role: contact.role_title || "",
          email: contact.email || "",
          phone: contact.phone || undefined,
          primary: contact.primary_contact,
          authorised: contact.authorised,
        }),
      ),
      importedAt: row?.imported_at ?? null,
      snapshot: row?.payload ?? null,
      updatedAt: row?.updated_at ?? null,
    });
  }

  return NextResponse.json(
    { organisations: result },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  const originError = requireSameOrigin(request);
  if (originError) return originError;
  const auth = await requirePlatformRole(["main_consultant"]);
  if ("response" in auth) return auth.response;

  const contentLength = Number(request.headers.get("content-length") || 0);
  if (Number.isFinite(contentLength) && contentLength > 1_500_000) {
    return NextResponse.json(
      { error: "The selected client data is too large to import in one request." },
      { status: 413 },
    );
  }

  const body = await readJson(request);
  if (!isRecord(body) || typeof body.organisationId !== "string") {
    return invalidRequest("Choose a valid client organisation to import.");
  }
  if (!uuidPattern.test(body.organisationId)) {
    return invalidRequest("Choose a valid client organisation to import.");
  }
  if (!isRecord(body.snapshot)) {
    return invalidRequest("The selected browser data could not be verified.");
  }

  let serializedSnapshot: string;
  try {
    serializedSnapshot = JSON.stringify(body.snapshot);
  } catch {
    return invalidRequest("The selected browser data could not be verified.");
  }
  if (new TextEncoder().encode(serializedSnapshot).byteLength > 1_500_000) {
    return NextResponse.json(
      { error: "The selected client data is too large to import in one request." },
      { status: 413 },
    );
  }

  const { data: organisation, error: organisationError } = await auth.supabase
    .from("organisations")
    .select("id, name")
    .eq("id", body.organisationId)
    .eq("status", "active")
    .maybeSingle();
  if (organisationError) return safeBackendFailure();
  if (!organisation) {
    return NextResponse.json(
      { error: "The selected organisation is unavailable for import." },
      { status: 404 },
    );
  }
  if (!isAssistantWorkspaceSnapshot(body.snapshot, organisation)) {
    return invalidRequest(
      "The imported data does not match the selected organisation.",
    );
  }

  const admin = createAdminClient();
  if (!admin) return adminServiceUnavailable();
  const importedAt = new Date().toISOString();
  const { error: importError } = await auth.supabase
    .from("organisation_workspace_snapshots")
    .upsert(
      {
        organisation_id: organisation.id,
        snapshot_version: 1,
        payload: body.snapshot,
        imported_by: auth.access.userId,
        imported_at: importedAt,
      },
      { onConflict: "organisation_id" },
    );
  if (importError) return safeBackendFailure();

  const { error: recordsError } = await admin.rpc(
    "replace_organisation_client_records",
    {
      target_organisation_id: organisation.id,
      imported_records: body.snapshot.records,
      actor_user_id: auth.access.userId,
    },
  );
  if (recordsError) return safeBackendFailure();

  return NextResponse.json({
    status: "imported",
    organisationId: organisation.id,
    importedAt,
  });
}

export async function PATCH(request: Request) {
  const originError = requireSameOrigin(request);
  if (originError) return originError;

  const contentLength = Number(request.headers.get("content-length") || 0);
  if (Number.isFinite(contentLength) && contentLength > 50_000) {
    return NextResponse.json(
      { error: "The workspace update is too large." },
      { status: 413 },
    );
  }

  const body = await readJson(request);
  if (
    !isRecord(body) ||
    typeof body.organisationId !== "string" ||
    !uuidPattern.test(body.organisationId) ||
    typeof body.expectedUpdatedAt !== "string" ||
    Number.isNaN(Date.parse(body.expectedUpdatedAt))
  ) {
    return invalidRequest("Choose a valid assigned organisation and workspace version.");
  }
  const parsedMutation = parseAssistantWorkspaceMutation(body.mutation);
  if (!parsedMutation.ok) return invalidRequest(parsedMutation.error);

  const supabase = await createClient();
  const access = await getWorkspaceAccess(supabase);
  if (
    access.status !== "authorized" ||
    access.platformRoles.includes("main_consultant") ||
    !access.memberships.some(
      ({ role, organisationId }) =>
        role === "assistant_consultant" &&
        organisationId === body.organisationId,
    )
  ) {
    return NextResponse.json(
      { error: "You are not authorised to update this client workspace." },
      { status: access.status === "unauthenticated" ? 401 : 403 },
    );
  }

  const { data: organisation, error: organisationError } = await supabase
    .from("organisations")
    .select("id, name")
    .eq("id", body.organisationId)
    .eq("status", "active")
    .maybeSingle();
  if (organisationError) return safeBackendFailure();
  if (!organisation) {
    return NextResponse.json(
      { error: "The selected organisation is unavailable." },
      { status: 404 },
    );
  }

  const { data: row, error: snapshotError } = await supabase
    .from("organisation_workspace_snapshots")
    .select("payload, updated_at")
    .eq("organisation_id", organisation.id)
    .maybeSingle();
  if (snapshotError) return safeBackendFailure();
  if (!row) {
    return NextResponse.json(
      { error: "This client has no imported workspace data yet." },
      { status: 404 },
    );
  }
  if (row.updated_at !== body.expectedUpdatedAt) {
    return NextResponse.json(
      { error: "This workspace changed in another session. Refresh before saving." },
      { status: 409 },
    );
  }
  if (!isAssistantWorkspaceSnapshot(row.payload, organisation)) {
    return safeBackendFailure();
  }

  const result = applyAssistantWorkspaceMutation(
    row.payload,
    parsedMutation.value,
    organisation,
    access.displayName,
  );
  if (!result.ok) return invalidRequest(result.error);

  let serializedSnapshot: string;
  try {
    serializedSnapshot = JSON.stringify(result.value);
  } catch {
    return invalidRequest("The workspace update could not be verified.");
  }
  if (new TextEncoder().encode(serializedSnapshot).byteLength > 1_500_000) {
    return NextResponse.json(
      { error: "The updated workspace is too large to save." },
      { status: 413 },
    );
  }

  const admin = createAdminClient();
  if (!admin) return adminServiceUnavailable();
  const { data: updatedRow, error: updateError } = await admin
    .from("organisation_workspace_snapshots")
    .update({ payload: result.value })
    .eq("organisation_id", organisation.id)
    .eq("updated_at", row.updated_at)
    .select("updated_at")
    .maybeSingle();
  if (updateError) return safeBackendFailure();
  if (!updatedRow) {
    return NextResponse.json(
      { error: "This workspace changed in another session. Refresh before saving." },
      { status: 409 },
    );
  }

  const { error: recordsError } = await admin.rpc(
    "replace_organisation_client_records",
    {
      target_organisation_id: organisation.id,
      imported_records: result.value.records,
      actor_user_id: access.userId,
    },
  );
  if (recordsError) return safeBackendFailure();

  return NextResponse.json(
    {
      organisationId: organisation.id,
      snapshot: result.value,
      updatedAt: updatedRow.updated_at,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
