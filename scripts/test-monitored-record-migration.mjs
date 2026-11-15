import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  normalizeLegacyTemporalValue,
  normalizeLegacyMigrationPayload,
  parseMonitoredRecordWrite,
} from "../src/lib/monitoredRecords/validation.ts";
import { planLegacyContactMappings } from "../src/lib/monitoredRecords/contactReconciliation.ts";

const require = createRequire(import.meta.url);
const fixtureIds = new Set(["coida-letter", "vehicle-licence"]);
const baseRecord = {
  id: "legacy-record-a",
  name: "COIDA certificate",
  organisationId: "legacy-client-a",
  organisation: "Legacy Client A",
  category: "COIDA",
  category2: "Certificate",
  issueDate: "2025-01-01",
  expiryDate: "2030-01-01",
  status: "Current",
  risk: "Low",
  escalationLevel: "Normal",
  contactId: "legacy-contact-a",
  contact: "Primary contact",
  contactEmail: "contact@example.invalid",
  followUp: "",
  referenceNumber: "REF-1",
  nextAction: "",
  notes: "",
  reminderFrequency: "weekly",
  reminderLeadDays: 7,
  clientCreated: false,
  lastConfirmed: "",
  confirmedBy: "",
  confirmationMethod: "",
  dataSource: "",
  reminderDays: [30, 7],
};

function check(name, run) {
  run();
  console.log(`PASS ${name}`);
}

check("record input accepts valid dates and controlled values", () => {
  const parsed = parseMonitoredRecordWrite({
    name: "Valid record",
    category: "COIDA",
    category2: "Certificate",
    expiryDate: "2030-01-01",
    status: "Current",
    risk: "Low",
    escalationLevel: "Normal",
  });
  assert.equal(parsed.ok, true);
});

check("record input rejects impossible dates and unknown fields", () => {
  assert.equal(
    parseMonitoredRecordWrite({
      name: "Bad date",
      category: "COIDA",
      category2: "Certificate",
      expiryDate: "2030-02-30",
      status: "Current",
      risk: "Low",
      escalationLevel: "Normal",
    }).ok,
    false,
  );
  assert.equal(
    parseMonitoredRecordWrite({
      name: "Cross-tenant",
      category: "COIDA",
      category2: "Certificate",
      expiryDate: "2030-01-01",
      status: "Current",
      risk: "Low",
      escalationLevel: "Normal",
      organisationId: "another-organisation",
    }).ok,
    false,
  );
});

check("migration preview excludes demo fixtures and rejects cross-client rows", () => {
  const result = normalizeLegacyMigrationPayload(
    {
      legacyClientId: "legacy-client-a",
      includeSuspectedFixtures: false,
      records: [
        baseRecord,
        { ...baseRecord, id: "vehicle-licence" },
        { ...baseRecord, id: "foreign-record", organisationId: "legacy-client-b" },
      ],
      communications: [],
      auditEvents: [],
    },
    fixtureIds,
  );
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.value.records.map(({ legacy_id }) => legacy_id), [
    "legacy-record-a",
  ]);
  assert.equal(result.value.skippedCounts.records, 2);
  assert.ok(result.value.warnings.some((warning) => warning.includes("demo record")));
});

check("preview rejects duplicate IDs and orphaned record history", () => {
  const result = normalizeLegacyMigrationPayload(
    {
      legacyClientId: "legacy-client-a",
      includeSuspectedFixtures: true,
      records: [baseRecord, baseRecord],
      communications: [
        {
          id: "communication-a",
          recordId: "missing-record",
          type: "Reminder",
          recipient: "",
          subject: "",
          message: "",
          outcome: "",
          deliveryStatus: "Draft",
          nextFollowUp: "",
          date: "03/04/2030, 10:00:00",
          uniqueKey: "legacy-key",
        },
      ],
      auditEvents: [],
    },
    fixtureIds,
  );
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.value.records.length, 1);
  assert.equal(result.value.skippedCounts.records, 1);
  assert.equal(result.value.skippedCounts.communications, 1);
  assert.ok(result.value.errors.some((issue) => issue.message.includes("Duplicate")));
  assert.ok(result.value.errors.some((issue) => issue.message.includes("outside")));
});

check("audit migration redacts unrestricted values and preserves ambiguous dates", () => {
  const result = normalizeLegacyMigrationPayload(
    {
      legacyClientId: "legacy-client-a",
      includeSuspectedFixtures: true,
      records: [baseRecord],
      communications: [],
      auditEvents: [
        {
          id: "audit-a",
          recordId: baseRecord.id,
          recordName: baseRecord.name,
          organisation: baseRecord.organisation,
          user: "Legacy user",
          action: "Record updated",
          field: "notes",
          previousValue: "personal details",
          newValue: "new personal details",
          date: "03/04/2030, 10:00:00",
          context: "unrestricted free text",
        },
      ],
    },
    fixtureIds,
  );
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.value.auditEvents[0].previous_value, null);
  assert.equal(result.value.auditEvents[0].new_value, null);
  assert.equal(result.value.auditEvents[0].values_redacted, true);
  assert.equal(result.value.auditEvents[0].occurred_at, null);
  assert.ok(result.value.warnings.some((warning) => warning.includes("context was omitted")));
});

