import { db } from "@/lib/db";
import { completeOnboarding } from "./onboarding";
import { activatePlan, ensureReminderSettings, generateDraft, type Result } from "./service";

/**
 * Finishing onboarding: build the plan from the saved answers, mark onboarding complete and start the plan (which starts
 * reminders). Idempotent and safe to repeat: a learner who already has a plan is simply marked complete, and a learner whose
 * plan could not be built (for example too few study days) stays in onboarding with the reason, so nothing is half done.
 * Also the "build my plan" action for a learner who finished onboarding but has no plan yet.
 */
export async function finishOnboarding(userId: string): Promise<Result<{ planId: string }>> {
  const profile = await db.profile.findUnique({ where: { userId }, select: { learnerMode: true } });
  if (profile?.learnerMode !== "PERSONALISED") return { ok: false, error: "Plans are not available for this account." };

  const existing = await db.learningPlan.findFirst({ where: { userId, status: { in: ["ACTIVE", "PAUSED"] } }, select: { id: true, timezone: true } });
  if (existing) {
    await db.$transaction(async (tx) => {
      await ensureReminderSettings(tx, userId, existing.timezone);
      await tx.profile.update({ where: { userId }, data: { onboardingStatus: "COMPLETE" } });
    });
    return { ok: true, planId: existing.id };
  }

  const built = await generateDraft(userId);
  if (!built.ok) return built; // nothing changed: the learner stays in onboarding and sees why
  const done = await completeOnboarding(userId);
  if (!done.ok) return done;
  const started = await activatePlan(userId);
  if (!started.ok) return started;
  return { ok: true, planId: started.planId };
}
