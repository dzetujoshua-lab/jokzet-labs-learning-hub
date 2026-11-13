import { z } from "zod";
import type { ActivityCategory, ActivityOrigin, LearnerMissionStatus } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { DEPARTMENTS } from "@/lib/departments";
import { secretIssue } from "@/lib/evidence/secrets";
import { EVIDENCE_TYPES, MISSION_KINDS, dateToISO, isoToDate, toEnum } from "@/lib/programme";
import { LIMITS, bucketKey, rateLimitHit } from "@/lib/ratelimit";
import { deriveRecommendations } from "./recommend";
import { RUBRIC_TEMPLATE_KEYS, getRubricTemplate } from "./rubric-templates";

/**
 * Personal activities and recommended challenges.
 *
 * Both are ordinary `Mission` rows owned by one learner (category PERSONAL_ACTIVITY or RECOMMENDED_CHALLENGE), so the whole
 * submit -> evidence -> assess pipeline works on them unchanged and they are isolated from the curriculum catalogue. They
 * never satisfy a curriculum mission, never earn XP or skills (see assessSubmission), and never count towards the headline
 * analytics: they are practice the learner chooses to do, assessed against a rubric.
 */

export type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };
const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

export const MAX_PERSONAL_ACTIVITIES = 200;

const departmentCodes = DEPARTMENTS.map((d) => d.code) as [string, ...string[]];
const text = (max: number) => z.string().trim().max(max);
const noSecrets = (value: string, ctx: z.RefinementCtx) => {
  const message = secretIssue(value);
  if (message) ctx.addIssue({ code: "custom", message });
};

export const activitySchema = z.object({
  title: text(120).min(3, "Give the activity a title (at least 3 characters)").superRefine(noSecrets),
  departmentCode: z.enum(departmentCodes, { error: "Pick a department" }),
  kind: z.enum(MISSION_KINDS),
  evidenceType: z.enum(EVIDENCE_TYPES),
  minutes: z.coerce.number().int().min(5, "At least 5 minutes").max(480, "At most 480 minutes").default(60),
  objective: text(500).min(10, "Describe what you want to achieve (at least 10 characters)").superRefine(noSecrets),
  deliverables: text(500).min(5, "Say what you will hand in as proof").superRefine(noSecrets),
  instructions: text(2000).superRefine(noSecrets).default(""),
  skillIds: z.array(z.string().min(1).max(64)).max(8, "Pick at most 8 skills").default([]),
  rubricTemplate: z.enum([...RUBRIC_TEMPLATE_KEYS, "none"] as [string, ...string[]]).default("none"),
  date: z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a valid date")]).default(""),
});
export type ActivityInput = z.input<typeof activitySchema>;

export type ActivityView = {
  id: string; // LearnerMission id
  title: string;
  category: ActivityCategory;
  origin: ActivityOrigin;
  departmentCode: string;
  minutes: number;
  status: LearnerMissionStatus;
  hasRubric: boolean;
  date: string | null;
};

const NOT_CURRICULUM = { category: { not: "CURRICULUM_MISSION" as const } };

/** Creates a personal activity (and its learner record, tagged skills and rubric) in one transaction. */
export async function createPersonalActivity(userId: string, input: ActivityInput): Promise<Result<{ id: string }>> {
  const parsed = activitySchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the form and try again.");
  const d = parsed.data;

  const limit = await rateLimitHit(bucketKey("activity:create", userId), LIMITS.activityCreateUser);
  if (!limit.ok) return fail("You are creating activities very quickly. Please wait a little and try again.");
  const owned = await db.learnerMission.count({ where: { userId, mission: NOT_CURRICULUM } });
  if (owned >= MAX_PERSONAL_ACTIVITIES) return fail(`You have reached the limit of ${MAX_PERSONAL_ACTIVITIES} personal activities. Delete some you no longer need.`);

  const department = await db.department.findUnique({ where: { code: d.departmentCode }, select: { id: true } });
  if (!department) return fail("Unknown department.");
  const uniqueSkills = [...new Set(d.skillIds)];
  if (uniqueSkills.length) {
    const valid = await db.skill.count({ where: { id: { in: uniqueSkills }, departmentId: department.id } });
    if (valid !== uniqueSkills.length) return fail("Pick skills that belong to the chosen department.");
  }
  const template = d.rubricTemplate === "none" ? null : getRubricTemplate(d.rubricTemplate);

  const lm = await db.$transaction(async (tx) => {
    const mission = await tx.mission.create({
      data: {
        departmentId: department.id,
        createdById: userId,
        category: "PERSONAL_ACTIVITY",
        origin: "LEARNER_CREATED",
        title: d.title,
        objective: d.objective,
        submissionRequirements: d.deliverables,
        notes: d.instructions || null,
        durationMinutes: d.minutes,
        kind: toEnum(d.kind) as never,
        evidenceType: toEnum(d.evidenceType) as never,
        xpReward: 0, // practice earns no XP; see assessSubmission
        requiredTools: [],
        isPublished: false,
        status: "DRAFT",
        skills: uniqueSkills.length ? { create: uniqueSkills.map((skillId) => ({ skillId })) } : undefined,
        rubric: template
          ? { create: { passingScore: template.passingScore, version: 1, criteria: { create: template.criteria.map(([name, description, maxPoints], i) => ({ position: i + 1, name, description, maxPoints })) } } }
          : undefined,
      },
    });
    return tx.learnerMission.create({ data: { userId, missionId: mission.id, scheduledFor: d.date ? isoToDate(d.date) : null } });
  });
  return { ok: true, id: lm.id };
}

