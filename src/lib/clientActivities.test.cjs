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
  filterClientActivities,
  getActivitiesForDate,
  getActivitiesForMonth,
  getActivitiesForResponsiblePerson,
  getActivitiesForWeek,
  getClientActivities,
  getOverdueActivities,
  getUpcomingRecordExpiries,
  normalizeActivityStatus,
} = require("./clientActivities.ts");
const { businessDateKey, businessTimeKey, clientBusinessToday } = require("./clientWorkspaceSelectors.ts");
const { summarizeClientCalendarActivities } = require("./clientCalendarReports.ts");

const organisationId = "demo-construction";
const data = {
  organisation: { id: organisationId },
  authOrganisationId: organisationId,
  userId: "user-1",
  team: [{ id: "user-1", name: "Alex Client" }],
  assignedTasks: [],
  workspaceState: {
    organisationId,
    people: [{ id: "person-1", organisationId, name: "Alex Client" }],
    trackers: [{ id: "tracker-1", organisationId, name: "Monthly compliance", status: "Active" }],
    items: [
      {
        id: "checklist-1", organisationId, trackerId: "tracker-1", task: "Submit return",
        responsiblePersonId: "person-1", responsiblePersonName: "Alex Client", targetDate: "2026-11-09",
        status: "Not Started", priority: "High", nextAction: "Upload return",
      },
      {
        id: "foreign-checklist", organisationId: "other-org", trackerId: "tracker-1", task: "Foreign item",
        targetDate: "2026-11-10", status: "Not Started",
      },
    ],
  },
  records: [
    {
      id: "record-expired", organisationId, name: "Safety certificate", expiryDate: "2026-11-05",
      followUp: "2026-11-12", status: "Current", risk: "High", contact: "Alex Client",
    },
    {
      id: "foreign-record", organisationId: "other-org", name: "Foreign certificate", expiryDate: "2026-11-10",
      followUp: "", status: "Expired",
    },
    {
      id: "record-upcoming", organisationId, name: "Insurance policy", expiryDate: "2026-11-17",
      followUp: "", status: "Current",
    },
  ],
  tasks: [
    {
      id: "task-1", organisationId, name: "Confirm renewal", linkedRecordId: "record-upcoming",
      ownerId: "person-1", priority: "medium", status: "active", clientVisible: true,
    },
    {
      id: "consultant-task", organisationId, name: "Internal review", ownerId: "consultant",
      status: "active", clientVisible: false,
    },
    {
      id: "foreign-task", organisationId: "other-org", name: "Foreign task",
      status: "active", clientVisible: true,
    },
  ],
  occurrences: [
    {
      id: "occurrence-1", organisationId, recurringTaskId: "task-1", ownerId: "person-1",
      scheduledFor: "2026-11-10", dueAt: "2026-11-10T09:30:00+02:00", status: "upcoming",
    },
    {
      id: "internal-occurrence", organisationId, recurringTaskId: "consultant-task",
      scheduledFor: "2026-11-10", dueAt: "2026-11-10T10:00:00+02:00", status: "upcoming",
    },
    {
      id: "foreign-occurrence", organisationId: "other-org", recurringTaskId: "foreign-task",
      scheduledFor: "2026-11-10", dueAt: "2026-11-10T10:00:00+02:00", status: "upcoming",
    },
  ],
  notifications: [
    {
      id: "notification-1", organisationId, date: "11/01/2026", relevantDate: "2026-11-12",
      subject: "Follow-up sent", related: "Safety certificate", kind: "Record", type: "Follow-up", deliveryStatus: "Delivered",
    },
    {
      id: "draft-notification", organisationId, relevantDate: "2026-11-12",
      subject: "Draft reminder", related: "Safety certificate", kind: "Record", type: "Reminder", deliveryStatus: "Draft",
    },
    {
      id: "foreign-notification", organisationId: "other-org", relevantDate: "2026-11-12",
      subject: "Foreign notification", related: "Foreign", kind: "Record", type: "Reminder", deliveryStatus: "Sent",
    },
  ],
};

