import "server-only";
import { getPlanView } from "./service";

/** What the learner reviews before confirming: a trimmed view of the generated (not yet active) plan. */
export type PlanReview = {
  startDate: string;
  endDate: string;
  timezone: string;
  weekdays: number[];
  startTime: string;
  sessionMinutes: number;
  totalSessions: number;
  totalMinutes: number;
  weeks: number;
  summary: NonNullable<Awaited<ReturnType<typeof getPlanView>>>["summary"];
  phases: { title: string; objective: string; startDate: string; endDate: string }[];
  firstWeek: { date: string; time: string; title: string; kind: string; minutes: number; departmentCode: string | null }[];
};

export async function getPlanReview(userId: string): Promise<PlanReview | null> {
  const view = await getPlanView(userId);
  if (!view || view.status !== "DRAFT" || view.items.length === 0) return null;
  const items = view.items.filter((i) => i.status === "PLANNED");
  if (items.length === 0) return null;
  const firstWeekNumber = items[0].weekNumber;
  const firstWeek = items.filter((i) => i.weekNumber === firstWeekNumber).slice(0, 14);
  return {
    startDate: view.startDate, endDate: view.endDate, timezone: view.timezone, weekdays: view.weekdays, startTime: view.startTime, sessionMinutes: view.sessionMinutes,
    totalSessions: items.length, totalMinutes: items.reduce((n, i) => n + i.minutes, 0), weeks: Math.max(...items.map((i) => i.weekNumber)),
    summary: view.summary,
    phases: view.phases.map((p) => ({ title: p.title, objective: p.objective, startDate: p.startDate, endDate: p.endDate })),
    firstWeek: firstWeek.map((i) => ({ date: i.date, time: i.time, title: i.title, kind: i.kind, minutes: i.minutes, departmentCode: i.departmentCode })),
  };
}
