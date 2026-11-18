import { execFileSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { assessSubmission } from "@/lib/assessments/service";
import { registerUser } from "@/lib/auth/service";
import { createEvidence } from "@/lib/evidence/service";
import { startMission, submitMission } from "@/lib/missions/progress";
import { db } from "@/lib/db";
import { getLearnerHome } from "@/lib/plan/home";
import { buildPlanForReview, confirmPlan, saveOnboarding } from "@/lib/plan/onboarding";
import { addCourse } from "@/lib/plan/service";

vi.setConfig({ testTimeout: 60_000 });

const PASSWORD = "correct-horse-42battery";
const mail = (n: string) => `home-test-${n}@example.test`;
const seed = () => execFileSync("npx", ["tsx", "prisma/seed.ts"], { env: process.env, stdio: "ignore", shell: true });
const START = "2026-12-07"; // a Monday

async function onboarded(name: string, code: string) {
  const r = await registerUser({ displayName: `${name} Tester`, email: mail(name.toLowerCase()), password: PASSWORD }, { adultConfirmed: true });
  if (!r.ok) throw new Error("registration failed");
  expect(await saveOnboarding(r.userId, { experience: "BEGINNER", goals: [{ departmentCode: code, weight: 3, targetLevel: 1, note: "" }], sessionMinutes: 45, weekdays: [1, 3, 5], startTime: "18:00", timezone: "Africa/Accra", durationKind: "THREE_MONTHS", startDate: START })).toEqual({ ok: true });
  expect((await buildPlanForReview(r.userId)).ok).toBe(true);
  expect((await confirmPlan(r.userId)).ok).toBe(true);
  return r.userId;
}
const at = (iso: string) => new Date(`${iso}T09:00:00.000Z`);

let a = "";
let b = "";
let legacy = "";
let fresh = "";

async function cleanup() {
  await db.user.deleteMany({ where: { email: { startsWith: "home-test" } } });
}
beforeAll(async () => {
  await cleanup();
  seed();
  process.env.PERSONALISED_LEARNING = "on";
  a = await onboarded("A", "fswd");
  b = await onboarded("B", "photo");
  const f = await registerUser({ displayName: "Fresh", email: mail("fresh"), password: PASSWORD }, { adultConfirmed: true });
  if (!f.ok) throw new Error("registration failed");
  fresh = f.userId;
  process.env.PERSONALISED_LEARNING = "off";
  const l = await registerUser({ displayName: "Legacy", email: mail("legacy"), password: PASSWORD }, { adultConfirmed: true });
  if (!l.ok) throw new Error("registration failed");
  legacy = l.userId;
  process.env.PERSONALISED_LEARNING = "on";
}, 600_000);
afterAll(async () => {
  await cleanup();
  await db.$disconnect();
});

describe("the personalised learner home", () => {
  it("is only for learners on a confirmed personalised plan: everyone else keeps the Command page", async () => {
    expect(await getLearnerHome(legacy)).toBeNull();
    expect(await getLearnerHome(fresh)).toBeNull(); // still onboarding: no active plan
    expect(await getLearnerHome("no-such-user")).toBeNull();
  });

  it("on a study day shows today's sessions with times, minutes and the course", async () => {
    const home = (await getLearnerHome(a, at(START)))!; // Monday: a study day
    expect(home.today).toBe(START);
    expect(home.displayName).toBe("A Tester");
    expect(home.todaySessions.length).toBeGreaterThan(0);
    expect(home.todaySessions.every((s) => s.date === START)).toBe(true);
    expect(home.minutesToday).toBe(home.todaySessions.reduce((n, s) => n + s.minutes, 0));
    expect(home.todaySessions[0].time).toBe("18:00");
    expect(home.nextSession).toEqual(home.todaySessions[0]);
    expect(home.timezone).toBe("Africa/Accra");
  });

  it("on a rest day shows nothing for today and the next session instead", async () => {
    const home = (await getLearnerHome(a, at("2026-12-08")))!; // Tuesday: not a study day
    expect(home.todaySessions).toHaveLength(0);
    expect(home.minutesToday).toBe(0);
    expect(home.nextSession).not.toBeNull();
    expect(home.nextSession!.date > "2026-12-08").toBe(true);
  });

  it("lists upcoming sessions in order, and a seven-day strip starting today", async () => {
    const home = (await getLearnerHome(a, at(START)))!;
    const dates = home.upcoming.map((u) => `${u.date}#${String(u.slotIndex).padStart(2, "0")}`);
    expect([...dates].sort()).toEqual(dates);
    expect(home.upcoming.every((u) => u.date > START)).toBe(true);
    expect(home.week).toHaveLength(7);
    expect(home.week[0]).toMatchObject({ date: START, isToday: true, label: "Today" });
    expect(home.week.map((d) => d.label).slice(1)).toEqual(["Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
    expect(home.week.find((d) => d.date === "2026-12-09")!.sessions.length).toBeGreaterThan(0); // Wednesday
    expect(home.week.find((d) => d.date === "2026-12-08")!.sessions).toHaveLength(0); // Tuesday
  });

  it("shows exactly the enrolled course, with its own progress", async () => {
    const home = (await getLearnerHome(a, at(START)))!;
    expect(home.courses.map((c) => c.code)).toEqual(["fswd"]);
    expect(home.courses[0]).toMatchObject({ name: "Full-stack Development", status: "ACTIVE", done: 0, missed: 0 });
    expect(home.courses[0].remaining).toBeGreaterThan(0);
    expect(home.courses[0].percent).toBe(0);
    expect(home.courses[0].next).not.toBeNull();
    expect(home.totals.done).toBe(0);
  });

  it("never shows another learner's plan or courses", async () => {
    const mine = (await getLearnerHome(a, at(START)))!;
    const theirs = (await getLearnerHome(b, at(START)))!;
    expect(theirs.courses.map((c) => c.code)).toEqual(["photo"]);
    const ids = new Set([...mine.todaySessions, ...mine.upcoming].map((s) => s.id));
    expect([...theirs.todaySessions, ...theirs.upcoming].some((s) => ids.has(s.id))).toBe(false);
    expect([...mine.todaySessions, ...mine.upcoming].every((s) => s.departmentCode === "fswd" || s.departmentCode === null)).toBe(true); // general practice has no course
  });

  it("after a second course is added, both appear, each with its own sessions and progress", async () => {
    expect((await addCourse(a, { departmentCode: "sec", startDate: START, durationDays: 120, requestKey: "home-test-sec" })).ok).toBe(true);
    const home = (await getLearnerHome(a, at(START)))!;
    expect(home.courses.map((c) => c.code).sort()).toEqual(["fswd", "sec"]);
    for (const c of home.courses) expect(c.remaining).toBeGreaterThan(0);
    expect(new Set(home.courseNames ? Object.keys(home.courseNames) : []).size).toBe(2);
    const times = [...home.todaySessions, ...home.upcoming].map((s) => `${s.date}#${s.slotIndex}`);
    expect(new Set(times).size).toBe(times.length); // one unified timetable, no overlap
  });

  it("counts a missed session once and reports it per course", async () => {
    const item = await db.learningPlanItem.findFirstOrThrow({ where: { userId: b, status: "PLANNED" }, orderBy: [{ date: "asc" }, { slotIndex: "asc" }] });
    await db.learningPlanItem.update({ where: { id: item.id }, data: { status: "MISSED" } });
    const home = (await getLearnerHome(b, at("2026-12-20")))!;
    expect(home.courses[0].missed).toBe(1);
    expect(home.totals.missed).toBe(1);
  });
});

describe("the home's next action, assessments, weekly goal and skills", () => {
  it("suggests the next planned session when nothing is in progress", async () => {
    const home = (await getLearnerHome(b, at("2026-12-07")))!;
    expect(home.continue?.reason).toBe("NEXT_SESSION");
    expect(home.continue?.missionCode).toBeTruthy();
    expect(home.assessments.filter((x) => x.kind === "AWAITING" || x.kind === "REVISE" || x.kind === "RESULT")).toHaveLength(0);
    expect(home.focus).toEqual({ working: [], confirmedSkills: 0 });
  });

  it("follows a real submission: in progress, then waiting to be scored, then needing revision with the result and who scored it", async () => {
    await startMission(b, "PHOTO-L0-01");
    expect((await getLearnerHome(b, at("2026-12-07")))!.continue).toMatchObject({ missionCode: "PHOTO-L0-01", reason: "IN_PROGRESS" });

    const lm = await db.learnerMission.findFirstOrThrow({ where: { userId: b, mission: { code: "PHOTO-L0-01" } } });
    expect((await createEvidence(b, { title: "Proof", departmentCode: "photo", kind: "Link", description: "", linkUrl: "https://github.com/jokzet/work", capturedDate: "2026-12-01" }, undefined, lm.id)).ok).toBe(true);
    expect((await submitMission(b, lm.id, { explanation: "I shot the series, edited it and wrote notes on each decision.", githubUrl: "", liveUrl: "" })).ok).toBe(true);
    const waiting = (await getLearnerHome(b, at("2026-12-07")))!;
    expect(waiting.assessments.some((x) => x.kind === "AWAITING" && x.href.startsWith("/assessments/"))).toBe(true);

    const submission = await db.submission.findFirstOrThrow({ where: { learnerMissionId: lm.id } });
    const criteria = await db.rubricCriterion.findMany({ where: { rubric: { mission: { code: "PHOTO-L0-01" } } }, orderBy: { position: "asc" } });
    const done = await assessSubmission(b, submission.id, { scores: criteria.map((c, i) => ({ criterionId: c.id, points: i === 0 ? 0 : c.maxPoints })) });
    expect(done.ok).toBe(true);

    const after = (await getLearnerHome(b, at("2026-12-07")))!;
    const result = after.assessments.find((x) => x.kind === "RESULT")!;
    expect(result.detail).toMatch(/Self-assessed/);
    expect(result.href).toBe(`/assessments/${submission.id}`);
    expect(after.focus.working.length).toBeGreaterThan(0); // the criterion that scored 0
    expect(after.focus.confirmedSkills).toBe(0); // nothing is "confirmed" without a reviewer
    if (done.ok && done.outcome !== "PASS") {
      expect(after.continue).toMatchObject({ reason: "NEEDS_REVISION", missionCode: "PHOTO-L0-01" });
      expect(after.assessments.some((x) => x.kind === "REVISE")).toBe(true);
    }
  });

  it("never shows one learner's assessments to another", async () => {
    const mine = (await getLearnerHome(a, at("2026-12-07")))!;
    expect(mine.assessments.filter((x) => x.kind === "RESULT" || x.kind === "AWAITING")).toHaveLength(0);
    expect(mine.focus.working).toEqual([]);
  });

  it("counts this week's sessions from the plan (Monday to Sunday), planned versus done", async () => {
    const home = (await getLearnerHome(a, at("2026-12-09")))!; // Wednesday
    expect(home.weekly.label).toBe("2026-12-07 to 2026-12-13");
    expect(home.weekly.planned).toBeGreaterThan(0);
    expect(home.weekly.done).toBe(0);
    expect(home.weekly.plannedMinutes).toBeGreaterThan(0);
    expect(home.weekly.doneMinutes).toBe(0);
  });
});