check("migration checksum is stable when source row order changes", () => {
  const secondRecord = { ...baseRecord, id: "legacy-record-b" };
  const first = normalizeLegacyMigrationPayload(
    {
      legacyClientId: "legacy-client-a",
      includeSuspectedFixtures: true,
      records: [baseRecord, secondRecord],
      communications: [],
      auditEvents: [],
    },
    fixtureIds,
  );
  const second = normalizeLegacyMigrationPayload(
    {
      legacyClientId: "legacy-client-a",
      includeSuspectedFixtures: true,
      records: [secondRecord, baseRecord],
      communications: [],
      auditEvents: [],
    },
    fixtureIds,
  );
  assert.equal(first.ok && second.ok, true);
  if (first.ok && second.ok) {
    assert.equal(first.value.sourceChecksum, second.value.sourceChecksum);
  }
});

check("date normalization preserves ISO dates and rejects ambiguous locale dates", () => {
  assert.deepEqual(normalizeLegacyTemporalValue("2026-11-14", "date"), {
    status: "valid",
    sourceValue: "2026-11-14",
    normalizedValue: "2026-11-14",
    interpretation: "ISO date-only value; no timezone conversion",
  });
  assert.equal(
    normalizeLegacyTemporalValue("2026-11-14T08:30:00Z", "timestamp").normalizedValue,
    "2026-11-14T08:30:00.000Z",
  );
  assert.equal(normalizeLegacyTemporalValue("2026-02-30", "date").status, "invalid");
  assert.equal(normalizeLegacyTemporalValue("01/02/2026", "date").status, "ambiguous");
  assert.equal(normalizeLegacyTemporalValue("", "date").normalizedValue, "");
  assert.equal(normalizeLegacyTemporalValue(null, "timestamp").status, "valid");
});

check("contact mapping is organisation-scoped by input and refuses ambiguous matches", () => {
  const legacy = [{
    legacy_id: "legacy-contact",
    checksum: "a".repeat(64),
    name: "Primary Contact",
    email: "person@example.invalid",
    phone: "+27 11 123 4567",
    role_title: "Manager",
    authorised: true,
    primary_contact: false,
  }];
  const matches = planLegacyContactMappings(
    legacy,
    [
      { id: "contact-a", name: "Other", email: "person@example.invalid", phone: null },
    ],
    [],
  );
  assert.equal(matches[0].targetId, "contact-a");
  assert.equal(matches[0].method, "email");
  const ambiguous = planLegacyContactMappings(
    legacy,
    [
      { id: "contact-a", name: "Other", email: "person@example.invalid", phone: null },
      { id: "contact-b", name: "Also Other", email: "PERSON@example.invalid", phone: null },
    ],
    [],
  );
  assert.equal(ambiguous[0].targetId, null);
  assert.equal(ambiguous[0].method, "ambiguous");
  assert.equal(
    planLegacyContactMappings(legacy, [], [])[0].method,
    "create",
  );
});

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDirectory, "..");
const architecture = process.arch === "arm64" ? "arm64" : "x64";
const cliPackage = require.resolve(`@supabase/cli-windows-${architecture}/package.json`);
const cliBinary = path.join(path.dirname(cliPackage), "bin", "supabase.exe");
const testFiles = [
  "record_migration_cleanup.sql",
  "record_migration_setup.sql",
  "record_contact_audit.sql",
  "record_migration_main.sql",
  "record_migration_assistant.sql",
  "record_migration_client.sql",
];
let databaseFailed = false;
try {
  for (const file of testFiles) {
    const sqlFile = path.join(root, "supabase", "tests", file);
    const result = spawnSync(
      cliBinary,
      ["db", "query", "--file", sqlFile],
      {
        cwd: root,
        encoding: "utf8",
        windowsHide: true,
        timeout: 60000,
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    if (result.status !== 0) {
      const output = [
        result.error?.message,
        result.stdout,
        result.stderr,
      ].filter(Boolean).join("\n");
      throw new Error(`${file} failed:\n${output || "No diagnostic output was returned."}`);
    }
    if (file === "record_contact_audit.sql") {
      console.log("PASS local responsible-contact audit and tenant checks");
    }
    if (file === "record_migration_client.sql") {
      console.log("PASS local database RLS, idempotency and reconciliation tests");
    }
  }
} catch (error) {
  databaseFailed = true;
  console.error(error instanceof Error ? error.message : "Local SQL tests failed.");
} finally {
  const cleanup = spawnSync(
    cliBinary,
    [
      "db",
      "query",
      "--file",
      path.join(root, "supabase", "tests", "record_migration_cleanup.sql"),
    ],
    {
      cwd: root,
      encoding: "utf8",
      windowsHide: true,
      timeout: 60000,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  if (cleanup.status !== 0) {
    databaseFailed = true;
    console.error(
      cleanup.stderr ||
        cleanup.stdout ||
        cleanup.error?.message ||
        "Local database test cleanup failed.",
    );
  }
}
if (databaseFailed) {
  process.exitCode = 1;
}
