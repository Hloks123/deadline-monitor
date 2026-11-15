import type { PlatformRole, WorkspaceRole } from "@/lib/auth/workspace";

type OrganisationMembership = {
  organisationId: string;
  role: WorkspaceRole;
};

export function canAccessMonitoredRecordOrganisation(
  organisationId: string,
  platformRoles: PlatformRole[],
  memberships: OrganisationMembership[],
) {
  return platformRoles.includes("main_consultant") ||
    memberships.some(
      (membership) =>
        membership.organisationId === organisationId &&
        membership.role === "assistant_consultant",
    );
}
