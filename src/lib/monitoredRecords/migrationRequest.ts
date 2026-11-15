import { isUuid } from "./server";

export type MigrationSourceRequest = {
  organisationId: string;
  legacyClientId: string;
  sourceDeviceId?: string;
  includeSuspectedFixtures: boolean;
  contacts: unknown[];
  records: unknown[];
  communications: unknown[];
  auditEvents: unknown[];
};

export type MigrationSourceParseResult =
  | { ok: true; value: MigrationSourceRequest }
  | { ok: false; error: string };

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseMigrationSourceRequest(
  value: unknown,
): MigrationSourceParseResult {
  const allowedFields = new Set([
    "organisationId",
    "legacyClientId",
    "sourceDeviceId",
    "includeSuspectedFixtures",
    "contacts",
    "records",
    "communications",
    "auditEvents",
  ]);
  if (
    !isObject(value) ||
    Object.keys(value).some((key) => !allowedFields.has(key)) ||
    typeof value.organisationId !== "string" ||
    !isUuid(value.organisationId) ||
    typeof value.legacyClientId !== "string" ||
    value.legacyClientId.trim().length === 0 ||
    value.legacyClientId.length > 200 ||
    (value.sourceDeviceId !== undefined &&
      (typeof value.sourceDeviceId !== "string" || !isUuid(value.sourceDeviceId))) ||
    typeof value.includeSuspectedFixtures !== "boolean" ||
    (value.contacts !== undefined && !Array.isArray(value.contacts)) ||
    !Array.isArray(value.records) ||
    !Array.isArray(value.communications) ||
    !Array.isArray(value.auditEvents) ||
    value.records.length > 500 ||
    (Array.isArray(value.contacts) && value.contacts.length > 1000) ||
    value.communications.length > 1000 ||
    value.auditEvents.length > 2000
  ) {
    return {
      ok: false,
      error: "Select one organisation and a valid, bounded legacy data set.",
    };
  }
  return {
    ok: true,
    value: {
      organisationId: value.organisationId,
      legacyClientId: value.legacyClientId.trim(),
      sourceDeviceId:
        typeof value.sourceDeviceId === "string" ? value.sourceDeviceId : undefined,
      includeSuspectedFixtures: value.includeSuspectedFixtures,
      contacts: Array.isArray(value.contacts) ? value.contacts : [],
      records: value.records,
      communications: value.communications,
      auditEvents: value.auditEvents,
    },
  };
}
