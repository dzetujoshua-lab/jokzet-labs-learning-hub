import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { LIMITS, bucketKey, rateLimitHit } from "@/lib/ratelimit";
import { addDaysISO, localDateOf, startInstant } from "@/lib/schedule/time";
import { daysBetween, slotDates, weekNumberOf } from "./capacity";
import { loadCatalog } from "./catalog";
import { generatePlan, GENERATOR_VERSION, inputHashOf, type DraftItem, type DraftPhase, type GenerateInput, type PlanDraft, type PlanSummary } from "./generate";
import { itemDone, rebalance, type RebalanceItem } from "./rebalance";
import { goalsSchema, type GoalsInput } from "./schema";

/**
 * The plan service. Every function takes the signed-in user's id first and filters by it; ids from the client are never
 * trusted. IMPORTANT: nothing in this file awards anything. It never touches XP, skills or a mission's status: credit
 * comes only from the assessment pipeline.
 */
export type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };
const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });
class Stop extends Error {}

const MAX_ITEMS = 1200;
const asDate = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const iso = (d: Date) => d.toISOString().slice(0, 10);
type Tx = Prisma.TransactionClient;

type PlanRow = NonNullable<Awaited<ReturnType<typeof loadPlan>>>;
async function loadPlan(client: Tx | typeof db, userId: string, status: "DRAFT" | "ACTIVE" | "PAUSED") {
  return client.learningPlan.findFirst({
    where: { userId, status },
    include: { goals: { include: { department: { select: { code: true, sortOrder: true } } } } },
  });
}
const goalsOf = (plan: PlanRow) =>
  [...plan.goals].sort((a, b) => a.department.sortOrder - b.department.sortOrder).map((g) => ({ departmentCode: g.department.code, weight: g.weight, targetLevel: g.targetLevel, note: g.note ?? "" }));

async function requirePersonalised(userId: string): Promise<Result> {
  const profile = await db.profile.findUnique({ where: { userId }, select: { learnerMode: true } });
  if (!profile) return fail("Profile not found.");
  if (profile.learnerMode !== "PERSONALISED") return fail("Plans are not available for this account.");
  return { ok: true };
}

/** Everything the generator needs, read for one learner. */
async function buildInput(
  client: Tx | typeof db, userId: string,
  plan: { experience: GenerateInput["experience"]; sessionMinutes: number; weekdays: number[]; startTime: string; timezone: string },
  goals: { departmentCode: string; weight: number; targetLevel: number }[],
  startDate: string, durationDays: number,
): Promise<{ input: GenerateInput }> {
  const { catalog, catalogVersion } = await loadCatalog();
  const [passedRows, baselines] = await Promise.all([
    client.learnerMission.findMany({ where: { userId, status: "PASSED" }, select: { missionId: true } }),
    client.baselineAssessment.findMany({ where: { userId }, orderBy: { updatedAt: "desc" }, select: { status: true, placementLevel: true, department: { select: { code: true } } } }),
  ]);
  const placement: Record<string, number> = {};
  const settled = new Set<string>();
  for (const b of baselines) {
    const code = b.department.code;
    if (b.status === "ASSESSED" || b.status === "SKIPPED") settled.add(code);
    if (b.status === "ASSESSED" && b.placementLevel !== null && placement[code] === undefined) placement[code] = b.placementLevel;
  }
  return {
    input: {
      timezone: plan.timezone, startDate, durationDays, experience: plan.experience, sessionMinutes: plan.sessionMinutes, weekdays: [...plan.weekdays].sort((a, b) => a - b),
      startTime: plan.startTime, goals: goals.map((g) => ({ departmentCode: g.departmentCode, weight: g.weight, targetLevel: g.targetLevel })), placement,
      baselinePending: goals.map((g) => g.departmentCode).filter((c) => !settled.has(c)), catalog, catalogVersion, passed: passedRows.map((p) => p.missionId),
    },
  };
}

