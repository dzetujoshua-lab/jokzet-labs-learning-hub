import { z } from "zod";
import { db } from "@/lib/db";
import { detectSecrets, secretMessage } from "@/lib/evidence/secrets";
import { LIMITS, bucketKey, rateLimitHit } from "@/lib/ratelimit";
import { localDateOf, localTimeOf } from "@/lib/schedule/time";
import { weekNumberOf } from "./capacity";
import { canMove, moveOptions, validateMove, type MoveContext, type MoveItem } from "./reschedule";
import { asDate, derivedDone, event, instantOf, iso, itemsWithState, loadPlan, perDayOf, Stop, type Result, type Tx } from "./service";

/**
 * Manual rescheduling of single sessions. Every move is validated by the pure rules in `reschedule.ts`, then validated AGAIN
 * inside a transaction that holds a lock on the plan, so two moves can never put two sessions in one seat. Each move leaves a
 * history row that keeps the original slot (date, session and start instant), who asked and why. The session keeps its identity
 * (same row, same mission link) and nothing the learner did is touched.
 */
type Rows = Awaited<ReturnType<typeof itemsWithState>>;
type PlanRow = NonNullable<Awaited<ReturnType<typeof loadPlan>>>;

const toMoveItem = (i: Rows[number]): MoveItem => ({
  id: i.id, date: iso(i.date), slotIndex: i.slotIndex, kind: i.kind, status: i.status, done: derivedDone(i), startsAt: i.startAt,
  departmentCode: i.department?.code ?? null, missionOrder: i.mission ? (i.mission.level?.number ?? 0) * 1000 + i.mission.sortOrder : null, stepFrom: i.stepFrom,
});

function contextFor(plan: PlanRow, rows: Rows, now: Date): MoveContext {
  return {
    items: rows.map(toMoveItem), weekdays: plan.weekdays, perDay: perDayOf(plan), planStart: iso(plan.startDate), planEnd: iso(plan.endDate),
    today: localDateOf(now, plan.timezone), now, instantOf: (d, s) => instantOf(plan, d, s),
  };
}

export type MoveOptionView = { date: string; slotIndex: number; time: string };

/** The allowed slots for each of the given sessions (read-only). Sessions that cannot move get no entry. */
export async function getMoveOptions(userId: string, itemIds: string[], now: Date = new Date()): Promise<Record<string, MoveOptionView[]>> {
  const plan = await loadPlan(db, userId, "ACTIVE");
  if (!plan || !itemIds.length) return {};
  const rows = await itemsWithState(userId, plan.id);
  const ctx = contextFor(plan, rows, now);
  const out: Record<string, MoveOptionView[]> = {};
  for (const id of itemIds) {
    const item = ctx.items.find((i) => i.id === id);
    if (!item || !canMove(item, ctx.today, now)) continue;
    out[id] = moveOptions(ctx, id).map((o) => ({ ...o, time: localTimeOf(ctx.instantOf(o.date, o.slotIndex), plan.timezone) }));
  }
  return out;
}

const moveSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  slotIndex: z.number().int().min(0).max(7),
  reason: z.string().trim().max(200).optional().default(""),
});
export type MoveInput = z.input<typeof moveSchema>;

export async function moveSession(userId: string, itemId: string, input: MoveInput, now: Date = new Date()): Promise<Result<{ from: { date: string; slotIndex: number }; to: { date: string; slotIndex: number } }>> {
  const parsed = moveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Choose one of the offered slots." };
  const { date, slotIndex, reason } = parsed.data;
  const secrets = detectSecrets(reason);
  if (secrets.length) return { ok: false, error: secretMessage(secrets) };
  const limit = await rateLimitHit(bucketKey("plan:move", userId), LIMITS.planMove);
  if (!limit.ok) return { ok: false, error: "Please slow down." };

  const plan = await loadPlan(db, userId, "ACTIVE");
  if (!plan) return { ok: false, error: "Your plan is not active. Resume it to move sessions." };

  try {
    return await db.$transaction(async (tx: Tx) => {
      await tx.$queryRaw`SELECT 1 FROM "LearningPlan" WHERE id = ${plan.id} FOR UPDATE`; // serialise moves on this plan
      const rows = await itemsWithState(userId, plan.id, tx);
      const ctx = contextFor(plan, rows, now);
      const check = validateMove(ctx, itemId, { date, slotIndex });
      if (!check.ok) throw new Stop(check.error);

      const item = rows.find((r) => r.id === itemId)!;
      const to = instantOf(plan, date, slotIndex);
      const phases = await tx.learningPlanPhase.findMany({ where: { planId: plan.id, userId }, orderBy: { position: "asc" } });
      const phase = phases.find((p) => iso(p.startDate) <= date && date <= iso(p.endDate)) ?? phases.find((p) => p.id === item.phaseId);
      await tx.learningPlanItem.update({ where: { id: item.id }, data: { date: asDate(date), slotIndex, startAt: to, weekNumber: weekNumberOf(date, iso(plan.startDate)), phaseId: phase?.id ?? item.phaseId } });
      await event(tx, plan.id, userId, "RESCHEDULED", {
        itemId: item.id, fromDate: iso(item.date), toDate: date, fromSlotIndex: item.slotIndex, toSlotIndex: slotIndex, fromStartAt: item.startAt, toStartAt: to, actor: "LEARNER", reason: reason || undefined,
      });

      // Reminders follow the new time: anything already queued for the old time is withdrawn so the right ones are created later.
      await tx.notification.deleteMany({ where: { userId, planItemId: item.id, readAt: null } });

      // Keep the mission's own "scheduled for" date (shown on the board) in step with its earliest remaining session.
      if (item.learnerMissionId) {
        const live = (await itemsWithState(userId, plan.id, tx)).filter((r) => r.learnerMissionId === item.learnerMissionId && r.status === "PLANNED" && !derivedDone(r) && r.kind !== "PRACTICE" && r.kind !== "REVIEW");
        const first = live.map((r) => iso(r.date)).sort()[0];
        if (first) await tx.learnerMission.updateMany({ where: { id: item.learnerMissionId, userId, status: "NOT_STARTED" }, data: { scheduledFor: asDate(first) } });
      }
      return { ok: true as const, from: { date: iso(item.date), slotIndex: item.slotIndex }, to: { date, slotIndex } };
    });
  } catch (e) {
    if (e instanceof Stop) return { ok: false, error: e.message };
    throw e;
  }
}
