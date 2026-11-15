import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { execFileSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const appUrl = process.env.CLIENT_TASK_PILOT_APP_URL || "http://localhost:3101";

function assertLoopback(rawUrl, label) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error(`${label} must be a loopback URL.`);
  }
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  if (
    url.protocol !== "http:" ||
    !["localhost", "127.0.0.1", "::1"].includes(hostname)
  ) {
    throw new Error(`${label} must use HTTP on localhost, 127.0.0.1, or ::1.`);
  }
  return url;
}

if (!supabaseUrl || !publishableKey || !serviceRoleKey) {
  throw new Error("Set the local Supabase URL, publishable key, and service-role key in the environment.");
}

assertLoopback(supabaseUrl, "NEXT_PUBLIC_SUPABASE_URL");
const app = assertLoopback(appUrl, "CLIENT_TASK_PILOT_APP_URL");

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const suffix = randomUUID().slice(0, 8);
const fixtureOrganisationIds = [];
const fixtureUserIds = [];
const fixtureUsers = {};

function verify(condition, message) {
  if (!condition) throw new Error(`FAIL: ${message}`);
}

function expectStatus(result, status, message) {
  const detail = typeof result.result?.error === "string"
    ? `: ${result.result.error}`
    : "";
  verify(
    result.response.status === status,
    `${message} (received HTTP ${result.response.status}; expected ${status})${detail}`,
  );
}

async function requestAs(user, route, { method = "GET", body } = {}) {
  const response = await fetch(new URL(route, app), {
    method,
    headers: {
      Cookie: user.cookie,
      ...(body ? {
        "Content-Type": "application/json",
        Origin: app.origin,
      } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error("The local application returned a non-JSON API response.");
  }
  return { response, result };
}

async function createOrganisation(name) {
  const { data, error } = await admin
    .from("organisations")
    .insert({ name, status: "active", service_package: "starter" })
    .select("id")
    .single();
  if (error || !data) throw new Error("Could not create a fictional local pilot organisation.");
  fixtureOrganisationIds.push(data.id);
  return data.id;
}

async function createUser(key, name) {
  const email = `pilot-${suffix}-${key}@example.test`;
  const password = randomBytes(32).toString("base64url");
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: name },
  });
  if (error || !data.user) throw new Error("Could not create a fictional local pilot account.");
  fixtureUserIds.push(data.user.id);
  fixtureUsers[key] = { id: data.user.id, email, password, name };
  return fixtureUsers[key];
}

async function addMembership(organisationId, userId, jobTitle) {
  const { error } = await admin.from("organisation_memberships").insert({
    organisation_id: organisationId,
    user_id: userId,
    role: "client_user",
    active: true,
    job_title: jobTitle,
  });
  if (error) throw new Error("Could not add a fictional local pilot membership.");
}

async function signIn(user) {
  const cookieJar = new Map();
  const client = createServerClient(supabaseUrl, publishableKey, {
    cookies: {
      getAll: () => [...cookieJar.entries()].map(([name, value]) => ({ name, value })),
      setAll: (cookiesToSet) => {
        for (const { name, value } of cookiesToSet) {
          if (value) cookieJar.set(name, value);
          else cookieJar.delete(name);
        }
      },
    },
  });
  const { error } = await client.auth.signInWithPassword({
    email: user.email,
    password: user.password,
  });
  if (error) throw new Error("Could not sign into a fictional local pilot account.");
  user.cookie = [...cookieJar.entries()]
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
  if (!user.cookie) throw new Error("The local pilot sign-in did not create a session cookie.");
}

function nextFridayDate() {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  const daysUntilFriday = (5 - date.getUTCDay() + 7) % 7 || 7;
  date.setUTCDate(date.getUTCDate() + daysUntilFriday);
  return date.toISOString().slice(0, 10);
}

async function cleanup() {
  let cleanupError = false;
  if (fixtureOrganisationIds.length > 0) {
    const ids = fixtureOrganisationIds
      .filter((id) => /^[0-9a-f-]{36}$/i.test(id))
      .map((id) => `'${id}'`)
      .join(", ");
    const sql = `DELETE FROM public.organisations WHERE id IN (${ids})`;
    try {
      if (process.platform === "win32") {
        const command = `& npx supabase db query --output-format json "${sql}"; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }`;
        execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", command], {
          cwd: repositoryRoot,
          stdio: "ignore",
        });
      } else {
        execFileSync("npx", ["supabase", "db", "query", "--output-format", "json", sql], {
          cwd: repositoryRoot,
          stdio: "ignore",
        });
      }
    } catch {
      cleanupError = true;
    }
  }
  for (const userId of fixtureUserIds) {
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) cleanupError = true;
  }
  return cleanupError;
}

