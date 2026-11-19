import { db } from "@/lib/db";
import { listCatalogue, listEnrolments, type CourseOffer } from "@/lib/enrolment/service";
import { getTotalXp, listDepartments } from "@/lib/missions/service";
import { PROGRAMME_XP_PER_LEVEL } from "@/lib/programme";
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
export type HomeContinue = { missionCode: string; title: string; course: string; courseCode: string | null; percent: number | null; reason: "IN_PROGRESS" | "NEEDS_REVISION" | "NEXT_SESSION" };
/** One day of the current Monday to Sunday week for the goal widget. */
export type HomeGoalDay = { date: string; label: string; state: "DONE" | "MISSED" | "PENDING" | "UPCOMING" | "REST"; isToday: boolean };
/** A skill from an enrolled course. `state` is CONFIRMED only when a reviewer confirmed it; SELF is an earlier, unconfirmed result. */
export type HomeSkill = { name: string; courseCode: string; courseName: string; lessons: number; state: "CONFIRMED" | "SELF" | "NOT_YET" };
export type HomeAssessmentRow = { id: string; kind: "AWAITING" | "REVISE" | "RESULT" | "CHECKPOINT"; title: string; detail: string; href: string };
export type LearnerHome = {
  continue: HomeContinue | null;
  assessments: HomeAssessmentRow[];
  weekly: { planned: number; done: number; plannedMinutes: number; doneMinutes: number; label: string };
  focus: { working: string[]; confirmedSkills: number };
  /** Official XP only (a reviewer's confirmation adds it). */
  progress: { xp: number; level: number; xpIntoLevel: number; perLevel: number };
  /** Today's planned and finished study minutes, and how each day of this week went. Planned and done are kept apart. */
  goal: { plannedMinutes: number; doneMinutes: number; days: HomeGoalDay[] };
  skills: HomeSkill[];
  /** Published courses the learner could add: the catalogue, kept separate from their own courses. */
  explore: CourseOffer[];
  earnedAchievements: { name: string; description: string }[];
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

const stateLabel = (kind: string, status: string): string =>
  status === "VERIFIED" ? "Confirmed by a reviewer" : status === "PENDING_REVIEW" ? "Waiting for a reviewer" : status === "REJECTED" ? "Not accepted by a reviewer" : kind === "AUTOMATED" ? "AI-assessed, not yet confirmed" : "Self-assessed";
const mondayOf = (iso: string) => addDaysISO(iso, -((weekdayOf(iso) + 6) % 7));

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

  // What to do next: unfinished work first (a mission being revised, then one in progress), otherwise the next planned session.
  const open = await db.learnerMission.findFirst({
    where: { userId, status: { in: ["NEEDS_REVISION", "IN_PROGRESS"] }, mission: { code: { not: null }, category: "CURRICULUM_MISSION", isPublished: true } },
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    select: { status: true, mission: { select: { code: true, title: true, department: { select: { name: true, code: true } } } } },
  });
  const cont: HomeContinue | null = open?.mission.code
    ? { missionCode: open.mission.code, title: open.mission.title, course: open.mission.department.name, courseCode: open.mission.department.code, percent: courses.find((c) => c.code === open.mission.department.code)?.percent ?? null, reason: open.status === "NEEDS_REVISION" ? "NEEDS_REVISION" : "IN_PROGRESS" }
    : nextSession?.missionCode ? { missionCode: nextSession.missionCode, title: nextSession.title, course: nextSession.departmentCode ? (courses.find((c) => c.code === nextSession.departmentCode)?.name ?? "") : "", courseCode: nextSession.departmentCode ?? null, percent: nextSession.departmentCode ? (courses.find((c) => c.code === nextSession.departmentCode)?.percent ?? null) : null, reason: "NEXT_SESSION" } : null;

  // Assessments: what is waiting, what needs revising, the next checkpoint, and the last results with who scored them.
  const [awaiting, revise, recent] = await Promise.all([
    db.submission.findMany({ where: { userId, status: "SUBMITTED" }, orderBy: { submittedAt: "desc" }, take: 3, select: { id: true, attempt: true, learnerMission: { select: { mission: { select: { title: true } } } } } }),
    db.learnerMission.findMany({ where: { userId, status: "NEEDS_REVISION", mission: { code: { not: null } } }, orderBy: { updatedAt: "desc" }, take: 3, select: { mission: { select: { code: true, title: true } } } }),
    db.assessment.findMany({ where: { userId }, orderBy: { assessedAt: "desc" }, take: 3, select: { id: true, submissionId: true, percentage: true, outcome: true, status: true, assessorKind: true, weaknesses: true, submission: { select: { learnerMission: { select: { mission: { select: { title: true } } } } } } } }),
  ]);
  const checkpoint = planned.find((i) => i.kind === "CHECKPOINT");
  const assessments: HomeAssessmentRow[] = [
    ...awaiting.map((s) => ({ id: `w-${s.id}`, kind: "AWAITING" as const, title: s.learnerMission.mission.title, detail: "Submitted. Waiting to be scored.", href: `/assessments/${s.id}` })),
    ...revise.map((m) => ({ id: `r-${m.mission.code}`, kind: "REVISE" as const, title: m.mission.title, detail: "Needs revision. Review the feedback and resubmit.", href: `/missions/${m.mission.code}` })),
    ...(checkpoint ? [{ id: `c-${checkpoint.id}`, kind: "CHECKPOINT" as const, title: checkpoint.title, detail: `Checkpoint on ${checkpoint.date} at ${checkpoint.time}.`, href: checkpoint.missionCode ? `/missions/${checkpoint.missionCode}` : "/timetable" }] : []),
    ...recent.map((a) => ({ id: `a-${a.id}`, kind: "RESULT" as const, title: a.submission.learnerMission.mission.title, detail: `${a.percentage}% · ${a.outcome === "PASS" ? "pass" : "needs work"} · ${stateLabel(a.assessorKind, a.status)}`, href: `/assessments/${a.submissionId}` })),
  ];
  // Where the learner is struggling (tags from their latest assessments) and how many skills a reviewer has actually confirmed.
  const tally = new Map<string, number>();
  for (const a of recent) for (const w of a.weaknesses) tally.set(w, (tally.get(w) ?? 0) + 1);
  const working = [...tally].sort((x, y) => y[1] - x[1]).slice(0, 4).map(([w]) => w);
  const confirmedSkills = await db.userSkill.count({ where: { userId, tier: "VERIFIED" } });

  // This week (Monday to Sunday, in the learner's time zone): planned sessions and the ones actually done.
  const weekStart = mondayOf(today);
  const weekEnd = addDaysISO(weekStart, 6);
  const thisWeek = live.filter((i) => i.date >= weekStart && i.date <= weekEnd);
  const weekly = {
    planned: thisWeek.length, done: thisWeek.filter((i) => i.done).length,
    plannedMinutes: thisWeek.reduce((n, i) => n + i.minutes, 0), doneMinutes: thisWeek.filter((i) => i.done).reduce((n, i) => n + i.minutes, 0),
    label: `${weekStart} to ${weekEnd}`,
  };

  // The goal widget: today's planned minutes against finished minutes, and how each day of this Monday to Sunday week went.
  const todayItems = live.filter((i) => i.date === today);
  const goalDays: HomeGoalDay[] = Array.from({ length: 7 }, (_, n) => {
    const date = addDaysISO(weekStart, n);
    const items = live.filter((i) => i.date === date);
    const state: HomeGoalDay["state"] = !items.length ? "REST"
      : items.every((i) => i.done) ? "DONE"
      : date > today ? "UPCOMING"
      : items.some((i) => i.status === "MISSED" && !i.done) && date < today ? "MISSED"
      : "PENDING";
    return { date, label: WEEKDAY[weekdayOf(date)], state, isToday: date === today };
  });
  const goal = { plannedMinutes: todayItems.reduce((n, i) => n + i.minutes, 0), doneMinutes: todayItems.filter((i) => i.done).reduce((n, i) => n + i.minutes, 0), days: goalDays };

  // Skills of the courses the learner is actually taking, with the honest state of each.
  const enrolledCodes = courses.map((c) => c.code);
  const skillRows = enrolledCodes.length ? await db.skill.findMany({
    where: { department: { code: { in: enrolledCodes } } },
    select: { name: true, department: { select: { code: true, name: true } }, missions: { where: { mission: { isPublished: true, createdById: null } }, select: { missionId: true } }, learners: { where: { userId }, select: { tier: true } } },
    orderBy: [{ department: { sortOrder: "asc" } }, { name: "asc" }],
  }) : [];
  const skills: HomeSkill[] = skillRows
    .filter((s) => s.missions.length > 0)
    .map((s) => ({ name: s.name, courseCode: s.department.code, courseName: s.department.name, lessons: s.missions.length, state: s.learners[0] ? (s.learners[0].tier === "VERIFIED" ? "CONFIRMED" as const : "SELF" as const) : "NOT_YET" as const }));

  const [xp, explore, achieved] = await Promise.all([
    getTotalXp(userId),
    listCatalogue(userId),
    db.userAchievement.findMany({ where: { userId }, orderBy: { earnedAt: "desc" }, take: 5, select: { achievement: { select: { name: true, description: true } } } }),
  ]);

  const done = live.filter((i) => i.done).length;
  const missed = live.filter((i) => i.status === "MISSED" && !i.done).length;
  const remaining = planned.length;
  const total = done + missed + remaining;

  return {
    continue: cont, assessments, weekly, focus: { working, confirmedSkills },
    progress: { xp, level: Math.floor(xp / PROGRAMME_XP_PER_LEVEL), xpIntoLevel: xp % PROGRAMME_XP_PER_LEVEL, perLevel: PROGRAMME_XP_PER_LEVEL },
    goal, skills, explore: explore.slice(0, 6), earnedAchievements: achieved.map((a) => a.achievement),
    displayName: profile.displayName, today, timezone: view.timezone, planPaused: view.status === "PAUSED", planEnds: view.endDate, todaySessions,
    minutesToday: todaySessions.reduce((n, i) => n + i.minutes, 0), nextSession, upcoming, week, courses,
    courseNames: Object.fromEntries(courses.map((c) => [c.code, c.name])),
    totals: { done, remaining, missed, percent: total ? Math.round((done / total) * 100) : 0 },
    catchUps: live.filter((i) => i.kind === "CATCH_UP" && i.status === "PLANNED" && !i.done).length,
  };
}
