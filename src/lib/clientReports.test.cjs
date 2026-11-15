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

const { buildClientReportRows } = require("./clientReports.ts");

const data = {
  organisation: { id: "prototype-org", company: "Example Client" },
  authOrganisationId: "canonical-org",
  userId: "client-user",
  team: [{ id: "assignee", name: "Team Member", jobTitle: "Coordinator" }],
  records: [
    {
      id: "server-record",
      organisationId: "canonical-org",
      name: "Server-backed policy",
      category: "Insurance",
      category2: "Liability",
      issueDate: "2025-01-01",
      expiryDate: "2025-12-01",
      status: "Current",
      risk: "High",
      contact: "Team Member",
      followUp: "",
      nextAction: "",
    },
    {
      id: "prototype-record",
      organisationId: "prototype-org",
      name: "Prototype-backed certificate",
      category: "Safety",
      category2: "Certificate",
      issueDate: "",
      expiryDate: "",
      status: "Current",
      risk: "Low",
      contact: "",
      followUp: "",
      nextAction: "",
    },
  ],
  tasks: [],
  assignedTasks: [
    {
      id: "pending-task",
      organisation_id: "canonical-org",
      created_by: "coworker",
      assigned_to: "client-user",
      title: "Review supplier contract",
      description: null,
      due_date: "2025-11-20",
      priority: "high",
      status: "pending_acceptance",
      response_note: null,
    },
    {
      id: "rejected-task",
      organisation_id: "canonical-org",
      created_by: "client-user",
      assigned_to: "assignee",
      title: "Prepare monthly reconciliation",
      description: null,
      due_date: null,
      priority: "medium",
      status: "rejected",
      response_note: "I am unavailable this week.",
    },
    {
      id: "foreign-task",
      organisation_id: "another-org",
      created_by: "client-user",
      assigned_to: "client-user",
      title: "Foreign task",
      description: null,
      due_date: null,
      priority: "medium",
      status: "accepted",
      response_note: null,
    },
  ],
  occurrences: [],
  notifications: [],
  auditEvents: [],
  workspaceState: {
    organisationId: "prototype-org",
    people: [],
    trackers: [],
    items: [],
  },
};

const allHistory = {
  start: "0000-01-01",
  end: "9999-12-31",
  label: "All available history",
};

test("all monitored records include both canonical and prototype organisation records", () => {
  const rows = buildClientReportRows("all-monitored-records", data, allHistory);

  assert.deepEqual(rows.map((row) => row.id).sort(), ["prototype-record", "server-record"]);
});

test("all client work includes participant assignments in every status without foreign tasks", () => {
  const rows = buildClientReportRows("all-client-work", data, allHistory);

  assert.deepEqual(rows.map((row) => row.id).sort(), [
    "assigned-task:pending-task",
    "assigned-task:rejected-task",
  ]);
  assert.equal(rows.find((row) => row.id === "assigned-task:pending-task").status, "Awaiting confirmation");
  const rejected = rows.find((row) => row.id === "assigned-task:rejected-task");
  assert.equal(rejected.status, "Rejected");
  assert.equal(rejected.cells["Response / Evidence"], "I am unavailable this week.");
});
