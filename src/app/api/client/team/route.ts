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
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function getSeniorManagerContext() {
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
  const clientMemberships = access.memberships.filter(
    ({ role }) => role === "client_administrator" || role === "client_user",
  );
  const manager = clientMemberships.find(({ isPrimary, role }) =>
    isPrimary && role === "client_administrator",
  );
  if (
    access.platformRoles.length > 0 ||
    access.memberships.some(({ role }) => role === "assistant_consultant") ||
    clientMemberships.length !== 1 ||
    !manager
  ) {
    return {
      response: NextResponse.json(
        { error: "Only the company Senior Manager can manage existing user profiles." },
        { status: 403 },
      ),
    };
  }
  return { access, membership: manager };
}

export async function GET() {
  const context = await getSeniorManagerContext();
  if ("response" in context) return context.response;
  const admin = createAdminClient();
  if (!admin) return adminServiceUnavailable();

  const { data: memberships, error: membershipsError } = await admin
    .from("organisation_memberships")
    .select("user_id, role, active, is_primary, job_title, created_at")
    .eq("organisation_id", context.membership.organisationId)
    .in("role", ["client_administrator", "client_user"])
    .order("created_at");
  if (membershipsError) return safeBackendFailure();
  const userIds = [...new Set((memberships ?? []).map(({ user_id }) => user_id))];
  const { data: profiles, error: profilesError } = userIds.length
    ? await admin
        .from("profiles")
        .select("id, display_name, email, active")
        .in("id", userIds)
    : { data: [], error: null };
  if (profilesError) return safeBackendFailure();
  const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
  const members = (memberships ?? []).flatMap((membership) => {
    const profile = profileById.get(membership.user_id);
    if (!profile) return [];
    return [{
      id: profile.id,
      name: profile.display_name,
      email: profile.email ?? "",
      active: membership.active && profile.active,
      isSeniorManager: membership.is_primary,
      jobTitle: membership.job_title,
      role: membership.role,
    }];
  });
  return NextResponse.json({ members }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: Request) {
  const originError = requireSameOrigin(request);
  if (originError) return originError;
  const body = await readJson(request);
  if (
    !isRecord(body) ||
    typeof body.userId !== "string" ||
    !uuidPattern.test(body.userId) ||
    typeof body.name !== "string" ||
    body.name.trim().length < 1 ||
    body.name.trim().length > 120 ||
    typeof body.jobTitle !== "string" ||
    body.jobTitle.trim().length > 120 ||
    typeof body.active !== "boolean"
  ) {
    return invalidRequest("Enter a valid name, job title, and account status.");
  }

  const context = await getSeniorManagerContext();
  if ("response" in context) return context.response;
  if (body.userId === context.access.userId) {
    return invalidRequest("The Senior Manager profile cannot be changed here.");
  }
  const admin = createAdminClient();
  if (!admin) return adminServiceUnavailable();

  const { data: member, error: memberError } = await admin
    .from("organisation_memberships")
    .select("user_id, role, is_primary")
    .eq("organisation_id", context.membership.organisationId)
    .eq("user_id", body.userId)
    .eq("role", "client_user")
    .maybeSingle();
  if (memberError) return safeBackendFailure();
  if (!member || member.is_primary) {
    return NextResponse.json({ error: "This profile cannot be managed." }, { status: 404 });
  }

  const { data: updatedProfile, error: profileError } = await admin
    .from("profiles")
    .update({ display_name: body.name.trim() })
    .eq("id", body.userId)
    .eq("active", true)
    .select("id")
    .maybeSingle();
  if (profileError) return safeBackendFailure();
  if (!updatedProfile) {
    return NextResponse.json({ error: "This profile is inactive and cannot be changed here." }, { status: 409 });
  }
  const { data: updatedMembership, error: membershipError } = await admin
    .from("organisation_memberships")
    .update({
      job_title: body.jobTitle.trim(),
      active: body.active,
    })
    .eq("organisation_id", context.membership.organisationId)
    .eq("user_id", body.userId)
    .eq("is_primary", false)
    .select("user_id")
    .maybeSingle();
  if (membershipError) return safeBackendFailure();
  if (!updatedMembership) {
    return NextResponse.json({ error: "This profile changed before it could be saved. Refresh and try again." }, { status: 409 });
  }

  return NextResponse.json({ status: "updated" });
}
