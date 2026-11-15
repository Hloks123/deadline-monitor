export type AuthenticatedClientOrganisation = {
  id: string;
  name: string;
  role: "client_administrator" | "client_user";
  isPrimary: boolean;
  userId: string;
  userName: string;
  userEmail: string;
};

let authenticatedOrganisation: AuthenticatedClientOrganisation | undefined;

export let CLIENT_WORKSPACE_ORGANISATION_ID = "";
export let CLIENT_WORKSPACE_USER = "";

export function getClientProfileStorageKey(key: string) {
  if (!authenticatedOrganisation) return key;
  return [
    "docmon_client_profile_v1",
    encodeURIComponent(authenticatedOrganisation.id),
    encodeURIComponent(authenticatedOrganisation.userId),
    key,
  ].join(":");
}

export function setAuthenticatedClientOrganisation(
  organisation: AuthenticatedClientOrganisation,
  prototypeOrganisationId?: string,
) {
  authenticatedOrganisation = organisation;
  CLIENT_WORKSPACE_ORGANISATION_ID = prototypeOrganisationId || "";
  CLIENT_WORKSPACE_USER = organisation.userName;
}

export function clearAuthenticatedClientOrganisation() {
  authenticatedOrganisation = undefined;
  CLIENT_WORKSPACE_ORGANISATION_ID = "";
  CLIENT_WORKSPACE_USER = "";
}

export function getAuthenticatedClientOrganisation() {
  return authenticatedOrganisation;
}
