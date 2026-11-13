import "server-only";
import { createHash } from "node:crypto";
import { db } from "@/lib/db";

/**
 * Database-backed fixed-window rate limiter (no extra infrastructure). Each (key, window) is one row in
 * `RateLimitBucket`, incremented atomically with INSERT ... ON CONFLICT, so concurrent requests cannot undercount.
 *
 * Keys never contain raw emails or IP addresses: use `bucketKey()` which hashes the parts.
 *
 * Failure policy: if the limiter itself cannot reach the database it FAILS OPEN (the request is allowed and the
 * error is logged). Availability of sign-in matters more than a throttle, and it keeps a code-before-migration
 * deployment from locking everyone out. The rest of the request still needs the database, so a real outage is
 * still an outage.
 */

export type Limit = { limit: number; windowSeconds: number };
export type LimitResult = { ok: boolean; count: number; limit: number; retryAfterSeconds: number };

const PURGE_AFTER_MS = 24 * 60 * 60 * 1000;
const PURGE_EVERY = 50; // opportunistic: roughly one call in fifty cleans old rows

/** Hash the identifying parts of a key so no email or IP is stored in the clear. */
export function bucketKey(scope: string, ...parts: string[]): string {
  const hashed = parts.map((p) => createHash("sha256").update(p).digest("hex").slice(0, 24));
  return [scope, ...hashed].join(":");
}

/**
 * The caller's address as seen by the platform. On Netlify `x-nf-client-connection-ip` is set by the edge and cannot
 * be supplied by the client; the other headers are only fallbacks for other hosting and are spoofable.
 */
export function clientIp(headers: { get(name: string): string | null }): string {
  const platform = headers.get("x-nf-client-connection-ip")?.trim();
  if (platform) return platform.slice(0, 64);
  const real = headers.get("x-real-ip")?.trim();
  if (real) return real.slice(0, 64);
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (forwarded || "unknown").slice(0, 64);
}

function windowOf(now: Date, windowSeconds: number) {
  const ms = windowSeconds * 1000;
  const start = Math.floor(now.getTime() / ms) * ms;
  return { start: new Date(start), retryAfterSeconds: Math.max(1, Math.ceil((start + ms - now.getTime()) / 1000)) };
}

/** Counts one hit against `key` and reports whether it is still within the limit. */
export async function rateLimitHit(key: string, { limit, windowSeconds }: Limit, now: Date = new Date()): Promise<LimitResult> {
  const { start, retryAfterSeconds } = windowOf(now, windowSeconds);
  try {
    const rows = await db.$queryRaw<{ count: number }[]>`
      INSERT INTO "RateLimitBucket" ("key", "windowStart", "count") VALUES (${key}, ${start}, 1)
      ON CONFLICT ("key", "windowStart") DO UPDATE SET "count" = "RateLimitBucket"."count" + 1
      RETURNING "count"`;
    const count = Number(rows[0]?.count ?? 1);
    if (Math.random() < 1 / PURGE_EVERY) void purgeOldBuckets(now).catch(() => undefined);
    return { ok: count <= limit, count, limit, retryAfterSeconds };
  } catch (error) {
    console.error("rate limiter unavailable (failing open):", error instanceof Error ? error.message : "unknown error");
    return { ok: true, count: 0, limit, retryAfterSeconds };
  }
}

/** Reads the current count without counting a hit. `ok` is false when the limit is already used up. */
export async function rateLimitPeek(key: string, { limit, windowSeconds }: Limit, now: Date = new Date()): Promise<LimitResult> {
  const { start, retryAfterSeconds } = windowOf(now, windowSeconds);
  try {
    const row = await db.rateLimitBucket.findUnique({ where: { key_windowStart: { key, windowStart: start } } });
    const count = row?.count ?? 0;
    return { ok: count < limit, count, limit, retryAfterSeconds };
  } catch (error) {
    console.error("rate limiter unavailable (failing open):", error instanceof Error ? error.message : "unknown error");
    return { ok: true, count: 0, limit, retryAfterSeconds };
  }
}

/** Forgets a key (all windows), for example the failure counter after a successful sign-in. */
export async function rateLimitReset(key: string): Promise<void> {
  try {
    await db.rateLimitBucket.deleteMany({ where: { key } });
  } catch (error) {
    console.error("rate limiter reset failed:", error instanceof Error ? error.message : "unknown error");
  }
}

export async function purgeOldBuckets(now: Date = new Date()): Promise<number> {
  const { count } = await db.rateLimitBucket.deleteMany({ where: { windowStart: { lt: new Date(now.getTime() - PURGE_AFTER_MS) } } });
  return count;
}

/** Standard limits, named so every call site and test shares one definition. */
export const LIMITS = {
  loginIp: { limit: 60, windowSeconds: 15 * 60 }, // every attempt from one address (password spraying)
  loginIpEmail: { limit: 5, windowSeconds: 15 * 60 }, // failures for one email from one address
  loginEmail: { limit: 25, windowSeconds: 60 * 60 }, // failures for one email from anywhere (distributed guessing)
  registerIp: { limit: 20, windowSeconds: 60 * 60 },
  evidenceUser: { limit: 60, windowSeconds: 60 * 60 },
  evidenceIp: { limit: 150, windowSeconds: 60 * 60 },
  testNotificationUser: { limit: 10, windowSeconds: 60 * 60 },
  pendingTick: { limit: 1, windowSeconds: 20 }, // reminder bookkeeping at most once per 20 s per learner
  pendingUser: { limit: 30, windowSeconds: 60 }, // polls per minute per learner (client polls twice a minute)
  reviewRequestUser: { limit: 20, windowSeconds: 24 * 60 * 60 }, // asking for reviews
  reviewActionReviewer: { limit: 240, windowSeconds: 60 * 60 }, // claiming and completing reviews
  resourceEngagementUser: { limit: 60, windowSeconds: 60 }, // advisory resource interactions
  activityCreateUser: { limit: 30, windowSeconds: 60 * 60 }, // creating personal activities and accepting challenges
} as const satisfies Record<string, Limit>;
