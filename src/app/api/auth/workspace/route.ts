import { NextResponse } from "next/server";
import { getWorkspaceAccess, getWorkspacePath } from "@/lib/auth/workspace";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const access = await getWorkspaceAccess(await createClient());

  if (access.status !== "authorized") {
    return NextResponse.json({ status: access.status }, { status: 403 });
  }

  return NextResponse.json(
    {
      status: access.status,
      destination: getWorkspacePath(access),
      platformRoles: access.platformRoles,
      memberships: access.memberships,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
