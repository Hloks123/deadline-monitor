import assert from "node:assert/strict";
import {
  canAccessConsultantRoute,
  canAccessWorkspace,
  getWorkspaceAccess,
  getWorkspacePath,
} from "../src/lib/auth/workspace.ts";

const user = { id: "fictional-user-id", email: "fictional@example.invalid" };
const activeProfile = {
  id: user.id,
  display_name: "Fictional User",
  active: true,
};

function createSupabaseMock({
  profile = activeProfile,
  profileError = null,
  memberships = [],
  membershipsError = null,
  visibleOrganisations = memberships.map(({ organisation_id }) => ({ id: organisation_id })),
  platformRoles = [],
  platformRoleError = null,
} = {}) {
  return {
    rpc: async () => ({ data: platformRoles, error: platformRoleError }),
    from(table) {
      const query = {
        select() {
          return query;
        },
        eq() {
          return query;
        },
        in() {
          return query;
        },
        maybeSingle: async () => ({ data: profile, error: profileError }),
        then(resolve, reject) {
          return Promise.resolve({
            data: table === "organisation_memberships" ? memberships : visibleOrganisations,
            error: table === "organisation_memberships" ? membershipsError : null,
          }).then(resolve, reject);
        },
      };
      return query;
    },
  };
}

let failures = 0;

async function check(name, run) {
  try {
    assert.equal(await run(), true);
    console.log(`PASS ${name}`);
  } catch {
    failures += 1;
    console.log(`FAIL ${name}`);
  }
}

async function accessFor(options, identity = user) {
  return getWorkspaceAccess(createSupabaseMock(options), {
    user: identity,
    error: null,
  });
}

await check("main consultant defaults to consultant workspace without memberships", async () => {
  const access = await accessFor({ platformRoles: ["main_consultant"] });
  return (
    access.status === "authorized" &&
    access.defaultWorkspace === "consultant" &&
    getWorkspacePath(access) === "/dashboard" &&
    canAccessWorkspace(access, "consultant") &&
    canAccessConsultantRoute(access, "/clients") &&
    canAccessConsultantRoute(access, "/account") &&
    canAccessConsultantRoute(access, "/clients/new") &&
    !canAccessWorkspace(access, "client")
  );
});

await check("administrator routes to dashboard without tenant access", async () => {
  const access = await accessFor({ platformRoles: ["administrator"] });
  return (
    access.status === "authorized" &&
    access.defaultWorkspace === "consultant" &&
    getWorkspacePath(access) === "/dashboard" &&
    !canAccessWorkspace(access, "consultant") &&
    canAccessConsultantRoute(access, "/dashboard") &&
    canAccessConsultantRoute(access, "/settings") &&
    canAccessConsultantRoute(access, "/account") &&
    !canAccessConsultantRoute(access, "/clients") &&
    !canAccessWorkspace(access, "client")
  );
});

await check("assistant consultant is organisation-scoped to consultant workspace", async () => {
  const access = await accessFor({
    memberships: [
      { organisation_id: "fictional-org-a", role: "assistant_consultant" },
    ],
  });
  return (
    access.status === "authorized" &&
    access.defaultWorkspace === "consultant" &&
    canAccessWorkspace(access, "consultant") &&
    canAccessConsultantRoute(access, "/dashboard") &&
    canAccessConsultantRoute(access, "/clients") &&
    canAccessConsultantRoute(access, "/monitored-records") &&
    canAccessConsultantRoute(access, "/work") &&
    canAccessConsultantRoute(access, "/calendar") &&
    canAccessConsultantRoute(access, "/reminders") &&
    canAccessConsultantRoute(access, "/reports") &&
    canAccessConsultantRoute(access, "/audit-history") &&
    canAccessConsultantRoute(access, "/account") &&
    !canAccessConsultantRoute(access, "/settings") &&
    !canAccessConsultantRoute(access, "/clients/new") &&
    !canAccessConsultantRoute(access, "/monitored-records/new") &&
    !canAccessConsultantRoute(access, "/recurring-tasks") &&
    !canAccessWorkspace(access, "client")
  );
});

