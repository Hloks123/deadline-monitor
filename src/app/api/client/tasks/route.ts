import { NextResponse } from "next/server";
import {
  adminServiceUnavailable,
  invalidRequest,
  isRecord,
  readJson,
  requireSameOrigin,
  safeBackendFailure,
} from "@/lib/admin/authorization";
import { getWorkspaceAccess } from "@/lib/auth/workspace";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isCalendarDate(value: string) {
  if (!datePattern.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value;
}

function hasForeignOrganisationId(
  body: Record<string, unknown>,
  organisationId: string,
) {
  return ["organisationId", "organisation_id", "organizationId", "organization_id"]
    .some((key) => key in body && body[key] !== organisationId);
}

async function getClientMembership() {
  const supabase = await createClient();
  const access = await getWorkspaceAccess(supabase);
  if (access.status !== "authorized") {
    return {
      response: NextResponse.json(
        { error: "Sign in with an active client account to continue." },
        { status: access.status === "unauthenticated" ? 401 : 403 },
      ),
    };
  }
  if (
    access.platformRoles.length > 0 ||
    access.memberships.some(({ role }) => role === "assistant_consultant")
  ) {
    return { response: NextResponse.json({ error: "You are not authorised to access client tasks." }, { status: 403 }) };
  }
  const memberships = access.memberships.filter(({ role }) =>
    role === "client_administrator" || role === "client_user",
  );
  if (memberships.length !== 1) {
    return { response: NextResponse.json({ error: "Your client organisation assignment is unavailable." }, { status: 403 }) };
  }
  return { access, membership: memberships[0] };
}

export async function GET(request: Request) {
  const context = await getClientMembership();
  if ("response" in context) return context.response;
  const searchParams = new URL(request.url).searchParams;
  const requestedOrganisationIds = [
    ...searchParams.getAll("organisationId"),
    ...searchParams.getAll("organisation_id"),
    ...searchParams.getAll("organizationId"),
    ...searchParams.getAll("organization_id"),
  ];
  if (requestedOrganisationIds.some((id) => id !== context.membership.organisationId)) {
    return NextResponse.json({ error: "You are not authorised to access this company's tasks." }, { status: 403 });
  }
  const admin = createAdminClient();
  if (!admin) return adminServiceUnavailable();

  const { data, error } = await admin
    .from("organisation_tasks")
    .select("id, organisation_id, created_by, assigned_to, title, description, due_date, priority, status, response_note, responded_at, created_at, updated_at")
    .eq("organisation_id", context.membership.organisationId)
    .or(`created_by.eq.${context.access.userId},assigned_to.eq.${context.access.userId}`)
    .order("created_at", { ascending: false });
  if (error) return safeBackendFailure();

  return NextResponse.json({ tasks: data ?? [], userId: context.access.userId }, {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: Request) {
  const originError = requireSameOrigin(request);
  if (originError) return originError;

  const body = await readJson(request);
  if (!isRecord(body)) {
    return invalidRequest("Enter a valid task title, assignee, due date, and priority.");
  }
  const rawAssignees: unknown[] = Array.isArray(body.assignedTo)
    ? body.assignedTo
    : [body.assignedTo];
  const validatedAssignees = rawAssignees.filter(
    (id): id is string => typeof id === "string" && uuidPattern.test(id),
  );
  const title = body.title;
  const dueDate = body.dueDate;
  if (
    rawAssignees.length === 0 ||
    validatedAssignees.length !== rawAssignees.length ||
    typeof title !== "string" ||
    title.trim().length < 1 ||
    title.trim().length > 200 ||
    (body.description !== undefined &&
      (typeof body.description !== "string" || body.description.length > 2000)) ||
    typeof dueDate !== "string" ||
    !isCalendarDate(dueDate) ||
    (body.priority !== undefined &&
      body.priority !== "low" &&
      body.priority !== "medium" &&
      body.priority !== "high")
  ) {
    return invalidRequest("Enter a valid task title, assignee, due date, and priority.");
  }

  const context = await getClientMembership();
  if ("response" in context) return context.response;
  if (hasForeignOrganisationId(body, context.membership.organisationId)) {
    return NextResponse.json({ error: "You are not authorised to assign tasks to this company." }, { status: 403 });
  }
  const admin = createAdminClient();
  if (!admin) return adminServiceUnavailable();

  const assignedTo = [...new Set(validatedAssignees)];
  const { data: memberships, error: membershipError } = await admin
    .from("organisation_memberships")
    .select("user_id")
    .eq("organisation_id", context.membership.organisationId)
    .eq("role", "client_user")
    .eq("active", true)
    .in("user_id", assignedTo);
  if (membershipError) return safeBackendFailure();
  const activeMembershipIds = new Set((memberships ?? []).map(({ user_id }) => user_id));
  const { data: profiles, error: profileError } = await admin
    .from("profiles")
    .select("id")
    .eq("active", true)
    .in("id", assignedTo);
  if (profileError) return safeBackendFailure();
  const activeProfileIds = new Set((profiles ?? []).map(({ id }) => id));
  if (assignedTo.some((id) => !activeMembershipIds.has(id) || !activeProfileIds.has(id))) {
    return NextResponse.json(
      { error: "Choose only active users in your company." },
      { status: 400 },
    );
  }

  const { data: tasks, error } = await admin
    .from("organisation_tasks")
    .insert(assignedTo.map((assignedUserId) => ({
      organisation_id: context.membership.organisationId,
      created_by: context.access.userId,
      assigned_to: assignedUserId,
      title: title.trim(),
      description: typeof body.description === "string" ? body.description.trim() : "",
      due_date: dueDate,
      priority: typeof body.priority === "string" ? body.priority : "medium",
    })))
    .select("id, organisation_id, created_by, assigned_to, title, description, due_date, priority, status, response_note, responded_at, created_at, updated_at");
  if (error || !tasks || tasks.length !== assignedTo.length) return safeBackendFailure();

  return NextResponse.json({ tasks }, { status: 201 });
}

export async function PATCH(request: Request) {
  const originError = requireSameOrigin(request);
  if (originError) return originError;
  const body = await readJson(request);
  if (
    !isRecord(body) ||
    typeof body.taskId !== "string" ||
    !uuidPattern.test(body.taskId) ||
    typeof body.expectedUpdatedAt !== "string" ||
    Number.isNaN(Date.parse(body.expectedUpdatedAt)) ||
    (body.action !== "accept" &&
      body.action !== "reject" &&
      body.action !== "reassign")
  ) {
    return invalidRequest("Choose a valid task action.");
  }

  const context = await getClientMembership();
  if ("response" in context) return context.response;
  if (hasForeignOrganisationId(body, context.membership.organisationId)) {
    return NextResponse.json({ error: "You are not authorised to update tasks for this company." }, { status: 403 });
  }
  const admin = createAdminClient();
  if (!admin) return adminServiceUnavailable();
  const { data: task, error: taskError } = await admin
    .from("organisation_tasks")
    .select("id, created_by, assigned_to, status, updated_at")
    .eq("id", body.taskId)
    .eq("organisation_id", context.membership.organisationId)
    .maybeSingle();
  if (taskError) return safeBackendFailure();
  if (!task) return NextResponse.json({ error: "Task not found." }, { status: 404 });
  if (task.updated_at !== body.expectedUpdatedAt) {
    return NextResponse.json(
      { error: "The task changed in another session. Refresh and try again." },
      { status: 409 },
    );
  }

  let update: Record<string, string | null>;
  if (body.action === "reassign") {
    if (
      task.created_by !== context.access.userId ||
      typeof body.assignedTo !== "string" ||
      !uuidPattern.test(body.assignedTo)
    ) {
      return NextResponse.json({ error: "Only the task creator can reassign it." }, { status: 403 });
    }
    const { data: assignee, error: assigneeError } = await admin
      .from("organisation_memberships")
      .select("user_id")
      .eq("organisation_id", context.membership.organisationId)
      .eq("user_id", body.assignedTo)
      .eq("role", "client_user")
      .eq("active", true)
      .maybeSingle();
    if (assigneeError) return safeBackendFailure();
    if (!assignee) return invalidRequest("Choose an active user in your company.");
    const { data: assigneeProfile, error: assigneeProfileError } = await admin
      .from("profiles")
      .select("id")
      .eq("id", body.assignedTo)
      .eq("active", true)
      .maybeSingle();
    if (assigneeProfileError) return safeBackendFailure();
    if (!assigneeProfile) return invalidRequest("Choose an active user in your company.");
    update = {
      assigned_to: body.assignedTo,
      status: "pending_acceptance",
      response_note: "",
      responded_at: null,
    };
  } else {
    if (
      task.assigned_to !== context.access.userId ||
      task.status !== "pending_acceptance"
    ) {
      return NextResponse.json(
        { error: "Only the assigned user can accept or reject a pending task." },
        { status: 403 },
      );
    }
    if (
      body.note !== undefined &&
      (typeof body.note !== "string" || body.note.trim().length > 1000)
    ) {
      return invalidRequest("The response note must be 1,000 characters or fewer.");
    }
    const responseNote = typeof body.note === "string" ? body.note.trim() : "";
    if (body.action === "reject" && !responseNote) {
      return invalidRequest("Provide a reason before rejecting this task.");
    }
    update = {
      status: body.action === "accept" ? "accepted" : "rejected",
      response_note: body.action === "reject" ? responseNote : "",
      responded_at: new Date().toISOString(),
    };
  }

  const { data: updatedTask, error } = await admin
    .from("organisation_tasks")
    .update(update)
    .eq("id", task.id)
    .eq("organisation_id", context.membership.organisationId)
    .eq("created_by", task.created_by)
    .eq("assigned_to", task.assigned_to)
    .eq("status", task.status)
    .eq("updated_at", body.expectedUpdatedAt)
    .select("id, organisation_id, created_by, assigned_to, title, description, due_date, priority, status, response_note, responded_at, created_at, updated_at")
    .maybeSingle();
  if (error) return safeBackendFailure();
  if (!updatedTask) {
    return NextResponse.json(
      { error: "The task changed in another session. Refresh and try again." },
      { status: 409 },
    );
  }

  return NextResponse.json({ task: updatedTask });
}
