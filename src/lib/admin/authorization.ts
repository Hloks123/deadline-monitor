import "server-only";

import { NextResponse } from "next/server";
import {
  getWorkspaceAccess,
  type PlatformRole,
  type WorkspaceAccess,
} from "@/lib/auth/workspace";
import { createClient } from "@/lib/supabase/server";

export async function requirePlatformRole(allowedRoles: PlatformRole[]) {
  const supabase = await createClient();
  const access = await getWorkspaceAccess(supabase);

  if (access.status !== "authorized") {
    const status = access.status === "unauthenticated" ? 401 : 403;
    return {
      response: NextResponse.json(
        { error: "You are not authorised to perform this action." },
        { status },
      ),
    } as const;
  }

  if (!allowedRoles.some((role) => access.platformRoles.includes(role))) {
    return {
      response: NextResponse.json(
        { error: "You are not authorised to perform this action." },
        { status: 403 },
      ),
    } as const;
  }

  return { supabase, access } as const;
}

export function isMainConsultant(
  access: Extract<WorkspaceAccess, { status: "authorized" }>,
) {
  return access.platformRoles.includes("main_consultant");
}

export function isAdministrator(
  access: Extract<WorkspaceAccess, { status: "authorized" }>,
) {
  return access.platformRoles.includes("administrator");
}

export function invalidRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function adminServiceUnavailable() {
  return NextResponse.json(
    { error: "The administrative data service is not configured." },
    { status: 503 },
  );
}

export function safeBackendFailure() {
  return NextResponse.json(
    { error: "The request could not be completed. Try again or contact support." },
    { status: 500 },
  );
}

export function requireSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) {
    return NextResponse.json(
      { error: "The request origin could not be verified." },
      { status: 403 },
    );
  }
  try {
    if (new URL(origin).origin === new URL(request.url).origin) return null;
  } catch {
    return NextResponse.json(
      { error: "The request origin could not be verified." },
      { status: 403 },
    );
  }
  return NextResponse.json(
    { error: "The request origin could not be verified." },
    { status: 403 },
  );
}

export async function readJson(request: Request): Promise<unknown | null> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
