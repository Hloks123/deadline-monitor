import { NextResponse } from "next/server";
import { getWorkspaceAccess } from "@/lib/auth/workspace";
import {
  invalidRequest,
  requireSameOrigin,
  safeBackendFailure,
} from "@/lib/admin/authorization";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const access = await getWorkspaceAccess(supabase);
  if (access.status !== "authorized") {
    return NextResponse.json(
      { error: "Your account could not be verified. Sign in again." },
      { status: access.status === "unauthenticated" ? 401 : 403 },
    );
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("display_name, email, active")
    .eq("id", access.userId)
    .maybeSingle();
  if (error) return safeBackendFailure();
  if (!profile) {
    return NextResponse.json({ error: "Your account profile could not be found." }, {
      status: 404,
    });
  }

  return NextResponse.json({
    profile: {
      name: profile.display_name,
      email: profile.email,
      active: profile.active,
      roles: [
        ...access.platformRoles,
        ...new Set(access.memberships.map(({ role }) => role)),
      ],
    },
  }, {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function PATCH(request: Request) {
  const originError = requireSameOrigin(request);
  if (originError) return originError;

  const supabase = await createClient();
  const access = await getWorkspaceAccess(supabase);
  if (access.status !== "authorized") {
    return NextResponse.json(
      { error: "Your account could not be verified. Sign in again." },
      { status: access.status === "unauthenticated" ? 401 : 403 },
    );
  }

  const body: unknown = await request.json().catch(() => null);
  if (
    typeof body !== "object" ||
    body === null ||
    Array.isArray(body) ||
    !("name" in body) ||
    typeof body.name !== "string"
  ) {
    return invalidRequest("Enter a valid display name.");
  }
  const name = body.name.trim();
  if (!name || name.length > 120) {
    return invalidRequest("Your display name must be between 1 and 120 characters.");
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .update({ display_name: name })
    .eq("id", access.userId)
    .select("display_name, email, active")
    .maybeSingle();
  if (error) return safeBackendFailure();
  if (!profile) {
    return NextResponse.json({ error: "Your account profile could not be updated." }, {
      status: 404,
    });
  }

  return NextResponse.json({
    profile: {
      name: profile.display_name,
      email: profile.email,
      active: profile.active,
    },
  });
}
