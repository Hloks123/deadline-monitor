import type { AuthError, SupabaseClient, User } from "@supabase/supabase-js";

export type PlatformRole = "administrator" | "main_consultant";

export type WorkspaceRole =
  | "assistant_consultant"
  | "client_administrator"
  | "client_user";

export type WorkspaceAccess =
  | { status: "unauthenticated" }
  | { status: "profile_missing" }
  | { status: "profile_inactive" }
  | { status: "no_membership" }
  | { status: "unavailable" }
  | {
      status: "authorized";
      userId: string;
      displayName: string;
      platformRoles: PlatformRole[];
      memberships: Array<{
        organisationId: string;
        role: WorkspaceRole;
        isPrimary: boolean;
        jobTitle: string;
      }>;
      defaultWorkspace: "consultant" | "client";
    };

const consultantRoles = new Set<WorkspaceRole>(["assistant_consultant"]);
const clientRoles = new Set<WorkspaceRole>(["client_administrator", "client_user"]);

export async function getWorkspaceAccess(
  supabase: SupabaseClient,
  authResult?: { user: User | null; error: AuthError | null },
): Promise<WorkspaceAccess> {
  let user: User | null;
  let userError: AuthError | null;

  if (authResult) {
    user = authResult.user;
    userError = authResult.error;
  } else {
    const result = await supabase.auth.getUser();
    user = result.data.user;
    userError = result.error;
  }

  if (userError?.name === "AuthSessionMissingError") {
    return { status: "unauthenticated" };
  }
  if (userError) return { status: "unavailable" };
  if (!user) return { status: "unauthenticated" };

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, display_name, active")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) return { status: "unavailable" };
  if (!profile) return { status: "profile_missing" };
  if (!profile.active) return { status: "profile_inactive" };

  const { data: rawPlatformRoles, error: platformRoleError } = await supabase.rpc(
    "get_current_platform_roles",
  );
  if (platformRoleError) return { status: "unavailable" };
  const platformRoles = Array.isArray(rawPlatformRoles)
    ? rawPlatformRoles.filter(
        (role): role is PlatformRole =>
          role === "administrator" || role === "main_consultant",
      )
    : [];

  const { data: rows, error: membershipsError } = await supabase
    .from("organisation_memberships")
    .select("organisation_id, role, is_primary, job_title")
    .eq("user_id", user.id)
    .eq("active", true);

  if (membershipsError) return { status: "unavailable" };

  const organisationIds = [...new Set((rows ?? []).map((row) => row.organisation_id))];
  const { data: visibleOrganisations, error: organisationsError } = organisationIds.length
    ? await supabase.from("organisations").select("id").in("id", organisationIds)
    : { data: [], error: null };
  if (organisationsError) return { status: "unavailable" };
  const visibleOrganisationIds = new Set(
    (visibleOrganisations ?? []).map((organisation) => organisation.id),
  );

  const memberships = (rows ?? []).flatMap((row) => {
    if (
      (row.role !== "assistant_consultant" &&
        row.role !== "client_administrator" &&
        row.role !== "client_user") ||
      !visibleOrganisationIds.has(row.organisation_id)
    ) {
      return [];
    }

    return [{
      organisationId: row.organisation_id,
      role: row.role,
      isPrimary: row.is_primary,
      jobTitle: row.job_title,
    }];
  });

  const hasConsultantAccess =
    platformRoles.includes("main_consultant") ||
    memberships.some(({ role }) => consultantRoles.has(role));
  const clientMemberships = memberships.filter(({ role }) =>
    clientRoles.has(role),
  );
  if (
    platformRoles.length === 0 &&
    !memberships.some(({ role }) => consultantRoles.has(role)) &&
    new Set(clientMemberships.map(({ organisationId }) => organisationId)).size > 1
  ) {
    return { status: "no_membership" };
  }
  const hasClientAccess =
    platformRoles.length === 0 &&
    !memberships.some(({ role }) => consultantRoles.has(role)) &&
    clientMemberships.length > 0;
  const hasAdministratorAccess = platformRoles.includes("administrator");

  if (!hasConsultantAccess && !hasClientAccess && !hasAdministratorAccess) {
    return { status: "no_membership" };
  }

  return {
    status: "authorized",
    userId: user.id,
    displayName: profile.display_name,
    platformRoles,
    memberships,
    defaultWorkspace:
      hasConsultantAccess || hasAdministratorAccess ? "consultant" : "client",
  };
}

export function canAccessWorkspace(
  access: WorkspaceAccess,
  workspace: "consultant" | "client",
): boolean {
  if (access.status !== "authorized") return false;
  if (workspace === "consultant") {
    return (
      access.platformRoles.includes("main_consultant") ||
      access.memberships.some(({ role }) => consultantRoles.has(role))
    );
  }
  if (
    access.platformRoles.length > 0 ||
    access.memberships.some(({ role }) => consultantRoles.has(role))
  ) {
    return false;
  }
  const roles = clientRoles;
  return access.memberships.some(({ role }) => roles.has(role));
}

export function canAccessConsultantRoute(
  access: WorkspaceAccess,
  pathname: string,
): boolean {
  if (access.status !== "authorized") return false;

  const isMainConsultant = access.platformRoles.includes("main_consultant");
  if (!isMainConsultant && access.platformRoles.includes("administrator")) {
    return (
      pathname === "/dashboard" ||
      pathname === "/settings" ||
      pathname === "/account"
    );
  }

  if (pathname === "/settings") {
    return isMainConsultant;
  }
  if (pathname === "/clients/new") {
    return isMainConsultant;
  }

  if (!isMainConsultant && (
    pathname === "/monitored-records/new" ||
    /^\/monitored-records\/[^/]+\/edit$/.test(pathname) ||
    pathname === "/recurring-tasks" ||
    pathname.startsWith("/recurring-tasks/")
  )) {
    return false;
  }

  return canAccessWorkspace(access, "consultant");
}

export function getWorkspacePath(
  access: Extract<WorkspaceAccess, { status: "authorized" }>,
): string {
  return access.defaultWorkspace === "consultant"
    ? "/dashboard"
    : "/client/dashboard";
}
