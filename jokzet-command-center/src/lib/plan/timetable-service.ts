import { db } from "@/lib/db";
import { localDateOf } from "@/lib/schedule/time";
import { sessionsPerDay } from "./availability";
import { personalisedLearningEnabled } from "./flag";
import { getPlanView, type PlanItemView } from "./service";
import { describeEvent, finishEstimate, monthGrid, parseDate, parseView, progressOf, weekDates, type TimetableView } from "./timetable";

/**
 * Read-only data for the timetable screens. Everything is scoped to the signed-in learner and reads the plan that is already
 * stored: it never generates, moves or marks anything (opening a screen is a GET and changes nothing).
 */
export type Timetable = {
  plan: { status: "ACTIVE" | "PAUSED"; startDate: string; endDate: string; timezone: string; autoReschedule: boolean; flexibility: string; sessionsPerDay: number };
  today: string;
  view: TimetableView;
  date: string;
  range: { from: string; to: string };
  items: PlanItemView[]; // live sessions inside the range, in date then session order
  progress: { total: number; completed: number; missed: number; percent: number };
  weekProgress: { total: number; completed: number };
  finish: { date: string; onTrack: boolean };
  nextCheckpoint: PlanItemView | null;
  catchUpOf: Record<string, string>; // catch-up session id -> the date of the session it replaces
  milestones: { title: string; objective: string; startDate: string; endDate: string }[];
  weekObjective: string | null;
  history: { at: string; title: string; detail: string }[];
};

/** Can this learner see the timetable at all? Only on the personalised programme, and only while the rollout flag is on. */
export async function timetableAccess(userId: string): Promise<boolean> {
  if (!personalisedLearningEnabled()) return false;
  const profile = await db.profile.findUnique({ where: { userId }, select: { learnerMode: true } });
  return profile?.learnerMode === "PERSONALISED";
}

export async function getTimetable(userId: string, opts: { view?: string; date?: string }, now: Date = new Date()): Promise<Timetable | null> {
  const plan = await getPlanView(userId, now);
  if (!plan || (plan.status !== "ACTIVE" && plan.status !== "PAUSED")) return null;
  const today = localDateOf(now, plan.timezone);
  const view = parseView(opts.view);
  const date = parseDate(opts.date, today);

  const range =
    view === "day" ? { from: date, to: date }
    : view === "week" ? { from: weekDates(date)[0], to: weekDates(date)[6] }
    : (() => { const cells = monthGrid(date).flat(); return { from: cells[0].date, to: cells[cells.length - 1].date }; })();

  const live = plan.items.filter((i) => i.status !== "CANCELLED");
  const inRange = live.filter((i) => i.date >= range.from && i.date <= range.to).sort((a, b) => (a.date === b.date ? a.slotIndex - b.slotIndex : a.date < b.date ? -1 : 1));
  const week = weekDates(date);
  const inWeek = live.filter((i) => i.date >= week[0] && i.date <= week[6]);
  const wp = progressOf(inWeek);
  const monthKey = date.slice(0, 7);

  const events = await db.learningPlanEvent.findMany({ where: { userId }, orderBy: { occurredAt: "desc" }, take: 15 });
  const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

  return {
    plan: { status: plan.status, startDate: plan.startDate, endDate: plan.endDate, timezone: plan.timezone, autoReschedule: plan.autoReschedule, flexibility: plan.flexibility, sessionsPerDay: sessionsPerDay(plan.dailyStudyMinutes, plan.sessionMinutes, plan.breakMinutes) },
    today, view, date, range,
    items: inRange,
    progress: progressOf(live),
    weekProgress: { total: wp.total, completed: wp.completed },
    finish: finishEstimate(live, plan.endDate),
    nextCheckpoint: live.filter((i) => i.kind === "CHECKPOINT" && i.status === "PLANNED" && i.date >= today).sort((a, b) => (a.date < b.date ? -1 : 1))[0] ?? null,
    catchUpOf: Object.fromEntries(live.filter((i) => i.kind === "CATCH_UP" && i.rescheduledFromId).flatMap((i) => { const o = live.find((x) => x.id === i.rescheduledFromId); return o ? [[i.id, o.date] as const] : []; })),
    milestones: plan.phases.filter((p) => p.startDate.slice(0, 7) <= monthKey && p.endDate.slice(0, 7) >= monthKey).map((p) => ({ title: p.title, objective: p.objective, startDate: p.startDate, endDate: p.endDate })),
    weekObjective: inWeek.find((i) => i.kind === "TEACHING" && i.status === "PLANNED")?.title ?? inWeek.find((i) => i.kind === "TEACHING")?.title ?? null,
    history: events.map((e) => ({ at: e.occurredAt.toISOString(), ...describeEvent({ type: e.type, fromDate: iso(e.fromDate), toDate: iso(e.toDate), note: e.note }) })),
  };
}