/** Writes a draft's phases and items under a plan (the plan row itself is updated by the caller). */
async function storeDraft(tx: Tx, planId: string, userId: string, draft: PlanDraft, catalogDepartments: Map<string, string>) {
  const phaseIds: string[] = [];
  for (const p of draft.phases as DraftPhase[]) {
    const row = await tx.learningPlanPhase.create({ data: { planId, userId, position: p.position, kind: p.kind, title: p.title, objective: p.objective, startDate: asDate(p.startDate), endDate: asDate(p.endDate) }, select: { id: true } });
    phaseIds.push(row.id);
  }
  await tx.learningPlanItem.createMany({
    data: draft.items.map((i: DraftItem) => ({
      planId, userId, phaseId: phaseIds[i.phaseIndex], date: asDate(i.date), startAt: i.startAt, position: i.position, kind: i.kind, minutes: i.minutes, title: i.title, objective: i.objective,
      weekNumber: i.weekNumber, departmentId: i.departmentCode ? (catalogDepartments.get(i.departmentCode) ?? null) : null,
      missionId: i.missionId, stepFrom: i.stepFrom, stepTo: i.stepTo, continuesPrev: i.continuesPrev,
    })),
  });
}
async function departmentIds(client: Tx | typeof db): Promise<Map<string, string>> {
  return new Map((await client.department.findMany({ select: { id: true, code: true } })).map((d) => [d.code, d.id]));
}

/** Gives every curriculum mission a plan item points at a LearnerMission (NOT_STARTED, no credit) and links the items to it. */
async function linkLearnerMissions(tx: Tx, userId: string, planId: string) {
  const items = await tx.learningPlanItem.findMany({ where: { planId, userId, kind: { in: ["TEACHING", "CHECKPOINT", "BASELINE", "CATCH_UP"] }, missionId: { not: null } }, select: { missionId: true, date: true }, orderBy: { date: "asc" } });
  const first = new Map<string, Date>();
  for (const i of items) if (!first.has(i.missionId!)) first.set(i.missionId!, i.date);
  if (first.size) await tx.learnerMission.createMany({ data: [...first].map(([missionId, scheduledFor]) => ({ userId, missionId, scheduledFor })), skipDuplicates: true });
  const lms = await tx.learnerMission.findMany({ where: { userId, missionId: { in: [...first.keys()] } }, select: { id: true, missionId: true } });
  for (const lm of lms) await tx.learningPlanItem.updateMany({ where: { planId, userId, missionId: lm.missionId }, data: { learnerMissionId: lm.id } });
}

const event = (tx: Tx, planId: string, userId: string, type: Prisma.LearningPlanEventUncheckedCreateInput["type"], extra: { itemId?: string; fromDate?: string; toDate?: string; note?: string } = {}) =>
  tx.learningPlanEvent.create({ data: { planId, userId, type, itemId: extra.itemId, fromDate: extra.fromDate ? asDate(extra.fromDate) : undefined, toDate: extra.toDate ? asDate(extra.toDate) : undefined, note: extra.note } });

// ───────────────────────── generate ─────────────────────────

/**
 * Builds (or refreshes) the schedule on the learner's DRAFT plan. Idempotent: if nothing that matters changed (the hash covers
 * the answers, the baseline results, what is already passed and the catalogue version) the stored plan is returned as it is.
 */
export async function generateDraft(userId: string): Promise<Result<{ planId: string; summary: PlanSummary; unchanged: boolean }>> {
  const mode = await requirePersonalised(userId);
  if (!mode.ok) return mode;
  const limit = await rateLimitHit(bucketKey("plan:generate", userId), LIMITS.planGenerate);
  if (!limit.ok) return fail("Please wait a little before generating again.");

  const plan = await loadPlan(db, userId, "DRAFT");
  if (!plan) return fail("Finish onboarding first: there is no draft plan to build.");
  if (!plan.goals.length) return fail("Choose at least one subject first.");

  const { input } = await buildInput(db, userId, plan, goalsOf(plan), iso(plan.startDate), plan.durationDays);
  const hash = inputHashOf(input);
  const existingItems = await db.learningPlanItem.count({ where: { planId: plan.id, userId } });
  if (existingItems > 0 && plan.inputHash === hash && plan.summary) return { ok: true, planId: plan.id, summary: plan.summary as unknown as PlanSummary, unchanged: true };

  const result = generatePlan(input);
  if (!result.ok) return fail(result.error);
  if (result.draft.items.length > MAX_ITEMS) return fail("This plan is too large. Choose a shorter duration.");
  const depts = await departmentIds(db);

  await db.$transaction(async (tx) => {
    await tx.learningPlanPhase.deleteMany({ where: { planId: plan.id, userId } }); // items go with their phases
    await storeDraft(tx, plan.id, userId, result.draft, depts);
    await tx.learningPlan.update({ where: { id: plan.id }, data: { inputHash: result.draft.inputHash, catalogVersion: input.catalogVersion, generatorVersion: GENERATOR_VERSION, summary: result.draft.summary as unknown as Prisma.InputJsonValue } });
    await event(tx, plan.id, userId, "GENERATED", { note: `${result.draft.items.length} sessions` });
  });
  return { ok: true, planId: plan.id, summary: result.draft.summary, unchanged: false };
}

