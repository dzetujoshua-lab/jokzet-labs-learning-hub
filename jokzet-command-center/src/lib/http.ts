import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

export const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

/**
 * CSRF defence for cookie-authenticated, state-changing route handlers: the browser always sends Origin on
 * cross-site POSTs, so a missing or different Origin is rejected (SameSite=Lax is a second layer).
 */
export function isSameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (origin === null) return false;
  if (origin === request.nextUrl.origin) return true;
  // Behind a reverse proxy the server may see http and an internal host while the browser used the public https address.
  // APP_URL is server configuration the operator sets, so trusting exactly that origin does not weaken the check.
  const configured = configuredOrigin();
  return configured !== null && origin === configured;
}

function configuredOrigin(): string | null {
  try {
    return process.env.APP_URL ? new URL(process.env.APP_URL).origin : null;
  } catch {
    return null;
  }
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
