import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/cookie";

const PUBLIC_PATHS = ["/login", "/register"];

/**
 * Optimistic check only: it looks for the cookie's presence to redirect early.
 * Real authorisation happens server-side (requireUser) against the database.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasCookie = request.cookies.has(SESSION_COOKIE);
  const isPublic = PUBLIC_PATHS.includes(pathname);

  // A stale cookie must not bounce users away from /login (that would loop), so signed-in
  // visitors are redirected from the login page itself after a real database check.
  if (!hasCookie && !isPublic) return NextResponse.redirect(new URL("/login", request.url));
  return NextResponse.next();
}

export const config = {
  // Skip Next internals, the health check and static files (anything with a file extension, e.g. /logo.png).
  // /api/cron/dispatch authenticates itself with CRON_SECRET (no browser cookie exists for a scheduler).
  matcher: ["/((?!api/health|api/cron/dispatch|_next/static|_next/image|.*\\..*).*)"],
};
