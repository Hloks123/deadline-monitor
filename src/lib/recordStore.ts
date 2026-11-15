import { getClientProfileStorageKey } from "./clientWorkspaceConstants.ts";
import type {
  MonitoredRecordCreateInput,
  MonitoredRecordPatch,
  MonitoredRecordRepository,
} from "./monitoredRecords/repository.ts";

export type CategoryOne =
  | "COIDA"
  | "SARS"
  | "Vehicles"
  | "Company Documents"
  | "CIPC"
  | "Insurance"
  | "Employees"
  | "Contracts"
  | "Property"
  | "Professional Registrations"
  | "Health and Safety"
  | "Municipal"
  | "Other";

export type RecordStatus =
  | "Current"
  | "Due soon"
  | "Expired"
  | "Awaiting client"
  | "Awaiting confirmation"
  | "Completed"
  | "Paused";

export type RecordRisk =
  | "Low"
  | "Medium"
  | "High";

export type EscalationLevel =
  | "Normal"
  | "Follow-up required"
  | "Escalated"
  | "Critical";

export type DeliveryStatus =
  | "Draft"
  | "Approved"
  | "Sent"
  | "Delivered"
  | "Failed"
  | "Bounced"
  | "Suppressed";

export type MonitoredRecord = {
  id: string;
  name: string;

  organisationId: string;
  organisation: string;

  category: CategoryOne;
  category2: string;

  issueDate: string;
  expiryDate: string;

  status: RecordStatus;
  risk: RecordRisk;
  escalationLevel: EscalationLevel;

  contactId: string;
  contact: string;
  contactEmail: string | null;

  followUp: string;
  referenceNumber?: string;
  nextAction?: string;
  notes?: string;
  reminderFrequency?: "daily" | "weekly" | "monthly" | "custom";
  reminderLeadDays?: number;
  clientCreated?: boolean;
  lastConfirmed: string;
  confirmedBy: string;
  confirmationMethod: string;
  dataSource: string;

  reminderDays: number[];
};

export type AuditEvent = {
  id: string;
  recordId: string;
  recordName: string;
  organisation: string;
  user: string;
  action: string;
  field?: string;
  previousValue: string;
  newValue: string;
  date: string;
  timestamp?: string;
  entityType?: string;
  entityId?: string;
  entityName?: string;
  context?: string;
};

export type CommunicationEvent = {
  id: string;
  uniqueKey: string;
  recordId: string;
  type: "Reminder" | "Follow-up";
  recipient: string;
  subject: string;
  message: string;
  outcome: string;
  deliveryStatus: DeliveryStatus;
  nextFollowUp: string;
  date: string;
  organisation?: string;
  relatedTaskId?: string;
  messageVersion?: string;
  reviewer?: string;
  decision?: "approved" | "suppressed" | "draft";
  reviewedAt?: string;
  failureReason?: string;
};

export const categoryOptions: Record<
  CategoryOne,
  string[]
