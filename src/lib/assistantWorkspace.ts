import type { AuditEvent, CommunicationEvent, MonitoredRecord } from "@/lib/recordStore";
import type { Client } from "@/lib/clientStore";
import type { ChecklistItem, ResponsiblePerson, WorkTracker } from "@/lib/clientWorkspaceStore";
import type { RecurringTask, TaskOccurrence } from "@/lib/recurringTasks/types";
import type { AssistantWorkspaceSnapshot } from "@/lib/assistantWorkspaceTypes";

type AssignedOrganisation = {
  id: string;
  name: string;
};

type SnapshotSource = {
  clients: Client[];
  client: Client;
  organisation: AssignedOrganisation;
  records: MonitoredRecord[];
  tasks: RecurringTask[];
  occurrences: TaskOccurrence[];
  people: ResponsiblePerson[];
  trackers: WorkTracker[];
  items: ChecklistItem[];
  auditEvents: AuditEvent[];
  communications: CommunicationEvent[];
};

function normalizedName(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

function scoped<T extends { organisationId: string }>(
  values: T[],
  legacyOrganisationId: string,
  organisationId: string,
): T[] {
  return values
    .filter((value) => value.organisationId === legacyOrganisationId)
    .map((value) => ({ ...value, organisationId }));
}

export function buildAssistantWorkspaceSnapshot(
  source: SnapshotSource,
): AssistantWorkspaceSnapshot {
  const { client, organisation } = source;
  const records = scoped(source.records, client.id, organisation.id);
  const tasks = scoped(source.tasks, client.id, organisation.id);
  const occurrences = scoped(source.occurrences, client.id, organisation.id);
  const people = scoped(source.people, client.id, organisation.id);
  const trackers = scoped(source.trackers, client.id, organisation.id);
  const items = scoped(source.items, client.id, organisation.id);

  const recordIds = new Set(records.map(({ id }) => id));
  const relatedEntityIds = new Set([
    ...recordIds,
    ...tasks.map(({ id }) => id),
    ...occurrences.map(({ id }) => id),
    ...trackers.map(({ id }) => id),
    ...items.map(({ id }) => id),
    client.id,
  ]);
  const uniqueClientName =
    source.clients.filter(
      (candidate) =>
        normalizedName(candidate.company) === normalizedName(client.company),
    ).length === 1;
  const auditEvents = source.auditEvents
    .filter((event) =>
      (uniqueClientName &&
        normalizedName(event.organisation) === normalizedName(client.company)) ||
      Boolean(
        event.context?.includes(`Organisation ID: ${client.id}`) &&
          (event.recordId && recordIds.has(event.recordId) ||
            event.entityId && relatedEntityIds.has(event.entityId)),
      ),
    )
    .map((event) => ({ ...event, organisation: organisation.name }));
  const communications = source.communications
    .filter((event) =>
      uniqueClientName &&
      normalizedName(event.organisation || "") === normalizedName(client.company),
    )
    .map((event) => ({ ...event, organisation: organisation.name }));

  return {
    version: 1,
    client: {
      ...client,
      id: organisation.id,
      canonicalOrganisationId: organisation.id,
      company: organisation.name,
    },
    records: records.map((record) => ({ ...record, organisation: organisation.name })),
    tasks,
    occurrences,
    people,
    trackers,
    items,
    auditEvents,
    communications,
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasScopedOrganisationId(value: unknown, organisationId: string) {
  return isObject(value) && value.organisationId === organisationId;
}

export function isAssistantWorkspaceSnapshot(
  value: unknown,
  organisation: AssignedOrganisation,
): value is AssistantWorkspaceSnapshot {
  if (!isObject(value) || value.version !== 1 || !isObject(value.client)) {
    return false;
  }
  if (
    value.client.id !== organisation.id ||
    value.client.canonicalOrganisationId !== organisation.id ||
    value.client.company !== organisation.name ||
    !Array.isArray(value.client.contacts) ||
    !value.client.contacts.every(
      (contact) =>
        isObject(contact) &&
        typeof contact.id === "string" &&
        typeof contact.name === "string" &&
        typeof contact.authorised === "boolean",
    )
  ) {
    return false;
  }

  const scopedCollections = [
    "records",
    "tasks",
    "occurrences",
    "people",
    "trackers",
    "items",
  ] as const;
  if (
    !scopedCollections.every(
      (key) =>
        Array.isArray(value[key]) &&
        value[key].every((item) =>
          hasScopedOrganisationId(item, organisation.id),
        ),
    )
  ) {
    return false;
  }
  return (
    Array.isArray(value.auditEvents) &&
    value.auditEvents.every(
      (event) => isObject(event) && event.organisation === organisation.name,
    ) &&
    Array.isArray(value.communications) &&
    value.communications.every(
      (event) =>
        isObject(event) && event.organisation === organisation.name,
    )
  );
}