let testError;
try {
  const organisationA = await createOrganisation(`Compimento Pilot ${suffix}`);
  const managerA = await createUser("admin-a", "Pilot Client Administrator");
  await addMembership(organisationA, managerA.id, "Client administrator");

  const employee1 = await createUser("employee-1", "Pilot Employee One");
  await addMembership(organisationA, employee1.id, "Employee One");
  const employee2 = await createUser("employee-2", "Pilot Employee Two");
  await addMembership(organisationA, employee2.id, "Employee Two");
  const employee3 = await createUser("employee-3", "Pilot Employee Three");
  await addMembership(organisationA, employee3.id, "Employee Three");

  const organisationB = await createOrganisation(`Separate Pilot ${suffix}`);
  const managerB = await createUser("admin-b", "Separate Client Administrator");
  await addMembership(organisationB, managerB.id, "Client administrator");
  const employeeB = await createUser("employee-b", "Separate Company Employee");
  await addMembership(organisationB, employeeB.id, "Employee");

  for (const user of [managerA, employee1, employee2, employee3, managerB, employeeB]) {
    await signIn(user);
  }

  const workspace = await requestAs(managerA, "/api/client/workspace");
  expectStatus(workspace, 200, "client administrator can load the client workspace");
  verify(workspace.result.status === "authorized", "workspace is authorized");
  verify(workspace.result.team.length === 4, "workspace includes only the four active Company A users");
  verify(
    workspace.result.team.filter(({ role }) => role === "client_administrator").length === 1 &&
      workspace.result.team.filter(({ role }) => role === "client_user").length === 3,
    "workspace includes canonical client roles",
  );
  verify(
    workspace.result.team.every(({ id }) => id !== managerB.id && id !== employeeB.id),
    "workspace excludes Company B users",
  );

  const team = await requestAs(managerA, "/api/client/team");
  expectStatus(team, 200, "client administrator can load team management");
  verify(team.result.members.length === 4, "team management returns four Company A users");
  verify(
    team.result.members.find(({ id }) => id === managerA.id)?.role === "client_administrator" &&
      team.result.members.filter(({ role }) => role === "client_user").length === 3,
    "team roles distinguish the administrator and employees",
  );
  verify(
    team.result.members.every(({ id }) => id !== managerB.id && id !== employeeB.id),
    "team management excludes Company B users",
  );

  const profileUpdate = await requestAs(managerA, "/api/client/team", {
    method: "PATCH",
    body: {
      userId: employee3.id,
      name: employee3.name,
      jobTitle: "Pilot employee",
      active: true,
    },
  });
  expectStatus(profileUpdate, 200, "team profile update returns a successful response");

  const employeeTeamAccess = await requestAs(employee1, "/api/client/team");
  expectStatus(employeeTeamAccess, 403, "ordinary client users cannot manage the team");

  const { error: inactiveMembershipError } = await admin
    .from("organisation_memberships")
    .update({ active: false })
    .eq("organisation_id", organisationA)
    .eq("user_id", employee3.id);
  if (inactiveMembershipError) throw new Error("Could not prepare the local inactive-membership check.");
  const inactiveMembershipAccess = await requestAs(employee3, "/api/client/tasks");
  expectStatus(inactiveMembershipAccess, 403, "inactive organisation membership is denied");
  const inactiveMemberAssignment = await requestAs(managerA, "/api/client/tasks", {
    method: "POST",
    body: {
      assignedTo: employee3.id,
      title: "Inactive membership assignment attempt",
      dueDate: nextFridayDate(),
      priority: "medium",
    },
  });
  expectStatus(inactiveMemberAssignment, 400, "inactive organisation members cannot receive tasks");
  const { error: activeMembershipError } = await admin
    .from("organisation_memberships")
    .update({ active: true })
    .eq("organisation_id", organisationA)
    .eq("user_id", employee3.id);
  if (activeMembershipError) throw new Error("Could not restore the local pilot membership.");

  const { error: inactiveProfileError } = await admin
    .from("profiles")
    .update({ active: false })
    .eq("id", employee3.id);
  if (inactiveProfileError) throw new Error("Could not prepare the local inactive-profile check.");
  const inactiveProfileAccess = await requestAs(employee3, "/api/client/tasks");
  expectStatus(inactiveProfileAccess, 403, "inactive profiles are denied");
  const inactiveProfileAssignment = await requestAs(managerA, "/api/client/tasks", {
    method: "POST",
    body: {
      assignedTo: employee3.id,
      title: "Inactive profile assignment attempt",
      dueDate: nextFridayDate(),
      priority: "medium",
    },
  });
  expectStatus(inactiveProfileAssignment, 400, "inactive profiles cannot receive tasks");
  const { error: activeProfileError } = await admin
    .from("profiles")
    .update({ active: true })
    .eq("id", employee3.id);
  if (activeProfileError) throw new Error("Could not restore the local pilot profile.");

  const missingDate = await requestAs(managerA, "/api/client/tasks", {
    method: "POST",
    body: {
      assignedTo: employee1.id,
      title: "Task missing a due date",
      priority: "high",
    },
  });
  expectStatus(missingDate, 400, "task creation rejects a missing due date");

  const dueDate = nextFridayDate();
  verify(new Date(`${dueDate}T00:00:00Z`).getUTCDay() === 5, "selected due date is Friday");
  const created = await requestAs(managerA, "/api/client/tasks", {
    method: "POST",
    body: {
      assignedTo: employee1.id,
      title: `Friday pilot task ${suffix}`,
      description: "Fictional local-only task.",
      dueDate,
      priority: "high",
    },
  });
  expectStatus(created, 201, "client administrator creates the task");
  verify(created.result.tasks.length === 1, "one assignment is created");
  const createdTask = created.result.tasks[0];
  verify(
    createdTask.organisation_id === organisationA &&
      createdTask.created_by === managerA.id &&
      createdTask.assigned_to === employee1.id &&
      createdTask.due_date === dueDate &&
      createdTask.status === "pending_acceptance",
    "task is server-scoped and preserves the date-only value",
  );

  const employee1Tasks = await requestAs(employee1, "/api/client/tasks");
  expectStatus(employee1Tasks, 200, "assigned employee can load tasks");
  verify(
    employee1Tasks.result.tasks.length === 1 &&
      employee1Tasks.result.tasks[0].id === createdTask.id &&
      employee1Tasks.result.tasks[0].due_date === dueDate,
    "employee sees the persisted Friday assignment after a fresh server request",
  );
  for (const user of [employee2, employee3]) {
    const coworkerTasks = await requestAs(user, "/api/client/tasks");
    expectStatus(coworkerTasks, 200, "same-organisation coworker can load only their visible tasks");
    verify(coworkerTasks.result.tasks.length === 0, "coworker cannot see another employee's task");
  }

  const forbiddenAssignee = await requestAs(managerA, "/api/client/tasks", {
    method: "POST",
    body: {
      assignedTo: employeeB.id,
      title: "Cross-company assignment attempt",
      dueDate,
      priority: "medium",
    },
  });
  expectStatus(forbiddenAssignee, 400, "Company A cannot assign a task to a Company B user");

  const foreignOrganisationRead = await requestAs(managerA, `/api/client/tasks?organisation_id=${organisationB}`);
  expectStatus(foreignOrganisationRead, 403, "Company A cannot request Company B task data");
  const foreignOrganisationCreate = await requestAs(managerA, "/api/client/tasks", {
    method: "POST",
    body: {
      organisation_id: organisationB,
      assignedTo: employee1.id,
      title: "Cross-company creation attempt",
      dueDate,
      priority: "medium",
    },
  });
  expectStatus(foreignOrganisationCreate, 403, "Company A cannot create a task for Company B");
  const foreignOrganisationUpdate = await requestAs(managerA, "/api/client/tasks", {
    method: "PATCH",
    body: {
      taskId: createdTask.id,
      expectedUpdatedAt: createdTask.updated_at,
      organisation_id: organisationB,
      action: "reassign",
      assignedTo: employee2.id,
    },
  });
  expectStatus(foreignOrganisationUpdate, 403, "Company A cannot update a task for Company B");

  const companyBTasks = await requestAs(managerB, "/api/client/tasks");
  expectStatus(companyBTasks, 200, "Company B administrator can load its own task list");
  verify(companyBTasks.result.tasks.length === 0, "Company B cannot read Company A's task");
  const crossTenantUpdate = await requestAs(managerB, "/api/client/tasks", {
    method: "PATCH",
    body: {
      taskId: createdTask.id,
      expectedUpdatedAt: createdTask.updated_at,
      action: "accept",
    },
  });
  expectStatus(crossTenantUpdate, 404, "Company B cannot update Company A's task");

  const state1 = employee1Tasks.result.tasks[0];
  const state2 = employee1Tasks.result.tasks[0];
  const accepted = await requestAs(employee1, "/api/client/tasks", {
    method: "PATCH",
    body: {
      taskId: state1.id,
      expectedUpdatedAt: state1.updated_at,
      action: "accept",
    },
  });
  expectStatus(accepted, 200, "assigned employee can accept a pending task");
  verify(accepted.result.task.status === "accepted", "acceptance is persisted");
  const staleUpdate = await requestAs(employee1, "/api/client/tasks", {
    method: "PATCH",
    body: {
      taskId: state2.id,
      expectedUpdatedAt: state2.updated_at,
      action: "accept",
    },
  });
  expectStatus(staleUpdate, 409, "a stale task state receives an HTTP 409 conflict");

  const acceptedTasks = await requestAs(employee1, "/api/client/tasks");
  verify(
    acceptedTasks.result.tasks[0].due_date === dueDate &&
      acceptedTasks.result.tasks[0].status === "accepted",
    "accepted task and Friday date persist after a fresh server request",
  );
  const managerTasksAfterAcceptance = await requestAs(managerA, "/api/client/tasks");
  verify(
    managerTasksAfterAcceptance.result.tasks.some(({ id, status }) =>
      id === createdTask.id && status === "accepted",
    ),
    "task creator can see the accepted status",
  );

  const reassignSource = managerTasksAfterAcceptance.result.tasks.find(({ id }) => id === createdTask.id);
  const reassigned = await requestAs(managerA, "/api/client/tasks", {
    method: "PATCH",
    body: {
      taskId: createdTask.id,
      expectedUpdatedAt: reassignSource.updated_at,
      action: "reassign",
      assignedTo: employee2.id,
    },
  });
  expectStatus(reassigned, 200, "task creator can reassign an active employee task");
  verify(
    reassigned.result.task.assigned_to === employee2.id &&
      reassigned.result.task.status === "pending_acceptance",
    "reassignment resets the task to pending acceptance",
  );
  const employee1AfterReassignment = await requestAs(employee1, "/api/client/tasks");
  const employee2AfterReassignment = await requestAs(employee2, "/api/client/tasks");
  verify(employee1AfterReassignment.result.tasks.length === 0, "previous assignee no longer sees a reassigned task");
  verify(
    employee2AfterReassignment.result.tasks.some(({ id, due_date }) =>
      id === createdTask.id && due_date === dueDate,
    ),
    "new assignee sees the persisted task with the same date",
  );

  const rejected = await requestAs(employee2, "/api/client/tasks", {
    method: "PATCH",
    body: {
      taskId: createdTask.id,
      expectedUpdatedAt: employee2AfterReassignment.result.tasks[0].updated_at,
      action: "reject",
      note: "The due date conflicts with another approved deadline.",
    },
  });
  expectStatus(rejected, 200, "assigned employee can reject with a reason");
  verify(
    rejected.result.task.status === "rejected" &&
      rejected.result.task.response_note === "The due date conflicts with another approved deadline.",
    "rejection status and reason are persisted",
  );

  const completionAttempt = await requestAs(managerA, "/api/client/tasks", {
    method: "PATCH",
    body: {
      taskId: createdTask.id,
      expectedUpdatedAt: rejected.result.task.updated_at,
      action: "complete",
    },
  });
  expectStatus(completionAttempt, 400, "completion is not exposed as a supported task action");

  const finalManagerTasks = await requestAs(managerA, "/api/client/tasks");
  verify(
    finalManagerTasks.result.tasks.some(({ id, status }) =>
      id === createdTask.id && status === "rejected",
    ),
    "task creator can see the final persisted rejection",
  );

  console.log("PASS: local-only four-user client task pilot with a separate Company B isolation account.");
  console.log("PASS: role-scoped team data, required Friday date, task visibility, acceptance, reassignment, rejection, and stale-update conflict.");
  console.log("PASS: cross-organisation read, create, assign, and update attempts were rejected.");
  console.log("INFO: completion is not supported by the current task action API.");
} catch (error) {
  testError = error instanceof Error ? error : new Error("Local client task pilot failed.");
} finally {
  const cleanupFailed = await cleanup();
  if (cleanupFailed) {
    console.error("FAIL: local pilot fixture cleanup did not complete; remove only the fictional test organisations and accounts locally.");
    process.exitCode = 1;
  }
}

if (testError) {
  console.error(testError.message);
  process.exitCode = 1;
}
