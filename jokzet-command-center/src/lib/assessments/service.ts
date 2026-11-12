import { z } from "zod";
import type { AssessmentOutcome } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { detectSecrets, secretMessage } from "@/lib/evidence/secrets";
import { adjustDepartmentXp } from "@/lib/missions/service";
import { dateToISO } from "@/lib/programme";

/** A criterion scoring below this share of its points counts as a weakness and generates a correction. */
export const WEAKNESS_THRESHOLD = 0.7;
/** Below this overall percentage the outcome is FAIL instead of REVISE. */
export const FAIL_BELOW_PERCENT = 40;

export function outcomeFor(percentage: number, passingScore: number): AssessmentOutcome {
  if (percentage >= passingScore) return "PASS";
  return percentage < FAIL_BELOW_PERCENT ? "FAIL" : "REVISE";
}

export const assessInputSchema = z.object({
  scores: z.array(z.object({ criterionId: z.string().min(1).max(64), points: z.number().int().min(0), comment: z.string().trim().max(500).optional() })).min(1).max(20),
  feedback: z.string().trim().max(2000).optional(),
});
export type AssessInput = z.input<typeof assessInputSchema>;

export type AssessResult =
  | { ok: true; outcome: AssessmentOutcome; percentage: number; totalPoints: number; maxPoints: number; xpAwarded: number }
  | { ok: false; error: string };

/**
 * Self-assessment against the mission rubric (this is a personal learning tool, so the learner assesses their own
 * submitted evidence). Only a SUBMITTED attempt with real evidence can be assessed, exactly once. Everything happens
 * in one transaction: scores, feedback, corrections, status changes, XP (awarded once), skills and evidence verification.
 */
