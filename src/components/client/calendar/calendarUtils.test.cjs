/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const ts = require("typescript");

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
  formatCalendarDate,
  formatCalendarMonth,
  getActivityTone,
  getCalendarWeekDays,
  getMonthGridDays,
  compareCalendarActivities,
  shiftCalendarDate,
  shiftMonth,
} = require("./calendarUtils.ts");

test("builds a complete Monday-first month grid", () => {
  const days = getMonthGridDays("2026-11");
  assert.equal(days.length, 42);
  assert.equal(days[0], "2026-10-26");
  assert.equal(days[6], "2026-11-01");
  assert.equal(days[41], "2026-12-06");
  assert.deepEqual(getMonthGridDays("invalid"), []);
});

test("formats calendar dates without shifting local calendar days", () => {
  assert.equal(formatCalendarMonth("2026-11"), "November 2026");
  assert.equal(formatCalendarDate("2026-11-10"), "Tuesday, 10 November 2026");
});

test("moves between months including year boundaries", () => {
  assert.equal(shiftMonth("2026-01", -1), "2025-12");
  assert.equal(shiftMonth("2026-12", 1), "2027-01");
});

test("builds Monday-first weeks and shifts dates across month boundaries", () => {
  assert.deepEqual(getCalendarWeekDays("2026-11-10"), [
    "2026-11-09",
    "2026-11-10",
    "2026-11-11",
    "2026-11-12",
    "2026-11-13",
    "2026-11-14",
    "2026-11-15",
  ]);
  assert.deepEqual(getCalendarWeekDays("2026-11-08"), [
    "2026-11-02",
    "2026-11-03",
    "2026-11-04",
    "2026-11-05",
    "2026-11-06",
    "2026-11-07",
    "2026-11-08",
  ]);
  assert.equal(shiftCalendarDate("2026-11-30", 1), "2026-12-01");
  assert.equal(shiftCalendarDate("2026-01-01", -1), "2025-12-31");
});

test("sorts calendar activities with all-day items first then by time", () => {
  const activities = [
    { title: "Later", time: "15:30" },
    { title: "All day B" },
    { title: "Earlier", time: "09:00" },
    { title: "All day A" },
  ];
  assert.deepEqual(activities.sort(compareCalendarActivities).map((activity) => activity.title), [
    "All day A",
    "All day B",
    "Earlier",
    "Later",
  ]);
});

test("uses distinct semantic colors for near expiries and activity states", () => {
  const recordExpiry = (date, status = "upcoming") => ({
    activityType: "record_expiry",
    date,
    status,
  });
  assert.match(getActivityTone(recordExpiry("2026-11-16"), "2026-11-10"), /orange/);
  assert.match(getActivityTone(recordExpiry("2026-11-30"), "2026-11-10"), /amber/);
  assert.match(getActivityTone(recordExpiry("2026-11-10", "expired"), "2026-11-10"), /red/);
  assert.match(getActivityTone({ activityType: "recurring_task", status: "completed" }, "2026-11-10"), /emerald/);
  assert.match(getActivityTone({ activityType: "checklist_item", status: "awaiting_confirmation" }, "2026-11-10"), /violet/);
  assert.match(getActivityTone({ activityType: "record_follow_up", status: "upcoming" }, "2026-11-10"), /teal/);
});
