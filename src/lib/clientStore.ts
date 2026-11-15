import { addAuditEvent } from "./recordStore";

export type ClientStatus =
  | "Active"
  | "Pilot"
  | "Suspended";

export type ServicePackage =
  | "Starter"
  | "Standard"
  | "Managed"
  | "Custom";

export type ClientContact = {
  id: string;
  name: string;
  role: string;
  email: string;
  phone?: string;
  primary: boolean;
  authorised: boolean;
};

export type Client = {
  id: string;
  canonicalOrganisationId?: string;
  company: string;
  registrationNumber?: string;
  servicePackage: ServicePackage;
  status: ClientStatus;
  reminderPreference: "Email" | "Phone" | "WhatsApp";
  contacts: ClientContact[];
};

const CLIENTS_KEY = "doc-monitor-clients";

export const defaultClients: Client[] = [
  {
    id: "demo-construction",
    company: "Demo Construction (Pty) Ltd",
    registrationNumber: "2020/000001/07",
    servicePackage: "Managed",
    status: "Active",
    reminderPreference: "Email",
    contacts: [
      {
        id: "demo-construction-primary",
        name: "Primary Authorised Contact",
        role: "Operations Manager",
        email: "contact@democonstruction.co.za",
        primary: true,
        authorised: true,
      },
      {
        id: "demo-construction-director",
        name: "Company Director",
        role: "Director",
        email: "director@democonstruction.co.za",
        primary: false,
        authorised: true,
      },
    ],
  },

  {
    id: "sample-logistics",
    company: "Sample Logistics (Pty) Ltd",
    registrationNumber: "2021/000002/07",
    servicePackage: "Standard",
    status: "Active",
    reminderPreference: "Email",
    contacts: [
      {
        id: "sample-logistics-fleet",
        name: "Fleet Administrator",
        role: "Fleet Administrator",
        email: "fleet@samplelogistics.co.za",
        primary: true,
        authorised: true,
      },
      {
        id: "sample-logistics-director",
        name: "Company Director",
        role: "Director",
        email: "director@samplelogistics.co.za",
        primary: false,
        authorised: true,
      },
    ],
  },

  {
    id: "example-services",
    company: "Example Services (Pty) Ltd",
    registrationNumber: "2022/000003/07",
    servicePackage: "Starter",
    status: "Pilot",
    reminderPreference: "Email",
    contacts: [
      {
        id: "example-services-director",
        name: "Company Director",
        role: "Director",
        email: "director@exampleservices.co.za",
        primary: true,
        authorised: true,
      },
    ],
  },

  {
    id: "example-property",
    company: "Example Property (Pty) Ltd",
    registrationNumber: "2022/000004/07",
    servicePackage: "Standard",
    status: "Active",
    reminderPreference: "Email",
    contacts: [
      {
        id: "example-property-primary",
        name: "Primary Authorised Contact",
        role: "Property Administrator",
        email: "contact@exampleproperty.co.za",
        primary: true,
        authorised: true,
      },
    ],
  },

  {
    id: "demo-transport",
    company: "Demo Transport (Pty) Ltd",
    registrationNumber: "2023/000005/07",
    servicePackage: "Managed",
    status: "Active",
    reminderPreference: "Email",
    contacts: [
      {
        id: "demo-transport-finance",
        name: "Finance Manager",
        role: "Finance Manager",
        email: "finance@demotransport.co.za",
        primary: true,
        authorised: true,
      },
      {
        id: "demo-transport-fleet",
        name: "Fleet Administrator",
        role: "Fleet Administrator",
        email: "fleet@demotransport.co.za",
        primary: false,
        authorised: true,
      },
    ],
  },

  {
    id: "example-consulting",
    company: "Example Consulting (Pty) Ltd",
    registrationNumber: "2023/000006/07",
    servicePackage: "Starter",
    status: "Active",
    reminderPreference: "Email",
    contacts: [
      {
        id: "example-consulting-director",
        name: "Company Director",
        role: "Director",
        email: "director@exampleconsulting.co.za",
        primary: true,
        authorised: true,
      },
    ],
  },
];

export function getClients(): Client[] {
  if (typeof window === "undefined") {
    return defaultClients;
  }

  const saved = localStorage.getItem(CLIENTS_KEY);

  if (!saved) {
    localStorage.setItem(
      CLIENTS_KEY,
      JSON.stringify(defaultClients)
    );

    return defaultClients;
  }

  try {
    const parsed: unknown = JSON.parse(saved);
    if (!Array.isArray(parsed)) {
      return defaultClients;
    }

    return parsed.map((item, index) => {
      const client = item as Partial<Client> & {
        contact?: string;
        email?: string;
        package?: string;
      };
      const contacts = Array.isArray(client.contacts)
        ? client.contacts
        : client.contact || client.email
          ? [{
              id: `${client.id || `legacy-${index}`}-primary`,
              name: client.contact || "Authorised Contact",
              role: "Authorised Contact",
              email: client.email || "",
              primary: true,
              authorised: true,
            }]
          : [];

      return {
        id: client.id || `legacy-client-${index}`,
        canonicalOrganisationId:
          typeof client.canonicalOrganisationId === "string"
            ? client.canonicalOrganisationId
            : undefined,
        company: client.company || "",
        registrationNumber: client.registrationNumber || "",
        servicePackage: client.servicePackage || client.package as ServicePackage || "Starter",
        status: client.status || "Pilot",
        reminderPreference: client.reminderPreference || "Email",
        contacts,
      };
    });
  } catch (error) {
    console.error("Could not read clients from local storage.", error);
    return [];
  }
}

export function getClient(clientId: string) {
  return getClients().find(
    (client) => client.id === clientId
  );
}

export function getClientByCompany(company: string) {
  return getClients().find(
    (client) => client.company === company
  );
}

function normalizeOrganisationName(name: string) {
  return name.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

export function resolvePrototypeClientForOrganisation(
  organisationId: string,
  organisationName: string,
): Client | undefined {
  const clients = getClients();
  const explicitMatches = clients.filter(
    (client) => client.canonicalOrganisationId === organisationId,
  );
  if (explicitMatches.length === 1) return explicitMatches[0];
  if (explicitMatches.length > 1) return undefined;

  const normalizedName = normalizeOrganisationName(organisationName);
  const nameMatches = clients.filter(
    (client) => normalizeOrganisationName(client.company) === normalizedName,
  );
  return nameMatches.length === 1 ? nameMatches[0] : undefined;
}

export function getActiveClients() {
  return getClients().filter(
    (client) => client.status !== "Suspended"
  );
}

export function getAuthorisedContacts(
  company: string
) {
  const client = getClientByCompany(company);

  if (!client) {
    return [];
  }

  return client.contacts.filter(
    (contact) => contact.authorised
  );
}

export function saveClient(client: Client) {
  const clients = getClients();

  const existing = clients.find((item) => item.id === client.id);

  const updatedClients = existing
    ? clients.map((item) =>
        item.id === client.id ? client : item
      )
    : [...clients, client];

  localStorage.setItem(
    CLIENTS_KEY,
    JSON.stringify(updatedClients)
  );

  window.dispatchEvent(
    new Event("deadline-monitor-clients-updated")
  );
  window.dispatchEvent(
    new Event("deadline-monitor-updated")
  );
  addAuditEvent({
    recordId: "",
    recordName: client.company,
    organisation: client.company,
    user: "Prototype Consultant",
    action: existing ? "Client updated" : "Client created",
    field: "client",
    previousValue: existing ? existing.company : "",
    newValue: client.company,
    entityType: "client",
    entityId: client.id,
    entityName: client.company,
  });
}