export async function assessSubmission(userId: string, submissionId: string, input: AssessInput, now: Date = new Date()): Promise<AssessResult> {
  const parsed = assessInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check the scores and try again." };
  const { scores, feedback } = parsed.data;

  const secrets = detectSecrets([feedback ?? "", ...scores.map((s) => s.comment ?? "")].join("\n"));
  if (secrets.length) return { ok: false, error: secretMessage(secrets) };

  return db.$transaction(async (tx) => {
    const submission = await tx.submission.findFirst({
      where: { id: submissionId, userId },
      include: {
        evidence: { select: { id: true } },
        learnerMission: { include: { mission: { include: { rubric: { include: { criteria: true } }, skills: true } } } },
      },
    });
    if (!submission) return { ok: false as const, error: "Submission not found." };
    if (submission.status !== "SUBMITTED") return { ok: false as const, error: submission.status === "ASSESSED" ? "This submission was already assessed." : "Submit the mission before assessing it." };
    if (submission.evidence.length === 0 && !submission.githubUrl && !submission.liveUrl) {
      return { ok: false as const, error: "Only submitted evidence can be assessed. This submission has none." };
    }

    const lm = submission.learnerMission;
    const mission = lm.mission;
    const rubric = mission.rubric;
    if (!rubric) return { ok: false as const, error: "This mission has no rubric." };

    // Every criterion exactly once, within its points.
    const byId = new Map(rubric.criteria.map((c) => [c.id, c]));
    const seen = new Set<string>();
    for (const s of scores) {
      const criterion = byId.get(s.criterionId);
      if (!criterion) return { ok: false as const, error: "A score refers to a criterion that is not part of this rubric." };
      if (seen.has(s.criterionId)) return { ok: false as const, error: "Each criterion can be scored only once." };
      if (s.points > criterion.maxPoints) return { ok: false as const, error: `"${criterion.name}" is out of ${criterion.maxPoints} points.` };
      seen.add(s.criterionId);
    }
    if (seen.size !== rubric.criteria.length) return { ok: false as const, error: "Score every criterion before saving." };

    const maxPoints = rubric.criteria.reduce((sum, c) => sum + c.maxPoints, 0);
    const totalPoints = scores.reduce((sum, s) => sum + s.points, 0);
    const percentage = Math.round((totalPoints / maxPoints) * 100);
    const outcome = outcomeFor(percentage, rubric.passingScore);
    const weak = scores.filter((s) => s.points < byId.get(s.criterionId)!.maxPoints * WEAKNESS_THRESHOLD);

    const assessment = await tx.assessment.create({
      data: {
        userId, submissionId, rubricId: rubric.id, assessorId: null, totalPoints, maxPoints, percentage, outcome,
        // Today every assessment is the learner's own: it keeps today's behaviour but is recorded as self-assessed, so it
        // can never be mistaken for a reviewed (verified) result. The rubric version and criterion snapshots freeze what
        // these scores meant even if the curriculum is edited later.
        assessorKind: "SELF", status: "SELF_RECORDED", rubricVersion: rubric.version,
        weaknesses: weak.map((s) => byId.get(s.criterionId)!.name), assessedAt: now,
        scores: {
          create: scores.map((s) => {
            const criterion = byId.get(s.criterionId)!;
            return { criterionId: s.criterionId, points: s.points, comment: s.comment || null, criterionName: criterion.name, maxPoints: criterion.maxPoints };
          }),
        },
      },
    });

    const feedbackRows: { assessmentId: string; authorId: string; kind: "GENERAL" | "CORRECTION" | "REMEDIATION"; body: string }[] = [];
    if (feedback) feedbackRows.push({ assessmentId: assessment.id, authorId: userId, kind: "GENERAL", body: feedback });
    if (outcome !== "PASS") {
      for (const s of weak) {
        const c = byId.get(s.criterionId)!;
        feedbackRows.push({ assessmentId: assessment.id, authorId: userId, kind: "CORRECTION", body: `${c.name}: ${s.comment || c.description}` });
      }
      if (mission.remediation) feedbackRows.push({ assessmentId: assessment.id, authorId: userId, kind: "REMEDIATION", body: mission.remediation });
    }
    if (feedbackRows.length) await tx.feedback.createMany({ data: feedbackRows });

    await tx.submission.update({ where: { id: submissionId }, data: { status: "ASSESSED" } });

    let xpAwarded = 0;
    if (outcome === "PASS") {
      await tx.learnerMission.update({ where: { id: lm.id }, data: { status: "PASSED", completedAt: now, startedAt: lm.startedAt ?? now } });
      // Only curriculum missions earn XP and skills. A personal activity or recommended challenge is practice the learner
      // chose to do: it is assessed and recorded (and can be shown in the portfolio), but it never earns XP, never earns
      // curriculum skills and never stands in for a mandatory mission.
      const earnsCredit = mission.category === "CURRICULUM_MISSION";
      if (earnsCredit && lm.xpAwarded === 0) {
        xpAwarded = mission.xpReward;
        await tx.learnerMission.update({ where: { id: lm.id }, data: { xpAwarded } });
        await adjustDepartmentXp(tx, userId, mission.departmentId, xpAwarded); // idempotent: only when nothing was awarded yet
      }
      await tx.evidenceItem.updateMany({ where: { submissionId }, data: { status: "VERIFIED" } });
      if (earnsCredit && mission.skills.length) {
        await tx.userSkill.createMany({ data: mission.skills.map((s) => ({ userId, skillId: s.skillId, earnedAt: now, tier: "SELF_ASSESSED" as const })), skipDuplicates: true });
      }
    } else {
      await tx.learnerMission.update({ where: { id: lm.id }, data: { status: "NEEDS_REVISION" } });
    }

    await tx.activityRecord.create({
      data: {
        userId, type: outcome === "PASS" ? "ASSESSMENT_PASSED" : "ASSESSMENT_REVISE", entityType: "Assessment", entityId: assessment.id,
        minutes: outcome === "PASS" ? mission.durationMinutes : null, occurredAt: now, metadata: { percentage, attempt: submission.attempt },
      },
    });
    return { ok: true as const, outcome, percentage, totalPoints, maxPoints, xpAwarded };
  });
}

/** Marks a correction as addressed (or reopens it). Owner-scoped; only CORRECTION items can be toggled. */
export async function setCorrectionResolved(userId: string, feedbackId: string, resolved: boolean, now: Date = new Date()): Promise<boolean> {
  const { count } = await db.feedback.updateMany({
    where: { id: feedbackId, kind: "CORRECTION", assessment: { userId } },
    data: { resolvedAt: resolved ? now : null },
  });
  return count > 0;
}