/** Attaches a rubric template to the learner's own activity that has none yet and no submissions. */
export async function attachRubricTemplate(userId: string, learnerMissionId: string, templateKey: string): Promise<Result> {
  const template = getRubricTemplate(templateKey);
  if (!template) return fail("Pick one of the rubric templates.");
  return db.$transaction(async (tx) => {
    const lm = await tx.learnerMission.findFirst({
      where: { id: learnerMissionId, userId, mission: { createdById: userId, ...NOT_CURRICULUM } },
      include: { mission: { include: { rubric: { select: { id: true } } } }, _count: { select: { submissions: true } } },
    });
    if (!lm) return fail("Activity not found.");
    if (lm.mission.rubric) return fail("This activity already has a rubric.");
    if (lm._count.submissions > 0) return fail("This activity already has a submission.");
    await tx.assessmentRubric.create({
      data: {
        missionId: lm.missionId, passingScore: template.passingScore, version: 1,
        criteria: { create: template.criteria.map(([name, description, maxPoints], i) => ({ position: i + 1, name, description, maxPoints })) },
      },
    });
    return { ok: true } as const;
  });
}

/** Marks the learner's own activity started. Curriculum missions are started through their own route. */
export async function startActivity(userId: string, learnerMissionId: string): Promise<boolean> {
  const { count } = await db.learnerMission.updateMany({
    where: { id: learnerMissionId, userId, status: "NOT_STARTED", mission: NOT_CURRICULUM },
    data: { status: "IN_PROGRESS", startedAt: new Date() },
  });
  return count > 0;
}

export async function listActivities(userId: string): Promise<ActivityView[]> {
  const rows = await db.learnerMission.findMany({
    where: { userId, mission: NOT_CURRICULUM },
    orderBy: [{ createdAt: "desc" }],
    include: { mission: { select: { title: true, category: true, origin: true, durationMinutes: true, department: { select: { code: true } }, rubric: { select: { id: true } } } } },
  });
  return rows.map((r) => ({
    id: r.id,
    title: r.mission.title,
    category: r.mission.category,
    origin: r.mission.origin,
    departmentCode: r.mission.department.code,
    minutes: r.mission.durationMinutes,
    status: r.status,
    hasRubric: r.mission.rubric !== null,
    date: r.scheduledFor ? dateToISO(r.scheduledFor) : null,
  }));
}

/** One of the learner's own activities with everything the workspace needs; null for anyone else's, or for curriculum missions. */
export async function getActivityDetail(userId: string, learnerMissionId: string) {
  const lm = await db.learnerMission.findFirst({
    where: { id: learnerMissionId, userId, mission: NOT_CURRICULUM },
    include: {
      mission: {
        include: {
          department: { select: { code: true, name: true } },
          rubric: { include: { criteria: { orderBy: { position: "asc" } } } },
          skills: { include: { skill: { select: { name: true } } } },
        },
      },
    },
  });
  return lm;
}

/** Skills of a department, for the tagging control (shared curriculum data). */
export async function listDepartmentSkills(departmentCode: string) {
  return db.skill.findMany({ where: { department: { code: departmentCode } }, orderBy: { name: "asc" }, select: { id: true, name: true } });
}

// ── Recommended challenges ──

export type RecommendationView = {
  id: string;
  missionTitle: string;
  departmentCode: string;
  minutes: number;
  reasonCode: string;
  reasonDetail: string;
  createdAt: string;
};