> = {
  COIDA: [
    "Letter of Good Standing",
    "Registration Certificate",
    "Return of Earnings",
    "Assessment Notice",
    "Proof of Payment",
    "Claim Documentation",
    "Employer Registration Details",
  ],

  SARS: [
    "Tax Compliance Status",
    "Tax Clearance PIN",
    "VAT Registration",
    "PAYE Registration",
    "Income Tax Registration",
    "UIF Registration",
    "SDL Registration",
    "EMP201",
    "EMP501",
    "VAT201",
    "Provisional Tax",
    "Income Tax Return",
  ],

  Vehicles: [
    "Vehicle Licence",
    "Roadworthy Certificate",
    "Operating Permit",
    "Vehicle Insurance",
    "Service Record",
    "Fleet Inspection",
    "Driver Permit",
    "Tracking Certificate",
    "Cross-border Permit",
  ],

  "Company Documents": [
    "B-BBEE Affidavit",
    "B-BBEE Certificate",
    "Company Registration Certificate",
    "Memorandum of Incorporation",
    "Share Certificate",
    "Director Resolution",
    "Board Resolution",
    "Company Profile",
    "Proof of Business Address",
    "Bank Confirmation Letter",
    "Annual Return",
    "Beneficial Ownership Declaration",
  ],

  CIPC: [
    "Annual Return",
    "Company Registration",
    "Director Amendment",
    "Registered Address Amendment",
    "Beneficial Ownership Filing",
    "Company Name Reservation",
    "Company Name Change",
    "Deregistration Status",
    "Reinstatement Application",
  ],

  Insurance: [
    "Public Liability Insurance",
    "Professional Indemnity Insurance",
    "Vehicle Insurance",
    "Asset Insurance",
    "Building Insurance",
    "Business Interruption Insurance",
    "Workers Compensation Insurance",
    "Cyber Insurance",
    "Insurance Schedule",
  ],

  Employees: [
    "Employment Contract",
    "Medical Certificate",
    "Training Certificate",
    "Driver Licence",
    "Professional Licence",
    "Work Permit",
    "Visa",
    "Disciplinary Record",
    "Leave Record",
    "Emergency Contact",
  ],

  Contracts: [
    "Client Contract",
    "Supplier Contract",
    "Service-Level Agreement",
    "Lease Agreement",
    "Maintenance Contract",
    "Employment Contract",
    "Non-disclosure Agreement",
    "Subcontractor Agreement",
    "Service Contract",
  ],

  Property: [
    "Lease Agreement",
    "Municipal Account",
    "Rates Clearance Certificate",
    "Building Insurance",
    "Occupancy Certificate",
    "Fire Certificate",
    "Electrical Compliance Certificate",
    "Property Valuation",
    "Title Deed Reference",
  ],

  "Professional Registrations": [
    "Professional Membership",
    "Practising Certificate",
    "Professional Licence",
    "Industry Registration",
    "Continuing Professional Development",
    "Professional Indemnity Insurance",
    "Accreditation Certificate",
  ],

  "Health and Safety": [
    "Health and Safety Policy",
    "Safety File",
    "Risk Assessment",
    "First Aid Certificate",
    "Fire Training Certificate",
    "Medical Fitness Certificate",
    "Incident Register",
    "Emergency Plan",
    "Equipment Inspection Certificate",
  ],

  Municipal: [
    "Business Licence",
    "Trading Permit",
    "Municipal Account",
    "Rates Clearance Certificate",
    "Zoning Certificate",
    "Occupancy Certificate",
    "Fire Clearance Certificate",
    "Waste Permit",
  ],

  Other: [
    "General Record",
    "Supporting Document",
    "Permit",
    "Certificate",
    "Registration",
    "Licence",
    "Agreement",
    "Other",
  ],
};

const RECORDS_KEY = "doc-monitor-records";
const AUDIT_KEY = "doc-monitor-audit-events";
const COMMUNICATION_KEY =
  "doc-monitor-communications";

function parseDate(value: string) {
  if (!value) {
    return null;
  }

  const date = new Date(`${value}T00:00:00`);

  return Number.isNaN(date.getTime())
    ? null
    : date;
}

