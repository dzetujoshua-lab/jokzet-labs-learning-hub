import type { Seat } from "./availability";

/**
 * Missed sessions. Pure: given a plan's items and the learner's local today, it says what to mark MISSED, which catch-up
 * sessions to add and which low-value sessions they displace. It only ever looks at items dated today or later when placing
 * work; an item dated before today is never moved or edited (the only change a past item may get is PLANNED to MISSED).
 *
 * Teaching work is never dropped: practice goes first, then review. If there is no room left before the plan ends the
 * remainder is reported as shortfall (extending the plan is an explicit action, not something this function does).
 *
 * `autoCatchUp = false` is the learner saying "do not reschedule for me": sessions are still marked MISSED (that is a record
 * of what happened) but nothing is added or displaced.
 */
export type RebalanceItem = {
  id: string;
  date: string; // local ISO date
  slotIndex: number; // which session of the day (0 = first)
  position: number;
  kind: "TEACHING" | "BASELINE" | "CHECKPOINT" | "PRACTICE" | "REVIEW" | "CATCH_UP";
  status: "PLANNED" | "MISSED" | "CANCELLED";
  rescheduledFromId: string | null;
  done: boolean; // the learner did what this session asked (derived from their mission, never stored)
};

export type CatchUpDraft = { rescheduledFromId: string; date: string; slotIndex: number; displaces: string | null };
export type RebalanceResult = {
  markMissed: string[]; // PLANNED, dated before today, not done
  catchUps: CatchUpDraft[];
  cancel: string[]; // practice / review sessions displaced by a catch-up
  shortfall: string[]; // missed items that found no room before the plan ends
};

const TEACHING_LIKE = new Set(["TEACHING", "BASELINE", "CHECKPOINT", "CATCH_UP"]);
const seatKey = (date: string, index: number) => `${date}#${index}`;
const byDateThenIndex = (a: { date: string; slotIndex?: number; index?: number }, b: { date: string; slotIndex?: number; index?: number }) =>
  a.date < b.date ? -1 : a.date > b.date ? 1 : (a.slotIndex ?? a.index ?? 0) - (b.slotIndex ?? b.index ?? 0);

export function rebalance(input: { items: RebalanceItem[]; today: string; seats: Seat[]; autoCatchUp?: boolean }): RebalanceResult {
  const { items, today, seats } = input;
  const auto = input.autoCatchUp ?? true;
  const active = items.filter((i) => i.status !== "CANCELLED");
  const hasCatchUp = new Set(active.filter((i) => i.kind === "CATCH_UP" && i.rescheduledFromId).map((i) => i.rescheduledFromId as string));

  const past = active.filter((i) => i.date < today && TEACHING_LIKE.has(i.kind) && !i.done);
  const markMissed = past.filter((i) => i.status === "PLANNED").map((i) => i.id);
  if (!auto) return { markMissed, catchUps: [], cancel: [], shortfall: [] };

  const needsCatchUp = past
    .filter((i) => !hasCatchUp.has(i.id))
    .sort((a, b) => (a.date === b.date ? a.slotIndex - b.slotIndex || a.position - b.position : a.date < b.date ? -1 : 1));

  // Room: every seat from today on that is empty, or holds only a practice / review session that can give way.
  const bySeat = new Map<string, RebalanceItem[]>();
  for (const i of active) if (i.date >= today) bySeat.set(seatKey(i.date, i.slotIndex), [...(bySeat.get(seatKey(i.date, i.slotIndex)) ?? []), i]);
  const room: { date: string; index: number; displaces: string | null }[] = [];
  for (const seat of seats.filter((s) => s.date >= today)) {
    const here = bySeat.get(seatKey(seat.date, seat.index)) ?? [];
    if (!here.length) room.push({ date: seat.date, index: seat.index, displaces: null });
    else if (here.length === 1 && (here[0].kind === "PRACTICE" || here[0].kind === "REVIEW") && here[0].status === "PLANNED") room.push({ date: seat.date, index: seat.index, displaces: here[0].id });
  }
  // Free seats first (nothing is lost), then practice, then review: the least valuable work gives way first.
  const rank = (r: { displaces: string | null }) => (r.displaces === null ? 0 : active.find((i) => i.id === r.displaces)?.kind === "PRACTICE" ? 1 : 2);
  const ordered = [...room].sort((a, b) => rank(a) - rank(b) || byDateThenIndex(a, b));
  const chosen = ordered.slice(0, needsCatchUp.length).sort(byDateThenIndex);

  const catchUps: CatchUpDraft[] = [];
  const cancel: string[] = [];
  const shortfall: string[] = [];
  needsCatchUp.forEach((missed, k) => {
    const slot = chosen[k];
    if (!slot) {
      shortfall.push(missed.id);
      return;
    }
    catchUps.push({ rescheduledFromId: missed.id, date: slot.date, slotIndex: slot.index, displaces: slot.displaces });
    if (slot.displaces) cancel.push(slot.displaces);
  });
  return { markMissed, catchUps, cancel, shortfall };
}

/**
 * Did the learner do what this session asked? Derived, never stored: a passed or completed mission counts; otherwise every
 * step in the session's range must be ticked, and a session with no step range (the submit unit) needs a submission.
 */
export function itemDone(
  item: { stepFrom: number | null; stepTo: number | null },
  mission: { status: string; completedSteps: string[]; hasSubmission: boolean; steps: { id: string; position: number }[] } | null,
): boolean {
  if (!mission) return false;
  if (mission.status === "PASSED" || mission.status === "COMPLETED") return true;
  if (item.stepFrom === null || item.stepTo === null) return mission.hasSubmission;
  const wanted = mission.steps.filter((s) => s.position >= item.stepFrom! && s.position <= item.stepTo!);
  return wanted.length > 0 && wanted.every((s) => mission.completedSteps.includes(s.id));
}
