import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";

nextEnv.loadEnvConfig(process.cwd());

const developmentProjectRef = "qxvtiscaafjqjfxanlpo";
const require = createRequire(import.meta.url);
const expectedOrganisations = {
  a: {
    email: "demo.client.a@example.com",
    passwordVariable: "TENANT_TEST_USER_A_PASSWORD",
    ownName: "Demo Construction (Pty) Ltd",
    otherName: "Sample Logistics (Pty) Ltd",
    responsiblePerson: "Tenant Isolation Test Person A",
  },
  b: {
    email: "demo.client.b@example.com",
    passwordVariable: "TENANT_TEST_USER_B_PASSWORD",
    ownName: "Sample Logistics (Pty) Ltd",
    otherName: "Demo Construction (Pty) Ltd",
    responsiblePerson: "Tenant Isolation Test Person B",
  },
};

const results = [];
const requiredTests = [
  "Unauthenticated client sees no organisations",
  "Unauthenticated client sees no responsible people",
  "User A authenticates",
  "User A can select Demo Construction (Pty) Ltd",
  "User A cannot select Sample Logistics (Pty) Ltd",
  "User A can see own-organisation responsible people",
  "User A cannot see other-organisation responsible people",
  "User A sees only their own active client membership with the primary role",
  "User A cannot insert an organisation membership",
  "User A cannot change role to consultant",
  "User A cannot change role to administrator",
  "User B authenticates",
  "User B can select Sample Logistics (Pty) Ltd",
  "User B cannot select Demo Construction (Pty) Ltd",
  "User B can see own-organisation responsible people",
  "User B cannot see other-organisation responsible people",
  "User B sees only their own active client membership with the primary role",
  "User B cannot insert an organisation membership",
  "Cross-organisation responsible-person profile assignment is rejected",
];

function record(name, passed) {
  results.push(passed);
  console.log(`${passed ? "PASS" : "FAIL"} ${name}`);
}

async function check(name, run) {
  try {
    record(name, await run());
  } catch {
    record(name, false);
  }
}

function createSupabaseClient(url, key) {
  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}

async function visibleOrganisations(client) {
  const { data, error } = await client
    .from("organisations")
    .select("id, name")
    .order("name");
  if (error) throw new Error("Organisation query failed");
  return data;
}

async function visibleResponsiblePeople(client) {
  const { data, error } = await client
    .from("responsible_people")
    .select("organisation_id, name")
    .order("name");
  if (error) throw new Error("Responsible people query failed");
  return data;
}

async function visibleMemberships(client) {
  const { data, error } = await client
    .from("organisation_memberships")
    .select("organisation_id, user_id, role, is_primary");
  if (error) throw new Error("Membership query failed");
  return data;
}