export function daysUntil(value: string) {
  const date = parseDate(value);

  if (!date) {
    return Number.POSITIVE_INFINITY;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return Math.ceil(
    (date.getTime() - today.getTime()) /
      (1000 * 60 * 60 * 24)
  );
}

export function calculateStatus(
  record: Pick<
    MonitoredRecord,
    "expiryDate" | "status"
  >
): RecordStatus {
  if (record.status === "Completed") {
    return "Completed";
  }

  if (record.status === "Paused") {
    return "Paused";
  }

  if (record.status === "Awaiting confirmation") {
    return "Awaiting confirmation";
  }

  if (record.status === "Awaiting client") {
    return "Awaiting client";
  }

  const remaining = daysUntil(
    record.expiryDate
  );

  if (remaining < 0) {
    return "Expired";
  }

  if (remaining <= 14) {
    return "Due soon";
  }

  return "Current";
}

export function calculateEscalation(
  record: Pick<
    MonitoredRecord,
    | "expiryDate"
    | "followUp"
    | "risk"
    | "status"
  >
): EscalationLevel {
  const status = calculateStatus(record);
  const followUpDays = daysUntil(
    record.followUp
  );

  if (
    status === "Expired" &&
    record.risk === "High"
  ) {
    return "Critical";
  }

  if (
    status === "Expired" ||
    (record.status === "Awaiting client" &&
      followUpDays < 0)
  ) {
    return "Escalated";
  }

  if (
    status === "Due soon" ||
    followUpDays <= 0
  ) {
    return "Follow-up required";
  }

  return "Normal";
}

export const defaultRecords: Record<
  string,
  MonitoredRecord
> = {
  "coida-letter": {
    id: "coida-letter",
    name: "COIDA Letter of Good Standing",

    organisationId: "demo-construction",
    organisation:
      "Demo Construction (Pty) Ltd",

    category: "COIDA",
    category2: "Letter of Good Standing",

    issueDate: "2025-11-08",
    expiryDate: "2026-11-08",

    status: "Due soon",
    risk: "High",
    escalationLevel: "Follow-up required",

    contactId:
      "demo-construction-primary",
    contact:
      "Primary Authorised Contact",
    contactEmail:
      "contact@democonstruction.co.za",

    followUp: "2026-11-08",
    lastConfirmed: "2026-11-05",
    confirmedBy:
      "Primary Authorised Contact",
    confirmationMethod: "Email",
    dataSource:
      "Client-approved starting register",

    reminderDays: [60, 30, 14, 7, 0],
  },

  "vehicle-licence": {
    id: "vehicle-licence",
    name: "Vehicle Licence GP 123-456",

    organisationId: "sample-logistics",
    organisation:
      "Sample Logistics (Pty) Ltd",

    category: "Vehicles",
    category2: "Vehicle Licence",

    issueDate: "2025-11-06",
    expiryDate: "2026-11-06",

    status: "Awaiting client",
    risk: "High",
    escalationLevel: "Escalated",

    contactId: "sample-logistics-fleet",
    contact: "Fleet Administrator",
    contactEmail:
      "fleet@samplelogistics.co.za",

    followUp: "2026-11-08",
    lastConfirmed: "2026-11-01",
    confirmedBy: "Fleet Administrator",
    confirmationMethod: "Email",
    dataSource:
      "Client-approved vehicle register",

    reminderDays: [60, 30, 14, 7, 0],
  },
};

function upgradeRecord(
  record: Partial<MonitoredRecord>
): MonitoredRecord {
  const upgraded: MonitoredRecord = {
    id: record.id || `record-${Date.now()}`,
    name: record.name || "Unnamed record",

    organisationId:
      record.organisationId || "",
    organisation:
      record.organisation || "",

    category:
      record.category || "Other",
    category2:
      record.category2 ||
      record.name ||
      "Other",

    issueDate: record.issueDate || "",
    expiryDate: record.expiryDate || "",

    status: record.status || "Current",
    risk: record.risk || "Low",
    escalationLevel:
      record.escalationLevel || "Normal",

    contactId: record.contactId || "",
    contact: record.contact || "",
    contactEmail:
      record.contactEmail || "",

    followUp: record.followUp || "",
    referenceNumber: record.referenceNumber || "",
    nextAction: record.nextAction || "",
    notes: record.notes || "",
    reminderFrequency: record.reminderFrequency || "weekly",
    reminderLeadDays: Number.isInteger(record.reminderLeadDays) ? record.reminderLeadDays : 7,
    clientCreated: record.clientCreated === true,
    lastConfirmed:
      record.lastConfirmed || "",
    confirmedBy:
      record.confirmedBy || "",
    confirmationMethod:
      record.confirmationMethod || "",
    dataSource:
      record.dataSource || "",

    reminderDays:
      record.reminderDays || [
        60,
        30,
        14,
        7,
        0,
      ],
  };

  upgraded.status =
    calculateStatus(upgraded);

  upgraded.escalationLevel =
    calculateEscalation(upgraded);

  return upgraded;
}

export function getRecords(): Record<
  string,
  MonitoredRecord
> {
  if (typeof window === "undefined") {
    return defaultRecords;
  }

  const saved = localStorage.getItem(
    getClientProfileStorageKey(RECORDS_KEY)
  );

  if (!saved) {
    localStorage.setItem(
      getClientProfileStorageKey(RECORDS_KEY),
      JSON.stringify(defaultRecords)
    );

    return defaultRecords;
  }

  try {
    const stored = JSON.parse(saved) as Record<
      string,
      Partial<MonitoredRecord>
    >;

    return Object.fromEntries(
      Object.entries(stored).map(
        ([id, record]) => [
          id,
          upgradeRecord({
            ...record,
            id,
          }),
        ]
      )
    );
  } catch {
    return defaultRecords;
  }
}

export function getRecord(id: string) {
  return getRecords()[id];
}

export function saveRecord(
  record: MonitoredRecord
) {
  const records = getRecords();

  const updatedRecord =
    upgradeRecord(record);

  localStorage.setItem(
    getClientProfileStorageKey(RECORDS_KEY),
    JSON.stringify({
      ...records,
      [updatedRecord.id]: updatedRecord,
    })
  );

  window.dispatchEvent(
    new Event("deadline-monitor-updated")
  );
}

export function getAuditEvents(): AuditEvent[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    return JSON.parse(
      localStorage.getItem(getClientProfileStorageKey(AUDIT_KEY)) || "[]"
    );
  } catch {
    return [];
  }
}

export function addAuditEvent(
  event: Omit<AuditEvent, "id" | "date">
) {
  const events = getAuditEvents();

  const newEvent: AuditEvent = {
    ...event,
    id: crypto.randomUUID(),
    date: new Date().toISOString(),
    timestamp: new Date().toISOString(),
    entityType: event.entityType || (event.recordId ? "record" : "system"),
    entityId: event.entityId || event.recordId || undefined,
    entityName: event.entityName || event.recordName || undefined,
  };

  localStorage.setItem(
    getClientProfileStorageKey(AUDIT_KEY),
    JSON.stringify([newEvent, ...events])
  );

  window.dispatchEvent(
    new Event("deadline-monitor-updated")
  );
}