// ───────────────────────── activate ─────────────────────────

/** Creates the learner's reminder settings if they have none (the live time zone is ReminderSettings.timezone). */
export async function ensureReminderSettings(tx: Tx, userId: string, timezone: string) {
  const existing = await tx.reminderSettings.findUnique({ where: { userId } });
  if (existing) return existing;
  return tx.reminderSettings.create({ data: { userId, timezone } });
}

/** Turns the generated draft into the learner's one active plan. Starts reminders; never grants anything. */
export async function activatePlan(userId: string): Promise<Result<{ planId: string }>> {
  const mode = await requirePersonalised(userId);
  if (!mode.ok) return mode;
  try {
    return await db.$transaction(async (tx): Promise<Result<{ planId: string }>> => {
      const plan = await loadPlan(tx, userId, "DRAFT");
      if (!plan) throw new Stop("There is no draft plan to activate.");
      if ((await tx.learningPlanItem.count({ where: { planId: plan.id, userId } })) === 0) throw new Stop("Generate your plan first.");
      if (await tx.learningPlan.findFirst({ where: { userId, status: "ACTIVE" }, select: { id: true } })) throw new Stop("You already have an active plan.");

      // The live time zone is the reminder settings'; the plan keeps a snapshot, and its reminder instants follow it.
      const settings = await ensureReminderSettings(tx, userId, plan.timezone);
      if (settings.timezone !== plan.timezone) {
        const items = await tx.learningPlanItem.findMany({ where: { planId: plan.id, userId }, select: { id: true, date: true } });
        for (const i of items) await tx.learningPlanItem.update({ where: { id: i.id }, data: { startAt: startInstant(iso(i.date), plan.startTime, settings.timezone) } });
      }
      await tx.scheduleConfig.updateMany({ where: { userId, isActive: true }, data: { isActive: false } }); // one reminder source at a time
      await linkLearnerMissions(tx, userId, plan.id);
      await tx.learningPlan.update({ where: { id: plan.id }, data: { status: "ACTIVE", draftKey: null, activeKey: userId, activatedAt: new Date(), timezone: settings.timezone } });
      await event(tx, plan.id, userId, "ACTIVATED");
      return { ok: true, planId: plan.id };
    });
  } catch (e) {
    if (e instanceof Stop) return fail(e.message);
    throw e;
  }
}

// ───────────────────────── view ─────────────────────────

export type PlanItemView = {
  id: string; date: string; kind: string; status: string; minutes: number; title: string; objective: string; weekNumber: number; departmentCode: string | null;
  missionCode: string | null; stepFrom: number | null; stepTo: number | null; continuesPrev: boolean; practised: boolean; done: boolean; rescheduledFromId: string | null;
};
export type PlanView = {
  id: string; status: string; startDate: string; endDate: string; timezone: string; sessionMinutes: number; weekdays: number[]; startTime: string; summary: PlanSummary | null;
  phases: { position: number; kind: string; title: string; startDate: string; endDate: string }[];
  items: PlanItemView[]; today: PlanItemView[]; catalogOutdated: boolean;
};

async function itemsWithState(userId: string, planId: string) {
  return db.learningPlanItem.findMany({
    where: { planId, userId },
    orderBy: [{ date: "asc" }, { position: "asc" }],
    include: {
      department: { select: { code: true } },
      mission: { select: { code: true, steps: { select: { id: true, position: true } } } },
      learnerMission: { select: { status: true, completedSteps: true, _count: { select: { submissions: true } } } },
    },
  });
}
const derivedDone = (i: Awaited<ReturnType<typeof itemsWithState>>[number]) =>
  itemDone(i, i.learnerMission ? { status: i.learnerMission.status, completedSteps: i.learnerMission.completedSteps, hasSubmission: i.learnerMission._count.submissions > 0, steps: i.mission?.steps ?? [] } : null);

