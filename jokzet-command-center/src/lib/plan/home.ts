import { db } from "@/lib/db";
import { listEnrolments } from "@/lib/enrolment/service";
import { listDepartments } from "@/lib/missions/service";
import { addDaysISO, localDateOf } from "@/lib/schedule/time";
import { getPlanView, type PlanItemView } from "./service";

/**
 * Everything the personalised learner home shows, for ONE learner, from their own plan and enrolments. Nothing here is read from
 * anything the browser sends. Returns null for anyone who is not on a personalised plan (they keep the original Command page).
 */
export type HomeCourse = {
  code: string;
  name: string;
  status: "ACTIVE" | "PAUSED" | "COMPLETED";
  level: number;
  xp: number;
  done: number;
  remaining: number;
  missed: number;
  percent: number;
  next: PlanItemView | null;
};
export type HomeDay = { date: string; label: string; isToday: boolean; sessions: PlanItemView[] };
export type LearnerHome = {
  displayName: string;
  today: string;
  timezone: string;
  planPaused: boolean;
  planEnds: string;
  todaySessions: PlanItemView[];
  minutesToday: number;
  nextSession: PlanItemView | null;
  upcoming: PlanItemView[];
  week: HomeDay[];
  courses: HomeCourse[];
  courseNames: Record<string, string>;
  totals: { done: number; remaining: number; missed: number; percent: number };
  catchUps: number;
};

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const weekdayOf = (iso: string) => new Date(`${iso}T00:00:00Z`).getUTCDay();
const byTime = (a: PlanItemView, b: PlanItemView) => (a.date === b.date ? a.slotIndex - b.slotIndex : a.date.localeCompare(b.date));

export async function getLearnerHome(userId: string, now: Date = new Date()): Promise<LearnerHome | null> {
  const profile = await db.profile.findUnique({ where: { userId }, select: { learnerMode: true, displayName: true } });
  if (!profile || profile.learnerMode !== "PERSONALISED") return null;
  const view = await getPlanView(userId, now);
  if (!view || (view.status !== "ACTIVE" && view.status !== "PAUSED")) return null;

  const [enrolments, departments] = await Promise.all([listEnrolments(userId), listDepartments(userId)]);
  const today = localDateOf(now, view.timezone);
  const live = view.items.filter((i) => i.status !== "CANCELLED");
  const planned = live.filter((i) => i.status === "PLANNED" && !i.done).sort(byTime);

  const todaySessions = planned.filter((i) => i.date === today);
  const upcoming = planned.filter((i) => i.date > today).slice(0, 6);
  const nextSession = todaySessions[0] ?? upcoming[0] ?? null;

  const week: HomeDay[] = Array.from({ length: 7 }, (_, n) => {
    const date = addDaysISO(today, n);
    return { date, label: n === 0 ? "Today" : WEEKDAY[weekdayOf(date)], isToday: n === 0, sessions: planned.filter((i) => i.date === date) };
  });

  const courses: HomeCourse[] = enrolments.map((e) => {
    const mine = live.filter((i) => i.departmentCode === e.departmentCode);
    const done = mine.filter((i) => i.done).length;
    const missed = mine.filter((i) => i.status === "MISSED" && !i.done).length;
    const remaining = mine.filter((i) => i.status === "PLANNED" && !i.done).length;
    const total = done + remaining + missed;
    const dept = departments.find((d) => d.code === e.departmentCode);
    return {
      code: e.departmentCode, name: e.departmentName, status: e.status, level: dept?.level ?? 0, xp: dept?.xp ?? 0, done, remaining, missed,
      percent: total ? Math.round((done / total) * 100) : 0, next: planned.find((i) => i.departmentCode === e.departmentCode) ?? null,
    };
  });

  const done = live.filter((i) => i.done).length;
  const missed = live.filter((i) => i.status === "MISSED" && !i.done).length;
  const remaining = planned.length;
  const total = done + missed + remaining;

  return {
    displayName: profile.displayName, today, timezone: view.timezone, planPaused: view.status === "PAUSED", planEnds: view.endDate, todaySessions,
    minutesToday: todaySessions.reduce((n, i) => n + i.minutes, 0), nextSession, upcoming, week, courses,
    courseNames: Object.fromEntries(courses.map((c) => [c.code, c.name])),
    totals: { done, remaining, missed, percent: total ? Math.round((done / total) * 100) : 0 },
    catchUps: live.filter((i) => i.kind === "CATCH_UP" && i.status === "PLANNED" && !i.done).length,
  };
}
