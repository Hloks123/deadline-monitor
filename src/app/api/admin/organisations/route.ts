import { NextResponse } from "next/server";
import { prepareAdminAuditEvent } from "@/lib/admin/audit";
import { getWorkspaceAccess } from "@/lib/auth/workspace";
import {
  adminServiceUnavailable,
  invalidRequest,
  readJson,
  requireSameOrigin,
  requirePlatformRole,
  safeBackendFailure,
} from "@/lib/admin/authorization";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const packages = new Set(["starter", "standard", "managed", "custom"]);
const statuses = new Set(["active", "pilot", "suspended"]);

function isValidTimezone(value: string) {
  try {
    new Intl.DateTimeFormat("en", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const access = await getWorkspaceAccess(supabase);
  if (
    access.status !== "authorized" ||
    (!access.platformRoles.includes("main_consultant") &&
      !access.platformRoles.includes("administrator") &&
      !access.memberships.some(({ role }) => role === "assistant_consultant"))
  ) {
    return NextResponse.json(
      { error: "You are not authorised to view organisations." },
      { status: access.status === "unauthenticated" ? 401 : 403 },
    );
  }

  const includeInactive =
    new URL(request.url).searchParams.get("includeInactive") === "true";
  const canManageOrganisations =
    access.platformRoles.includes("main_consultant") ||
    access.platformRoles.includes("administrator");

  if (includeInactive && !canManageOrganisations) {
    return NextResponse.json(
      { error: "You are not authorised to view inactive organisations." },
      { status: 403 },
    );
  }

  if (canManageOrganisations) {
    const admin = createAdminClient();
    if (!admin) return adminServiceUnavailable();
    let query = admin
      .from("organisations")
      .select("id, name, registration_number, service_package, status, timezone, reminder_preferences")
      .order("name");
    if (!includeInactive) query = query.eq("status", "active");
    const { data, error } = await query;
    if (error) return safeBackendFailure();
    const organisations = data ?? [];
    const organisationIds = organisations.map(({ id }) => id);
    const { data: contacts, error: contactsError } = organisationIds.length
      ? await admin
          .from("organisation_contacts")
          .select("id, organisation_id, name, email, phone, role_title, authorised, primary_contact")
          .in("organisation_id", organisationIds)
          .eq("active", true)
      : { data: [], error: null };
    if (contactsError) return safeBackendFailure();
    const contactsByOrganisation = new Map<string, typeof contacts>();
    for (const contact of contacts ?? []) {
      const current = contactsByOrganisation.get(contact.organisation_id) ?? [];
      current.push(contact);
      contactsByOrganisation.set(contact.organisation_id, current);
    }
    return NextResponse.json({ organisations: organisations.map((organisation) => ({
      ...organisation,
      contacts: contactsByOrganisation.get(organisation.id) ?? [],
    })) }, {
      headers: { "Cache-Control": "no-store" },
    });
  }

  const { data, error } = await supabase
    .from("organisations")
    .select("id, name, registration_number, service_package, status, timezone, reminder_preferences, created_at, updated_at")
    .eq("status", "active")
    .order("name");
  if (error) return safeBackendFailure();

  const organisationIds = (data ?? []).map(({ id }) => id);
  const { data: contacts, error: contactsError } = organisationIds.length
    ? await supabase
        .from("organisation_contacts")
        .select("id, organisation_id, name, email, phone, role_title, authorised, primary_contact")
        .in("organisation_id", organisationIds)
        .eq("active", true)
    : { data: [], error: null };
  if (contactsError) return safeBackendFailure();
  const contactsByOrganisation = new Map<string, typeof contacts>();
  for (const contact of contacts ?? []) {
    const current = contactsByOrganisation.get(contact.organisation_id) ?? [];
    current.push(contact);
    contactsByOrganisation.set(contact.organisation_id, current);
  }

  return NextResponse.json({ organisations: (data ?? []).map((organisation) => ({
    ...organisation,
    contacts: contactsByOrganisation.get(organisation.id) ?? [],
  })) }, {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: Request) {
  const originError = requireSameOrigin(request);
  if (originError) return originError;
  const auth = await requirePlatformRole(["main_consultant", "administrator"]);
  if ("response" in auth) return auth.response;

  const body = await readJson(request);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return invalidRequest("Enter valid organisation details.");
  }
  const input = body as Record<string, unknown>;
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const registrationNumber =
    typeof input.registrationNumber === "string"
      ? input.registrationNumber.trim()
      : "";
  const servicePackage =
    typeof input.servicePackage === "string"
      ? input.servicePackage.toLowerCase()
      : "";
  const status = typeof input.status === "string" ? input.status.toLowerCase() : "";
  const timezone = typeof input.timezone === "string" ? input.timezone : "";
  const reminderChannel =
    typeof input.reminderChannel === "string"
      ? input.reminderChannel.toLowerCase()
      : "";

  if (
    !name ||
    name.length > 200 ||
    registrationNumber.length > 100 ||
    !packages.has(servicePackage) ||
    !statuses.has(status) ||
    !isValidTimezone(timezone) ||
    !["email", "phone", "whatsapp"].includes(reminderChannel)
  ) {
    return invalidRequest("Review the organisation details and try again.");
  }

  const admin = createAdminClient();
  if (!admin) return adminServiceUnavailable();

  const { data: existing, error: existingError } = await admin
    .from("organisations")
    .select("id, name");
  if (existingError) return safeBackendFailure();
  if (
    (existing ?? []).some(
      (organisation) =>
        organisation.name.trim().toLocaleLowerCase() ===
        name.toLocaleLowerCase(),
    )
  ) {
    return NextResponse.json(
      { error: "An organisation with this name already exists." },
      { status: 409 },
    );
  }

  const { data, error } = await admin
    .from("organisations")
    .insert({
      name,
      registration_number: registrationNumber || null,
      service_package: servicePackage,
      status,
      timezone,
      reminder_preferences: { preferredChannel: reminderChannel },
    })
    .select("id, name, registration_number, service_package, status, timezone, reminder_preferences")
    .single();
  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "An organisation with this name already exists." },
        { status: 409 },
      );
    }
    return safeBackendFailure();
  }

  const audit = prepareAdminAuditEvent(
    "organisation.created",
    auth.access.userId,
    data.id,
  );
  return NextResponse.json(
    { organisation: data, audit: { prepared: true, persisted: false, event: audit } },
    { status: 201 },
  );
}
