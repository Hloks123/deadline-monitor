import { NextResponse } from "next/server";
import { prepareAdminAuditEvent } from "@/lib/admin/audit";
import {
  adminServiceUnavailable,
  invalidRequest,
  readJson,
  requireSameOrigin,
  requirePlatformRole,
  safeBackendFailure,
} from "@/lib/admin/authorization";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const packages = new Set(["starter", "standard", "managed", "custom"]);
const statuses = new Set(["active", "pilot", "suspended"]);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidTimezone(value: string) {
  try {
    new Intl.DateTimeFormat("en", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export async function PATCH(
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
        organisation.id !== organisationId &&
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
    .update({
      name,
      registration_number: registrationNumber || null,
      service_package: servicePackage,
      status,
      timezone,
      reminder_preferences: { preferredChannel: reminderChannel },
    })
    .eq("id", organisationId)
    .select("id, name, registration_number, service_package, status, timezone, reminder_preferences")
    .maybeSingle();
  if (error?.code === "23505") {
    return NextResponse.json(
      { error: "An organisation with this name already exists." },
      { status: 409 },
    );
  }
  if (error) return safeBackendFailure();
  if (!data) {
    return NextResponse.json({ error: "The organisation could not be found." }, {
      status: 404,
    });
  }

  const audit = prepareAdminAuditEvent(
    "organisation.updated",
    auth.access.userId,
    organisationId,
  );
  return NextResponse.json({
    organisation: data,
    audit: { prepared: true, persisted: false, event: audit },
  });
}