export function getCommunications(): CommunicationEvent[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    return JSON.parse(
      localStorage.getItem(
        getClientProfileStorageKey(COMMUNICATION_KEY)
      ) || "[]"
    );
  } catch {
    return [];
  }
}

export function createCommunicationKey({
  recordId,
  type,
  nextFollowUp,
  recipient,
}: {
  recordId: string;
  type: CommunicationEvent["type"];
  nextFollowUp: string;
  recipient: string;
}) {
  return [
    recordId,
    type,
    nextFollowUp,
    recipient.toLowerCase(),
  ].join("|");
}

export function communicationExists(
  uniqueKey: string
) {
  return getCommunications().some(
    (communication) =>
      communication.uniqueKey === uniqueKey
  );
}

export function addCommunication(
  event: Omit<
    CommunicationEvent,
    "id" | "date" | "uniqueKey"
  >
) {
  const communications =
    getCommunications();

  const uniqueKey =
    createCommunicationKey({
      recordId: event.recordId,
      type: event.type,
      nextFollowUp: event.nextFollowUp,
      recipient: event.recipient,
    });

  if (communicationExists(uniqueKey)) {
    return {
      success: false,
      duplicate: true,
      message:
        "This reminder or follow-up has already been logged.",
    };
  }

  const communication: CommunicationEvent = {
    ...event,
    id: crypto.randomUUID(),
    uniqueKey,
    date: new Date().toLocaleString("en-ZA"),
  };

  localStorage.setItem(
    getClientProfileStorageKey(COMMUNICATION_KEY),
    JSON.stringify([
      communication,
      ...communications,
    ])
  );

  window.dispatchEvent(
    new Event("deadline-monitor-updated")
  );

  return {
    success: true,
    duplicate: false,
    message:
      "Communication logged successfully.",
  };
}

export function saveCommunicationReview(
  event: Omit<CommunicationEvent, "id" | "date" | "uniqueKey">
) {
  const communications = getCommunications();
  const uniqueKey = createCommunicationKey({
    recordId: event.recordId,
    type: event.type,
    nextFollowUp: event.nextFollowUp,
    recipient: event.recipient,
  });
  const existing = communications.find((item) => item.uniqueKey === uniqueKey);
  const reviewed: CommunicationEvent = {
    ...existing,
    ...event,
    id: existing?.id || crypto.randomUUID(),
    uniqueKey,
    date: new Date().toISOString(),
  };
  const updated = existing
    ? communications.map((item) => item.id === existing.id ? reviewed : item)
    : [reviewed, ...communications];
  localStorage.setItem(getClientProfileStorageKey(COMMUNICATION_KEY), JSON.stringify(updated));
  window.dispatchEvent(new Event("deadline-monitor-updated"));
  return reviewed;
}

export function createLocalStorageMonitoredRecordRepository(): MonitoredRecordRepository {
  return {
    async list(organisationId, options = {}) {
      const limit = options.limit ?? 100;
      const offset = options.offset ?? 0;
      const records = Object.values(getRecords())
        .filter((record) => record.organisationId === organisationId)
        .slice(offset, offset + limit)
        .map((record) => ({
          ...record,
          version: 0,
          deletedAt: null,
        }));
      return {
        records,
        nextOffset: records.length === limit ? offset + records.length : null,
      };
    },

    async get(organisationId, recordId) {
      const record = getRecord(recordId);
      if (!record || record.organisationId !== organisationId) return null;
      return { ...record, version: 0, deletedAt: null };
    },

    async create(organisationId, input: MonitoredRecordCreateInput) {
      if (input.organisationId !== organisationId) {
        throw new Error("Monitored record does not belong to the selected organisation.");
      }
      const record: MonitoredRecord = {
        ...input,
        id: crypto.randomUUID(),
      };
      saveRecord(record);
      return { ...record, version: 0, deletedAt: null };
    },

    async update(
      organisationId,
      recordId,
      expectedVersion,
      changes: MonitoredRecordPatch,
    ) {
      const record = getRecord(recordId);
      if (!record || record.organisationId !== organisationId) {
        throw new Error("Monitored record was not found.");
      }
      if (expectedVersion !== 0) {
        throw new Error("Monitored record changed before this update was saved.");
      }
      const updated: MonitoredRecord = { ...record, ...changes };
      saveRecord(updated);
      return { ...updated, version: 0, deletedAt: null };
    },

    async history(organisationId, recordId) {
      const record = getRecord(recordId);
      if (!record || record.organisationId !== organisationId) {
        throw new Error("Monitored record was not found.");
      }
      return {
        communications: getCommunications().filter(
          (event) => event.recordId === recordId,
        ),
        auditEvents: getAuditEvents().filter(
          (event) => event.recordId === recordId,
        ),
      };
    },

    async auditHistory() {
      throw new Error("Record audit history requires the server-backed repository.");
    },
  };
}