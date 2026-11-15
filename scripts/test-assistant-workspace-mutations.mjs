import assert from "node:assert/strict";
import { buildAssistantWorkspaceSnapshot } from "../src/lib/assistantWorkspace.ts";
import {
  applyAssistantWorkspaceMutation,
  parseAssistantWorkspaceMutation,
} from "../src/lib/assistantWorkspaceMutations.ts";

const client = {
  id: "browser-client-a",
  company: "Client A",
  status: "Active",
  servicePackage: "Managed",
  reminderPreference: "Email",
  contacts: [
    {
      id: "contact-a",
      name: "Assigned Contact",
      role: "Manager",
      email: "contact@example.test",
      primary: true,
      authorised: true,
    },
  ],
};
const organisation = { id: "assigned-organisation-a", name: "Client A" };
const snapshot = buildAssistantWorkspaceSnapshot({
  clients: [client],
  client,
  organisation,
  records: [
    {
      id: "record-a",
      name: "Existing record",
      organisationId: client.id,
      organisation: client.company,
      category: "COIDA",
      category2: "Certificate",
      issueDate: "",
      expiryDate: "2030-01-01",
      status: "Current",
      risk: "Medium",
      escalationLevel: "Normal",
      contactId: "contact-a",
      contact: "Assigned Contact",
      contactEmail: "contact@example.test",
      followUp: "",
      lastConfirmed: "",
      confirmedBy: "",
      confirmationMethod: "",
      dataSource: "Test",
      reminderDays: [30, 7],
    },
  ],
  tasks: [
    {
      id: "task-a",
      organisationId: client.id,
      name: "Recurring task",
      ownerId: "person-a",
      priority: "medium",
      status: "active",
      requiresCompletionEvidence: true,
    },
  ],
  occurrences: [
    {
      id: "occurrence-a",
      recurringTaskId: "task-a",
      organisationId: client.id,
      scheduledFor: "2030-01-01",
      dueAt: "2030-01-01T17:00:00",
      status: "upcoming",
      ownerId: "person-a",
      uniqueKey: "occurrence-a",
      retryCount: 0,
      createdAt: "2029-12-01T00:00:00.000Z",
      updatedAt: "2029-12-01T00:00:00.000Z",
    },
  ],
  people: [
    {
      id: "person-a",
      organisationId: client.id,
      name: "Assigned Contact",
      active: true,
    },
  ],
  trackers: [
    {
      id: "tracker-a",
      organisationId: client.id,
      name: "Active tracker",
      periodType: "Monthly tracker",
      startDate: "2029-12-01",
      endDate: "2030-12-31",
      ownerId: "person-a",
      reminderPreference: "In-app only",
      status: "Active",
      createdAt: "2029-12-01T00:00:00.000Z",
      updatedAt: "2029-12-01T00:00:00.000Z",
    },
  ],
  items: [],
  auditEvents: [],
  communications: [],
});

function parse(mutation) {
  const result = parseAssistantWorkspaceMutation(mutation);
  assert.equal(result.ok, true, result.ok ? "" : result.error);
  return result.value;
}

const createdRecord = applyAssistantWorkspaceMutation(
  snapshot,
  parse({
    type: "create_record",
    record: {
      name: "New assigned record",
      category: "COIDA",
      category2: "Certificate",
      issueDate: "",
      expiryDate: "2030-06-30",
      risk: "High",
      contactId: "contact-a",
      followUp: "",
      nextAction: "Confirm renewal",
      notes: "",
    },
  }),
  organisation,
  "Assistant A",
  "2030-01-01T10:00:00.000Z",
);
assert.equal(createdRecord.ok, true);
assert.equal(createdRecord.value.records[0].organisationId, organisation.id);
assert.equal(createdRecord.value.auditEvents[0].user, "Assistant A");
assert.equal(createdRecord.value.auditEvents[0].entityType, "record");

const createdWork = applyAssistantWorkspaceMutation(
  snapshot,
  parse({
    type: "create_work_item",
    trackerId: "tracker-a",
    task: "Prepare monthly return",
    targetDate: "2030-02-01",
    responsiblePersonId: "person-a",
    priority: "High",
  }),
  organisation,
  "Assistant A",
  "2030-01-01T10:00:00.000Z",
);
assert.equal(createdWork.ok, true);
assert.equal(createdWork.value.items[0].organisationId, organisation.id);
assert.equal(createdWork.value.items[0].responsiblePersonName, "Assigned Contact");

const updatedWork = applyAssistantWorkspaceMutation(
  createdWork.value,
  parse({
    type: "update_work_item",
    itemId: createdWork.value.items[0].id,
    changes: {
      status: "Blocked",
      blockedReason: "Waiting for client information",
    },
  }),
  organisation,
  "Assistant A",
);
assert.equal(updatedWork.ok, true);
assert.equal(updatedWork.value.items[0].status, "Blocked");
assert.ok(updatedWork.value.auditEvents.some((event) => event.field === "status"));

const crossOrganisationWork = applyAssistantWorkspaceMutation(
  snapshot,
  parse({
    type: "create_work_item",
    trackerId: "foreign-tracker",
    task: "Foreign work",
    targetDate: "2030-02-01",
    responsiblePersonId: "",
    priority: "Low",
  }),
  organisation,
  "Assistant A",
);
assert.equal(crossOrganisationWork.ok, false);

const crossOrganisationRecord = applyAssistantWorkspaceMutation(
  snapshot,
  parse({ type: "update_record", recordId: "foreign-record", changes: { name: "Changed" } }),
  organisation,
  "Assistant A",
);
assert.equal(crossOrganisationRecord.ok, false);

const crossOrganisationItem = applyAssistantWorkspaceMutation(
  snapshot,
  parse({
    type: "update_work_item",
    itemId: "foreign-item",
    changes: { task: "Changed work" },
  }),
  organisation,
  "Assistant A",
);
assert.equal(crossOrganisationItem.ok, false);

const invalidMutation = parseAssistantWorkspaceMutation({
  type: "update_record",
  recordId: "record-a",
  changes: { organisationId: "another-organisation" },
});
assert.equal(invalidMutation.ok, false, "clients cannot change record scope");

const completedOccurrence = applyAssistantWorkspaceMutation(
  snapshot,
  parse({
    type: "update_occurrence",
    occurrenceId: "occurrence-a",
    status: "completed",
    completionEvidence: "Submitted confirmation",
    skippedReason: "",
    failureReason: "",
  }),
  organisation,
  "Assistant A",
);
assert.equal(completedOccurrence.ok, true);
assert.equal(completedOccurrence.value.occurrences[0].status, "completed");
assert.equal(completedOccurrence.value.auditEvents[0].action, "Assistant updated recurring work");

const missingEvidence = applyAssistantWorkspaceMutation(
  snapshot,
  parse({
    type: "update_occurrence",
    occurrenceId: "occurrence-a",
    status: "completed",
    completionEvidence: "",
  }),
  organisation,
  "Assistant A",
);
assert.equal(missingEvidence.ok, false, "required completion evidence is enforced");

console.log("ASSISTANT WORKSPACE MUTATIONS: PASS");
