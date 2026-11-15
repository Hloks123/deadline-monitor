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

const { resolvePrototypeClientForOrganisation } = require("./clientStore.ts");
const {
  getClientWorkspaceOrganisation,
  getClientWorkspaceRecords,
} = require("./clientWorkspace.ts");
const {
  clearAuthenticatedClientOrganisation,
  getClientProfileStorageKey,
  setAuthenticatedClientOrganisation,
} = require("./clientWorkspaceConstants.ts");
const { addResponsiblePerson, getClientWorkspaceState, saveWorkTracker } = require("./clientWorkspaceStore.ts");
const { addAuditEvent, getAuditEvents } = require("./recordStore.ts");

const organisations = [
  {
    id: "supabase-org-a",
    name: "Demo Construction (Pty) Ltd",
    role: "client_user",
    isPrimary: false,
    userId: "user-a",
    userName: "Client A",
    userEmail: "demo.client.a@example.com",
  },
  {
    id: "supabase-org-b",
    name: "Sample Logistics (Pty) Ltd",
    role: "client_user",
    isPrimary: false,
    userId: "user-b",
    userName: "Client B",
    userEmail: "demo.client.b@example.com",
  },
];

test.afterEach(clearAuthenticatedClientOrganisation);

test("authenticated client A maps to Demo Construction prototype data only", () => {
  const prototype = resolvePrototypeClientForOrganisation(
    organisations[0].id,
    organisations[0].name,
  );
  assert.equal(prototype?.id, "demo-construction");

  setAuthenticatedClientOrganisation(organisations[0], prototype?.id);
  assert.equal(getClientWorkspaceOrganisation()?.company, organisations[0].name);
  const records = getClientWorkspaceRecords();
  assert.ok(records.length > 0);
  assert.ok(records.every((record) => record.organisationId === "demo-construction"));
  assert.ok(!records.some((record) => record.organisationId === "sample-logistics"));
});

test("authenticated client B maps to Sample Logistics prototype data only", () => {
  const prototype = resolvePrototypeClientForOrganisation(
    organisations[1].id,
    organisations[1].name,
  );
  assert.equal(prototype?.id, "sample-logistics");

  setAuthenticatedClientOrganisation(organisations[1], prototype?.id);
  assert.equal(getClientWorkspaceOrganisation()?.company, organisations[1].name);
  const records = getClientWorkspaceRecords();
  assert.ok(records.length > 0);
  assert.ok(records.every((record) => record.organisationId === "sample-logistics"));
  assert.ok(!records.some((record) => record.organisationId === "demo-construction"));
});

test("an unmapped authenticated organisation has no prototype records", () => {
  const prototype = resolvePrototypeClientForOrganisation(
    "supabase-org-unmapped",
    "Unmapped Organisation Ltd",
  );
  assert.equal(prototype, undefined);

  setAuthenticatedClientOrganisation({
    ...organisations[1],
    id: "supabase-org-unmapped",
    name: "Unmapped Organisation Ltd",
  });
  assert.equal(getClientWorkspaceOrganisation()?.company, "Unmapped Organisation Ltd");
  assert.deepEqual(getClientWorkspaceRecords(), []);
});

test("work tracker data remains available and isolated when switching organisations", () => {
  const previousWindow = global.window;
  const previousLocalStorage = global.localStorage;
  const storage = new Map();
  global.window = { dispatchEvent() {} };
  global.localStorage = {
    getItem(key) {
      return storage.get(key) ?? null;
    },
    setItem(key, value) {
      storage.set(key, String(value));
    },
  };
  try {
    setAuthenticatedClientOrganisation(organisations[0], "demo-construction");
    storage.set(getClientProfileStorageKey("docmon_client_workspace_v1"), JSON.stringify({
      organisationId: "demo-construction",
      people: [{ id: "person-a", organisationId: "demo-construction", name: "Client A", active: true }],
      trackers: [{ id: "tracker-a", organisationId: "demo-construction" }],
      items: [{ id: "item-a", organisationId: "demo-construction" }],
      reminderPreference: { time: "14:00" },
    }));
    const clientA = getClientWorkspaceState();
    assert.deepEqual(clientA.trackers.map((tracker) => tracker.id), ["tracker-a"]);
    assert.deepEqual(clientA.items.map((item) => item.id), ["item-a"]);
    assert.deepEqual(clientA.people.map((person) => person.id), ["person-a"]);
    assert.equal(clientA.reminderPreference.time, "14:00");

    setAuthenticatedClientOrganisation(organisations[1], "sample-logistics");
    storage.set(getClientProfileStorageKey("docmon_client_workspace_v1"), JSON.stringify({
      organisationId: "sample-logistics",
      people: [{ id: "person-b", organisationId: "sample-logistics", name: "Client B", active: true }],
      trackers: [{ id: "tracker-b", organisationId: "sample-logistics" }],
      items: [{ id: "item-b", organisationId: "sample-logistics" }],
      reminderPreference: { time: "14:00" },
    }));
    const clientB = getClientWorkspaceState();
    assert.deepEqual(clientB.trackers.map((tracker) => tracker.id), ["tracker-b"]);
    assert.deepEqual(clientB.items.map((item) => item.id), ["item-b"]);
    assert.deepEqual(clientB.people.map((person) => person.id), ["person-b"]);
    assert.equal(clientB.reminderPreference.time, "14:00");
  } finally {
    clearAuthenticatedClientOrganisation();
    if (previousWindow === undefined) delete global.window;
    else global.window = previousWindow;
    if (previousLocalStorage === undefined) delete global.localStorage;
    else global.localStorage = previousLocalStorage;
  }
});

test("two users in one organisation use separate browser workspaces", () => {
  const previousWindow = global.window;
  const previousLocalStorage = global.localStorage;
  const storage = new Map();
  global.window = { dispatchEvent() {} };
  global.localStorage = {
    getItem(key) {
      return storage.get(key) ?? null;
    },
    setItem(key, value) {
      storage.set(key, String(value));
    },
  };
  const firstUser = { ...organisations[0], userId: "first-user" };
  const secondUser = { ...organisations[0], userId: "second-user", userName: "Client B" };
  try {
    setAuthenticatedClientOrganisation(firstUser, "demo-construction");
    const person = addResponsiblePerson({ name: "First user", active: true });
    assert.equal(person.success, true);
    saveWorkTracker({
      name: "First user's tracker",
      periodType: "Weekly tracker",
      startDate: "2026-01-01",
      endDate: "2026-01-07",
      ownerId: person.person.id,
      reminderPreference: "In-app only",
      status: "Active",
    });
    assert.equal(getClientWorkspaceState().trackers.length, 1);
    addAuditEvent({
      recordId: "",
      recordName: "First user task",
      organisation: "Demo Construction",
      user: "Client A",
      action: "Created task",
      previousValue: "",
      newValue: "First user task",
    });
    assert.ok(getAuditEvents().length > 0);

    setAuthenticatedClientOrganisation(secondUser, "demo-construction");
    assert.deepEqual(getClientWorkspaceState().trackers, []);
    assert.deepEqual(getAuditEvents(), []);
  } finally {
    clearAuthenticatedClientOrganisation();
    if (previousWindow === undefined) delete global.window;
    else global.window = previousWindow;
    if (previousLocalStorage === undefined) delete global.localStorage;
    else global.localStorage = previousLocalStorage;
  }
});
