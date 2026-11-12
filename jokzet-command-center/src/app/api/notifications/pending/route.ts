import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/dal";
import { json } from "@/lib/http";
import { pendingForClient, tickUser } from "@/lib/notifications/engine";
import { LIMITS, bucketKey, rateLimitHit } from "@/lib/ratelimit";

/**
 * Polled by the open app (every 30 s per tab). It writes (reminder bookkeeping), so it is throttled in two ways:
 * the poll itself per learner, and the bookkeeping (`tickUser`) at most once per 20 s per learner no matter how many
 * tabs are open. A throttled tick still returns whatever is already pending.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return json({ error: "Unauthorized" }, 401);

  const poll = await rateLimitHit(bucketKey("pending:user", user.id), LIMITS.pendingUser);
  if (!poll.ok) {
    return NextResponse.json({ error: "Slow down" }, { status: 429, headers: { "Retry-After": String(poll.retryAfterSeconds), "Cache-Control": "no-store" } });
  }
  const tick = await rateLimitHit(bucketKey("pending:tick", user.id), LIMITS.pendingTick);
  if (tick.ok) await tickUser(user.id);
  return json({ notifications: await pendingForClient(user.id) });
}
