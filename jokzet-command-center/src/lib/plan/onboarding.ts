import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { startMission } from "@/lib/missions/progress";
import { LIMITS, bucketKey, rateLimitHit } from "@/lib/ratelimit";
import { placementFromPercentage } from "./baseline";
import { ensureReminderSettings } from "./service";
import { durationDaysFor, onboardingSchema, type OnboardingInput } from "./schema";

/**
 * Onboarding for PERSONALISED learners: what they want to learn, when they can study, for how long, and (optionally) a
 * baseline per subject. Everything is stored on one DRAFT plan; the generator that turns it into a schedule is Phase 7.
 * Every function takes the signed-in user's id first and filters by it; ids from the client are never trusted.
 */
export type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };
const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

const DAY_MS = 24 * 60 * 60 * 1000;

export type BaselineView = {
  departmentCode: string;
  status: "PENDING" | "SUBMITTED" | "ASSESSED" | "SKIPPED";
  missionCode: string | null;
  missionTitle: string | null;
  percentage: number | null;
  placementLevel: number | null;
};

export type OnboardingState = {
  learnerMode: "LEGACY" | "PERSONALISED";
  status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETE";
  draft: {
    experience: "BEGINNER" | "IMPROVER" | "INTERMEDIATE" | "ADVANCED";
    sessionMinutes: number;
    dailyStudyMinutes: number;
    breakMinutes: number;
    flexibility: "STRICT" | "BALANCED" | "FLEXIBLE";
    autoReschedule: boolean;
    weekdays: number[];
    startTime: string;
    timezone: string;
    durationKind: "TWO_WEEKS" | "ONE_MONTH" | "THREE_MONTHS" | "SIX_MONTHS" | "ONE_YEAR" | "CUSTOM";
    durationDays: number;
    startDate: string;
    goals: { departmentCode: string; weight: number; targetLevel: number; note: string }[];
  } | null;
  baselines: BaselineView[];
  /** Subjects that have a published baseline mission (the others start at Level 0). */
  baselineAvailable: string[];
};

export async function getOnboardingState(userId: string): Promise<OnboardingState | null> {
  const profile = await db.profile.findUnique({ where: { userId }, select: { learnerMode: true, onboardingStatus: true } });
  if (!profile) return null;
  const [plan, baselineMissions] = await Promise.all([
    db.learningPlan.findFirst({
      where: { userId, status: "DRAFT" },
      include: {
        goals: { include: { department: { select: { code: true, sortOrder: true } } } },
        baselines: { include: { department: { select: { code: true } }, mission: { select: { code: true, title: true } } } },
      },
    }),
    db.mission.findMany({ where: { createdById: null, isPublished: true, role: "BASELINE" }, select: { department: { select: { code: true } } } }),
  ]);
  return {
    learnerMode: profile.learnerMode,
    status: profile.onboardingStatus,
    draft: plan
      ? {
          experience: plan.experience,
          sessionMinutes: plan.sessionMinutes,
          dailyStudyMinutes: plan.dailyStudyMinutes,
          breakMinutes: plan.breakMinutes,
          flexibility: plan.flexibility,
          autoReschedule: plan.autoReschedule,
          weekdays: [...plan.weekdays].sort((a, b) => a - b),
          startTime: plan.startTime,
          timezone: plan.timezone,
          durationKind: plan.durationKind,
          durationDays: plan.durationDays,
          startDate: plan.startDate.toISOString().slice(0, 10),
          goals: [...plan.goals]
            .sort((a, b) => a.department.sortOrder - b.department.sortOrder)
            .map((g) => ({ departmentCode: g.department.code, weight: g.weight, targetLevel: g.targetLevel, note: g.note ?? "" })),
        }
      : null,
    baselines: (plan?.baselines ?? []).map((b) => ({
      departmentCode: b.department.code,
      status: b.status,
      missionCode: b.mission.code,
      missionTitle: b.mission.title,
      percentage: b.percentage,
      placementLevel: b.placementLevel,
    })),
    baselineAvailable: [...new Set(baselineMissions.map((m) => m.department.code))],
  };
}

