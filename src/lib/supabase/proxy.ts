import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  canAccessConsultantRoute,
  canAccessWorkspace,
  getWorkspaceAccess,
  getWorkspacePath,
} from "@/lib/auth/workspace";
import { getSupabaseConfig } from "./config";

export async function updateSession(request: NextRequest) {
  const { url, publishableKey } = getSupabaseConfig();
  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }

        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const pathname = request.nextUrl.pathname;
  const isClientRoute = pathname === "/client" || pathname.startsWith("/client/");
  const consultantRoutes = [
    "/dashboard",
    "/clients",
    "/monitored-records",
    "/work",
    "/calendar",
    "/reminders",
    "/reports",
    "/audit-history",
    "/settings",
    "/account",
    "/recurring-tasks",
  ];
  const isConsultantRoute = consultantRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (!isClientRoute && !isConsultantRoute) return response;

  const access = await getWorkspaceAccess(supabase, {
    user: authData.user,
    error: authError,
  });
  if (
    access.status === "authorized" &&
    (isClientRoute
      ? canAccessWorkspace(access, "client")
      : canAccessConsultantRoute(access, pathname))
  ) {
    return response;
  }

  const destination = request.nextUrl.clone();
  if (access.status === "unauthenticated") {
    destination.pathname = "/login";
    destination.search = "";
  } else if (access.status === "profile_inactive") {
    destination.pathname = "/login";
    destination.search = "?error=inactive";
  } else if (
    access.status === "profile_missing" ||
    access.status === "no_membership"
  ) {
    destination.pathname = "/login";
    destination.search = "?error=no-access";
  } else if (access.status === "unavailable") {
    destination.pathname = "/login";
    destination.search = "?error=auth-unavailable";
  } else {
    destination.pathname = getWorkspacePath(access);
    destination.search = "";
  }

  const redirect = NextResponse.redirect(destination);
  for (const cookie of response.cookies.getAll()) {
    redirect.cookies.set(cookie);
  }
  return redirect;
}
