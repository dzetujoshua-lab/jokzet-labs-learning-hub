"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/dal";
import { personalisedLearningEnabled } from "@/lib/plan/flag";
import { finishOnboarding } from "@/lib/plan/finish";
import { saveOnboarding, skipBaseline, startBaseline } from "@/lib/plan/onboarding";
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

/** Builds the plan, marks onboarding complete and starts the plan. If the plan cannot be built the learner stays here with the reason. */
export async function finishOnboardingAction(): Promise<Done> {
  const user = await guard();
  if (!user) return off;
  const r = await finishOnboarding(user.id);
  revalidatePath("/", "layout");
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}
