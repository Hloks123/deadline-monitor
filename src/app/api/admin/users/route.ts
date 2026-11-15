import { NextResponse } from "next/server";
import { prepareAdminAuditEvent } from "@/lib/admin/audit";
import {
  adminServiceUnavailable,
  invalidRequest,
  isAdministrator,
  isMainConsultant,
  readJson,
  requireSameOrigin,
  requirePlatformRole,
  safeBackendFailure,
} from "@/lib/admin/authorization";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  planInvitationMemberships,
  validateInvitationOrganisationSelection,
  type InvitationOrganisationRole,
  type InvitableOrganisationRole,
} from "@/lib/admin/userProvisioning";

export const dynamic = "force-dynamic";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const userRoles = new Set([
  "administrator",
  "assistant_consultant",
  "client_administrator",
  "client_user",
]);

type AdminClient = NonNullable<ReturnType<typeof createAdminClient>>;

function safeProvisioningMessage(message: string) {
  return message
    .replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, "[email]")
    .replace(
      /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi,
      "[id]",
    )
    .replace(/\bbearer\s+[\w.-]+/gi, "Bearer [redacted]")
    .replace(/\beyJ[\w.-]+\b/g, "[token]")
    .replace(
      /\b(password|token|secret|key|access[_ -]?token|refresh[_ -]?token|service[_ -]?role[_ -]?key)\s*[=:]\s*[^,\s]+/gi,
      "$1=[redacted]",
    )
    .slice(0, 240);
}

function logProvisioningFailure(
  operation: string,
  error: { code?: string; status?: number; message: string },
) {
  console.error("[api/admin/users] provisioning operation failed", {
    operation,
    code: error.code ?? "unknown",
    status: error.status ?? "unknown",
    message: safeProvisioningMessage(error.message),
  });
}

async function findAuthUserByEmail(admin: AdminClient, email: string) {
  const perPage = 1000;
  for (let page = 1; page <= 100; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) {
      logProvisioningFailure("auth user lookup", error);
      return { user: null, error };
    }

    const user = data.users.find(
      (candidate) => candidate.email?.toLowerCase() === email,
    );
    if (user) return { user, error: null };
    if (data.users.length < perPage) return { user: null, error: null };
  }

  return {
    user: null,
    error: { code: "lookup_limit", message: "Auth user lookup exceeded its page limit." },
  };
}

async function ensureInvitationAccess(
  admin: AdminClient,
  userId: string,
  role: string,
  organisationIds: string[],
) {
  const [platformResult, membershipResult] = await Promise.all([
    admin.from("platform_roles").select("role, active").eq("user_id", userId),
    admin
      .from("organisation_memberships")
      .select("organisation_id, role, active")
      .eq("user_id", userId),
  ]);
  if (platformResult.error) {
    logProvisioningFailure("platform role lookup", platformResult.error);
    return { error: "failed" as const };
  }
  if (membershipResult.error) {
    logProvisioningFailure("organisation membership lookup", membershipResult.error);
    return { error: "failed" as const };
  }

  const platformRoles = platformResult.data ?? [];
  const memberships = membershipResult.data ?? [];

  if (role === "administrator") {
    if (memberships.length || platformRoles.some((item) => item.role !== role)) {
      return { error: "conflict" as const };
    }
    const existingRole = platformRoles.find((item) => item.role === role);
    if (existingRole) {
      return existingRole.active
        ? { error: null }
        : { error: "conflict" as const };
    }

    const { error } = await admin.from("platform_roles").upsert(
      { user_id: userId, role, active: true },
      { onConflict: "user_id,role", ignoreDuplicates: true },
    );
    if (error) {
      logProvisioningFailure("platform role INSERT", error);
      return { error: "failed" as const };
    }
    const { data: verifiedRole, error: verifyError } = await admin
      .from("platform_roles")
      .select("active")
      .eq("user_id", userId)
      .eq("role", role)
      .maybeSingle();
    if (verifyError) {
      logProvisioningFailure("platform role verification", verifyError);
      return { error: "failed" as const };
    }
    return verifiedRole?.active
      ? { error: null }
      : { error: "failed" as const };
  }

  if (platformRoles.length) return { error: "conflict" as const };
  const requestedRole = role as InvitableOrganisationRole;
  const plan = planInvitationMemberships(
    userId,
    requestedRole,
    organisationIds,
    memberships.map((membership) => ({
      organisationId: membership.organisation_id,
      role: membership.role,
      active: membership.active,
    })),
  );
  if (plan.kind === "conflict") {
    return { error: "conflict" as const };
  }

  if (plan.rows.length) {
    const { error } = await admin
      .from("organisation_memberships")
      .upsert(plan.rows, {
        onConflict: "organisation_id,user_id",
        ignoreDuplicates: true,
      });
    if (error) {
      logProvisioningFailure("organisation membership INSERT", error);
      return { error: "failed" as const };
    }
  }

  const { data: verifiedMemberships, error: verifyError } = await admin
    .from("organisation_memberships")
    .select("organisation_id, role, active, is_primary")
    .eq("user_id", userId)
    .in("organisation_id", organisationIds);
  if (verifyError) {
    logProvisioningFailure("organisation membership verification", verifyError);
    return { error: "failed" as const };
  }
  const verifiedByOrganisation = new Map(
    (verifiedMemberships ?? []).map((membership) => [
      membership.organisation_id,
      membership,
    ]),
  );
  const allMembershipsVerified = organisationIds.every((organisationId) => {
    const membership = verifiedByOrganisation.get(organisationId);
    const expectedRole =
      requestedRole === "client_administrator" || requestedRole === "client_user"
        ? membership?.is_primary
          ? "client_administrator"
          : "client_user"
        : requestedRole;
    return membership?.role === expectedRole && membership.active;
  });
  if (!allMembershipsVerified) {
    logProvisioningFailure("organisation membership verification", {
      code: "verification_failed",
      status: 500,
      message: "The requested active membership could not be confirmed.",
    });
    return { error: "failed" as const };
  }
  return { error: null };
}

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

