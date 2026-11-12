import type { NextRequest } from "next/server";
import { hasValidCronSecret, json } from "@/lib/http";
import { runSchedulerOnce } from "@/lib/notifications/scheduler";

/**
 * Server-side reminder scheduler entry point for an external trigger (Windows Task Scheduler, cron, uptime pinger).
 * Authenticated with CRON_SECRET (Bearer). With no secret configured the endpoint is closed.
 */
export async function POST(request: NextRequest) {
  if (!hasValidCronSecret(request)) return json({ error: "Unauthorized" }, 401);
  const stats = await runSchedulerOnce();
  return json({ ok: true, stats });
}
