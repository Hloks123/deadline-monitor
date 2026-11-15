import type {
  AuditEvent,
  CommunicationEvent,
  MonitoredRecord,
} from "@/lib/recordStore";
import {
  parseMonitoredRecordAuditHistory,
  type MonitoredRecordAuditHistory,
} from "./auditHistory";
import type { MonitoredRecordWrite } from "./validation";

export type MonitoredRecordEntity = MonitoredRecord & {
  version: number;
  deletedAt: string | null;
};

export type MonitoredRecordPage = {
  records: MonitoredRecordEntity[];
  nextOffset: number | null;
};

export type MonitoredRecordHistory = {
  communications: CommunicationEvent[];
  auditEvents: AuditEvent[];
};

export class MonitoredRecordHistoryError extends Error {
  constructor(
    readonly kind:
      | "unauthenticated"
      | "forbidden"
      | "not_found"
      | "invalid_response"
      | "unavailable",
  ) {
    super("Monitored-record audit history could not be loaded.");
    this.name = "MonitoredRecordHistoryError";
  }
}

export type MonitoredOrganisation = {
  id: string;
  name: string;
  contacts: Array<{
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    role_title: string | null;
    authorised: boolean;
    primary_contact: boolean;
  }>;
};

export type MonitoredRecordCreateInput = Omit<MonitoredRecord, "id">;
export type MonitoredRecordPatch = Partial<
  Omit<MonitoredRecord, "id" | "organisationId" | "organisation">
>;

export interface MonitoredRecordRepository {
  list(
    organisationId: string,
    options?: { limit?: number; offset?: number },
  ): Promise<MonitoredRecordPage>;
  get(
    organisationId: string,
    recordId: string,
  ): Promise<MonitoredRecordEntity | null>;
  create(
    organisationId: string,
    input: MonitoredRecordCreateInput,
  ): Promise<MonitoredRecordEntity>;
  update(
    organisationId: string,
    recordId: string,
    expectedVersion: number,
    changes: MonitoredRecordPatch,
  ): Promise<MonitoredRecordEntity>;
  history(
    organisationId: string,
    recordId: string,
  ): Promise<MonitoredRecordHistory>;
  auditHistory(
    organisationId: string,
    recordId: string,
  ): Promise<MonitoredRecordAuditHistory>;
}

function assertResponse<T>(response: Response): Promise<T> {
  return response.json().then((body: unknown) => {
    if (!response.ok) {
      const message =
        typeof body === "object" &&
        body !== null &&
        "error" in body &&
        typeof body.error === "string"
          ? body.error
          : "The monitored-record request failed.";
      throw new Error(message);
    }
    return body as T;
  });
}

function apiPath(organisationId: string) {
  return `/api/organisations/${encodeURIComponent(organisationId)}/monitored-records`;
}

function createPayload(input: MonitoredRecordCreateInput) {
  const {
    name,
    category,
    category2,
    issueDate,
    expiryDate,
    status,
    risk,
    escalationLevel,
    contactId,
    contact,
    contactEmail,
    followUp,
    referenceNumber,
    nextAction,
    notes,
    reminderFrequency,
    reminderLeadDays,
    clientCreated,
    lastConfirmed,
    confirmedBy,
    confirmationMethod,
    dataSource,
    reminderDays,
  } = input;
  return {
    name,
    category,
    category2,
    issueDate,
    expiryDate,
    status,
    risk,
    escalationLevel,
    contactId,
    contact,
    contactEmail,
    followUp,
    referenceNumber,
    nextAction,
    notes,
    reminderFrequency,
    reminderLeadDays,
    clientCreated,
    lastConfirmed,
    confirmedBy,
    confirmationMethod,
    dataSource,
    reminderDays,
  };
}

function patchPayload(changes: MonitoredRecordPatch) {
  const {
    name,
    category,
    category2,
    issueDate,
    expiryDate,
    status,
    risk,
    escalationLevel,
    contactId,
    contact,
    contactEmail,
    followUp,
    referenceNumber,
    nextAction,
    notes,
    reminderFrequency,
    reminderLeadDays,
    clientCreated,
    lastConfirmed,
    confirmedBy,
    confirmationMethod,
    dataSource,
    reminderDays,
  } = changes;
  return Object.fromEntries(
    Object.entries({
      name,
      category,
      category2,
      issueDate,
      expiryDate,
      status,
      risk,
      escalationLevel,
      contactId,
      contact,
      contactEmail,
      followUp,
      referenceNumber,
      nextAction,
      notes,
      reminderFrequency,
      reminderLeadDays,
      clientCreated,
      lastConfirmed,
      confirmedBy,
      confirmationMethod,
      dataSource,
      reminderDays,
    }).filter(([, value]) => value !== undefined),
  );
}