test("normalizes date-only values and instants in the business time zone", () => {
  assert.equal(businessDateKey("2026-11-10"), "2026-11-10");
  assert.equal(businessDateKey("2026-11-09T22:30:00Z"), "2026-11-10");
  assert.equal(clientBusinessToday(new Date("2026-11-13T22:30:00Z")), "2026-11-14");
  assert.equal(businessDateKey("2026-11-10T25:30:00"), "");
  assert.equal(businessTimeKey("2026-11-10T25:30:00"), "");
  assert.equal(businessTimeKey("2026-11-09T22:30:00Z"), "00:30");
});

test("normalizes activity statuses without collapsing expired into overdue", () => {
  for (const [source, expected] of [
    ["Expired", "expired"], ["expired", "expired"], ["Overdue", "overdue"],
    ["overdue", "overdue"], ["Not Started", "not_started"], ["Upcoming", "upcoming"],
    ["In Progress", "in_progress"], ["Accepted", "accepted"], ["Completed", "completed"],
    ["Awaiting Confirmation", "awaiting_confirmation"], ["Paused", "paused"],
    ["Cancelled", "cancelled"], ["Blocked", "blocked"],
  ]) {
    assert.equal(normalizeActivityStatus(source), expected);
  }
});

test("derives only current-organisation client activities and supports selectors", () => {
  const activities = getClientActivities(data, "2026-11-10");
  assert.ok(activities.every((activity) => activity.organisationId === organisationId));
  assert.ok(!activities.some((activity) => /foreign|internal/i.test(activity.title)));
  assert.ok(!activities.some((activity) => activity.id.includes("draft")));
  assert.equal(activities.find((activity) => activity.id === "record-expiry:record-expired").status, "expired");
  assert.equal(activities.find((activity) => activity.id === "checklist:checklist-1").status, "overdue");
  assert.equal(activities.find((activity) => activity.id === "occurrence:occurrence-1").time, "09:30");
  assert.equal(activities.find((activity) => activity.id === "record-follow-up:record-expired").status, "upcoming");
  assert.equal(activities.find((activity) => activity.id === "released-notification:notification-1").activityType, "follow_up");

  assert.equal(getActivitiesForDate(activities, "2026-11-10").length, 1);
  assert.equal(getActivitiesForMonth(activities, "2026-11").length, activities.length);
  assert.equal(getActivitiesForMonth(activities, 2026, 11).length, activities.length);
  assert.ok(getActivitiesForWeek(activities, "2026-11-10").every((activity) => activity.date >= "2026-11-09" && activity.date <= "2026-11-15"));
  assert.ok(filterClientActivities(activities, { activityType: "tasks" }).every((activity) => ["recurring_task", "assigned_task"].includes(activity.activityType)));
  assert.deepEqual(filterClientActivities(activities, { status: "overdue" }).map((activity) => activity.id).sort(), [
    "checklist:checklist-1",
    "record-expiry:record-expired",
  ]);
  assert.ok(filterClientActivities(activities, { responsiblePerson: "Alex Client" }).every((activity) => activity.responsiblePerson === "Alex Client"));
  assert.ok(getActivitiesForResponsiblePerson(activities, "alex client").length > 0);
  assert.deepEqual(getOverdueActivities(activities, "2026-11-10").map((activity) => activity.id), [
    "record-expiry:record-expired",
    "checklist:checklist-1",
  ]);
  assert.deepEqual(getUpcomingRecordExpiries(activities, "2026-11-10", 7).map((activity) => activity.id), [
    "record-expiry:record-upcoming",
  ]);
});

