import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { isSupabaseConfigured } from "@/lib/env";

// Routes that don't require authentication
const PUBLIC_ROUTES = ["/login", "/signup", "/auth/callback", "/", "/onboarding"];

export async function middleware(request: NextRequest) {
  // Always refresh the session cookie
  const response = await updateSession(request);

  // If Supabase is not configured, allow all routes (demo mode)
  if (!isSupabaseConfigured()) {
    return response;
  }

  const { pathname } = request.nextUrl;
  const isPublicRoute = PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith("/auth/")
  );

  // Check for auth session via cookie
  const hasSession = request.cookies.has("sb-access-token") ||
    request.cookies.has("sb-refresh-token") ||
    request.cookies.getAll().some((c) => c.name.startsWith("sb-"));

  // Redirect unauthenticated users from protected routes to login
  if (!isPublicRoute && !hasSession) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // NOTE: We intentionally do NOT redirect authenticated users away from
  // /login or /signup here. Stale/invalid sb-* cookies can cause a redirect
  // loop (/login → /dashboard → /login). Let server components and page-level
  // guards handle auth state properly.

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)).*)",
  ],
};
