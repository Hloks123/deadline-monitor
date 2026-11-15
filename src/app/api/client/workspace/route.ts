import { NextResponse } from "next/server";
import { adminServiceUnavailable, safeBackendFailure } from "@/lib/admin/authorization";
import { getWorkspaceAccess } from "@/lib/auth/workspace";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const access = await getWorkspaceAccess(supabase);

  if (access.status !== "authorized") {
    return NextResponse.json({ status: access.status }, { status: 403 });
  }

  const clientMemberships = access.memberships.filter(
    ({ role }) => role === "client_user" || role === "client_administrator",
  );
  if (
    access.platformRoles.length > 0 ||
    clientMemberships.length !== 1 ||
    access.memberships.length !== 1
  ) {
    return NextResponse.json({ status: "ambiguous_membership" }, { status: 403 });
  }

  const membership = clientMemberships[0];
  const [organisationResult, userResult] = await Promise.all([
    supabase
      .from("organisations")
      .select("id, name")
      .eq("id", membership.organisationId)
      .eq("status", "active")
      .maybeSingle(),
    supabase.auth.getUser(),
  ]);

  if (organisationResult.error || userResult.error) {
    return NextResponse.json({ status: "unavailable" }, { status: 503 });
  }
  if (
    !organisationResult.data ||
    !userResult.data.user ||
    userResult.data.user.id !== access.userId
  ) {
    return NextResponse.json({ status: "no_membership" }, { status: 403 });
  }

  const admin = createAdminClient();
  if (!admin) return adminServiceUnavailable();
  const [recordsResult, teamMembershipsResult] = await Promise.all([
    supabase
      .from("organisation_client_records")
      .select("record_id, payload")
      .eq("organisation_id", membership.organisationId)
      .order("created_at"),
    admin
      .from("organisation_memberships")
      .select("user_id, role, active, is_primary, job_title")
      .eq("organisation_id", membership.organisationId)
      .eq("active", true)
      .in("role", ["client_administrator", "client_user"]),
  ]);
  if (recordsResult.error || teamMembershipsResult.error) {
    return safeBackendFailure();
  }
  const teamUserIds = [
    ...new Set((teamMembershipsResult.data ?? []).map(({ user_id }) => user_id)),
  ];
  const { data: profiles, error: profilesError } = teamUserIds.length
    ? await admin
        .from("profiles")
        .select("id, display_name, active")
        .in("id", teamUserIds)
        .eq("active", true)
    : { data: [], error: null };
  if (profilesError) return safeBackendFailure();

  const profilesById = new Map(
    (profiles ?? []).map((profile) => [profile.id, profile]),
  );
  const team = (teamMembershipsResult.data ?? []).flatMap((teamMembership) => {
    const profile = profilesById.get(teamMembership.user_id);
    if (!profile) return [];
    return [{
      id: profile.id,
      name: profile.display_name,
      jobTitle: teamMembership.job_title,
      role: teamMembership.role,
    }];
  });

  return NextResponse.json(
    {
      status: "authorized",
      organisation: {
        id: organisationResult.data.id,
        name: organisationResult.data.name,
        role: membership.role,
        isSeniorManager: membership.isPrimary,
        jobTitle: membership.jobTitle,
      },
      user: {
        id: access.userId,
        name: access.displayName,
        email: userResult.data.user.email || "",
      },
      records: (recordsResult.data ?? []).map(({ payload }) => payload),
      team,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
