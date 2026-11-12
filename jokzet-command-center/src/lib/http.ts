import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

export const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

/**
 * CSRF defence for cookie-authenticated, state-changing route handlers: the browser always sends Origin on
 * cross-site POSTs, so a missing or different Origin is rejected (SameSite=Lax is a second layer).
 */
export function isSameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  return origin !== null && origin === request.nextUrl.origin;
}

/** Constant-time check of `Authorization: Bearer <CRON_SECRET>`. Fails closed when no secret is configured. */
export function hasValidCronSecret(request: NextRequest, secret = process.env.CRON_SECRET): boolean {
  if (!secret || secret.length < 24) return false;
  const header = request.headers.get("authorization") ?? "";
  const given = header.startsWith("Bearer ") ? header.slice(7) : "";
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}
