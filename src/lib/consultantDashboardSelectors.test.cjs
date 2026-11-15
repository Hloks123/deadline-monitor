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

const {
  getConsultantDashboardSummary,
  getRecentConsultantDashboardActivity,
} = require("./consultantDashboardSelectors.ts");

function task(id, kind, status, dueDate, frequency = "weekly") {
  return {
    id,
    organisationId: "org-a",
    organisation: "Organisation A",
    task: id,
    related: "—",
    responsible: "Alex",
    dueDate,
    dueTime: "",
    priority: "Medium",
    status,
    source: kind === "checklist" ? "Checklist" : "Recurring",
    kind,
    completedDate: "",
    completionEvidence: "",
    nextAction: "",
    ...(kind === "recurring"
      ? { occurrence: { recurringTaskId: id } }
      : {}),
    frequency,
  };
}

function schedule(id, status, jobHealth, frequency = "weekly") {
  return {
    task: {
      id,
      organisationId: "org-a",
      status,
      recurrence: { frequency },
    },
    organisation: "Organisation A",
    owner: "Alex",
    related: "—",
    repeats: "Weekly",
    lastRun: "",
    nextRun: "",
    jobHealth,
  };
}

test("dashboard projection counts canonical exceptions, due work and recurring health", () => {
  const exceptions = [
    { id: "critical", severity: "Critical", organisationId: "org-a", organisation: "Organisation A", issue: "High-risk record has expired", related: "Expired permit", responsible: "Alex", date: "2026-11-09", nextAction: "Renew", status: "Expired" },
    { id: "high", severity: "High", organisationId: "org-a", organisation: "Organisation A", issue: "Recurring occurrence failed", related: "Monthly task", responsible: "Alex", date: "2026-11-10", nextAction: "Retry", status: "Failed" },
    { id: "blocked", severity: "Medium", organisationId: "org-a", organisation: "Organisation A", issue: "Checklist item is blocked", related: "Blocked task", responsible: "Alex", date: "2026-11-11", nextAction: "Resolve blocker", status: "Blocked" },
    { id: "missed", severity: "Medium", organisationId: "org-a", organisation: "Organisation A", issue: "Missed recurring occurrence", related: "Weekly task", responsible: "Alex", date: "2026-11-12", nextAction: "Complete", status: "Overdue" },
    { id: "record-awaiting", severity: "Low", organisationId: "org-a", organisation: "Organisation A", issue: "Record awaiting client confirmation", related: "Renewal record", responsible: "Alex", date: "2026-11-13", nextAction: "Confirm", status: "Awaiting confirmation" },
    { id: "checklist-awaiting", severity: "Low", organisationId: "org-a", organisation: "Organisation A", issue: "Checklist item awaiting client confirmation", related: "Evidence task", responsible: "Alex", date: "2026-11-14", nextAction: "Confirm", status: "Awaiting Confirmation" },
  ];
  const snapshot = {
    organisations: [{ id: "org-a", name: "Organisation A" }],
    people: [],
    tasks: [
      task("one-off", "recurring", "Upcoming", "2026-11-10", "once"),
      task("repeated", "recurring", "Due today", "2026-11-10"),
      task("checklist", "checklist", "Not Started", "2026-11-10"),
      task("record-action", "record", "Upcoming", "2026-11-10"),
      task("done", "recurring", "Completed", "2026-11-10", "once"),
      task("skipped", "checklist", "Skipped", "2026-11-10"),
      task("cancelled", "recurring", "Cancelled", "2026-11-10"),
      task("overdue", "recurring", "Overdue", "2026-11-09"),
    ],
    checklists: [],
    recurring: [
      schedule("one-off", "active", "Healthy", "once"),
      schedule("repeated", "active", "Healthy"),
      schedule("missed", "active", "Missed occurrence"),
      schedule("failed", "active", "Failed · 1 retries"),
      schedule("paused", "paused", "Paused schedule requires review"),
    ],
    completed: [task("done", "recurring", "Completed", "2026-11-10", "once")],
    exceptions,
  };

  const summary = getConsultantDashboardSummary(snapshot, "2026-11-10");

  assert.equal(summary.exceptions.critical, exceptions.filter((item) => item.severity === "Critical").length);
  assert.equal(summary.exceptions.high, exceptions.filter((item) => item.severity === "High").length);
  assert.equal(summary.exceptions.blocked, exceptions.filter((item) => item.issue === "Checklist item is blocked").length);
  assert.equal(summary.exceptions.failedRecurring, exceptions.filter((item) => item.issue === "Recurring occurrence failed").length);
  assert.equal(summary.exceptions.awaitingConfirmation, 2);
  assert.equal(summary.exceptions.highRiskExpiredRecords, 1);
  assert.equal(summary.exceptions.missedRecurring, 1);
  assert.deepEqual(summary.exceptions.ordered.map((item) => item.id), [
    "critical",
    "high",
    "blocked",
    "missed",
    "record-awaiting",
    "checklist-awaiting",
  ]);
  assert.deepEqual(summary.today, {
    total: 4,
    tasks: 1,
    checklist: 1,
    recurringOccurrences: 1,
    recordActions: 1,
  });
  assert.equal(summary.workRequiringAttention, 4);
  assert.deepEqual(summary.recurring, {
    active: 4,
    paused: 1,
    healthy: 2,
    missed: 1,
    failed: 1,
  });
});

test("recent dashboard activity is material, active-organisation scoped, newest first and capped at six", () => {
  const event = (id, action, entityType, timestamp, context = "") => ({
    id,
    recordId: "",
    recordName: `Entity ${id}`,
    organisation: "Organisation A",
    user: "Client user",
    action,
    previousValue: "",
    newValue: "",
    date: timestamp,
    timestamp,
    entityType,
    entityId: id,
    entityName: `Entity ${id}`,
    context,
  });
  const events = [
    event("1", "Client monitored record created", "record", "2026-11-11T09:00:00.000Z"),
    event("2", "Client monitored record edited", "record", "2026-11-11T09:01:00.000Z"),
    event("3", "Client replacement date confirmed", "record", "2026-11-11T09:02:00.000Z"),
    event("4", "Recurring task schedule changed", "recurring task", "2026-11-11T09:03:00.000Z"),
    event("5", "Recurring task paused", "recurring task", "2026-11-11T09:04:00.000Z"),
    event("6", "Checklist item added", "checklist item", "2026-11-11T09:05:00.000Z"),
    event("7", "Task completed", "checklist item", "2026-11-11T09:06:00.000Z"),
    event("debug", "Internal debug event created", "system", "2026-11-11T09:07:00.000Z"),
    event("suspended", "Recurring task resumed", "recurring task", "2026-11-11T09:08:00.000Z", "Organisation ID: org-suspended"),
  ];

  const result = getRecentConsultantDashboardActivity(
    events,
    [{ id: "org-a", name: "Organisation A" }],
  );

  assert.deepEqual(result.map((item) => item.id), ["7", "6", "5", "4", "3", "2"]);
  assert.equal(result.length, 6);
  assert.equal(result.every((item) => item.user === "Client user"), true);
});
