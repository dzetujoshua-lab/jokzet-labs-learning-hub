import { db } from "@/lib/db";
import { planNotifications } from "./engine";
import { dispatchPush, type DispatchStats, type PushSender } from "./push";
import { generateInstances, reconcileMissed } from "@/lib/schedule/daily";
import { reconcilePlan } from "@/lib/plan/service";

export type SchedulerStats = { users: number; created: number; push: DispatchStats };

let running = false; // per-process guard; the database claim in dispatchPush protects across processes

/**
 * The server-side reminder scheduler. Runs without any browser open: makes sure every active user has their daily
 * missions, marks missed ones, creates due notifications, then delivers Web Push. Called by the cron endpoint, the
 * `reminders:dispatch` script, or the optional in-process interval. Fully idempotent.
 */
export async function runSchedulerOnce(now: Date = new Date(), sender?: PushSender): Promise<SchedulerStats | null> {
  if (running) return null;
  running = true;
  try {
    const users = await db.reminderSettings.findMany({
      where: { enabled: true, user: { isActive: true, OR: [{ scheduleConfigs: { some: { isActive: true } } }, { learningPlans: { some: { status: "ACTIVE" } } }] } },
      select: { userId: true },
    });
    let created = 0;
    for (const { userId } of users) {
      await generateInstances(userId, now);
      await reconcileMissed(userId, now);
      await reconcilePlan(userId, now); // plan learners: mark missed sessions and add catch-ups (no-op without an active plan)
      created += await planNotifications(userId, now);
    }
    const push = await dispatchPush(now, sender);
    return { users: users.length, created, push };
  } finally {
    running = false;
  }
}