/** Re-derives offers from the learner's assessment history. Idempotent: running it again changes nothing. */
export async function refreshRecommendations(userId: string): Promise<number> {
  const eligible = { createdById: null, category: "CURRICULUM_MISSION" as const, status: "PUBLISHED" as const, experimentChallenge: { not: null } };
  const [assessments, corrections, existing] = await Promise.all([
    db.assessment.findMany({
      where: { userId, rubric: { mission: eligible } },
      orderBy: { assessedAt: "desc" },
      take: 10,
      select: { id: true, assessedAt: true, weaknesses: true, rubric: { select: { mission: { select: { id: true, title: true } } } } },
    }),
    db.feedback.findMany({
      where: { kind: "CORRECTION", resolvedAt: null, assessment: { userId, rubric: { mission: eligible } } },
      select: { assessment: { select: { id: true, assessedAt: true, rubric: { select: { mission: { select: { id: true, title: true } } } } } } },
    }),
    db.activityRecommendation.findMany({ where: { userId }, select: { missionId: true, status: true } }),
  ]);

  const candidates = deriveRecommendations({
    assessments: assessments.map((a) => ({ id: a.id, assessedAt: a.assessedAt, missionId: a.rubric.mission.id, missionTitle: a.rubric.mission.title, weaknesses: a.weaknesses })),
    openCorrections: corrections.map((c) => ({ assessmentId: c.assessment.id, assessedAt: c.assessment.assessedAt, missionId: c.assessment.rubric.mission.id, missionTitle: c.assessment.rubric.mission.title })),
    alreadyRecommended: new Set(existing.map((e) => e.missionId)),
    openOffers: existing.filter((e) => e.status === "OFFERED").length,
  });
  if (!candidates.length) return 0;
  const { count } = await db.activityRecommendation.createMany({
    data: candidates.map((c) => ({ userId, missionId: c.missionId, reasonCode: c.reasonCode, reasonDetail: c.reasonDetail, sourceAssessmentId: c.sourceAssessmentId })),
    skipDuplicates: true,
  });
  return count;
}

export async function listRecommendations(userId: string): Promise<RecommendationView[]> {
  const rows = await db.activityRecommendation.findMany({
    where: { userId, status: "OFFERED" },
    orderBy: { createdAt: "asc" },
    include: { mission: { select: { title: true, durationMinutes: true, department: { select: { code: true } } } } },
  });
  return rows.map((r) => ({
    id: r.id,
    missionTitle: r.mission.title,
    departmentCode: r.mission.department.code,
    minutes: Math.min(r.mission.durationMinutes, 60),
    reasonCode: r.reasonCode,
    reasonDetail: r.reasonDetail ?? "",
    createdAt: r.createdAt.toISOString(),
  }));
}

/**
 * Accepting an offer creates the learner's own RECOMMENDED_CHALLENGE: the source mission's EXPERIMENT challenge as the
 * objective, its deliverable and rubric (same standard of assessment), tagged with its skills. The source mission and the
 * learner's curriculum progress are not touched, and the challenge never becomes mandatory.
 */
export async function acceptRecommendation(userId: string, recommendationId: string): Promise<Result<{ id: string }>> {
  const limit = await rateLimitHit(bucketKey("activity:accept", userId), LIMITS.activityCreateUser);
  if (!limit.ok) return fail("Please wait a little before accepting another challenge.");
  const rec = await db.activityRecommendation.findFirst({ where: { id: recommendationId, userId, status: "OFFERED" } });
  if (!rec) return fail("This challenge is no longer available.");

  const source = await db.mission.findFirst({
    where: { id: rec.missionId, createdById: null, category: "CURRICULUM_MISSION", status: "PUBLISHED", experimentChallenge: { not: null } },
    include: { rubric: { include: { criteria: { orderBy: { position: "asc" } } } }, skills: true },
  });
  if (!source || !source.rubric) return fail("This challenge is no longer available.");

  const result = await db.$transaction(async (tx) => {
    const claimed = await tx.activityRecommendation.updateMany({ where: { id: rec.id, userId, status: "OFFERED" }, data: { status: "ACCEPTED", resolvedAt: new Date() } });
    if (claimed.count === 0) return null; // someone (this learner in another tab) accepted or dismissed it first
    const mission = await tx.mission.create({
      data: {
        departmentId: source.departmentId,
        createdById: userId,
        category: "RECOMMENDED_CHALLENGE",
        origin: "PLATFORM_RECOMMENDATION",
        title: `Challenge: ${source.title}`.slice(0, 120),
        objective: source.experimentChallenge,
        submissionRequirements: source.submissionRequirements,
        notes: rec.reasonDetail,
        durationMinutes: Math.min(source.durationMinutes, 60),
        kind: source.kind,
        evidenceType: source.evidenceType,
        xpReward: 0,
        requiredTools: source.requiredTools,
        isPublished: false,
        status: "DRAFT",
        skills: source.skills.length ? { create: source.skills.map((s) => ({ skillId: s.skillId })) } : undefined,
        rubric: {
          create: {
            passingScore: source.rubric!.passingScore,
            version: 1,
            criteria: { create: source.rubric!.criteria.map((c) => ({ position: c.position, name: c.name, description: c.description, maxPoints: c.maxPoints })) },
          },
        },
      },
    });
    const lm = await tx.learnerMission.create({ data: { userId, missionId: mission.id } });
    await tx.activityRecommendation.update({ where: { id: rec.id }, data: { acceptedLearnerMissionId: lm.id } });
    return lm.id;
  });
  return result ? { ok: true, id: result } : fail("This challenge is no longer available.");
}

export async function dismissRecommendation(userId: string, recommendationId: string): Promise<boolean> {
  const { count } = await db.activityRecommendation.updateMany({
    where: { id: recommendationId, userId, status: "OFFERED" },
    data: { status: "DISMISSED", resolvedAt: new Date() },
  });
  return count > 0;
}
