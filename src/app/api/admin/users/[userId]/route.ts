import { NextResponse } from "next/server";
import { prepareAdminAuditEvent } from "@/lib/admin/audit";
import {
  adminServiceUnavailable,
  invalidRequest,
  isMainConsultant,
  readJson,
  requireSameOrigin,
  requirePlatformRole,
  safeBackendFailure,
} from "@/lib/admin/authorization";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const organisationRoles = new Set([
  "assistant_consultant",
  "client_administrator",
  "client_user",
]);

function siteUrl() {
  const value = process.env.NEXT_PUBLIC_SITE_URL;
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.hostname !== "localhost") return null;
    return url.origin;
  } catch {
    return null;
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ userId: string }> },
) {
  const originError = requireSameOrigin(request);
  if (originError) return originError;
  const auth = await requirePlatformRole(["main_consultant", "administrator"]);
  if ("response" in auth) return auth.response;

  const { userId } = await context.params;
  if (!uuidPattern.test(userId) || userId === auth.access.userId) {
    return invalidRequest("This account cannot be changed from the current session.");
  }

  const body = await readJson(request);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return invalidRequest("Enter a valid access change.");
  }
  const input = body as Record<string, unknown>;
  const admin = createAdminClient();
  if (!admin) return adminServiceUnavailable();

  const { data: target, error: targetError } = await admin
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();
  if (targetError) return safeBackendFailure();
  if (!target) {
    return NextResponse.json({ error: "The user could not be found." }, {
      status: 404,
    });
  }

  const { data: mainRole, error: roleLookupError } = await admin
    .from("platform_roles")
    .select("user_id")
    .eq("user_id", userId)
    .eq("role", "main_consultant")
    .maybeSingle();
  if (roleLookupError) return safeBackendFailure();
  if (mainRole) {
    return NextResponse.json(
      { error: "Main consultant access cannot be changed through this workflow." },
      { status: 403 },
    );
  }

  let auditAction:
    | "user.profile_status_changed"
    | "user.membership_changed"
    | "user.platform_role_changed";

  if (input.type === "profile" && typeof input.active === "boolean") {
    const { error } = await admin
      .from("profiles")
      .update({ active: input.active })
      .eq("id", userId);
    if (error) return safeBackendFailure();
    auditAction = "user.profile_status_changed";
  } else if (
    input.type === "membership" &&
    typeof input.active === "boolean" &&
    typeof input.organisationId === "string" &&
    uuidPattern.test(input.organisationId) &&
    typeof input.role === "string" &&
    organisationRoles.has(input.role)
  ) {
    if (input.role === "assistant_consultant" && !isMainConsultant(auth.access)) {
      return NextResponse.json(
        { error: "Only the Main Consultant can manage Assistant Consultant assignments." },
        { status: 403 },
      );
    }

    const { data: organisation, error: organisationError } = await admin
      .from("organisations")
      .select("id")
      .eq("id", input.organisationId)
      .maybeSingle();
    if (organisationError) return safeBackendFailure();
    if (!organisation) {
      return invalidRequest("Select an existing organisation.");
    }
    if (input.active) {
      const { data: activeOrganisation, error } = await admin
        .from("organisations")
        .select("id")
        .eq("id", input.organisationId)
        .eq("status", "active")
        .maybeSingle();
      if (error) return safeBackendFailure();
      if (!activeOrganisation) {
        return invalidRequest("Access cannot be assigned to an inactive organisation.");
      }
      const { data: currentMemberships, error: membershipsError } = await admin
        .from("organisation_memberships")
        .select("role, organisation_id, active")
        .eq("user_id", userId);
      if (membershipsError) return safeBackendFailure();
      const assigningConsultant = input.role === "assistant_consultant";
      const hasConflictingRole = (currentMemberships ?? []).some(
        (membership) =>
          membership.active &&
          (assigningConsultant
            ? membership.role === "client_administrator" ||
              membership.role === "client_user"
            : membership.role === "assistant_consultant"),
      );
      const hasDifferentClientOrganisation =
        (input.role === "client_administrator" || input.role === "client_user") &&
        (currentMemberships ?? []).some(
          (membership) =>
            membership.active &&
            (membership.role === "client_administrator" ||
              membership.role === "client_user") &&
            input.organisationId !== membership.organisation_id,
        );
      if (input.active && hasConflictingRole) {
        return invalidRequest(
          "A user cannot have both consultant and client workspace access.",
        );
      }
      if (input.active && hasDifferentClientOrganisation) {
        return invalidRequest(
          "Client accounts must be assigned one organisation until an organisation selector is available.",
        );
      }
    }

    const { error } = await admin
      .from("organisation_memberships")
      .upsert(
        {
          user_id: userId,
          organisation_id: input.organisationId,
          role: input.role,
          active: input.active,
        },
        { onConflict: "organisation_id,user_id" },
      );
    if (error) return safeBackendFailure();
    auditAction = "user.membership_changed";
  } else if (
    input.type === "platform_role" &&
    input.role === "administrator" &&
    typeof input.active === "boolean"
  ) {
    if (!isMainConsultant(auth.access)) {
      return NextResponse.json(
        { error: "Only the main consultant can manage administrator access." },
        { status: 403 },
      );
    }
    const { error } = await admin
      .from("platform_roles")
      .upsert(
        {
          user_id: userId,
          role: "administrator",
          active: input.active,
        },
        { onConflict: "user_id,role" },
      );
    if (error) return safeBackendFailure();
    auditAction = "user.platform_role_changed";
  } else {
    return invalidRequest("The requested access change is not supported.");
  }

  const audit = prepareAdminAuditEvent(auditAction, auth.access.userId, userId);
  return NextResponse.json({
    updated: true,
    audit: { prepared: true, persisted: false, event: audit },
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ userId: string }> },
) {
  const originError = requireSameOrigin(request);
  if (originError) return originError;
  const auth = await requirePlatformRole(["main_consultant", "administrator"]);
  if ("response" in auth) return auth.response;

  const { userId } = await context.params;
  if (!uuidPattern.test(userId)) {
    return invalidRequest("The user could not be found.");
  }

  const body = await readJson(request);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return invalidRequest("Enter a valid request.");
  }
  if ((body as Record<string, unknown>).action !== "password_reset") {
    return invalidRequest("The requested action is not supported.");
  }

  const admin = createAdminClient();
  const baseUrl = siteUrl();
  if (!admin) return adminServiceUnavailable();
  if (!baseUrl) {
    return NextResponse.json(
      { error: "The password reset could not be sent. Try again or contact support." },
      { status: 503 },
    );
  }

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("email")
    .eq("id", userId)
    .maybeSingle();
  if (profileError) return safeBackendFailure();
  if (!profile?.email) {
    return NextResponse.json({ error: "The user could not be found." }, {
      status: 404,
    });
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(profile.email, {
    redirectTo: `${baseUrl}/auth/callback`,
  });
  if (error) return safeBackendFailure();

  const audit = prepareAdminAuditEvent(
    "user.password_reset_requested",
    auth.access.userId,
    userId,
  );
  return NextResponse.json({
    sent: true,
    audit: { prepared: true, persisted: false, event: audit },
  });
}
