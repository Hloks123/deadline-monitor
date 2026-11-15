import type { Client, ClientStatus, ServicePackage } from "@/lib/clientStore";

export type ManagedOrganisation = {
  id: string;
  name: string;
  registration_number: string | null;
  service_package: string;
  status: string;
  timezone: string;
  reminder_preferences: unknown;
  contacts?: ManagedOrganisationContact[];
};

export type ManagedOrganisationContact = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role_title: string | null;
  authorised: boolean;
  primary_contact: boolean;
};

const packages: Record<string, ServicePackage> = {
  starter: "Starter",
  standard: "Standard",
  managed: "Managed",
  custom: "Custom",
};

const statuses: Record<string, ClientStatus> = {
  active: "Active",
  pilot: "Pilot",
  suspended: "Suspended",
};

export function clientFromOrganisation(
  organisation: ManagedOrganisation,
  legacyClient?: Client,
): Client {
  return {
    ...(legacyClient ?? {
      id: organisation.id,
      reminderPreference: "Email" as const,
      contacts: [],
    }),
    canonicalOrganisationId: organisation.id,
    company: organisation.name,
    registrationNumber: organisation.registration_number || undefined,
    servicePackage: packages[organisation.service_package] || "Custom",
    status: statuses[organisation.status] || "Pilot",
    contacts: (organisation.contacts ?? []).map((contact) => ({
      id: contact.id,
      name: contact.name,
      role: contact.role_title || "",
      email: contact.email || "",
      phone: contact.phone || "",
      primary: contact.primary_contact,
      authorised: contact.authorised,
    })),
  };
}

export function mergeManagedOrganisations(
  legacyClients: Client[],
  organisations: ManagedOrganisation[],
): Client[] {
  const byName = new Map(
    legacyClients.map((client) => [
      client.company.trim().toLocaleLowerCase(),
      client,
    ]),
  );
  const matchedIds = new Set<string>();

  const managedClients = organisations.map((organisation) => {
    const legacy = byName.get(organisation.name.trim().toLocaleLowerCase());
    if (legacy) matchedIds.add(legacy.id);
    return clientFromOrganisation(organisation, legacy);
  });
  const unmatchedLegacy = legacyClients.filter(
    (client) => !matchedIds.has(client.id),
  );

  return [...managedClients, ...unmatchedLegacy];
}