/** The learner's plan (active, else paused, else draft). "Done" is derived from their mission, never stored. */
export async function getPlanView(userId: string, now: Date = new Date()): Promise<PlanView | null> {
  const plan = (await loadPlan(db, userId, "ACTIVE")) ?? (await loadPlan(db, userId, "PAUSED")) ?? (await loadPlan(db, userId, "DRAFT"));
  if (!plan) return null;
  const [phases, rows, { catalogVersion }] = await Promise.all([
    db.learningPlanPhase.findMany({ where: { planId: plan.id, userId }, orderBy: { position: "asc" } }),
    itemsWithState(userId, plan.id),
    loadCatalog(),
  ]);
  const today = localDateOf(now, plan.timezone);
  const items: PlanItemView[] = rows.map((i) => ({
    id: i.id, date: iso(i.date), kind: i.kind, status: i.status, minutes: i.minutes, title: i.title, objective: i.objective, weekNumber: i.weekNumber, departmentCode: i.department?.code ?? null,
    missionCode: i.mission?.code ?? null, stepFrom: i.stepFrom, stepTo: i.stepTo, continuesPrev: i.continuesPrev, practised: i.practisedAt !== null, done: derivedDone(i), rescheduledFromId: i.rescheduledFromId,
  }));
  return {
    id: plan.id, status: plan.status, startDate: iso(plan.startDate), endDate: iso(plan.endDate), timezone: plan.timezone, sessionMinutes: plan.sessionMinutes, weekdays: plan.weekdays, startTime: plan.startTime,
    summary: (plan.summary as unknown as PlanSummary) ?? null,
    phases: phases.map((p) => ({ position: p.position, kind: p.kind, title: p.title, startDate: iso(p.startDate), endDate: iso(p.endDate) })),
    items, today: items.filter((i) => i.date === today && i.status === "PLANNED"), catalogOutdated: !!plan.catalogVersion && plan.catalogVersion !== catalogVersion,
  };
}

/** The one thing a learner can change on a session: tick that they practised (only on the day, only practice, never counted). */
export async function markPractised(userId: string, itemId: string, now: Date = new Date()): Promise<Result> {
  const item = await db.learningPlanItem.findFirst({ where: { id: itemId, userId }, include: { plan: { select: { status: true, timezone: true } } } });
  if (!item || item.kind !== "PRACTICE") return fail("Nothing to tick here.");
  if (item.plan.status !== "ACTIVE" || item.status !== "PLANNED") return fail("This session is not active.");
  if (iso(item.date) !== localDateOf(now, item.plan.timezone)) return fail("You can tick practice on the day it is planned.");
  await db.learningPlanItem.update({ where: { id: item.id }, data: { practisedAt: now } });
  return { ok: true };
}

// ───────────────────────── missed sessions ─────────────────────────

/**
 * Marks past sessions the learner did not do as MISSED and adds catch-up sessions in the next free slots. Idempotent. Items
 * dated before today are never edited except PLANNED to MISSED; teaching work is never dropped, practice then review make
 * room first. Only an ACTIVE plan is reconciled.
 */
