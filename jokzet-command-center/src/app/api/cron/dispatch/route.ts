import type { NextRequest } from "next/server";
import { hasValidCronSecret, json } from "@/lib/http";
import { bucketKey, rateLimitHit } from "@/lib/ratelimit";
import { processDueAssessmentJobs } from "@/lib/ai/jobs";
import { runSchedulerOnce } from "@/lib/notifications/scheduler";

/**
 * Server-side scheduler entry point (reminders and due AI assessments) for an external trigger (Windows Task Scheduler, cron, uptime pinger).
 * Authenticated with CRON_SECRET (Bearer). With no secret configured the endpoint is closed.
 */
export async function POST(request: NextRequest) {
  if (!hasValidCronSecret(request)) return json({ error: "Unauthorized" }, 401);
  // Heartbeat: one row per minute in the existing rate-limit table (kept 24 hours, no schema change) proves the scheduler is being
  // called. The owner can count the last hour's rows to see whether the cron job is really running. Never blocks the run.
  await rateLimitHit(bucketKey("cron:heartbeat", "dispatch"), { limit: 1_000_000, windowSeconds: 60 }).catch(() => undefined);
  const stats = await runSchedulerOnce();
  // Also picks up AI assessments that are due: queued, waiting to retry, or abandoned by a worker that stopped. Does nothing
  // while AI assessment is switched off.
  const assessments = await processDueAssessmentJobs();
  return json({ ok: true, stats, assessments });
}
