import { buildAssistantWorkspaceSnapshot } from "@/lib/assistantWorkspace";
import type { AssistantWorkspaceSnapshot } from "@/lib/assistantWorkspaceTypes";
import { getClients, type Client } from "@/lib/clientStore";
import { getAllClientWorkspaceEntries } from "@/lib/clientWorkspaceStore";
import {
  getAuditEvents,
  getCommunications,
  getRecords,
} from "@/lib/recordStore";
import { getOccurrences } from "@/lib/recurringTasks/occurrenceService";
import { getRecurringTasks } from "@/lib/recurringTasks/taskStore";

export function getImportableClients() {
  return getClients();
}

export function buildLegacyClientSnapshot(
  client: Client,
  organisation: { id: string; name: string },
): AssistantWorkspaceSnapshot {
  if (typeof window === "undefined") {
    throw new Error("Client browser data can only be imported from this device.");
  }

  const clients = getClients();
  const directory = getAllClientWorkspaceEntries();
  return buildAssistantWorkspaceSnapshot({
    clients,
    client,
    organisation,
    records: Object.values(getRecords()),
    tasks: getRecurringTasks(),
    occurrences: getOccurrences(),
    people: directory.people,
    trackers: directory.trackers,
    items: directory.items,
    auditEvents: getAuditEvents(),
    communications: getCommunications(),
  });
}