export async function reconcilePlan(userId: string, now: Date = new Date()): Promise<Result<{ missed: number; catchUps: number; shortfall: number }>> {
  const plan = await loadPlan(db, userId, "ACTIVE");
  if (!plan) return { ok: true, missed: 0, catchUps: 0, shortfall: 0 };
  const today = localDateOf(now, plan.timezone);
  const rows = await itemsWithState(userId, plan.id);
  const slots = slotDates(iso(plan.startDate), plan.durationDays, plan.weekdays);
  const input: RebalanceItem[] = rows.map((i) => ({ id: i.id, date: iso(i.date), position: i.position, kind: i.kind, status: i.status, rescheduledFromId: i.rescheduledFromId, done: derivedDone(i) }));
  const r = rebalance({ items: input, today, slots });
  if (!r.markMissed.length && !r.catchUps.length && !r.cancel.length) return { ok: true, missed: 0, catchUps: 0, shortfall: r.shortfall.length };

  const phases = await db.learningPlanPhase.findMany({ where: { planId: plan.id, userId }, orderBy: { position: "asc" } });
  const byId = new Map(rows.map((i) => [i.id, i]));
  await db.$transaction(async (tx) => {
    let position = Math.max(0, ...rows.map((i) => i.position));
    for (const id of r.markMissed) {
      const { count } = await tx.learningPlanItem.updateMany({ where: { id, userId, status: "PLANNED" }, data: { status: "MISSED" } });
      if (count) await event(tx, plan.id, userId, "MISSED", { itemId: id, fromDate: iso(byId.get(id)!.date) });
    }
    for (const id of r.cancel) await tx.learningPlanItem.updateMany({ where: { id, userId, status: "PLANNED", kind: { in: ["PRACTICE", "REVIEW"] } }, data: { status: "CANCELLED" } });
    for (const c of r.catchUps) {
      const m = byId.get(c.rescheduledFromId)!;
      const phase = phases.find((p) => iso(p.startDate) <= c.date && c.date <= iso(p.endDate)) ?? phases[phases.length - 1];
      position += 1;
      const created = await tx.learningPlanItem.create({
        data: {
          planId: plan.id, userId, phaseId: phase.id, date: asDate(c.date), startAt: startInstant(c.date, plan.startTime, plan.timezone), position, kind: "CATCH_UP", minutes: m.minutes,
          title: m.title.startsWith("Catch-up: ") ? m.title : `Catch-up: ${m.title}`, objective: m.objective, weekNumber: weekNumberOf(c.date, iso(plan.startDate)), departmentId: m.departmentId,
          missionId: m.missionId, learnerMissionId: m.learnerMissionId, stepFrom: m.stepFrom, stepTo: m.stepTo, continuesPrev: m.continuesPrev, rescheduledFromId: m.id,
        },
      });
      await event(tx, plan.id, userId, "CATCH_UP_CREATED", { itemId: created.id, fromDate: iso(m.date), toDate: c.date });
    }
  });
  return { ok: true, missed: r.markMissed.length, catchUps: r.catchUps.length, shortfall: r.shortfall.length };
}

// ───────────────────────── pause / resume ─────────────────────────

export async function pausePlan(userId: string, now: Date = new Date()): Promise<Result> {
  const limit = await rateLimitHit(bucketKey("plan:change", userId), LIMITS.planChange);
  if (!limit.ok) return fail("Please slow down.");
  const plan = await loadPlan(db, userId, "ACTIVE");
  if (!plan) return fail("You have no active plan.");
  await db.$transaction(async (tx) => {
    await tx.learningPlan.update({ where: { id: plan.id }, data: { status: "PAUSED", activeKey: null, pausedAt: now } });
    await event(tx, plan.id, userId, "PAUSED");
  });
  return { ok: true };
}

/**
 * Resumes a paused plan. Sessions that were still to do from the day it was paused move to the next study days, in the same
 * order (nothing is marked missed for the time it was paused); the plan's end moves with them. Earlier sessions are untouched.
 */
export async function resumePlan(userId: string, now: Date = new Date()): Promise<Result<{ moved: number }>> {
  const limit = await rateLimitHit(bucketKey("plan:change", userId), LIMITS.planChange);
  if (!limit.ok) return fail("Please slow down.");
  try {
    return await db.$transaction(async (tx): Promise<Result<{ moved: number }>> => {
      const plan = await loadPlan(tx, userId, "PAUSED");
      if (!plan) throw new Stop("You have no paused plan.");
      if (await tx.learningPlan.findFirst({ where: { userId, status: "ACTIVE" }, select: { id: true } })) throw new Stop("You already have an active plan.");
      const today = localDateOf(now, plan.timezone);
      const pausedOn = plan.pausedAt ? localDateOf(plan.pausedAt, plan.timezone) : today;
      const rows = await tx.learningPlanItem.findMany({ where: { planId: plan.id, userId, status: "PLANNED", date: { gte: asDate(pausedOn) } }, orderBy: [{ date: "asc" }, { position: "asc" }] });
      let moved = 0;
      if (rows.length) {
        const span = Math.max(14, rows.length * 7 + 14);
        const newSlots = slotDates(today, span, plan.weekdays).slice(0, rows.length);
        if (newSlots.length < rows.length) throw new Stop("Could not find room for the remaining sessions.");
        for (const [k, row] of rows.entries()) {
          const date = newSlots[k];
          if (date === iso(row.date)) continue;
          await tx.learningPlanItem.update({ where: { id: row.id }, data: { date: asDate(date), startAt: startInstant(date, plan.startTime, plan.timezone), weekNumber: weekNumberOf(date, iso(plan.startDate)) } });
          moved += 1;
        }
        const last = newSlots[newSlots.length - 1];
        if (last > iso(plan.endDate)) await tx.learningPlan.update({ where: { id: plan.id }, data: { endDate: asDate(last), durationDays: daysBetween(iso(plan.startDate), last) + 1 } });
        // Keep every phase's dates in step with its sessions.
        for (const phase of await tx.learningPlanPhase.findMany({ where: { planId: plan.id, userId } })) {
          const dates = (await tx.learningPlanItem.findMany({ where: { phaseId: phase.id, userId }, select: { date: true } })).map((d) => iso(d.date)).sort();
          if (dates.length) await tx.learningPlanPhase.update({ where: { id: phase.id }, data: { startDate: asDate(dates[0]), endDate: asDate(dates[dates.length - 1]) } });
        }
      }
      await tx.learningPlan.update({ where: { id: plan.id }, data: { status: "ACTIVE", activeKey: userId, pausedAt: null } });
      await event(tx, plan.id, userId, "RESUMED", { note: `${moved} sessions moved` });
      return { ok: true, moved };
    });
  } catch (e) {
    if (e instanceof Stop) return fail(e.message);
    throw e;
  }
}

