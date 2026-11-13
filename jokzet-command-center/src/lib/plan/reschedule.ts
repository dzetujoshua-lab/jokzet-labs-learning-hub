import { addDaysISO, weekdayOf } from "@/lib/schedule/time";

/**
 * Manual rescheduling of ONE future session. Pure: it decides whether a proposed new slot is allowed and lists the slots that
 * are. The rules (all of them must hold):
 *  - only a session that is still PLANNED, not done, and has not started can move (the past is never rewritten);
 *  - the new slot is a real seat: inside the plan, on a study day the learner chose, within the sessions-per-day capacity, and
 *    in the future;
 *  - the seat is free (two live sessions never share a seat);
 *  - curriculum order is respected: a session never jumps ahead of work in its subject that must come first (an earlier
 *    mission, or an earlier step of the same mission), and a move may not create an ordering problem that did not already exist.
 */
export type MoveItem = {
  id: string;
  date: string; // local ISO date
  slotIndex: number;
  kind: "TEACHING" | "BASELINE" | "CHECKPOINT" | "PRACTICE" | "REVIEW" | "CATCH_UP";
  status: "PLANNED" | "MISSED" | "CANCELLED";
  done: boolean; // derived from the learner's own work
  startsAt: Date;
  departmentCode: string | null;
  missionOrder: number | null; // position of its mission in the subject's curriculum (level, then sort order)
  stepFrom: number | null;
};

export type MoveContext = {
  items: MoveItem[];
  weekdays: number[];
  perDay: number;
  planStart: string;
  planEnd: string;
  today: string;
  now: Date;
  instantOf: (date: string, slotIndex: number) => Date;
};
export type MoveTarget = { date: string; slotIndex: number };

export type MoveCode = "NOT_FOUND" | "NOT_MOVABLE" | "SAME" | "OUTSIDE_PLAN" | "NOT_STUDY_DAY" | "BAD_SLOT" | "PAST" | "OCCUPIED" | "ORDER";
export type MoveCheck = { ok: true } | { ok: false; code: MoveCode; error: string };
const no = (code: MoveCode, error: string): MoveCheck => ({ ok: false, code, error });

const ORDERED_KINDS = new Set(["TEACHING", "CATCH_UP", "CHECKPOINT"]);
const place = (i: { date: string; slotIndex: number }) => `${i.date}#${i.slotIndex}`;
const keyOf = (i: MoveItem): [number, number] => [i.missionOrder ?? 0, i.stepFrom ?? Number.MAX_SAFE_INTEGER];
const cmpKey = (a: [number, number], b: [number, number]) => a[0] - b[0] || a[1] - b[1];

/** Pairs (a, b) where a must come before b in the curriculum but is placed after it. */
function orderViolations(items: { id: string; date: string; slotIndex: number; item: MoveItem }[]): Set<string> {
  const out = new Set<string>();
  for (const a of items) {
    for (const b of items) {
      if (a.id === b.id) continue;
      if (cmpKey(keyOf(a.item), keyOf(b.item)) < 0 && place(a) > place(b)) out.add(`${a.id}|${b.id}`);
    }
  }
  return out;
}

export function validateMove(ctx: MoveContext, itemId: string, target: MoveTarget): MoveCheck {
  const item = ctx.items.find((i) => i.id === itemId);
  if (!item) return no("NOT_FOUND", "That session was not found.");
  if (item.status !== "PLANNED" || item.done) return no("NOT_MOVABLE", item.done ? "A session you have already done cannot be moved." : "Only upcoming sessions can be moved.");
  if (item.date < ctx.today || item.startsAt.getTime() <= ctx.now.getTime()) return no("NOT_MOVABLE", "A session that has started or passed cannot be moved.");
  if (target.date === item.date && target.slotIndex === item.slotIndex) return no("SAME", "That is where the session already is.");

  if (target.date < ctx.planStart || target.date > ctx.planEnd) return no("OUTSIDE_PLAN", "Choose a day inside your plan.");
  if (!ctx.weekdays.includes(weekdayOf(target.date))) return no("NOT_STUDY_DAY", "That is not one of your study days.");
  if (!Number.isInteger(target.slotIndex) || target.slotIndex < 0 || target.slotIndex >= ctx.perDay) return no("BAD_SLOT", "That time of day is not part of your timetable.");
  if (target.date < ctx.today || ctx.instantOf(target.date, target.slotIndex).getTime() <= ctx.now.getTime()) return no("PAST", "Choose a time in the future.");

  if (ctx.items.some((i) => i.id !== item.id && i.status !== "CANCELLED" && i.date === target.date && i.slotIndex === target.slotIndex)) return no("OCCUPIED", "Another session is already in that slot.");

  // Curriculum order within the subject: no NEW ordering problem may appear.
  if (item.departmentCode && ORDERED_KINDS.has(item.kind) && item.missionOrder !== null) {
    const peers = ctx.items.filter((i) => i.status === "PLANNED" && !i.done && i.departmentCode === item.departmentCode && ORDERED_KINDS.has(i.kind) && i.missionOrder !== null);
    const before = orderViolations(peers.map((i) => ({ id: i.id, date: i.date, slotIndex: i.slotIndex, item: i })));
    const after = orderViolations(peers.map((i) => ({ id: i.id, date: i.id === item.id ? target.date : i.date, slotIndex: i.id === item.id ? target.slotIndex : i.slotIndex, item: i })));
    for (const v of after) if (!before.has(v)) return no("ORDER", "That would put this session ahead of work in the same subject that has to come first.");
  }
  return { ok: true };
}

export type MoveOption = { date: string; slotIndex: number };

/** The earliest allowed slots for a session (up to `limit`), in date then session order. */
export function moveOptions(ctx: MoveContext, itemId: string, limit = 12): MoveOption[] {
  const from = ctx.today > ctx.planStart ? ctx.today : ctx.planStart;
  const out: MoveOption[] = [];
  for (let d = from; d <= ctx.planEnd && out.length < limit; d = addDaysISO(d, 1)) {
    if (!ctx.weekdays.includes(weekdayOf(d))) continue;
    for (let slotIndex = 0; slotIndex < ctx.perDay && out.length < limit; slotIndex += 1) {
      if (validateMove(ctx, itemId, { date: d, slotIndex }).ok) out.push({ date: d, slotIndex });
    }
  }
  return out;
}

export const canMove = (item: Pick<MoveItem, "status" | "done" | "date" | "startsAt">, today: string, now: Date) =>
  item.status === "PLANNED" && !item.done && item.date >= today && item.startsAt.getTime() > now.getTime();
