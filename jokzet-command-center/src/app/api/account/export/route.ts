import { type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/dal";
import { json } from "@/lib/http";
import { buildUserExport, serializeExport } from "@/lib/privacy/export";
import { LIMITS, bucketKey, rateLimitHit } from "@/lib/ratelimit";

/**
 * Downloads everything the platform holds about the signed-in learner as JSON. Only ever the caller's own data (the id comes
 * from the session, never from the request), read-only, throttled, never cached.
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return json({ error: "Unauthorized" }, 401);
  // Browsers label requests another site triggered in the background; refuse those.
  if (request.headers.get("sec-fetch-site") === "cross-site" && request.headers.get("sec-fetch-mode") !== "navigate") {
    return json({ error: "Forbidden" }, 403);
  }

  const limited = await rateLimitHit(bucketKey("export:user", user.id), LIMITS.exportUser);
  if (!limited.ok) {
    return new Response(JSON.stringify({ error: "Too many export requests. Please try again later." }), {
      status: 429,
      headers: { "content-type": "application/json", "Retry-After": String(limited.retryAfterSeconds), "Cache-Control": "no-store" },
    });
  }

  const body = serializeExport(await buildUserExport(user.id));
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(body, {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="jokzet-labs-my-data-${stamp}.json"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
