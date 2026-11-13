import { z } from "zod";
import { db } from "@/lib/db";
import { detectSecretInUrl, detectSecrets, secretIssue, secretMessage } from "@/lib/evidence/secrets";

const httpsUrl = z
  .string()
  .trim()
  .max(500)
  .refine((v) => v === "" || /^https?:\/\/[^\s]+$/i.test(v), "Enter a full link starting with http:// or https://")
  .transform((v) => (v === "" ? null : v));

export const submitSchema = z.object({
  explanation: z.string().trim().min(20, "Explain what you did in at least 20 characters").max(4000),
  githubUrl: httpsUrl,
  liveUrl: httpsUrl,
});
export type SubmitInput = z.input<typeof submitSchema>;

export const saveProgressSchema = z.object({
  completedSteps: z.array(z.string().max(64)).max(50),
  notes: z
    .string()
    .trim()
    .max(4000)
    .superRefine((value, ctx) => {
      const message = secretIssue(value);
      if (message) ctx.addIssue({ code: "custom", message });
    })
    .default(""),
});

/** Mission detail for the signed-in learner. Curriculum missions only (code present). */
export async function getMissionDetail(userId: string, code: string) {
  const mission = await db.mission.findFirst({
    where: { code, createdById: null, isPublished: true },
    include: {
      department: { select: { code: true, name: true } },
      steps: { orderBy: { position: "asc" } },
      resources: true,
      rubric: { include: { criteria: { orderBy: { position: "asc" } } } },
      skills: { include: { skill: { select: { name: true } } } },
    },
  });
  if (!mission) return null;

  const learnerMission = await db.learnerMission.findUnique({
    where: { userId_missionId: { userId, missionId: mission.id } },
    include: { submissions: { orderBy: { attempt: "desc" }, take: 1 } },
  });
  return { mission, learnerMission };
}

/** Creates the learner's record if needed and marks the mission started. */
export async function startMission(userId: string, code: string): Promise<boolean> {
  const mission = await db.mission.findFirst({ where: { code, createdById: null, isPublished: true } });
  if (!mission) return false;
  const now = new Date();
  const lm = await db.learnerMission.upsert({
    where: { userId_missionId: { userId, missionId: mission.id } },
    update: {},
    create: { userId, missionId: mission.id, status: "IN_PROGRESS", startedAt: now },
  });
  if (lm.status === "NOT_STARTED") {
    await db.learnerMission.update({ where: { id: lm.id }, data: { status: "IN_PROGRESS", startedAt: lm.startedAt ?? now } });
    await db.activityRecord.create({
      data: { userId, type: "MISSION_STARTED", entityType: "Mission", entityId: mission.id },
    });
  }
  return true;
}

export async function saveProgress(
  userId: string, learnerMissionId: string, input: z.input<typeof saveProgressSchema>,
): Promise<boolean> {
  const data = saveProgressSchema.parse(input);
  const lm = await db.learnerMission.findFirst({ where: { id: learnerMissionId, userId }, include: { mission: { include: { steps: true } } } });
  if (!lm) return false;
  const valid = new Set(lm.mission.steps.map((s) => s.id));
  await db.learnerMission.update({
    where: { id: lm.id },
    data: {
      completedSteps: data.completedSteps.filter((id) => valid.has(id)), // ignore ids from other missions
      notes: data.notes || null,
      status: lm.status === "NOT_STARTED" ? "IN_PROGRESS" : lm.status,
      startedAt: lm.startedAt ?? new Date(),
    },
  });
  return true;
}

export type SubmitResult = { ok: true; attempt: number } | { ok: false; error: string };

/**
 * Sends the current draft attempt for assessment. Requires at least one piece of real evidence (an attached vault item
 * or a repository/live link) as well as the explanation, and refuses anything that looks like a secret. Resubmission
 * after a revision uses the next draft, so attempt numbers increase. Not allowed while an attempt awaits assessment.
 */
export async function submitMission(userId: string, learnerMissionId: string, input: SubmitInput): Promise<SubmitResult> {
  const parsed = submitSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check your submission." };

  const secrets = detectSecrets(parsed.data.explanation);
  if (secrets.length) return { ok: false, error: secretMessage(secrets) };
  for (const url of [parsed.data.githubUrl, parsed.data.liveUrl]) {
    if (url && detectSecretInUrl(url)) return { ok: false, error: "A link seems to contain a token or key. Remove it before submitting." };
  }

  return db.$transaction(async (tx) => {
    const lm = await tx.learnerMission.findFirst({
      where: { id: learnerMissionId, userId },
      include: { submissions: { orderBy: { attempt: "desc" }, take: 1 } },
    });
    if (!lm) return { ok: false as const, error: "Mission not found." };
    if (lm.status === "SUBMITTED") return { ok: false as const, error: "Your last submission is waiting to be assessed." };
    if (lm.status === "PASSED") return { ok: false as const, error: "This mission is already passed." };

    const latest = lm.submissions[0];
    const draft = latest?.status === "DRAFT"
      ? latest
      : await tx.submission.create({ data: { userId, learnerMissionId: lm.id, attempt: (latest?.attempt ?? 0) + 1, status: "DRAFT" } });

    const evidenceCount = await tx.evidenceItem.count({ where: { submissionId: draft.id, userId } });
    if (evidenceCount === 0 && !parsed.data.githubUrl && !parsed.data.liveUrl) {
      return { ok: false as const, error: "Add at least one piece of evidence (a file from the vault, or a repository or live link) before submitting." };
    }

    const now = new Date();
    await tx.submission.update({
      where: { id: draft.id },
      data: {
        status: "SUBMITTED", submittedAt: now, explanation: parsed.data.explanation,
        githubUrl: parsed.data.githubUrl, liveUrl: parsed.data.liveUrl,
      },
    });
    await tx.learnerMission.update({ where: { id: lm.id }, data: { status: "SUBMITTED", startedAt: lm.startedAt ?? now } });
    await tx.activityRecord.create({
      data: { userId, type: "SUBMISSION_CREATED", entityType: "LearnerMission", entityId: lm.id, metadata: { attempt: draft.attempt } },
    });
    return { ok: true as const, attempt: draft.attempt };
  });
}
