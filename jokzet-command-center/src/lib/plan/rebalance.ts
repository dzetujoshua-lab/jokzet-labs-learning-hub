/**
 * Missed sessions. Pure: given a plan's items and the learner's local today, it says what to mark MISSED, which catch-up
 * sessions to add and which low-value sessions they displace. It only ever looks at items dated today or later when placing
 * work; an item dated before today is never moved or edited (the only change a past item may get is PLANNED to MISSED).
 *
 * Teaching work is never dropped: practice goes first, then review. If there is no room left before the plan ends the
 * remainder is reported as shortfall (extending the plan is an explicit action, not something this function does).
 */
export type RebalanceItem = {
  id: string;
  date: string; // local ISO date
  position: number;
  kind: "TEACHING" | "BASELINE" | "CHECKPOINT" | "PRACTICE" | "REVIEW" | "CATCH_UP";
  status: "PLANNED" | "MISSED" | "CANCELLED";
  rescheduledFromId: string | null;
  done: boolean; // the learner did what this session asked (derived from their mission, never stored)
};

export type CatchUpDraft = { rescheduledFromId: string; date: string; displaces: string | null };
export type RebalanceResult = {
  markMissed: string[]; // PLANNED, dated before today, not done
  catchUps: CatchUpDraft[];
  cancel: string[]; // practice / review sessions displaced by a catch-up
  shortfall: string[]; // missed items that found no room before the plan ends
};

const TEACHING_LIKE = new Set(["TEACHING", "BASELINE", "CHECKPOINT", "CATCH_UP"]);

export function rebalance(input: { items: RebalanceItem[]; today: string; slots: string[] }): RebalanceResult {
  const { items, today, slots } = input;
  const active = items.filter((i) => i.status !== "CANCELLED");
  const hasCatchUp = new Set(active.filter((i) => i.kind === "CATCH_UP" && i.rescheduledFromId).map((i) => i.rescheduledFromId as string));

  const past = active.filter((i) => i.date < today && TEACHING_LIKE.has(i.kind) && !i.done);
  const markMissed = past.filter((i) => i.status === "PLANNED").map((i) => i.id);
  const needsCatchUp = past
    .filter((i) => !hasCatchUp.has(i.id))
    .sort((a, b) => (a.date === b.date ? a.position - b.position : a.date < b.date ? -1 : 1));

  // Room: every plan slot from today on that has no active item, or only a practice / review session that can give way.
  const byDate = new Map<string, RebalanceItem[]>();
  for (const i of active) if (i.date >= today) byDate.set(i.date, [...(byDate.get(i.date) ?? []), i]);
  const room: { date: string; displaces: string | null }[] = [];
  for (const date of slots.filter((d) => d >= today)) {
    const here = byDate.get(date) ?? [];
    if (!here.length) room.push({ date, displaces: null });
    else if (here.length === 1 && (here[0].kind === "PRACTICE" || here[0].kind === "REVIEW") && here[0].status === "PLANNED") room.push({ date, displaces: here[0].id });
  }
  // Free slots first (nothing is lost), then practice, then review: the least valuable work gives way first.
  const rank = (r: { displaces: string | null }) => (r.displaces === null ? 0 : active.find((i) => i.id === r.displaces)?.kind === "PRACTICE" ? 1 : 2);
  const ordered = [...room].sort((a, b) => rank(a) - rank(b) || (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const chosen = ordered.slice(0, needsCatchUp.length).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  const catchUps: CatchUpDraft[] = [];
  const cancel: string[] = [];
  const shortfall: string[] = [];
  needsCatchUp.forEach((missed, k) => {
    const slot = chosen[k];
    if (!slot) {
      shortfall.push(missed.id);
      return;
    }
    catchUps.push({ rescheduledFromId: missed.id, date: slot.date, displaces: slot.displaces });
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
