import assert from "node:assert/strict";
import {
  buildAssistantWorkspaceSnapshot,
  isAssistantWorkspaceSnapshot,
} from "../src/lib/assistantWorkspace.ts";

const clientA = {
  id: "browser-client-a",
  company: "Client A",
  status: "Active",
  servicePackage: "Managed",
  reminderPreference: "Email",
  contacts: [],
};
const clientB = {
  ...clientA,
  id: "browser-client-b",
  company: "Client B",
};
const organisation = { id: "assigned-organisation-a", name: "Client A" };
const snapshot = buildAssistantWorkspaceSnapshot({
  clients: [clientA, clientB],
  client: clientA,
  organisation,
  records: [
    { id: "record-a", organisationId: clientA.id, name: "Record A" },
    { id: "record-b", organisationId: clientB.id, name: "Record B" },
  ],
  tasks: [
    { id: "task-a", organisationId: clientA.id, name: "Task A" },
    { id: "task-b", organisationId: clientB.id, name: "Task B" },
  ],
  occurrences: [
    { id: "occurrence-a", organisationId: clientA.id },
    { id: "occurrence-b", organisationId: clientB.id },
  ],
  people: [
    { id: "person-a", organisationId: clientA.id },
    { id: "person-b", organisationId: clientB.id },
  ],
  trackers: [
    { id: "tracker-a", organisationId: clientA.id },
    { id: "tracker-b", organisationId: clientB.id },
  ],
  items: [
    { id: "item-a", organisationId: clientA.id },
    { id: "item-b", organisationId: clientB.id },
  ],
  auditEvents: [
    { id: "event-a", organisation: "Client A", action: "Record updated" },
    { id: "event-b", organisation: "Client B", action: "Record updated" },
  ],
  communications: [
    { id: "communication-a", organisation: "Client A" },
    { id: "communication-b", organisation: "Client B" },
  ],
});

for (const [collection, expectedId] of Object.entries({
  records: "record-a",
  tasks: "task-a",
  occurrences: "occurrence-a",
  people: "person-a",
  trackers: "tracker-a",
  items: "item-a",
})) {
  assert.deepEqual(
    snapshot[collection].map((item) => item.id),
    [expectedId],
    `${collection} are filtered to the selected browser client`,
  );
  assert.ok(
    snapshot[collection].every(
      (item) => item.organisationId === organisation.id,
    ),
    `${collection} are remapped to the database organisation`,
  );
}

assert.deepEqual(
  snapshot.auditEvents.map((event) => event.id),
  ["event-a"],
);
assert.deepEqual(
  snapshot.communications.map((event) => event.id),
  ["communication-a"],
);
assert.equal(snapshot.client.id, organisation.id);
assert.equal(snapshot.client.company, organisation.name);
assert.equal(isAssistantWorkspaceSnapshot(snapshot, organisation), true);

const crossOrganisationPayload = {
  ...snapshot,
  records: [
    { id: "foreign-record", organisationId: "another-organisation" },
  ],
};
assert.equal(
  isAssistantWorkspaceSnapshot(crossOrganisationPayload, organisation),
  false,
  "snapshots containing rows from another organisation are rejected",
);

console.log("ASSISTANT WORKSPACE SCOPE: PASS");
