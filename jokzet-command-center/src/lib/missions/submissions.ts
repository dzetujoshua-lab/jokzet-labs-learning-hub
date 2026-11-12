import { db } from "@/lib/db";

/**
 * Evidence is attached to a mission through a DRAFT submission (one per attempt). Submitting turns the draft into a
 * SUBMITTED attempt; resubmission after a revision simply starts the next draft (attempt n+1).
 */
export async function getOrCreateDraft(userId: string, learnerMissionId: string) {
  const lm = await db.learnerMission.findFirst({
    where: { id: learnerMissionId, userId },
    include: { submissions: { orderBy: { attempt: "desc" }, take: 1 } },
  });
  if (!lm) return null;
  if (lm.status === "SUBMITTED" || lm.status === "PASSED") return null; // locked while awaiting assessment / after a pass
  const latest = lm.submissions[0];
  if (latest?.status === "DRAFT") return latest;
  return db.submission.create({ data: { userId, learnerMissionId: lm.id, attempt: (latest?.attempt ?? 0) + 1, status: "DRAFT" } });
}

export type AttachResult = { ok: true } | { ok: false; error: string };

/** Attaches a vault item to the mission's current draft. Both the mission and the evidence must belong to the user. */
export async function attachToDraft(userId: string, learnerMissionId: string, evidenceId: string): Promise<AttachResult> {
  const item = await db.evidenceItem.findFirst({ where: { id: evidenceId, userId } });
  if (!item) return { ok: false, error: "Evidence not found." };
  if (item.submissionId) {
    const current = await db.submission.findUnique({ where: { id: item.submissionId } });
    if (current && current.learnerMissionId !== learnerMissionId) return { ok: false, error: "That evidence is already used in another mission." };
    if (current && current.status !== "DRAFT") return { ok: false, error: "That evidence belongs to a submission that was already sent." };
  }
  const draft = await getOrCreateDraft(userId, learnerMissionId);
  if (!draft) return { ok: false, error: "This mission cannot accept new evidence right now." };
  await db.evidenceItem.update({ where: { id: item.id }, data: { submissionId: draft.id } });
  return { ok: true };
}

export async function detachFromDraft(userId: string, evidenceId: string): Promise<boolean> {
  const { count } = await db.evidenceItem.updateMany({
    where: { id: evidenceId, userId, submission: { status: "DRAFT" } }, // sent submissions keep their evidence
    data: { submissionId: null },
  });
  return count > 0;
}

/** Everything the mission page needs about evidence, the current attempt, and the latest assessment. */
export async function getSubmissionState(userId: string, learnerMissionId: string) {
  const lm = await db.learnerMission.findFirst({
    where: { id: learnerMissionId, userId },
    include: { mission: { select: { departmentId: true, id: true } } },
  });
  if (!lm) return null;

  const latest = await db.submission.findFirst({
    where: { learnerMissionId, userId },
    orderBy: { attempt: "desc" },
    include: {
      evidence: { include: { file: { select: { originalName: true, sizeBytes: true, kind: true } } }, orderBy: { createdAt: "asc" } },
      assessment: {
        include: {
          scores: { include: { criterion: true }, orderBy: { criterion: { position: "asc" } } },
          feedback: { orderBy: { createdAt: "asc" } },
        },
      },
    },
  });

  // Vault items from the same department that are not attached to any submission yet.
  const available = await db.evidenceItem.findMany({
    where: { userId, departmentId: lm.mission.departmentId, submissionId: null },
    orderBy: { capturedDate: "desc" },
    take: 30,
    select: { id: true, title: true, kind: true },
  });

  const attempts = await db.submission.count({ where: { learnerMissionId, userId, status: { not: "DRAFT" } } });
  return { latest, available, attempts };
}