test("accepted company assignments are included in the calendar only for their assignee and organisation", () => {
  const authOrganisationId = "canonical-supabase-org";
  const activities = getClientActivities({
    ...data,
    authOrganisationId,
    records: [
      ...data.records,
      {
        id: "server-record", organisationId: authOrganisationId, name: "Server-backed policy",
        expiryDate: "2026-11-18", followUp: "", status: "Current", risk: "Medium",
      },
    ],
    assignedTasks: [
      {
        id: "assigned-1", organisation_id: authOrganisationId, created_by: "coworker",
        assigned_to: "user-1", title: "Review payroll", description: "Check the monthly totals",
        due_date: "2026-11-12", priority: "high", status: "accepted", response_note: "",
      },
      {
        id: "assigned-to-coworker", organisation_id: authOrganisationId, created_by: "user-1",
        assigned_to: "coworker", title: "Coworker assignment", description: "",
        due_date: "2026-11-12", priority: "medium", status: "accepted", response_note: "",
      },
      {
        id: "assigned-overdue", organisation_id: authOrganisationId, created_by: "coworker",
        assigned_to: "user-1", title: "Overdue accepted assignment", description: "",
        due_date: "2026-11-09", priority: "high", status: "accepted", response_note: "",
      },
      {
        id: "rejected-1", organisation_id: authOrganisationId, created_by: "coworker",
        assigned_to: "user-1", title: "Rejected assignment", description: "",
        due_date: "2026-11-12", priority: "medium", status: "rejected", response_note: "",
      },
      {
        id: "foreign-assignment", organisation_id: "other-org", created_by: "coworker",
        assigned_to: "user-1", title: "Foreign assignment", description: "",
        due_date: "2026-11-12", priority: "medium", status: "accepted", response_note: "",
      },
    ],
  }, "2026-11-10");

  const acceptedTask = activities.find((activity) => activity.id === "assigned-task:assigned-1");
  assert.equal(acceptedTask.activityType, "assigned_task");
  assert.equal(acceptedTask.date, "2026-11-12");
  assert.equal(acceptedTask.status, "accepted");
  assert.ok(activities.some((activity) => activity.id === "record-expiry:server-record"));
  assert.equal(activities.find((activity) => activity.id === "assigned-task:assigned-overdue").status, "overdue");
  assert.ok(filterClientActivities(activities, { activityType: "tasks" }).includes(acceptedTask));
  assert.ok(!activities.some((activity) => /coworker assignment|rejected assignment|foreign assignment/i.test(activity.title)));
});

test("calendar report summary counts come from the selected activity array", () => {
  const activities = [
    { activityType: "recurring_task", status: "upcoming", date: "2026-11-12" },
    { activityType: "assigned_task", status: "upcoming", date: "2026-11-12" },
    { activityType: "recurring_task", status: "completed", date: "2026-11-12" },
    { activityType: "recurring_task", status: "overdue", date: "2026-11-09" },
    { activityType: "checklist_item", status: "overdue", date: "2026-11-09" },
    { activityType: "record_expiry", status: "upcoming", date: "2026-11-16" },
    { activityType: "record_expiry", status: "expired", date: "2026-11-05" },
    { activityType: "record_follow_up", status: "awaiting_confirmation", date: "2026-11-12" },
  ];
  assert.deepEqual(summarizeClientCalendarActivities(activities, "2026-11-10"), {
    total: 8,
    tasksScheduled: 3,
    completedTasks: 1,
    overdueWork: 2,
    recordsExpiring: 1,
    expiredRecords: 1,
    awaitingConfirmation: 1,
  });
});

test("Friday assigned-task dates remain date-only in the client calendar", () => {
  const fridayTask = {
    id: "friday-assignment",
    organisation_id: organisationId,
    created_by: "coworker",
    assigned_to: "user-1",
    title: "Friday assignment",
    description: "",
    due_date: "2026-11-13",
    priority: "high",
    status: "accepted",
    response_note: "",
    updated_at: "2026-11-10T12:00:00.000Z",
  };
  const activities = getClientActivities({
    ...data,
    assignedTasks: [fridayTask],
  }, "2026-11-10");

  const fridayActivity = activities.find((activity) =>
    activity.id === "assigned-task:friday-assignment"
  );
  assert.equal(new Date(`${fridayTask.due_date}T00:00:00Z`).getUTCDay(), 5);
  assert.equal(fridayActivity.date, "2026-11-13");
});
