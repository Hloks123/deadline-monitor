import { NextResponse } from "next/server";
import { prepareAdminAuditEvent } from "@/lib/admin/audit";
import {
  adminServiceUnavailable,
  invalidRequest,
  readJson,
  requirePlatformRole,
  requireSameOrigin,
  safeBackendFailure,
} from "@/lib/admin/authorization";
import { parseOrganisationContacts } from "@/lib/admin/organisationContacts";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ organisationId: string }> },
) {
  const originError = requireSameOrigin(request);
  if (originError) return originError;
  const auth = await requirePlatformRole(["main_consultant", "administrator"]);
  if ("response" in auth) return auth.response;

  const { organisationId } = await context.params;
  if (!uuidPattern.test(organisationId)) {
    return invalidRequest("The organisation could not be found.");
  }
  const body = await readJson(request);
  if (!isRecord(body)) return invalidRequest("Enter valid contact details.");
  const contacts = parseOrganisationContacts(body.contacts);
  if (!contacts) {
    return invalidRequest(
      "Add at least one authorised contact with a valid email address and exactly one primary contact.",
    );
  }

  const admin = createAdminClient();
  if (!admin) return adminServiceUnavailable();
  const { data: organisation, error: organisationError } = await admin
    .from("organisations")
    .select("id")
    .eq("id", organisationId)
    .maybeSingle();
  if (organisationError) return safeBackendFailure();
  if (!organisation) {
    return NextResponse.json({ error: "The organisation could not be found." }, {
      status: 404,
    });
  }

  const { error } = await admin.rpc("replace_organisation_contacts", {
    target_organisation_id: organisationId,
    contacts_input: contacts,
  });
  if (error) return safeBackendFailure();

  const { data: savedContacts, error: contactsError } = await admin
    .from("organisation_contacts")
    .select("id, organisation_id, name, email, phone, role_title, authorised, primary_contact")
    .eq("organisation_id", organisationId)
    .eq("active", true)
    .order("created_at");
  if (contactsError) return safeBackendFailure();

  const audit = prepareAdminAuditEvent(
    "organisation.contacts_updated",
    auth.access.userId,
    organisationId,
  );
  return NextResponse.json({
    contacts: savedContacts ?? [],
    audit: { prepared: true, persisted: false, event: audit },
  });
}
