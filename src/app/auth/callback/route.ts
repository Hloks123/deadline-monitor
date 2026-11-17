import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

function getSafeNextPath(request: NextRequest, candidate: string | null, fallback: string) {
  if (!candidate) return fallback;
  try {
    const destination = new URL(candidate, request.url);
    if (destination.origin !== request.nextUrl.origin) return fallback;
    return `${destination.pathname}${destination.search}${destination.hash}`;
  } catch {
    return fallback;
  }
}

function invalidLinkRedirect(request: NextRequest, destination: string) {
  const invalidUrl = new URL(destination, request.url);
  invalidUrl.searchParams.set("error", "reset-link-invalid");
  return NextResponse.redirect(invalidUrl);
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const flowId = request.nextUrl.searchParams.get("sb_flow_id");
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");
  const requestedNext = request.nextUrl.searchParams.get("next");
  const isRecovery = type === "recovery" || Boolean(tokenHash);
  const nextPath = getSafeNextPath(
    request,
    requestedNext,
    isRecovery ? "/update-password" : "/login",
  );

  const supabase = await createClient();

  if (tokenHash && type === "recovery") {
    const { error } = await supabase.auth.verifyOtp({
      type: "recovery",
      token_hash: tokenHash,
    });

    if (error) return invalidLinkRedirect(request, nextPath);
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(
      code,
      flowId ? { flowId } : undefined,
    );

    if (error) return invalidLinkRedirect(request, nextPath);
  } else {
    return invalidLinkRedirect(request, nextPath);
  }

  return NextResponse.redirect(new URL(nextPath, request.url));
}
