import type { NextRequest } from "next/server";
import { hasValidCronSecret, json } from "@/lib/http";
import { processDueAssessmentJobs } from "@/lib/ai/jobs";
import { runSchedulerOnce } from "@/lib/notifications/scheduler";

/**
 * Server-side scheduler entry point (reminders and due AI assessments) for an external trigger (Windows Task Scheduler, cron, uptime pinger).
 * Authenticated with CRON_SECRET (Bearer). With no secret configured the endpoint is closed.
 */
export async function POST(request: NextRequest) {
  if (!hasValidCronSecret(request)) return json({ error: "Unauthorized" }, 401);
  const stats = await runSchedulerOnce();
  // Also picks up AI assessments that are due: queued, waiting to retry, or abandoned by a worker that stopped. Does nothing
  // while AI assessment is switched off.
  const assessments = await processDueAssessmentJobs();
  return json({ ok: true, stats, assessments });
}