for (const role of ["client_administrator", "client_user"]) {
  await check(`${role} is limited to the client workspace`, async () => {
    const access = await accessFor({
        memberships: [{
          organisation_id: "fictional-org-a",
          role,
          is_primary: role === "client_administrator",
          job_title: "",
        }],
    });
    return (
      access.status === "authorized" &&
        access.memberships[0]?.isPrimary === (role === "client_administrator") &&
      access.defaultWorkspace === "client" &&
      getWorkspacePath(access) === "/client/dashboard" &&
      canAccessWorkspace(access, "client") &&
      !canAccessWorkspace(access, "consultant") &&
      !canAccessConsultantRoute(access, "/clients")
    );
  });
}

await check("platform consultant role overrides scoped assistant memberships", async () => {
  const access = await accessFor({
    platformRoles: ["main_consultant"],
    memberships: [
      { organisation_id: "fictional-org-a", role: "assistant_consultant" },
    ],
  });
  return (
    access.status === "authorized" &&
    access.platformRoles.includes("main_consultant") &&
    access.defaultWorkspace === "consultant" &&
    canAccessConsultantRoute(access, "/clients") &&
    !canAccessWorkspace(access, "client")
  );
});

await check("main consultant keeps authority when also assigned administrator role", async () => {
  const access = await accessFor({
    platformRoles: ["administrator", "main_consultant"],
  });
  return (
    access.status === "authorized" &&
    canAccessConsultantRoute(access, "/clients") &&
    canAccessConsultantRoute(access, "/settings")
  );
});

await check("membership to an inaccessible organisation grants no workspace", async () => {
  const access = await accessFor({
    memberships: [
      { organisation_id: "suspended-org", role: "client_user" },
    ],
    visibleOrganisations: [],
  });
  return access.status === "no_membership";
});

await check("Auth user metadata cannot grant a platform or tenant role", async () => {
  const access = await accessFor(
    {},
    {
      ...user,
      app_metadata: { role: "main_consultant", organisation_id: "fictional-org-a" },
      user_metadata: { role: "administrator" },
    },
  );
  return access.status === "no_membership";
});

await check("assistant plus client memberships do not cross workspace boundaries", async () => {
  const access = await accessFor({
    memberships: [
      { organisation_id: "fictional-org-a", role: "assistant_consultant" },
      { organisation_id: "fictional-org-b", role: "client_user" },
    ],
  });
  return (
    access.status === "authorized" &&
    access.defaultWorkspace === "consultant" &&
    canAccessWorkspace(access, "consultant") &&
    !canAccessWorkspace(access, "client")
  );
});

await check("multiple client organisations are denied until context selection exists", async () => {
  const access = await accessFor({
    memberships: [
      { organisation_id: "fictional-org-a", role: "client_user" },
      { organisation_id: "fictional-org-b", role: "client_administrator" },
    ],
  });
  return access.status === "no_membership";
});

await check("unsupported platform role does not grant access", async () => {
  const access = await accessFor({ platformRoles: ["superuser"] });
  return access.status === "no_membership";
});

await check("missing membership denies workspace access", async () => {
  const access = await accessFor();
  return access.status === "no_membership";
});

await check("inactive profile denies workspace access", async () => {
  const access = await accessFor({
    profile: { ...activeProfile, active: false },
    platformRoles: ["main_consultant"],
  });
  return access.status === "profile_inactive";
});

await check("missing profile denies workspace access", async () => {
  const access = await accessFor({ profile: null, platformRoles: ["main_consultant"] });
  return access.status === "profile_missing";
});

await check("platform-role lookup errors fail closed", async () => {
  const access = await accessFor({
    platformRoleError: { message: "fictional database error" },
  });
  return access.status === "unavailable";
});

console.log(`WORKSPACE AUTHORIZATION: ${failures === 0 ? "PASS" : "FAIL"}`);
if (failures > 0) process.exitCode = 1;