function isEmail(value: string) {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function GET() {
  const auth = await requirePlatformRole(["main_consultant", "administrator"]);
  if ("response" in auth) return auth.response;

  const admin = createAdminClient();
  if (!admin) return adminServiceUnavailable();

  const [profilesResult, platformRolesResult, membershipsResult, organisationsResult] =
    await Promise.all([
      admin
        .from("profiles")
        .select("id, display_name, email, active")
        .order("display_name"),
      admin
        .from("platform_roles")
        .select("user_id, role, active"),
      admin
        .from("organisation_memberships")
        .select("user_id, organisation_id, role, active"),
      admin.from("organisations").select("id, name"),
    ]);

  if (
    profilesResult.error ||
    platformRolesResult.error ||
    membershipsResult.error ||
    organisationsResult.error
  ) {
    return safeBackendFailure();
  }

  const rolesByUser = new Map<string, Array<{ role: string; active: boolean }>>();
  for (const role of platformRolesResult.data ?? []) {
    const roles = rolesByUser.get(role.user_id) ?? [];
    roles.push({ role: role.role, active: role.active });
    rolesByUser.set(role.user_id, roles);
  }

  const organisationNames = new Map(
    (organisationsResult.data ?? []).map((organisation) => [
      organisation.id,
      organisation.name,
    ]),
  );
  const membershipsByUser = new Map<
    string,
    Array<{
      organisationId: string;
      organisationName: string;
      role: string;
      active: boolean;
    }>
  >();
  for (const membership of membershipsResult.data ?? []) {
    const memberships = membershipsByUser.get(membership.user_id) ?? [];
    memberships.push({
      organisationId: membership.organisation_id,
      organisationName: organisationNames.get(membership.organisation_id) ?? "",
      role: membership.role,
      active: membership.active,
    });
    membershipsByUser.set(membership.user_id, memberships);
  }

  return NextResponse.json(
    {
      users: (profilesResult.data ?? []).map((profile) => ({
        id: profile.id,
        name: profile.display_name,
        email: profile.email,
        active: profile.active,
        platformRoles: rolesByUser.get(profile.id) ?? [],
        memberships: membershipsByUser.get(profile.id) ?? [],
      })),
      capabilities: {
        actorId: auth.access.userId,
        canAssignAdministrator: isMainConsultant(auth.access),
        canManageAccess: isMainConsultant(auth.access) || isAdministrator(auth.access),
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  const originError = requireSameOrigin(request);
  if (originError) return originError;
  const auth = await requirePlatformRole(["main_consultant", "administrator"]);
  if ("response" in auth) return auth.response;

  const body = await readJson(request);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return invalidRequest("Enter valid user details.");
  }
  const input = body as Record<string, unknown>;
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
  const role = typeof input.role === "string" ? input.role : "";
  const organisationIds = Array.isArray(input.organisationIds)
    ? input.organisationIds
    : [];
  const isMain = isMainConsultant(auth.access);

  if (
    !name ||
    name.length > 120 ||
    !isEmail(email) ||
    !userRoles.has(role) ||
    (role === "administrator" && !isMain) ||
    organisationIds.some(
      (id) => typeof id !== "string" || !uuidPattern.test(id),
    )
  ) {
    return invalidRequest("Review the user details and try again.");
  }

  const uniqueOrganisationIds = [...new Set(organisationIds as string[])];
  if (role === "assistant_consultant" && !isMain) {
    return NextResponse.json(
      { error: "Only the Main Consultant can invite Assistant Consultants." },
      { status: 403 },
    );
  }
  const selectionError = validateInvitationOrganisationSelection(
    role as InvitationOrganisationRole,
    uniqueOrganisationIds,
  );
  if (selectionError) {
    return invalidRequest(selectionError);
  }

  const admin = createAdminClient();
  if (!admin) return adminServiceUnavailable();
  const baseUrl = siteUrl();
  if (!baseUrl) {
    return NextResponse.json(
      { error: "The invitation could not be sent. Try again or contact support." },
      { status: 503 },
    );
  }

  if (uniqueOrganisationIds.length) {
    const { data: organisations, error } = await admin
      .from("organisations")
      .select("id")
      .in("id", uniqueOrganisationIds)
      .eq("status", "active");
    if (error) return safeBackendFailure();
    if ((organisations ?? []).length !== uniqueOrganisationIds.length) {
      return invalidRequest("Select only active organisations.");
    }
  }

  let invitedUser: { id: string } | null = null;
  let recoveredExistingAuthUser = false;
  const { data: invited, error: inviteError } =
    await admin.auth.admin.inviteUserByEmail(email, {
      data: { display_name: name },
      redirectTo: `${baseUrl}/auth/callback?next=/update-password`,
    });
  if (inviteError) {
    const errorCode = inviteError.code?.toLowerCase();
    if (
      errorCode === "email_exists" ||
      errorCode === "user_already_exists"
    ) {
      const existing = await findAuthUserByEmail(admin, email);
      if (existing.error) {
        return NextResponse.json(
          {
            error: "The existing account could not be verified. No new invitation was sent.",
            provisioningState: "partial",
          },
          { status: 502 },
        );
      }
      if (!existing.user) {
        return NextResponse.json(
          {
            error: "An account already exists for this email address.",
          },
          { status: 409 },
        );
      }
      invitedUser = { id: existing.user.id };
      recoveredExistingAuthUser = true;
    } else {
      const errorMessage = inviteError.message.toLowerCase();
      if (
        errorCode === "redirect_to_not_allowed" ||
        (errorMessage.includes("redirect") &&
          (errorMessage.includes("not allowed") ||
            errorMessage.includes("allowlist")))
      ) {
        return NextResponse.json(
          {
            error: "The invitation could not be sent. Try again or contact support.",
          },
          { status: 503 },
        );
      }
      console.error("[api/admin/users] Auth invitation failed", {
        code: inviteError.code ?? "unknown",
        status: inviteError.status ?? "unknown",
      });
      return NextResponse.json(
        { error: "The user could not be invited. Check the email or contact support." },
        { status: inviteError.status === 429 ? 429 : 400 },
      );
    }
  } else {
    invitedUser = invited.user ? { id: invited.user.id } : null;
  }
  if (!invitedUser) {
    return NextResponse.json(
      {
        error: "The invitation was sent, but account access is not ready. Contact support before retrying.",
        provisioningState: "partial",
      },
      { status: 502 },
    );
  }

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id, active")
    .eq("id", invitedUser.id)
    .maybeSingle();
  if (profileError) {
    logProvisioningFailure("profile lookup", profileError);
    return NextResponse.json(
      {
        error: "The invitation was sent, but account access is not ready. Contact support before retrying.",
        provisioningState: "partial",
      },
      { status: 502 },
    );
  }
  if (!profile) {
    logProvisioningFailure("profile availability", {
      code: "profile_missing",
      status: 404,
      message: "Auth user has no matching public profile.",
    });
    return NextResponse.json(
      {
        error:
          "The account exists, but its profile is not ready yet. No access was assigned. Please contact support.",
        provisioningState: "partial",
      },
      { status: 502 },
    );
  }
  if (!profile.active) {
    return NextResponse.json(
      {
        error: "This account is inactive. Reactivate it through Users & Access before assigning access.",
      },
      { status: 409 },
    );
  }

  const accessResult = await ensureInvitationAccess(
    admin,
    invitedUser.id,
    role,
    uniqueOrganisationIds,
  );
  if (accessResult.error === "conflict") {
    return NextResponse.json(
      { error: "The existing account has conflicting or inactive access. Review it in Users & Access." },
      { status: 409 },
    );
  }
  if (accessResult.error) {
    return NextResponse.json(
      {
        error: recoveredExistingAuthUser
          ? "Existing account access is still incomplete. No new invitation was sent; retry to resume provisioning."
          : "The invitation was sent, but access setup is incomplete. Retry to resume provisioning; no duplicate invitation will be sent.",
        provisioningState: "partial",
      },
      { status: 502 },
    );
  }

  prepareAdminAuditEvent("user.invited", auth.access.userId, invitedUser.id);
  prepareAdminAuditEvent(
    role === "administrator"
      ? "user.platform_role_changed"
      : "user.membership_changed",
    auth.access.userId,
    invitedUser.id,
  );

  return NextResponse.json(
    {
      recoveredExistingAuthUser,
      audit: { prepared: true, persisted: false },
    },
    { status: recoveredExistingAuthUser ? 200 : 201 },
  );
}
