import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";

/**
 * Is this learner mission part of a plan that is still in use (draft, active or paused)? A plan-linked mission cannot be
 * deleted or ticked off from the board: completion must go through evidence and assessment, and deleting it would break
 * the plan. Superseded plans are history and do not protect anything.
 */
export async function isPlanLinked(userId: string, learnerMissionId: string, tx: Prisma.TransactionClient | typeof db = db): Promise<boolean> {
  const n = await tx.learningPlanItem.count({
    where: { userId, learnerMissionId, status: { not: "CANCELLED" }, plan: { status: { in: ["DRAFT", "ACTIVE", "PAUSED"] } } },
  });
  return n > 0;
}
