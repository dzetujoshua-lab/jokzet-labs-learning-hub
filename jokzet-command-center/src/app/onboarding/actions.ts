"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/dal";
import { personalisedLearningEnabled } from "@/lib/plan/flag";
import { buildPlanForReview, confirmPlan, saveOnboarding, skipBaseline, startBaseline } from "@/lib/plan/onboarding";
import type { OnboardingInput } from "@/lib/plan/schema";

type Done = { ok: boolean; error?: string };
const code = z.string().min(1).max(32);

/** Every action re-verifies the session and the rollout flag; the signed-in user is the only subject. */
async function guard() {
  const user = await requireUser();
  return personalisedLearningEnabled() ? user : null;
}
const off: Done = { ok: false, error: "Personalised learning is not available yet." };

export async function saveOnboardingAction(input: OnboardingInput): Promise<Done> {
  const user = await guard();
  if (!user) return off;
  const r = await saveOnboarding(user.id, input);
  revalidatePath("/onboarding");
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}

export async function startBaselineAction(departmentCode: string): Promise<Done & { missionCode?: string }> {
  const user = await guard();
  if (!user) return off;
  const r = await startBaseline(user.id, code.parse(departmentCode));
  revalidatePath("/onboarding");
  return r.ok ? { ok: true, missionCode: r.missionCode } : { ok: false, error: r.error };
}

export async function skipBaselineAction(departmentCode: string): Promise<Done> {
  const user = await guard();
  if (!user) return off;
  const r = await skipBaseline(user.id, code.parse(departmentCode));
  revalidatePath("/onboarding");
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}

/** Generates the syllabus and timetable from the saved answers and moves to the review step. Starts nothing. */
export async function buildPlanAction(): Promise<Done> {
  const user = await guard();
  if (!user) return off;
  const r = await buildPlanForReview(user.id);
  revalidatePath("/onboarding");
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}

/** The learner's explicit confirmation: activates the reviewed plan and completes onboarding. */
export async function confirmPlanAction(): Promise<Done> {
  const user = await guard();
  if (!user) return off;
  const r = await confirmPlan(user.id);
  revalidatePath("/", "layout");
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}

/** Back from the review to editing the answers (the generated plan is kept until the answers change). */
export async function editAnswersAction(): Promise<Done> {
  const user = await guard();
  if (!user) return off;
  await db.profile.updateMany({ where: { userId: user.id, learnerMode: "PERSONALISED", onboardingStatus: "PLAN_REVIEW" }, data: { onboardingStatus: "IN_PROGRESS" } });
  revalidatePath("/onboarding");
  return { ok: true };
}
