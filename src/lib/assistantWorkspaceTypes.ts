import type { AuditEvent, CommunicationEvent, MonitoredRecord } from "@/lib/recordStore";
import type { Client, ClientContact } from "@/lib/clientStore";
import type { ChecklistItem, ResponsiblePerson, WorkTracker } from "@/lib/clientWorkspaceStore";
import type { RecurringTask, TaskOccurrence } from "@/lib/recurringTasks/types";

export type AssistantWorkspaceSnapshot = {
  version: 1;
  client: Client;
  records: MonitoredRecord[];
  tasks: RecurringTask[];
  occurrences: TaskOccurrence[];
  people: ResponsiblePerson[];
  trackers: WorkTracker[];
  items: ChecklistItem[];
  auditEvents: AuditEvent[];
  communications: CommunicationEvent[];
};

export type AssistantWorkspaceSnapshotResponse = {
  organisations: Array<{
    id: string;
    name: string;
    contacts: ClientContact[];
    importedAt: string | null;
    updatedAt: string | null;
    snapshot: AssistantWorkspaceSnapshot | null;
  }>;
};

export type AssistantWorkspaceImportOrganisation = {
  id: string;
  name: string;
  status: string;
};
