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

const records = [
  {
    id: "shared-record",
    organisationId: "org-a",
    organisation: "Organisation A",
    name: "A record",
    expiryDate: "2026-11-15",
    followUp: "2026-11-12",
    contact: "Alex",
    risk: "High",
    status: "Active",
    nextAction: "Confirm renewal",
  },
  {
    id: "shared-record",
    organisationId: "org-b",
    organisation: "Organisation B",
    name: "B record",
    expiryDate: "2026-11-16",
    followUp: "2026-11-13",
    risk: "Medium",
    status: "Active",
  },
  {
    id: "inactive-record",
    organisationId: "org-suspended",
    name: "Suspended record",
    expiryDate: "2026-11-18",
    status: "Active",
  },
];

const mocks = {
  "@/lib/clientActivities": {
    filterClientActivities: (activities) => activities,
  },
  "@/lib/consultantWork": {
    loadConsultantWorkSnapshot: () => snapshot,
  },
  "@/lib/clientWorkspaceSelectors": {
    businessDateKey: (value) => value || "",
    clientBusinessToday: () => "2026-11-10",
  },
  "@/lib/recordStore": {
    getRecords: () => Object.fromEntries(
      records.map((record, index) => [`record-${index}`, record]),
    ),
  },
};

const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (mocks[request]) return mocks[request];
  return originalLoad.call(this, request, parent, isMain);
};

const snapshot = {
  organisations: [
    { id: "org-a", name: "Organisation A" },
    { id: "org-b", name: "Organisation B" },
  ],
  people: [],
  tasks: [
    {
      id: "record:org-a:shared-record:2026-11-12",
      organisationId: "org-a",
      organisation: "Organisation A",
      task: "Confirm renewal",
      related: "A record",
      responsible: "Alex",
      dueDate: "2026-11-12",
      dueTime: "",
      priority: "High",
      status: "Upcoming",
      source: "Record action",
      kind: "record",
      completedDate: "",
      completionEvidence: "",
      nextAction: "Confirm renewal",
    },
    {
      id: "occurrence:org-a:occurrence-a",
      organisationId: "org-a",
      organisation: "Organisation A",
      task: "Monthly task",
      related: "—",
      responsible: "Alex",
      dueDate: "2026-11-12",
      dueTime: "09:00",
      priority: "High",
      status: "Upcoming",
      source: "Client-created",
      kind: "recurring",
      completedDate: "",
      completionEvidence: "",
      nextAction: "",
      occurrence: { recurringTaskId: "schedule-a" },
    },
    {
      id: "checklist:org-a:item-a",
      organisationId: "org-a",
      organisation: "Organisation A",
      task: "Checklist task",
      related: "Monthly checklist",
      responsible: "Alex",
      dueDate: "2026-11-13",
      dueTime: "",
      priority: "Medium",
      status: "Upcoming",
      source: "Checklist",
      kind: "checklist",
      completedDate: "",
      completionEvidence: "",
      nextAction: "",
    },
  ],
};

const {
  filterConsultantActivities,
  getConsultantActivities,
} = require("./consultantActivities.ts");

test("calendar uses canonical record events once and excludes suspended organisations", () => {
  const activities = getConsultantActivities(snapshot, "2026-11-10");
  const recordActivities = activities.filter(
    (activity) => activity.sourceEntityType === "record",
  );
  const organisationARecordActivities = recordActivities.filter(
    (activity) => activity.organisationId === "org-a",
  );

  assert.equal(organisationARecordActivities.length, 2);
  assert.deepEqual(
    organisationARecordActivities.map((activity) => activity.activityType).sort(),
    ["record_expiry", "record_follow_up"],
  );
  assert.equal(
    activities.some((activity) => activity.organisationId === "org-suspended"),
    false,
  );
  assert.equal(
    activities.some((activity) => activity.title === "Confirm renewal" && activity.sourceEntityType === "task"),
    false,
  );
  assert.equal(
    organisationARecordActivities.every(
      (activity) => activity.route === "/monitored-records/shared-record",
    ),
    true,
  );
});

test("calendar retains recurring and checklist links and organisation scoping", () => {
  const activities = getConsultantActivities(snapshot, "2026-11-10");
  const recurring = activities.find(
    (activity) => activity.title === "Monthly task",
  );
  const checklist = activities.find(
    (activity) => activity.title === "Checklist task",
  );

  assert.ok(recurring);
  assert.match(recurring.description, /Client-created/);
  assert.equal(recurring.route, "/recurring-tasks/schedule-a");
  assert.equal(checklist.route, "/work");

  const filtered = filterConsultantActivities(activities, {
    organisationId: "org-a",
    priority: "high",
  });
  assert.equal(filtered.every((activity) => activity.organisationId === "org-a"), true);
  assert.equal(filtered.every((activity) => activity.priority === "high"), true);
  assert.equal(
    filtered.every((activity) => activity.organisationName === "Organisation A"),
    true,
  );
});
