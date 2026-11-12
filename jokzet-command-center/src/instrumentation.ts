/**
 * Optional in-process reminder scheduler. Enable with ENABLE_IN_PROCESS_SCHEDULER=true (single server instance).
 * For multi-instance or serverless hosting use the authenticated /api/cron/dispatch endpoint instead.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.ENABLE_IN_PROCESS_SCHEDULER !== "true") return;
  const g = globalThis as { __jzScheduler?: ReturnType<typeof setInterval> };
  if (g.__jzScheduler) return; // survive dev hot reloads without stacking timers

  const { runSchedulerOnce } = await import("@/lib/notifications/scheduler");
  g.__jzScheduler = setInterval(() => {
    runSchedulerOnce().catch((error) => console.error("[reminder-scheduler]", error));
  }, 60_000);
}
