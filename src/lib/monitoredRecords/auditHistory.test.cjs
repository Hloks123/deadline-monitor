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
  mapMonitoredRecordAuditRow,
  parseMonitoredRecordAuditHistory,
  selectAuditHistorySource,
} = require("./auditHistory.ts");
const { canAccessMonitoredRecordOrganisation } = require("./access.ts");
const {
  httpMonitoredRecordRepository,
  MonitoredRecordHistoryError,
} = require("./repository.ts");

test("history access is limited to main consultants and assigned assistants", () => {
  assert.equal(canAccessMonitoredRecordOrganisation("org-a", ["main_consultant"], []), true);
  assert.equal(
    canAccessMonitoredRecordOrganisation("org-a", [], [
      { organisationId: "org-a", role: "assistant_consultant" },
    ]),
    true,
  );
  assert.equal(
    canAccessMonitoredRecordOrganisation("org-a", [], [
      { organisationId: "org-b", role: "assistant_consultant" },
    ]),
    false,
  );
  assert.equal(
    canAccessMonitoredRecordOrganisation("org-a", [], [
      { organisationId: "org-a", role: "client_administrator" },
    ]),
    false,
  );
  assert.equal(
    canAccessMonitoredRecordOrganisation("org-a", [], [
      { organisationId: "org-a", role: "client_user" },
    ]),
    false,
  );
  assert.equal(canAccessMonitoredRecordOrganisation("org-a", ["administrator"], []), false);
});

test("record-specific history uses only matching server events and general history stays local", () => {
  const localEvents = [{ id: "local", recordId: "record-a" }];
  const serverEvents = [
    { id: "server-a", recordId: "record-a" },
    { id: "server-b", recordId: "record-b" },
  ];
  assert.deepEqual(
    selectAuditHistorySource("record-a", localEvents, serverEvents),
    [serverEvents[0]],
  );
  assert.deepEqual(selectAuditHistorySource("", localEvents, serverEvents), localEvents);
});

test("history rows expose only approved fields and never contact identifiers", () => {
  const event = mapMonitoredRecordAuditRow({
    id: "event-a",
    record_id: "record-a",
    record_name: "Safety certificate",
    actor_label: "Consultant",
    action: "Monitored record updated",
    field: "record",
    previous_value: JSON.stringify({
      expiryDate: "2030-01-01",
      contactId: "contact-uuid-old",
      notes: "private note",
      legacy_id: "legacy-record-id",
      migration_checksum: "checksum",
    }),
    new_value: JSON.stringify({
      expiryDate: "2031-01-01",
      contactId: "contact-uuid-new",
      notes: "another private note",
      legacy_id: "other-legacy-id",
      migration_checksum: "another-checksum",
    }),
    occurred_at: "2026-11-14T12:00:00.000Z",
  }, "record-a");

  assert.ok(event);
  assert.equal(event.action, "Monitored record updated");
  assert.equal(event.changes.length, 2);
  const contactChange = event.changes.find((change) => change.label === "Responsible contact");
  assert.deepEqual(contactChange, {
    field: "contactId",
    label: "Responsible contact",
    previousValue: null,
    newValue: null,
    summary: "Responsible contact changed",
  });
  assert.ok(!JSON.stringify(event).includes("contact-uuid"));
  assert.ok(!JSON.stringify(event).includes("private note"));
  assert.ok(!JSON.stringify(event).includes("legacy-record-id"));
  assert.ok(!JSON.stringify(event).includes("checksum"));
});

test("record creation with no responsible contact does not imply a contact change", () => {
  const event = mapMonitoredRecordAuditRow({
    id: "event-create",
    record_id: "record-a",
    action: "Monitored record created",
    field: "record",
    new_value: JSON.stringify({ contactId: null }),
  }, "record-a");
  assert.ok(event);
  assert.deepEqual(event.changes, []);
});

