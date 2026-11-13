import { addDays } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { db } from "@/lib/db";
import { PROGRAMME_TIMEZONE } from "@/lib/departments";
import { dateToISO, isoToDate, isoWeekStart, todayISO } from "@/lib/programme";

export type Activity = { at: Date; minutes: number };

export type PeriodRow = { key: string; label: string; minutes: number; missions: number; skills: number; assessments: number; averageScore: number | null };

const localDate = (d: Date) => formatInTimeZone(d, PROGRAMME_TIMEZONE, "yyyy-MM-dd");

/** Monday-start week keys ending with the week containing `today`, oldest first. */
export function lastWeekKeys(today: string, count: number): string[] {
  const current = isoWeekStart(today);
  return Array.from({ length: count }, (_, i) => dateToISO(addDays(isoToDate(current), -7 * (count - 1 - i))));
}

/** yyyy-MM keys ending with the month containing `today`, oldest first. */
export function lastMonthKeys(today: string, count: number): string[] {
  const [y, m] = today.split("-").map(Number);
  return Array.from({ length: count }, (_, i) => {
    const offset = count - 1 - i;
    const idx = y * 12 + (m - 1) - offset;
    return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, "0")}`;
  });
}

export const weekLabel = (key: string) => formatInTimeZone(isoToDate(key), "UTC", "d MMM");
export const monthLabel = (key: string) => formatInTimeZone(isoToDate(`${key}-01`), "UTC", "MMM yyyy");

type Dated = { at: Date };
/** Groups items by the bucket key of their local date; items outside the given keys are ignored. */
export function bucketBy<T extends Dated>(items: T[], keys: string[], keyOf: (localIso: string) => string) {
  const map = new Map<string, T[]>(keys.map((k) => [k, []]));
  for (const item of items) map.get(keyOf(localDate(item.at)))?.push(item);
  return map;
}

export type AnalyticsData = {
  totals: { minutes: number; missionsCompleted: number; skills: number; assessments: number; averageScore: number | null; passRate: number | null };
  completion: { completed: number; total: number; dailyCompleted: number; dailyTotal: number };
  weekly: PeriodRow[];
  monthly: PeriodRow[];
  departments: { code: string; name: string; xp: number; level: number; completed: number; total: number; minutes: number; averageScore: number | null }[];
  performance: { id: string; label: string; percentage: number; outcome: string; departmentCode: string; date: string }[];
  skillsByDepartment: { code: string; count: number }[];
  /** Self-directed practice, reported separately and never added to the curriculum figures above. */
  practice: { personal: PracticeTotals; challenges: PracticeTotals };
};

export type PracticeTotals = { completed: number; minutes: number; assessed: number };

const avg = (values: number[]) => (values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null);

export async function getAnalytics(userId: string, now: Date = new Date()): Promise<AnalyticsData> {
  const today = todayISO(now);
  const [missions, practiceRows, daily, assessments, skills, learnerDepts, curriculumTotals] = await Promise.all([
    // Curriculum missions only: personal activities and recommended challenges are practice and are reported separately.
    db.learnerMission.findMany({
      where: { userId, status: { in: ["COMPLETED", "PASSED"] }, completedAt: { not: null }, mission: { category: "CURRICULUM_MISSION" } },
      select: { completedAt: true, minutesSpent: true, mission: { select: { durationMinutes: true, department: { select: { code: true } } } } },
    }),
    db.learnerMission.findMany({
      where: { userId, status: { in: ["COMPLETED", "PASSED"] }, completedAt: { not: null }, mission: { category: { not: "CURRICULUM_MISSION" } } },
      select: { status: true, minutesSpent: true, mission: { select: { category: true, durationMinutes: true } } },
    }),
    db.dailyMissionInstance.findMany({
      where: { userId },
      select: { status: true, completedAt: true, template: { select: { durationMinutes: true } } },
    }),
    db.assessment.findMany({
      where: { userId, rubric: { mission: { category: "CURRICULUM_MISSION" } } },
      orderBy: { assessedAt: "asc" },
      select: { id: true, percentage: true, outcome: true, assessedAt: true, rubric: { select: { mission: { select: { title: true, department: { select: { code: true } } } } } } },
    }),
    db.userSkill.findMany({ where: { userId }, select: { earnedAt: true, skill: { select: { department: { select: { code: true } } } } } }),
    db.learnerDepartment.findMany({ where: { userId }, select: { xp: true, level: true, department: { select: { code: true, name: true, sortOrder: true } } } }),
    db.mission.groupBy({ by: ["departmentId"], where: { createdById: null, isPublished: true }, _count: { _all: true } }),
  ]);
  const deptCodeById = new Map((await db.department.findMany({ select: { id: true, code: true } })).map((d) => [d.id, d.code]));

  // Hours: one record per finished mission (board) and per finished daily mission, never both for the same work.
  const missionActs = missions.map((m) => ({
    at: m.completedAt!,
    minutes: m.minutesSpent > 0 ? m.minutesSpent : m.mission.durationMinutes,
    dept: m.mission.department.code,
  }));
  const dailyDone = daily.filter((d) => d.status === "COMPLETED" && d.completedAt);
  const dailyActs = dailyDone.map((d) => ({ at: d.completedAt!, minutes: d.template.durationMinutes, dept: null as string | null }));
  const acts = [...missionActs, ...dailyActs];
  const assessmentActs = assessments.map((a) => ({ at: a.assessedAt, percentage: a.percentage }));
  const skillActs = skills.map((s) => ({ at: s.earnedAt }));

  const period = (keys: string[], keyOf: (iso: string) => string, label: (k: string) => string): PeriodRow[] => {
    const a = bucketBy(acts, keys, keyOf);
    const m = bucketBy(missionActs.map((x) => ({ at: x.at })), keys, keyOf);
    const d = bucketBy(dailyActs.map((x) => ({ at: x.at })), keys, keyOf);
    const s = bucketBy(skillActs, keys, keyOf);
    const q = bucketBy(assessmentActs, keys, keyOf);
    return keys.map((key) => ({
      key,
      label: label(key),
      minutes: (a.get(key) ?? []).reduce((sum, x) => sum + x.minutes, 0),
      missions: (m.get(key)?.length ?? 0) + (d.get(key)?.length ?? 0),
      skills: s.get(key)?.length ?? 0,
      assessments: q.get(key)?.length ?? 0,
      averageScore: avg((q.get(key) ?? []).map((x) => x.percentage)),
    }));
  };

  const totalByDept = new Map(curriculumTotals.map((t) => [deptCodeById.get(t.departmentId) ?? "", t._count._all]));
  const minutesByDept = new Map<string, number>();
  for (const a of missionActs) minutesByDept.set(a.dept, (minutesByDept.get(a.dept) ?? 0) + a.minutes);
  const completedByDept = new Map<string, number>();
  for (const a of missionActs) completedByDept.set(a.dept, (completedByDept.get(a.dept) ?? 0) + 1);
  const scoresByDept = new Map<string, number[]>();
  for (const a of assessments) {
    const code = a.rubric.mission.department.code;
    scoresByDept.set(code, [...(scoresByDept.get(code) ?? []), a.percentage]);
  }
  const skillsByDept = new Map<string, number>();
  for (const s of skills) skillsByDept.set(s.skill.department.code, (skillsByDept.get(s.skill.department.code) ?? 0) + 1);

  const passes = assessments.filter((a) => a.outcome === "PASS").length;

  return {
    totals: {
      minutes: acts.reduce((sum, a) => sum + a.minutes, 0),
      missionsCompleted: missionActs.length + dailyActs.length,
      skills: skills.length,
      assessments: assessments.length,
      averageScore: avg(assessments.map((a) => a.percentage)),
      passRate: assessments.length ? Math.round((passes / assessments.length) * 100) : null,
    },
    completion: {
      completed: missionActs.length,
      total: [...totalByDept.values()].reduce((a, b) => a + b, 0),
      dailyCompleted: dailyDone.length,
      dailyTotal: daily.filter((d) => d.status !== "SKIPPED").length,
    },
    weekly: period(lastWeekKeys(today, 8), isoWeekStart, weekLabel),
    monthly: period(lastMonthKeys(today, 6), (iso) => iso.slice(0, 7), monthLabel),
    departments: [...learnerDepts]
      .sort((a, b) => a.department.sortOrder - b.department.sortOrder)
      .map((l) => ({
        code: l.department.code,
        name: l.department.name,
        xp: l.xp,
        level: l.level,
        completed: completedByDept.get(l.department.code) ?? 0,
        total: totalByDept.get(l.department.code) ?? 0,
        minutes: minutesByDept.get(l.department.code) ?? 0,
        averageScore: avg(scoresByDept.get(l.department.code) ?? []),
      })),
    performance: assessments.slice(-12).map((a) => ({
      id: a.id,
      label: a.rubric.mission.title,
      percentage: a.percentage,
      outcome: a.outcome,
      departmentCode: a.rubric.mission.department.code,
      date: localDate(a.assessedAt),
    })),
    skillsByDepartment: [...skillsByDept.entries()].map(([code, count]) => ({ code, count })),
    practice: practiceTotals(practiceRows),
  };
}

function practiceTotals(rows: { status: string; minutesSpent: number; mission: { category: string; durationMinutes: number } }[]) {
  const sum = (category: string): PracticeTotals => {
    const mine = rows.filter((r) => r.mission.category === category);
    return {
      completed: mine.length,
      minutes: mine.reduce((t, r) => t + (r.minutesSpent > 0 ? r.minutesSpent : r.mission.durationMinutes), 0),
      assessed: mine.filter((r) => r.status === "PASSED").length,
    };
  };
  return { personal: sum("PERSONAL_ACTIVITY"), challenges: sum("RECOMMENDED_CHALLENGE") };
}
