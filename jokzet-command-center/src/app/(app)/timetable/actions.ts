"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/dal";
import { finishOnboarding } from "@/lib/plan/finish";
import { pausePlan, resumePlan } from "@/lib/plan/service";
import { timetableAccess } from "@/lib/plan/timetable-service";

type Done = { ok: boolean; error?: string };

/** Every action re-verifies the session and that the learner may use the timetable (personalised mode, flag on). */
async function guard() {
  const user = await requireUser();
  return (await timetableAccess(user.id)) ? user : null;
}
const off: Done = { ok: false, error: "The timetable is not available yet." };
const refresh = () => revalidatePath("/", "layout");

export async function pausePlanAction(): Promise<Done> {
  const user = await guard();
  if (!user) return off;
  const r = await pausePlan(user.id);
  refresh();
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}

export async function resumePlanAction(): Promise<Done> {
  const user = await guard();
  if (!user) return off;
  const r = await resumePlan(user.id);
  refresh();
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}

/** For a learner who finished onboarding but has no plan (for example the first attempt could not build one). */
export async function buildPlanAction(): Promise<Done> {
  const user = await guard();
  if (!user) return off;
  const r = await finishOnboarding(user.id);
  refresh();
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}

// ── Moving a session and changing availability ──
import { z } from "zod";
import { moveSession } from "@/lib/plan/reschedule-service";
import { changeAvailability } from "@/lib/plan/service";
import type { AvailabilityInput } from "@/lib/plan/schema";

const id = z.string().min(1).max(64);

export async function moveSessionAction(itemId: string, date: string, slotIndex: number, reason: string): Promise<Done> {
  const user = await guard();
  if (!user) return off;
  const r = await moveSession(user.id, id.parse(itemId), { date, slotIndex, reason });
  refresh();
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}

export async function changeAvailabilityAction(input: AvailabilityInput): Promise<Done & { newVersion?: boolean }> {
  const user = await guard();
  if (!user) return off;
  const r = await changeAvailability(user.id, input);
  refresh();
  return r.ok ? { ok: true, newVersion: r.newVersion } : { ok: false, error: r.error };
}
