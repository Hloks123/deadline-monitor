/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

const resolveFilename = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain, options) {
  if (request.startsWith("@/")) {
    request = path.resolve(__dirname, "..", `${request.slice(2)}.ts`);
  }
  return resolveFilename.call(this, request, parent, isMain, options);
};

require.extensions[".ts"] = (module, filename) => {
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText;
  module._compile(output, filename);
};

const mocks = {
  "@/lib/clientStore": { getActiveClients: () => [], getClient: () => undefined },
  "@/lib/recordStore": { getAuditEvents: () => [], getRecords: () => ({}) },
  "@/lib/clientWorkspaceStore": { getAllClientWorkspaceEntries: () => ({ people: [], trackers: [], items: [] }) },
  "@/lib/recurringTasks/occurrenceService": { getOccurrences: () => [] },
  "@/lib/recurringTasks/taskStore": { getRecurringTasks: () => [] },
};
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (mocks[request]) return mocks[request];
  return originalLoad.call(this, request, parent, isMain);
};

const { buildConsultantWorkSnapshot } = require("./consultantWork.ts");

const clients = [
  { id: "org-a", company: "Organisation A", status: "Active", contacts: [{ id: "person-a", name: "Alex", authorised: true }] },
  { id: "org-b", company: "Organisation B", status: "Pilot", contacts: [{ id: "person-b", name: "Blair", authorised: true }] },
  { id: "org-inactive", company: "Inactive", status: "Suspended", contacts: [] },
];

test("consultant work retains tenant IDs and excludes suspended organisations", () => {
  const result = buildConsultantWorkSnapshot({
    clients,
    today: "2026-11-10",
    records: [
      { id: "shared-record", organisationId: "org-a", name: "Organisation A record" },
      { id: "shared-record", organisationId: "org-b", name: "Organisation B record" },
    ],
    tasks: [
      { id: "shared-schedule", organisationId: "org-a", name: "One-off", linkedRecordId: "shared-record", ownerId: "person-a", status: "active", priority: "high", startDate: "2026-11-10", recurrence: { frequency: "once" } },
      { id: "shared-schedule", organisationId: "org-b", name: "Foreign task", linkedRecordId: "shared-record", ownerId: "person-b", status: "active", priority: "low", startDate: "2026-11-10", recurrence: { frequency: "weekly" } },
      { id: "schedule-inactive", organisationId: "org-inactive", name: "Suspended task", ownerId: "person-x", status: "active", priority: "low", startDate: "2026-11-10", recurrence: { frequency: "weekly" } },
    ],
    occurrences: [
      { id: "shared-occurrence", recurringTaskId: "shared-schedule", organisationId: "org-a", scheduledFor: "2026-11-10", dueAt: "2026-11-10T09:00:00", status: "completed", completedAt: "2026-11-10T09:15:00", ownerId: "person-a", updatedAt: "2026-11-10T09:15:00" },
      { id: "shared-occurrence", recurringTaskId: "shared-schedule", organisationId: "org-b", scheduledFor: "2026-11-10", dueAt: "2026-11-10T09:00:00", status: "upcoming", ownerId: "person-b", updatedAt: "2026-11-10T08:00:00" },
      { id: "occ-inactive", recurringTaskId: "schedule-inactive", organisationId: "org-inactive", scheduledFor: "2026-11-10", dueAt: "2026-11-10T09:00:00", status: "upcoming", ownerId: "person-x", updatedAt: "2026-11-10T08:00:00" },
    ],
    auditEvents: [],
    directory: { people: [], trackers: [], items: [] },
  });

  assert.deepEqual(result.organisations.map((item) => item.id), ["org-a", "org-b"]);
  assert.equal(result.tasks.some((item) => item.organisationId === "org-inactive"), false);
  assert.deepEqual(result.completed.map((item) => item.organisationId), ["org-a"]);
  const organisationBTask = result.tasks.find((item) => item.organisationId === "org-b");
  assert.equal(organisationBTask.organisation, "Organisation B");
  assert.equal(organisationBTask.task, "Foreign task");
  assert.equal(organisationBTask.related, "Organisation B record");
});

test("consultant work derives checklist rows, overdue state, and blocked exceptions from shared data", () => {
  const result = buildConsultantWorkSnapshot({
    clients: [clients[0]],
    today: "2026-11-10",
    records: [],
    tasks: [],
    occurrences: [],
    auditEvents: [],
    directory: {
      people: [{ id: "person-a", organisationId: "org-a", name: "Alex", active: true }],
      trackers: [{ id: "tracker-a", organisationId: "org-a", name: "Monthly checklist", ownerId: "person-a", periodType: "Monthly tracker", startDate: "2026-11-01", endDate: "2026-11-30", status: "Active" }],
      items: [
        { id: "blocked-item", organisationId: "org-a", trackerId: "tracker-a", task: "Blocked task", responsiblePersonId: "person-a", responsiblePersonName: "Alex", targetDate: "2026-11-10", priority: "High", status: "Blocked", blockedReason: "Waiting for client" },
        { id: "overdue-item", organisationId: "org-a", trackerId: "tracker-a", task: "Overdue task", responsiblePersonId: "person-a", responsiblePersonName: "Alex", targetDate: "2026-11-09", priority: "Medium", status: "Not Started" },
      ],
    },
  });

  assert.equal(result.checklists[0].name, "Monthly checklist");
  assert.equal(result.checklists[0].overdueCount, 1);
  assert.equal(result.tasks.find((item) => item.task === "Blocked task").status, "Blocked");
  assert.equal(result.tasks.find((item) => item.task === "Overdue task").status, "Overdue");
  assert.equal(result.exceptions[0].issue, "Checklist item is blocked");
  assert.equal(result.exceptions[0].organisationId, "org-a");
});

test("client-created work source is only shown when a matching audit event supports it", () => {
  const task = { id: "calendar-task", organisationId: "org-a", name: "Calendar item", ownerId: "person-a", status: "active", priority: "medium", startDate: "2026-11-10", recurrence: { frequency: "once" } };
  const base = {
    clients: [clients[0]],
    today: "2026-11-10",
    records: [],
    tasks: [task],
    occurrences: [{ id: "calendar-occ", recurringTaskId: task.id, organisationId: "org-a", scheduledFor: "2026-11-10", dueAt: "2026-11-10T09:00:00", status: "upcoming", ownerId: "person-a", updatedAt: "2026-11-10T08:00:00" }],
    directory: { people: [], trackers: [], items: [] },
  };
  const ordinary = buildConsultantWorkSnapshot({ ...base, auditEvents: [] });
  const clientCreated = buildConsultantWorkSnapshot({
    ...base,
    auditEvents: [{
      action: "Task created from Calendar",
      entityType: "recurring task",
      entityId: task.id,
      newValue: JSON.stringify({ task: { organisationId: task.organisationId } }),
    }],
  });

  assert.equal(ordinary.tasks[0].source, "Recurring");
  assert.equal(clientCreated.tasks[0].source, "Client-created");
});