export type AssessmentRow = {
  id: string;
  submissionId: string;
  title: string;
  departmentCode: string;
  date: string;
  attempt: number;
  score: number;
  maxScore: number;
  percentage: number;
  outcome: "pass" | "revise" | "fail";
  missionCode: string | null;
  openCorrections: number;
};

export type PendingRow = { submissionId: string; title: string; departmentCode: string; attempt: number; submittedAt: string | null; missionCode: string | null };

/** Everything the Assessment Centre page shows, for one user. */
export async function getAssessmentOverview(userId: string) {
  const [assessments, pending] = await Promise.all([
    db.assessment.findMany({
      where: { userId },
      orderBy: { assessedAt: "desc" },
      include: {
        submission: { select: { attempt: true } },
        rubric: { select: { mission: { select: { title: true, code: true, department: { select: { code: true } } } } } },
        feedback: { where: { kind: "CORRECTION", resolvedAt: null }, select: { id: true } },
      },
    }),
    db.submission.findMany({
      where: { userId, status: "SUBMITTED" },
      orderBy: { submittedAt: "asc" },
      include: { learnerMission: { select: { mission: { select: { title: true, code: true, department: { select: { code: true } } } } } } },
    }),
  ]);

  const rows: AssessmentRow[] = assessments.map((a) => ({
    id: a.id,
    submissionId: a.submissionId,
    title: a.rubric.mission.title,
    departmentCode: a.rubric.mission.department.code,
    date: dateToISO(a.assessedAt),
    attempt: a.submission.attempt,
    score: a.totalPoints,
    maxScore: a.maxPoints,
    percentage: a.percentage,
    outcome: a.outcome.toLowerCase() as AssessmentRow["outcome"],
    missionCode: a.rubric.mission.code,
    openCorrections: a.feedback.length,
  }));

  const pendingRows: PendingRow[] = pending.map((p) => ({
    submissionId: p.id,
    title: p.learnerMission.mission.title,
    departmentCode: p.learnerMission.mission.department.code,
    attempt: p.attempt,
    submittedAt: p.submittedAt?.toISOString() ?? null,
    missionCode: p.learnerMission.mission.code,
  }));

  // Weakness tracking: how often each rubric criterion fell short, per department.
  const weaknessCounts = new Map<string, { name: string; departmentCode: string; count: number }>();
  for (const a of assessments) {
    for (const name of a.weaknesses) {
      const departmentCode = a.rubric.mission.department.code;
      const key = `${departmentCode}:${name}`;
      const entry = weaknessCounts.get(key) ?? { name, departmentCode, count: 0 };
      entry.count += 1;
      weaknessCounts.set(key, entry);
    }
  }
  const weaknesses = [...weaknessCounts.values()].sort((a, b) => b.count - a.count).slice(0, 8);

  const average = rows.length ? Math.round(rows.reduce((sum, r) => sum + r.percentage, 0) / rows.length) : 0;
  return { rows, pending: pendingRows, weaknesses, stats: { average, passed: rows.filter((r) => r.outcome === "pass").length, toRevise: rows.filter((r) => r.outcome !== "pass").length, logged: rows.length } };
}

/** Detail for the assessment page: a submitted attempt, its evidence, rubric and (if any) the existing result. */
export async function getAssessmentContext(userId: string, submissionId: string) {
  return db.submission.findFirst({
    where: { id: submissionId, userId },
    include: {
      evidence: { include: { file: { select: { originalName: true, kind: true, sizeBytes: true } }, department: { select: { code: true } } }, orderBy: { createdAt: "asc" } },
      learnerMission: { include: { mission: { include: { department: { select: { code: true, name: true } }, rubric: { include: { criteria: { orderBy: { position: "asc" } } } } } } } },
      assessment: {
        include: { scores: { include: { criterion: true }, orderBy: { criterion: { position: "asc" } } }, feedback: { orderBy: { createdAt: "asc" } } },
      },
    },
  });
}
