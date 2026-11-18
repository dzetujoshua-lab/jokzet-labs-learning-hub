"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOnboardedUser } from "@/lib/auth/dal";
import { addCourse, previewAddCourse, type CoursePreview } from "@/lib/plan/service";

const request = z.object({
  departmentCode: z.string().trim().min(1).max(32),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  durationDays: z.number().int().min(14).max(365),
  requestKey: z.string().trim().min(8).max(64).optional(),
});

export type PreviewState = { ok: true; preview: CoursePreview } | { ok: false; error: string };
export type AddState = { ok: true; created: boolean } | { ok: false; error: string };

/** Both actions take the learner from the server session; nothing the browser sends can name another learner. */
export async function previewCourseAction(input: z.input<typeof request>): Promise<PreviewState> {
  const user = await requireOnboardedUser();
  const parsed = request.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check the start date and duration." };
  const r = await previewAddCourse(user.id, parsed.data);
  return r.ok ? { ok: true, preview: r.preview } : { ok: false, error: r.error };
}

export async function addCourseAction(input: z.input<typeof request>): Promise<AddState> {
  const user = await requireOnboardedUser();
  const parsed = request.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check the start date and duration." };
  const r = await addCourse(user.id, parsed.data);
  if (!r.ok) return { ok: false, error: r.error };
  revalidatePath("/", "layout");
  return { ok: true, created: r.created };
}