async function requirePersonalised(userId: string): Promise<Result<{ status: string }>> {
  const profile = await db.profile.findUnique({ where: { userId }, select: { learnerMode: true, onboardingStatus: true } });
  if (!profile) return fail("Profile not found.");
  if (profile.learnerMode !== "PERSONALISED") return fail("Onboarding is not available for this account.");
  return { ok: true, status: profile.onboardingStatus };
}

/** Saves (or replaces) the draft plan and its goals in one transaction. Idempotent: saving twice keeps one draft. */
export async function saveOnboarding(userId: string, input: OnboardingInput): Promise<Result> {
  const parsed = onboardingSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check your answers and try again.");
  const d = parsed.data;

  const mode = await requirePersonalised(userId);
  if (!mode.ok) return mode;

  const limit = await rateLimitHit(bucketKey("onboarding:save", userId), LIMITS.onboardingSave);
  if (!limit.ok) return fail("Please slow down and try again in a little while.");

  const departments = await db.department.findMany({ where: { code: { in: d.goals.map((g) => g.departmentCode) } }, select: { id: true, code: true } });
  const idByCode = new Map(departments.map((x) => [x.code, x.id]));
  if (d.goals.some((g) => !idByCode.has(g.departmentCode))) return fail("One of the chosen subjects does not exist.");

  const days = durationDaysFor(d.durationKind, d.customDays);
  const start = new Date(`${d.startDate}T00:00:00.000Z`);
  const end = new Date(start.getTime() + (days - 1) * DAY_MS);
  const weekdays = [...d.weekdays].sort((a, b) => a - b);

  await db.$transaction(async (tx) => {
    const base = {
      experience: d.experience,
      sessionMinutes: d.sessionMinutes,
      dailyStudyMinutes: d.dailyStudyMinutes,
      breakMinutes: d.breakMinutes,
      flexibility: d.flexibility,
      autoReschedule: d.autoReschedule,
      weekdays,
      startTime: d.startTime,
      timezone: d.timezone,
      durationKind: d.durationKind,
      durationDays: days,
      startDate: start,
      endDate: end,
    };
    const existing = await tx.learningPlan.findFirst({ where: { userId, status: "DRAFT" }, select: { id: true } });
    const plan = existing
      ? await tx.learningPlan.update({ where: { id: existing.id }, data: base })
      : await tx.learningPlan.create({ data: { ...base, userId, status: "DRAFT", draftKey: userId } });

    await tx.learningGoal.deleteMany({ where: { planId: plan.id } });
    await tx.learningGoal.createMany({
      data: d.goals.map((g) => ({ planId: plan.id, userId, departmentId: idByCode.get(g.departmentCode)!, weight: g.weight, targetLevel: g.targetLevel, note: g.note || null })),
    });
    // Baselines for subjects that were dropped (and never attempted) go away with them.
    await tx.baselineAssessment.deleteMany({ where: { planId: plan.id, status: { in: ["PENDING", "SKIPPED"] }, departmentId: { notIn: [...idByCode.values()] } } });
    await tx.profile.updateMany({ where: { userId, onboardingStatus: "NOT_STARTED" }, data: { onboardingStatus: "IN_PROGRESS" } });
  });
  return { ok: true };
}

async function draftWithGoal(userId: string, departmentCode: string) {
  return db.learningPlan.findFirst({
    where: { userId, status: "DRAFT", goals: { some: { department: { code: departmentCode } } } },
    select: { id: true },
  });
}

/**
 * Starts the baseline for one chosen subject: a normal mission (so it runs through the usual submit → evidence → assess
 * flow) that earns nothing. Subjects without a published baseline simply start at Level 0.
 */
export async function startBaseline(userId: string, departmentCode: string): Promise<Result<{ missionCode: string }>> {
  const mode = await requirePersonalised(userId);
  if (!mode.ok) return mode;
  const plan = await draftWithGoal(userId, departmentCode);
  if (!plan) return fail("Choose this subject in your goals first.");

  const mission = await db.mission.findFirst({
    where: { createdById: null, isPublished: true, role: "BASELINE", department: { code: departmentCode } },
    orderBy: { sortOrder: "asc" },
    select: { id: true, code: true, departmentId: true },
  });
  if (!mission?.code) return fail("There is no baseline for this subject yet. You will start at Level 0.");

  const existing = await db.baselineAssessment.findUnique({ where: { planId_departmentId: { planId: plan.id, departmentId: mission.departmentId } } });
  if (existing?.status === "ASSESSED") return fail("This baseline is already done.");

  if (!(await startMission(userId, mission.code))) return fail("This baseline is not available.");
  const lm = await db.learnerMission.findUniqueOrThrow({ where: { userId_missionId: { userId, missionId: mission.id } }, select: { id: true } });
  await db.baselineAssessment.upsert({
    where: { planId_departmentId: { planId: plan.id, departmentId: mission.departmentId } },
    update: { status: "PENDING", learnerMissionId: lm.id, missionId: mission.id },
    create: { planId: plan.id, userId, departmentId: mission.departmentId, missionId: mission.id, learnerMissionId: lm.id, status: "PENDING" },
  });
  return { ok: true, missionCode: mission.code };
}

