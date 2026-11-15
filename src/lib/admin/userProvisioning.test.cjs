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
  buildInvitationMemberships,
  planInvitationMemberships,
  validateInvitationOrganisationSelection,
} = require("./userProvisioning.ts");
const { parseOrganisationContacts } = require("./organisationContacts.ts");

const primaryContact = {
  name: "Primary Contact",
  email: "contact@example.invalid",
  phone: "",
  roleTitle: "Owner",
  authorised: true,
  primary: true,
};

test("assistant consultant invitation requires at least one organisation", () => {
  assert.equal(
    validateInvitationOrganisationSelection("assistant_consultant", []),
    "Select at least one organisation for this Assistant Consultant.",
  );
});

test("assistant invitation creates one active scoped row per unique selection", () => {
  const ids = ["org-a", "org-b", "org-a"];
  assert.equal(
    validateInvitationOrganisationSelection("assistant_consultant", ids),
    undefined,
  );
  assert.deepEqual(buildInvitationMemberships("user-1", "assistant_consultant", ids), [
    { user_id: "user-1", organisation_id: "org-a", role: "assistant_consultant", active: true },
    { user_id: "user-1", organisation_id: "org-b", role: "assistant_consultant", active: true },
  ]);
});

test("invitation retry plans only missing memberships", () => {
  const existing = [
    { organisationId: "org-a", role: "assistant_consultant", active: true },
  ];
  assert.deepEqual(
    planInvitationMemberships("user-1", "assistant_consultant", ["org-a", "org-b"], existing),
    {
      kind: "ready",
      rows: [{
        user_id: "user-1",
        organisation_id: "org-b",
        role: "assistant_consultant",
        active: true,
      }],
    },
  );
  assert.deepEqual(
    planInvitationMemberships("user-1", "assistant_consultant", ["org-a"], existing),
    { kind: "ready", rows: [] },
  );
});

test("invitation retry does not reactivate or overwrite conflicting access", () => {
  assert.equal(
    planInvitationMemberships("user-1", "assistant_consultant", ["org-a"], [
      { organisationId: "org-a", role: "assistant_consultant", active: false },
    ]).kind,
    "conflict",
  );
  assert.equal(
    planInvitationMemberships("user-1", "assistant_consultant", ["org-a"], [
      { organisationId: "org-a", role: "client_user", active: true },
    ]).kind,
    "conflict",
  );
});

test("client roles require exactly one organisation", () => {
  for (const role of ["client_administrator", "client_user"]) {
    assert.ok(validateInvitationOrganisationSelection(role, []));
    assert.equal(validateInvitationOrganisationSelection(role, ["org-a"]), undefined);
    assert.ok(validateInvitationOrganisationSelection(role, ["org-a", "org-b"]));
  }
});

test("administrator platform role does not receive organisation memberships", () => {
  assert.equal(validateInvitationOrganisationSelection("administrator", []), undefined);
  assert.ok(validateInvitationOrganisationSelection("administrator", ["org-a"]));
});

test("organisation contacts require an authorised primary with an email", () => {
  assert.deepEqual(parseOrganisationContacts([primaryContact]), [
    {
      name: "Primary Contact",
      email: "contact@example.invalid",
      phone: "",
      role_title: "Owner",
      authorised: true,
      primary_contact: true,
    },
  ]);
  assert.equal(parseOrganisationContacts([]), null);
  assert.equal(
    parseOrganisationContacts([{ ...primaryContact, email: "" }]),
    null,
  );
});

test("organisation contacts require exactly one authorised primary", () => {
  assert.equal(
    parseOrganisationContacts([
      primaryContact,
      {
        ...primaryContact,
        name: "Second Contact",
        email: "second@example.invalid",
        primary: true,
      },
    ]),
    null,
  );
  assert.equal(
    parseOrganisationContacts([
      { ...primaryContact, primary: false },
      {
        ...primaryContact,
        name: "Second Contact",
        email: "second@example.invalid",
        primary: false,
      },
    ]),
    null,
  );
});

test("organisation contacts are normalized and validate optional contact data", () => {
  const parsed = parseOrganisationContacts([{
    ...primaryContact,
    name: "  Primary Contact  ",
    email: " CONTACT@EXAMPLE.INVALID ",
    phone: " 555 0100 ",
    roleTitle: " Owner ",
  }]);
  assert.equal(parsed?.[0].name, "Primary Contact");
  assert.equal(parsed?.[0].email, "contact@example.invalid");
  assert.equal(parsed?.[0].phone, "555 0100");
  assert.equal(parsed?.[0].role_title, "Owner");
  assert.equal(
    parseOrganisationContacts([
      { ...primaryContact, authorised: false, email: "not-an-email", primary: false },
    ]),
    null,
  );
});