function validateCrossOrganisationAssignment(organisationAId, userBId) {
  if (
    !/^[0-9a-f-]{36}$/i.test(organisationAId) ||
    !/^[0-9a-f-]{36}$/i.test(userBId)
  ) {
    return false;
  }

  const sql = `
DO $tenant_isolation_test$
BEGIN
  BEGIN
    INSERT INTO public.responsible_people
      (organisation_id, profile_id, name, role_title, active)
    VALUES
      ('${organisationAId}', '${userBId}', 'Tenant Isolation Negative Assignment', 'Fictional test', true);
  EXCEPTION WHEN check_violation THEN
    RETURN;
  END;

  RAISE EXCEPTION USING
    ERRCODE = 'P0001',
    MESSAGE = 'Responsible-person membership validation did not reject the cross-organisation profile.';
END;
$tenant_isolation_test$;
`;
  const sqlPath = path.join(
    os.tmpdir(),
    `deadline-monitor-tenant-check-${randomUUID()}.sql`,
  );

  try {
    fs.writeFileSync(sqlPath, sql, { encoding: "utf8", flag: "wx" });
    const architecture = process.arch === "arm64" ? "arm64" : "x64";
    const cliPackage = require.resolve(
      `@supabase/cli-windows-${architecture}/package.json`,
    );
    const cliBinary = path.join(
      path.dirname(cliPackage),
      "bin",
      "supabase.exe",
    );
    const result = spawnSync(
      cliBinary,
      [
        "db",
        "query",
        "--remote",
        "--yes",
        "--file",
        sqlPath,
      ],
      {
        encoding: "utf8",
        windowsHide: true,
        timeout: 60000,
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    return result.status === 0;
  } finally {
    fs.rmSync(sqlPath, { force: true });
  }
}

async function testUser(label, config, url, key) {
  const client = createSupabaseClient(url, key);
  let user = null;
  let ownOrganisation = null;

  const { data, error } = await client.auth.signInWithPassword({
    email: config.email,
    password: process.env[config.passwordVariable],
  });
  if (!error) user = data.user;
  record(`${label} authenticates`, Boolean(user && user.email === config.email));

  let organisations = [];
  if (user) {
    try {
      organisations = await visibleOrganisations(client);
    } catch {
      organisations = [];
    }
    ownOrganisation =
      organisations.find((organisation) => organisation.name === config.ownName) ?? null;
  }

  record(
    `${label} can select ${config.ownName}`,
    Boolean(ownOrganisation),
  );
  record(
    `${label} cannot select ${config.otherName}`,
    !organisations.some((organisation) => organisation.name === config.otherName),
  );

  let responsiblePeople = [];
  if (user) {
    try {
      responsiblePeople = await visibleResponsiblePeople(client);
    } catch {
      responsiblePeople = [];
    }
  }
  record(
    `${label} can see own-organisation responsible people`,
    Boolean(
      ownOrganisation &&
        responsiblePeople.some(
          (person) =>
            person.organisation_id === ownOrganisation.id &&
            person.name === config.responsiblePerson,
        ),
    ),
  );
  record(
    `${label} cannot see other-organisation responsible people`,
    Boolean(
      ownOrganisation &&
        responsiblePeople.every(
          (person) => person.organisation_id === ownOrganisation.id,
        ),
    ),
  );

  let memberships = [];
  if (user) {
    try {
      memberships = await visibleMemberships(client);
    } catch {
      memberships = [];
    }
  }
  record(
    `${label} sees only their own active client membership with the primary role`,
    Boolean(
      ownOrganisation &&
        memberships.length === 1 &&
        memberships[0].user_id === user?.id &&
        memberships[0].organisation_id === ownOrganisation.id &&
        memberships[0].role ===
          (memberships[0].is_primary ? "client_administrator" : "client_user"),
    ),
  );

  await check(`${label} cannot insert an organisation membership`, async () => {
    if (!user || !ownOrganisation) return false;
    const { error: insertError } = await client
      .from("organisation_memberships")
      .insert({
        id: randomUUID(),
        organisation_id: ownOrganisation.id,
        user_id: user.id,
        role: "client_user",
        active: true,
      });
    return insertError?.code === "42501";
  });

  if (label === "User A") {
    for (const role of ["consultant", "administrator"]) {
      await check(`${label} cannot change role to ${role}`, async () => {
        if (!user || !ownOrganisation) return false;
        const { error: updateError } = await client
          .from("organisation_memberships")
          .update({ role })
          .eq("organisation_id", ownOrganisation.id)
          .eq("user_id", user.id);
        const currentMemberships = await visibleMemberships(client);
        const originalMembership = memberships.find(
          (membership) =>
            membership.organisation_id === ownOrganisation.id &&
            membership.user_id === user.id,
        );
        return (
          updateError?.code === "42501" &&
          currentMemberships.length === 1 &&
          Boolean(originalMembership) &&
          currentMemberships[0].role === originalMembership.role &&
          currentMemberships[0].is_primary === originalMembership.is_primary
        );
      });
    }
  }

  if (user) await client.auth.signOut();
  return user && ownOrganisation ? { userId: user.id, ownOrganisation } : null;
}

async function main() {
  const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const passwordA = process.env.TENANT_TEST_USER_A_PASSWORD;
  const passwordB = process.env.TENANT_TEST_USER_B_PASSWORD;
  const missingVariables = [
    !projectUrl && "NEXT_PUBLIC_SUPABASE_URL",
    !publishableKey && "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  ].filter(Boolean);

  let configuredForDevelopment = false;
  try {
    const projectRef = new URL(projectUrl).hostname.split(".")[0];
    configuredForDevelopment =
      projectRef === developmentProjectRef &&
      fs.existsSync("supabase/config.toml");
  } catch {
    configuredForDevelopment = false;
  }

  if (!configuredForDevelopment || missingVariables.length > 0) {
    if (missingVariables.length > 0) {
      console.log(
        `BLOCKED: missing local environment variable names: ${missingVariables.join(", ")}`,
      );
    } else {
      console.log("BLOCKED: configured Supabase project is not the development project.");
    }
    for (const testName of requiredTests) {
      record(`${testName} (blocked; not executed)`, false);
    }
    console.log("TENANT ISOLATION: FAIL");
    process.exitCode = 1;
    return;
  }

  const anonymousClient = createSupabaseClient(projectUrl, publishableKey);
  await check("Unauthenticated client sees no organisations", async () => {
    const { data, error } = await anonymousClient
      .from("organisations")
      .select("id");
    return (error?.code === "42501" || error?.status === 401) && data === null
      ? true
      : !error && data.length === 0;
  });
  await check("Unauthenticated client sees no responsible people", async () => {
    const { data, error } = await anonymousClient
      .from("responsible_people")
      .select("id");
    return (error?.code === "42501" || error?.status === 401) && data === null
      ? true
      : !error && data.length === 0;
  });

  const missingPasswords = [
    !passwordA && "TENANT_TEST_USER_A_PASSWORD",
    !passwordB && "TENANT_TEST_USER_B_PASSWORD",
  ].filter(Boolean);
  if (missingPasswords.length > 0) {
    console.log(
      `BLOCKED: missing local environment variable names: ${missingPasswords.join(", ")}`,
    );
    for (const testName of requiredTests.slice(2)) {
      record(`${testName} (blocked; not executed)`, false);
    }
    console.log("TENANT ISOLATION: FAIL");
    process.exitCode = 1;
    return;
  }

  const userA = await testUser(
    "User A",
    expectedOrganisations.a,
    projectUrl,
    publishableKey,
  );
  const userB = await testUser(
    "User B",
    expectedOrganisations.b,
    projectUrl,
    publishableKey,
  );

  await check(
    "Cross-organisation responsible-person profile assignment is rejected",
    async () =>
      Boolean(
        userA &&
          userB &&
          userA.ownOrganisation.name === expectedOrganisations.a.ownName &&
          userB.ownOrganisation.name === expectedOrganisations.b.ownName &&
          validateCrossOrganisationAssignment(
            userA.ownOrganisation.id,
            userB.userId,
          ),
      ),
  );

  const passed = results.every(Boolean);
  console.log(`TENANT ISOLATION: ${passed ? "PASS" : "FAIL"}`);
  if (!passed) process.exitCode = 1;
}

await main();