test("contact-only trigger events use a neutral description without exposing UUIDs", () => {
  const event = mapMonitoredRecordAuditRow({
    id: "event-contact",
    record_id: "record-a",
    action: "Monitored record updated",
    field: "contact_id",
    previous_value: JSON.stringify({ contactId: "private-contact-a" }),
    new_value: JSON.stringify({ contactId: "private-contact-b" }),
  }, "record-a");
  assert.ok(event);
  assert.equal(event.summary, "Responsible contact changed");
  assert.deepEqual(event.changes, [{
    field: "contactId",
    label: "Responsible contact",
    previousValue: null,
    newValue: null,
    summary: "Responsible contact changed",
  }]);
  assert.ok(!JSON.stringify(event).includes("private-contact"));
});

test("history mapping rejects another record and sanitizes unexpected actions", () => {
  assert.equal(
    mapMonitoredRecordAuditRow({ id: "event", record_id: "record-b" }, "record-a"),
    null,
  );
  const event = mapMonitoredRecordAuditRow({
    id: "event-a",
    record_id: "record-a",
    action: "internal error includes migration checksum",
    previous_value: '{"service_role":"secret"}',
    new_value: "{}",
  }, "record-a");
  assert.ok(event);
  assert.equal(event.action, "Monitored record activity");
  assert.deepEqual(event.changes, []);
});

test("ambiguous legacy audit dates remain labeled text instead of being parsed", () => {
  const event = mapMonitoredRecordAuditRow({
    id: "event-a",
    record_id: "record-a",
    action: "Record status changed",
    legacy_date_text: "03/04/2030, 10:00",
  }, "record-a");
  assert.ok(event);
  assert.equal(event.date, "03/04/2030, 10:00");
  assert.equal(event.dateKind, "legacy_text");
});

test("history response parser accepts empty history and strips unknown response metadata", () => {
  assert.deepEqual(
    parseMonitoredRecordAuditHistory({
      organisationName: "Example Organisation",
      events: [],
      truncated: false,
      migrationMetadata: { checksum: "hidden" },
    }, "record-a"),
    {
      organisationName: "Example Organisation",
      events: [],
      truncated: false,
    },
  );
});

test("history response parser rejects malformed rows and cross-record events", () => {
  assert.throws(
    () => parseMonitoredRecordAuditHistory({
      organisationName: "Example",
      events: [{ id: "event", recordId: "record-b" }],
      truncated: false,
    }, "record-a"),
    /response is invalid/,
  );
  assert.throws(
    () => parseMonitoredRecordAuditHistory({
      organisationName: "Example",
      events: "not-an-array",
      truncated: false,
    }, "record-a"),
    /response is invalid/,
  );
});

test("repository requests server history and accepts an empty result", async () => {
  const originalFetch = global.fetch;
  let requestedUrl = "";
  global.fetch = async (url) => {
    requestedUrl = String(url);
    return {
      ok: true,
      status: 200,
      json: async () => ({
        organisationName: "Example Organisation",
        events: [],
        truncated: false,
      }),
    };
  };
  try {
    const history = await httpMonitoredRecordRepository.auditHistory("org-a", "record-a");
    assert.match(requestedUrl, /\/history\?scope=audit$/);
    assert.deepEqual(history.events, []);
  } finally {
    global.fetch = originalFetch;
  }
});

test("repository reports forbidden and not-found responses without falling back", async () => {
  const originalFetch = global.fetch;
  try {
    for (const [status, kind] of [[403, "forbidden"], [404, "not_found"]]) {
      global.fetch = async () => ({
        ok: false,
        status,
        json: async () => ({ error: "internal backend detail" }),
      });
      await assert.rejects(
        httpMonitoredRecordRepository.auditHistory("org-a", "record-a"),
        (error) => error instanceof MonitoredRecordHistoryError && error.kind === kind,
      );
    }

    global.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({ organisationName: "Example", events: null, truncated: false }),
    });
    await assert.rejects(
      httpMonitoredRecordRepository.auditHistory("org-a", "record-a"),
      (error) => error instanceof MonitoredRecordHistoryError && error.kind === "invalid_response",
    );
  } finally {
    global.fetch = originalFetch;
  }
});
