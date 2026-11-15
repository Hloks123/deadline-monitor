export type InvitableOrganisationRole =
  | "assistant_consultant"
  | "client_administrator"
  | "client_user";

export type InvitationOrganisationRole =
  | "administrator"
  | InvitableOrganisationRole;

export type InvitationMembership = {
  user_id: string;
  organisation_id: string;
  role: InvitableOrganisationRole;
  active: true;
};

export type ExistingInvitationMembership = {
  organisationId: string;
  role: string;
  active: boolean;
};

export function validateInvitationOrganisationSelection(
  role: InvitationOrganisationRole,
  organisationIds: string[],
): string | undefined {
  if (role === "administrator") {
    return organisationIds.length === 0
      ? undefined
      : "Administrator access does not use organisation assignments.";
  }
  if (role === "assistant_consultant") {
    return organisationIds.length > 0
      ? undefined
      : "Select at least one organisation for this Assistant Consultant.";
  }
  return organisationIds.length === 1
    ? undefined
    : "Select exactly one organisation for this client user.";
}

export function buildInvitationMemberships(
  userId: string,
  role: InvitableOrganisationRole,
  organisationIds: string[],
): InvitationMembership[] {
  return [...new Set(organisationIds)].map((organisationId) => ({
    user_id: userId,
    organisation_id: organisationId,
    role,
    active: true,
  }));
}

export function planInvitationMemberships(
  userId: string,
  role: InvitableOrganisationRole,
  organisationIds: string[],
  existingMemberships: ExistingInvitationMembership[],
) {
  const isAssistant = role === "assistant_consultant";
  if (
    existingMemberships.some(
      (membership) =>
        membership.role !== role ||
        (!isAssistant && !organisationIds.includes(membership.organisationId)),
    )
  ) {
    return { kind: "conflict" as const, rows: [] };
  }

  const existingByOrganisation = new Map(
    existingMemberships.map((membership) => [
      membership.organisationId,
      membership,
    ]),
  );
  const missingOrganisationIds: string[] = [];
  for (const organisationId of organisationIds) {
    const existing = existingByOrganisation.get(organisationId);
    if (!existing) {
      missingOrganisationIds.push(organisationId);
    } else if (!existing.active) {
      return { kind: "conflict" as const, rows: [] };
    }
  }

  return {
    kind: "ready" as const,
    rows: buildInvitationMemberships(
      userId,
      role,
      missingOrganisationIds,
    ),
  };
}
