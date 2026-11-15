/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

const originalLoad = Module._load;
const originalResolveFilename = Module._resolveFilename;
const mockState = {
  contactResolution: { ok: true, contact: { name: "Contact A", email: "a@example.invalid" } },
  auditRows: [],
  calls: [],
};

function response(body, init = {}) {
  return new Response(JSON.stringify(body), {
    status: init.status || 200,
    headers: { "content-type": "application/json", ...init.headers },
  });
}

function createSupabase() {
  return {
    from(table) {
      let isUpdate = false;
      return {
        update(values) {
          isUpdate = true;
          mockState.calls.push({ table, operation: "update", values });
          return this;
        },
        select(columns) {
          mockState.calls.push({ table, operation: "select", columns });
          return this;
        },
        eq() {
          return this;
        },
        is() {
          return this;
        },
        order() {
          return this;
        },
        limit() {
          return this;
        },
        async maybeSingle() {
          if (isUpdate) {
            isUpdate = false;
            return { data: null, error: null };
          }
          return { data: { id: "record-a" }, error: null };
        },
        then(resolve, reject) {
          return Promise.resolve({ data: mockState.auditRows, error: null }).then(resolve, reject);
        },
      };
    },
  };
}

Module._resolveFilename = function (request, parent, isMain, options) {
  if (request.startsWith("@/")) {
    request = path.resolve(__dirname, "../..", `${request.slice(2)}.ts`);
  }
  return originalResolveFilename.call(this, request, parent, isMain, options);
};

Module._load = function (request, parent, isMain) {
  if (request === "next/server") {
    return { NextResponse: { json: response } };
  }
  if (request === "@/lib/admin/authorization") {
    return {
      invalidRequest: (message) => response({ error: message }, { status: 400 }),
      isRecord: (value) => typeof value === "object" && value !== null && !Array.isArray(value),
      readJson: (requestValue) => requestValue.json(),
      requireSameOrigin: () => null,
      safeBackendFailure: () => response({ error: "Request failed." }, { status: 500 }),
    };
  }
  if (request === "@/lib/monitoredRecords/server") {
    return {
      authoriseOrganisationRecordAccess: async () => ({
        ok: true,
        supabase: createSupabase(),
        organisation: { id: "org-a", name: "Organisation A" },
        userId: "user-a",
      }),
      isUuid: () => true,
      mapMonitoredRecord: (record) => record,
      recordDatabasePatch: (userId, changes) => ({ ...changes, updated_by: userId }),
      resolveRecordContact: async () => mockState.contactResolution,
    };
  }
  if (request === "@/lib/monitoredRecords/validation") {
    return {
      parseMonitoredRecordWrite: (changes) => ({ ok: true, value: changes }),
    };
  }
  return originalLoad.call(this, request, parent, isMain);
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

const { PATCH } = require("../../app/api/organisations/[organisationId]/monitored-records/[recordId]/route.ts");
const { GET: getHistory } = require("../../app/api/organisations/[organisationId]/monitored-records/[recordId]/history/route.ts");

test("stale responsible-contact PATCH returns 409 without a successful write", async () => {
  mockState.calls = [];
  mockState.contactResolution = {
    ok: true,
    contact: { name: "Contact A", email: "a@example.invalid" },
  };
  const request = new Request("http://localhost/api/organisations/org-a/monitored-records/record-a", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      version: 1,
      changes: { contactId: "contact-a" },
    }),
  });

  const result = await PATCH(request, {
    params: Promise.resolve({ organisationId: "org-a", recordId: "record-a" }),
  });
  assert.equal(result.status, 409);
  assert.match((await result.json()).error, /changed/);
  assert.deepEqual(
    mockState.calls.filter((call) => call.operation === "update").map((call) => call.table),
    ["organisation_records"],
  );
  assert.ok(!mockState.calls.some((call) => call.table === "organisation_audit_events"));
});

test("invalid responsible-contact resolution rejects PATCH before writing", async () => {
  mockState.calls = [];
  mockState.contactResolution = { ok: false };
  const request = new Request("http://localhost/api/organisations/org-a/monitored-records/record-a", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      version: 1,
      changes: { contactId: "contact-from-org-b" },
    }),
  });

  const result = await PATCH(request, {
    params: Promise.resolve({ organisationId: "org-a", recordId: "record-a" }),
  });
  assert.equal(result.status, 400);
  assert.ok(!mockState.calls.some((call) => call.operation === "update"));
});

test("audit-history API returns the neutral contact description, not raw UUIDs", async () => {
  mockState.auditRows = [{
    id: "event-contact",
    record_id: "record-a",
    record_name: "Safety certificate",
    actor_label: "Consultant",
    action: "Monitored record updated",
    field: "contact_id",
    previous_value: JSON.stringify({ contactId: "private-contact-a" }),
    new_value: JSON.stringify({ contactId: "private-contact-b" }),
    occurred_at: "2026-11-15T12:00:00.000Z",
  }];
  const request = new Request(
    "http://localhost/api/organisations/org-a/monitored-records/record-a/history?scope=audit",
  );
  const result = await getHistory(request, {
    params: Promise.resolve({ organisationId: "org-a", recordId: "record-a" }),
  });
  const body = await result.json();

  assert.equal(result.status, 200);
  assert.equal(body.events[0].summary, "Responsible contact changed");
  assert.ok(!JSON.stringify(body).includes("private-contact"));
});

test.after(() => {
  Module._load = originalLoad;
  Module._resolveFilename = originalResolveFilename;
});