export const httpMonitoredRecordRepository: MonitoredRecordRepository = {
  async list(organisationId, options = {}) {
    const query = new URLSearchParams();
    if (options.limit !== undefined) query.set("limit", String(options.limit));
    if (options.offset !== undefined) query.set("offset", String(options.offset));
    const response = await fetch(
      `${apiPath(organisationId)}?${query.toString()}`,
      { cache: "no-store" },
    );
    return assertResponse<MonitoredRecordPage>(response);
  },

  async get(organisationId, recordId) {
    const response = await fetch(
      `${apiPath(organisationId)}/${encodeURIComponent(recordId)}`,
      { cache: "no-store" },
    );
    if (response.status === 404) return null;
    return assertResponse<{ record: MonitoredRecordEntity }>(response).then(
      ({ record }) => record,
    );
  },

  async create(organisationId, input) {
    const response = await fetch(apiPath(organisationId), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(createPayload(input)),
    });
    return assertResponse<{ record: MonitoredRecordEntity }>(response).then(
      ({ record }) => record,
    );
  },

  async update(organisationId, recordId, expectedVersion, changes) {
    const response = await fetch(
      `${apiPath(organisationId)}/${encodeURIComponent(recordId)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          version: expectedVersion,
          changes: patchPayload(changes),
        }),
      },
    );
    return assertResponse<{ record: MonitoredRecordEntity }>(response).then(
      ({ record }) => record,
    );
  },

  async history(organisationId, recordId) {
    const response = await fetch(
      `${apiPath(organisationId)}/${encodeURIComponent(recordId)}/history`,
      { cache: "no-store" },
    );
    return assertResponse<MonitoredRecordHistory>(response);
  },

  async auditHistory(organisationId, recordId) {
    const response = await fetch(
      `${apiPath(organisationId)}/${encodeURIComponent(recordId)}/history?scope=audit`,
      { cache: "no-store" },
    );
    if (response.status === 401) throw new MonitoredRecordHistoryError("unauthenticated");
    if (response.status === 403) throw new MonitoredRecordHistoryError("forbidden");
    if (response.status === 404) throw new MonitoredRecordHistoryError("not_found");
    if (!response.ok) throw new MonitoredRecordHistoryError("unavailable");

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new MonitoredRecordHistoryError("invalid_response");
    }
    try {
      return parseMonitoredRecordAuditHistory(body, recordId);
    } catch {
      throw new MonitoredRecordHistoryError("invalid_response");
    }
  },
};

export async function loadAccessibleOrganisations(): Promise<MonitoredOrganisation[]> {
  const response = await fetch("/api/admin/organisations", {
    cache: "no-store",
  });
  const result = await assertResponse<{ organisations: MonitoredOrganisation[] }>(response);
  return result.organisations;
}

export async function loadAccessibleMonitoredRecords(): Promise<MonitoredRecordEntity[]> {
  const organisations = await loadAccessibleOrganisations();
  const pages = await Promise.all(
    organisations.map(async (organisation) => {
      const records: MonitoredRecordEntity[] = [];
      let offset = 0;
      do {
        const page = await httpMonitoredRecordRepository.list(organisation.id, {
          limit: 500,
          offset,
        });
        records.push(...page.records);
        if (page.nextOffset === null) break;
        offset = page.nextOffset;
      } while (true);
      return records;
    }),
  );
  return pages.flat();
}

export async function findAccessibleMonitoredRecord(
  recordId: string,
): Promise<MonitoredRecordEntity | null> {
  const response = await fetch(
    `/api/monitored-records/${encodeURIComponent(recordId)}`,
    { cache: "no-store" },
  );
  if (response.status === 404) return null;
  return assertResponse<{ record: MonitoredRecordEntity }>(response).then(
    ({ record }) => record,
  );
}

export type { MonitoredRecordWrite };
