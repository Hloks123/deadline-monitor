import { NextResponse } from "next/server";
import { requirePlatformRole, safeBackendFailure } from "@/lib/admin/authorization";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requirePlatformRole(["main_consultant"]);
  if ("response" in auth) return auth.response;

  const { data, error } = await auth.supabase
    .from("organisations")
    .select("id, name")
    .eq("status", "active")
    .order("name");
  if (error) return safeBackendFailure();

  return NextResponse.json(
    { organisations: data ?? [] },
    { headers: { "Cache-Control": "no-store" } },
  );
}