/** The learner chooses not to take a baseline for a subject. Never overrides a finished baseline. */
export async function skipBaseline(userId: string, departmentCode: string): Promise<Result> {
  const mode = await requirePersonalised(userId);
  if (!mode.ok) return mode;
  const plan = await draftWithGoal(userId, departmentCode);
  if (!plan) return fail("Choose this subject in your goals first.");
  const department = await db.department.findUniqueOrThrow({ where: { code: departmentCode }, select: { id: true } });
  const mission = await db.mission.findFirst({ where: { createdById: null, role: "BASELINE", departmentId: department.id }, select: { id: true } });
  if (!mission) return { ok: true }; // nothing to skip: no baseline exists for this subject
  const existing = await db.baselineAssessment.findUnique({ where: { planId_departmentId: { planId: plan.id, departmentId: department.id } } });
  if (existing?.status === "ASSESSED") return fail("This baseline is already done.");
  await db.baselineAssessment.upsert({
    where: { planId_departmentId: { planId: plan.id, departmentId: department.id } },
    update: { status: "SKIPPED" },
    create: { planId: plan.id, userId, departmentId: department.id, missionId: mission.id, status: "SKIPPED" },
  });
  return { ok: true };
}

/** Marks onboarding complete. Needs a saved draft with at least one goal. */
export async function completeOnboarding(userId: string): Promise<Result> {
  const mode = await requirePersonalised(userId);
  if (!mode.ok) return mode;
  const plan = await db.learningPlan.findFirst({ where: { userId, status: "DRAFT" }, select: { timezone: true, _count: { select: { goals: true } } } });
  if (!plan || plan._count.goals === 0) return fail("Save your goals before finishing.");
  // Every personalised learner gets reminder settings here (not only when a plan is activated), so reminders can never depend
  // on an imported schedule. An existing row is never overwritten.
  await db.$transaction(async (tx) => {
    await ensureReminderSettings(tx, userId, plan.timezone);
    await tx.profile.update({ where: { userId }, data: { onboardingStatus: "COMPLETE" } });
  });
  return { ok: true };
}

/** Where a PERSONALISED learner who has not finished onboarding must go (null for everyone else). */
export async function onboardingRedirectFor(userId: string): Promise<"/onboarding" | null> {
  const profile = await db.profile.findUnique({ where: { userId }, select: { learnerMode: true, onboardingStatus: true } });
  return profile && profile.learnerMode === "PERSONALISED" && profile.onboardingStatus !== "COMPLETE" ? "/onboarding" : null;
}

/**
 * Called inside assessSubmission's transaction for a BASELINE mission: records the result as advisory placement on the
 * learner's baseline row. It never grants anything.
 */
export async function recordBaselineResult(tx: Prisma.TransactionClient, userId: string, learnerMissionId: string, percentage: number): Promise<void> {
  const row = await tx.baselineAssessment.findFirst({ where: { userId, learnerMissionId }, select: { id: true, departmentId: true } });
  if (!row) return; // a baseline taken outside onboarding has no plan to update
  const lessons = await tx.mission.findMany({ where: { createdById: null, isPublished: true, role: "LESSON", departmentId: row.departmentId }, select: { level: { select: { number: true } } } });
  const levels = lessons.map((m) => m.level?.number).filter((n): n is number => typeof n === "number");
  const placement = placementFromPercentage(percentage, levels);
  await tx.baselineAssessment.update({ where: { id: row.id }, data: { status: "ASSESSED", percentage, placementLevel: placement.level } });
}
