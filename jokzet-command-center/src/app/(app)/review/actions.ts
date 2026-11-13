"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole, requireUser } from "@/lib/auth/dal";
import { cancelReviewRequest, claimRequest, completeReview, releaseRequest, requestReview, type Actor, type CompleteInput, type CompleteResult } from "@/lib/reviews/service";

const idSchema = z.string().min(1).max(64);
type Done = { ok: boolean; error?: string };

/** Every action re-verifies the session (and, for reviewers, the role); ids from the client are never trusted. */
async function reviewer(): Promise<Actor> {
  const user = await requireRole("ADMIN", "REVIEWER");
  return { id: user.id, role: user.role, displayName: user.displayName };
}

function refresh() {
  revalidatePath("/", "layout");
}

// ── Learner ──
export async function requestReviewAction(assessmentId: string): Promise<Done> {
  const user = await requireUser();
  const r = await requestReview(user.id, idSchema.parse(assessmentId));
  refresh();
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}

export async function cancelReviewAction(assessmentId: string): Promise<Done> {
  const user = await requireUser();
  const r = await cancelReviewRequest(user.id, idSchema.parse(assessmentId));
  refresh();
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}

// ── Reviewer ──
export async function claimReviewAction(requestId: string): Promise<Done> {
  const r = await claimRequest(await reviewer(), idSchema.parse(requestId));
  refresh();
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}

export async function releaseReviewAction(requestId: string): Promise<Done> {
  const r = await releaseRequest(await reviewer(), idSchema.parse(requestId));
  refresh();
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}

export async function completeReviewAction(requestId: string, input: CompleteInput): Promise<CompleteResult> {
  const r = await completeReview(await reviewer(), idSchema.parse(requestId), input);
  refresh();
  return r;
}