// ───────────────────────── extend / change subjects ─────────────────────────

/**
 * Builds a new version of the active plan from today: the old plan becomes SUPERSEDED (its history stays), its future
 * sessions are cancelled, and the new plan is generated for the remaining days plus any extension. XP, skills, passed
 * missions and progress are never altered.
 */
async function successor(userId: string, now: Date, kind: "EXTENDED" | "SUBJECTS_CHANGED", opts: { extraDays: number; goals?: GoalsInput }): Promise<Result<{ planId: string; released: number }>> {
  const mode = await requirePersonalised(userId);
  if (!mode.ok) return mode;
  const limit = await rateLimitHit(bucketKey("plan:change", userId), LIMITS.planChange);
  if (!limit.ok) return fail("Please slow down.");
  let newGoals: ReturnType<typeof goalsOf> | null = null;
  if (opts.goals) {
    const parsed = goalsSchema.safeParse(opts.goals);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check your subjects and try again.");
    const known = new Set((await db.department.findMany({ select: { code: true } })).map((d) => d.code));
    if (parsed.data.some((g) => !known.has(g.departmentCode))) return fail("One of the chosen subjects does not exist.");
    newGoals = parsed.data.map((g) => ({ departmentCode: g.departmentCode, weight: g.weight, targetLevel: g.targetLevel, note: g.note ?? "" }));
  }

  try {
    return await db.$transaction(async (tx): Promise<Result<{ planId: string; released: number }>> => {
      const old = await loadPlan(tx, userId, "ACTIVE");
      if (!old) throw new Stop("You have no active plan.");
      const today = localDateOf(now, old.timezone);
      const remaining = Math.max(0, daysBetween(today, iso(old.endDate)) + 1);
      const durationDays = remaining + opts.extraDays;
      if (durationDays < 7 || durationDays > 730) throw new Stop("A plan must be between 7 and 730 days.");
      const goals = newGoals ?? goalsOf(old);
      const departments = await departmentIds(tx);
      const goalDepts = new Set(goals.map((g) => g.departmentCode));

      const { input } = await buildInput(tx, userId, old, goals, today, durationDays);
      const result = generatePlan(input);
      if (!result.ok) throw new Stop(result.error);
      if (result.draft.items.length > MAX_ITEMS) throw new Stop("This plan is too large. Choose a shorter duration.");

      // Subjects that were dropped: untouched, not-yet-started work is released; anything the learner has touched is kept.
      let released = 0;
      if (newGoals) {
        const dropped = goalsOf(old).filter((g) => !goalDepts.has(g.departmentCode)).map((g) => g.departmentCode);
        if (dropped.length) {
          const future = await tx.learningPlanItem.findMany({
            where: { planId: old.id, userId, status: "PLANNED", date: { gte: asDate(today) }, learnerMissionId: { not: null }, department: { code: { in: dropped } } },
            select: { learnerMissionId: true },
          });
          for (const lmId of [...new Set(future.map((f) => f.learnerMissionId!))]) {
            const lm = await tx.learnerMission.findFirst({ where: { id: lmId, userId }, include: { _count: { select: { submissions: true } } } });
            if (!lm) continue;
            const touched = lm.status !== "NOT_STARTED" || lm._count.submissions > 0 || lm.completedSteps.length > 0 || !!lm.notes || lm.minutesSpent > 0 || lm.xpAwarded > 0
              || (await tx.evidenceItem.count({ where: { userId, missionId: lm.missionId } })) > 0;
            const elsewhere = await tx.learningPlanItem.count({ where: { userId, learnerMissionId: lm.id, NOT: { planId: old.id, status: "PLANNED", date: { gte: asDate(today) } } } });
            if (touched || elsewhere > 0) continue;
            await tx.learningPlanItem.deleteMany({ where: { planId: old.id, userId, learnerMissionId: lm.id } });
            await tx.learnerMission.delete({ where: { id: lm.id } });
            released += 1;
          }
          if (released) await event(tx, old.id, userId, "ITEMS_RELEASED", { note: `${released} untouched missions released` });
        }
      }

      await tx.learningPlanItem.updateMany({ where: { planId: old.id, userId, status: "PLANNED", date: { gte: asDate(today) } }, data: { status: "CANCELLED" } });
      await tx.learningPlan.update({ where: { id: old.id }, data: { status: "SUPERSEDED", activeKey: null, supersededAt: now } });

      const created = await tx.learningPlan.create({
        data: {
          userId, status: "ACTIVE", activeKey: userId, parentPlanId: old.id, durationKind: "CUSTOM", durationDays, startDate: asDate(today), endDate: asDate(addDaysISO(today, durationDays - 1)), timezone: old.timezone,
          experience: old.experience, sessionMinutes: old.sessionMinutes, weekdays: old.weekdays, startTime: old.startTime, generatorVersion: GENERATOR_VERSION, catalogVersion: input.catalogVersion,
          inputHash: result.draft.inputHash, summary: result.draft.summary as unknown as Prisma.InputJsonValue, activatedAt: now,
        },
      });
      await tx.learningGoal.createMany({
        data: goals.map((g) => ({ planId: created.id, userId, departmentId: departments.get(g.departmentCode)!, weight: g.weight, targetLevel: g.targetLevel, note: g.note || null })),
      });
      await storeDraft(tx, created.id, userId, result.draft, departments);
      await linkLearnerMissions(tx, userId, created.id);
      await event(tx, created.id, userId, "GENERATED", { note: `${result.draft.items.length} sessions` });
      await event(tx, created.id, userId, kind, { fromDate: iso(old.endDate), toDate: iso(created.endDate) });
      return { ok: true, planId: created.id, released };
    });
  } catch (e) {
    if (e instanceof Stop) return fail(e.message);
    throw e;
  }
}

export const extendPlan = (userId: string, extraDays: number, now: Date = new Date()) =>
  Number.isInteger(extraDays) && extraDays >= 7 && extraDays <= 365 ? successor(userId, now, "EXTENDED", { extraDays }) : Promise.resolve(fail("Extend by 7 to 365 days."));

export const changeSubjects = (userId: string, goals: GoalsInput, now: Date = new Date()) => successor(userId, now, "SUBJECTS_CHANGED", { extraDays: 0, goals });

// ───────────────────────── reminders: time zone or time changed ─────────────────────────

/** Recomputes the reminder instant of every future planned session after the learner's time zone changes. */
export async function recomputePlanItemInstants(userId: string, timezone: string, now: Date = new Date()): Promise<number> {
  const plan = await loadPlan(db, userId, "ACTIVE");
  if (!plan) return 0;
  const today = localDateOf(now, timezone);
  const rows = await db.learningPlanItem.findMany({ where: { planId: plan.id, userId, status: "PLANNED", date: { gte: asDate(today) } }, select: { id: true, date: true } });
  await db.$transaction(async (tx) => {
    for (const r of rows) await tx.learningPlanItem.update({ where: { id: r.id }, data: { startAt: startInstant(iso(r.date), plan.startTime, timezone) } });
    await tx.learningPlan.update({ where: { id: plan.id }, data: { timezone } });
  });
  return rows.length;
}
