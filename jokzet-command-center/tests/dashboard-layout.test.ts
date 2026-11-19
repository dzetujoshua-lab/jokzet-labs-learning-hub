import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { registerUser } from "@/lib/auth/service";
import { db } from "@/lib/db";
import { startMission } from "@/lib/missions/progress";
import { getLearnerHome } from "@/lib/plan/home";
import { buildPlanForReview, confirmPlan, saveOnboarding } from "@/lib/plan/onboarding";
import { cleanQuery, searchAcademy } from "@/lib/search/service";

vi.setConfig({ testTimeout: 60_000 });

const PASSWORD = "correct-horse-42battery";
const mail = (n: string) => `dash-test-${n}@example.test`;
const seed = () => execFileSync("npx", ["tsx", "prisma/seed.ts"], { env: process.env, stdio: "ignore", shell: true });
const START = "2026-12-07"; // a Monday
const at = (iso: string) => new Date(`${iso}T09:00:00.000Z`);
const read = (p: string) => readFileSync(p, "utf8");

async function onboarded(name: string, code: string) {
  const r = await registerUser({ displayName: `${name} Tester`, email: mail(name.toLowerCase()), password: PASSWORD }, { adultConfirmed: true });
  if (!r.ok) throw new Error("registration failed");
  expect(await saveOnboarding(r.userId, { experience: "BEGINNER", goals: [{ departmentCode: code, weight: 3, targetLevel: 1, note: "" }], sessionMinutes: 45, weekdays: [1, 3, 5], startTime: "18:00", timezone: "Africa/Accra", durationKind: "THREE_MONTHS", startDate: START })).toEqual({ ok: true });
  expect((await buildPlanForReview(r.userId)).ok).toBe(true);
  expect((await confirmPlan(r.userId)).ok).toBe(true);
  return r.userId;
}

let a = "";
let b = "";
let legacy = "";
const cleanup = async () => {
  await db.user.deleteMany({ where: { email: { startsWith: "dash-test" } } });
  await db.achievement.deleteMany({ where: { code: "dash-test-badge" } });
};

beforeAll(async () => {
  await cleanup();
  seed();
  process.env.PERSONALISED_LEARNING = "on";
  a = await onboarded("A", "fswd");
  b = await onboarded("B", "photo");
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

describe("dashboard data: only the learner's own, only what is real", () => {
  it("the daily goal separates planned from finished minutes and covers Monday to Sunday", async () => {
    const home = (await getLearnerHome(a, at(START)))!;
    expect(home.goal.plannedMinutes).toBe(home.minutesToday);
    expect(home.goal.doneMinutes).toBe(0);
    expect(home.goal.days.map((d) => d.label)).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
    expect(home.goal.days[0]).toMatchObject({ date: START, isToday: true });
    expect(home.goal.days[1]).toMatchObject({ state: "REST", isToday: false }); // Tuesday is not a study day
    expect(home.goal.days[2].state).toBe("UPCOMING"); // Wednesday is planned
    expect(home.goal.days[0].state).toBe("PENDING"); // today, nothing finished yet
  });

  it("XP and level are the official numbers (a new learner has none) and the next level is a real target", async () => {
    const home = (await getLearnerHome(a, at(START)))!;
    expect(home.progress).toEqual({ xp: 0, level: 0, xpIntoLevel: 0, perLevel: 900 });
    await db.learnerDepartment.updateMany({ where: { userId: a, department: { code: "fswd" } }, data: { xp: 950 } });
    expect((await getLearnerHome(a, at(START)))!.progress).toMatchObject({ xp: 950, level: 1, xpIntoLevel: 50 });
    expect((await getLearnerHome(b, at(START)))!.progress.xp).toBe(0); // another learner's XP is not mine
    await db.learnerDepartment.updateMany({ where: { userId: a }, data: { xp: 0 } });
  });

  it("skills come only from the learner's own courses, with the honest state of each", async () => {
    const homeA = (await getLearnerHome(a, at(START)))!;
    const homeB = (await getLearnerHome(b, at(START)))!;
    expect(homeA.skills.length).toBeGreaterThan(0);
    expect(homeA.skills.every((s) => s.courseCode === "fswd" && s.lessons > 0 && s.state === "NOT_YET")).toBe(true);
    expect(homeB.skills.every((s) => s.courseCode === "photo")).toBe(true);
    const skill = await db.skill.findFirstOrThrow({ where: { department: { code: "fswd" }, missions: { some: {} } } });
    await db.userSkill.create({ data: { userId: a, skillId: skill.id, tier: "SELF_ASSESSED" } });
    expect((await getLearnerHome(a, at(START)))!.skills.find((s) => s.name === skill.name)?.state).toBe("SELF");
    await db.userSkill.update({ where: { userId_skillId: { userId: a, skillId: skill.id } }, data: { tier: "VERIFIED" } });
    expect((await getLearnerHome(a, at(START)))!.skills.find((s) => s.name === skill.name)?.state).toBe("CONFIRMED");
    expect((await getLearnerHome(b, at(START)))!.skills.some((s) => s.name === skill.name)).toBe(false);
  });

  it("the programmes to explore are the published ones the learner has not added, kept apart from their own", async () => {
    const home = (await getLearnerHome(a, at(START)))!;
    expect(home.courses.map((c) => c.code)).toEqual(["fswd"]);
    expect(home.explore.length).toBeGreaterThan(0);
    expect(home.explore.length).toBeLessThanOrEqual(6);
    expect(home.explore.map((o) => o.code)).not.toContain("fswd");
    expect(home.explore.every((o) => o.lessons > 0)).toBe(true);
    expect((await getLearnerHome(b, at(START)))!.explore.map((o) => o.code)).not.toContain("photo");
  });

  it("the continue card names the course and its real plan progress", async () => {
    const home = (await getLearnerHome(a, at(START)))!;
    expect(home.continue).toMatchObject({ courseCode: "fswd", reason: "NEXT_SESSION" });
    expect(home.continue?.percent).toBe(home.courses[0].percent);
  });

  it("achievements are only those the learner actually earned", async () => {
    expect((await getLearnerHome(a, at(START)))!.earnedAchievements).toEqual([]);
    const badge = await db.achievement.create({ data: { code: "dash-test-badge", name: "Test badge", description: "For a test", icon: "star" } });
    await db.userAchievement.create({ data: { userId: a, achievementId: badge.id } });
    expect((await getLearnerHome(a, at(START)))!.earnedAchievements).toEqual([{ name: "Test badge", description: "For a test" }]);
    expect((await getLearnerHome(b, at(START)))!.earnedAchievements).toEqual([]);
  });
});

describe("search", () => {
  it("cleans the query and refuses to search for less than two letters", async () => {
    expect(cleanQuery("  a   b  ")).toBe("a b");
    expect(cleanQuery("x".repeat(500))).toHaveLength(80);
    expect(cleanQuery(null)).toBe("");
    expect(await searchAcademy(a, "a")).toMatchObject({ tooShort: true, total: 0 });
    expect(await searchAcademy(a, "   ")).toMatchObject({ tooShort: true, total: 0 });
  });

  it("finds lessons in the learner's own course and nothing from courses they have not added", async () => {
    const r = await searchAcademy(a, "responsive");
    expect(r.lessons.map((l) => l.href)).toContain("/missions/FSWD-L0-01");
    expect(r.courses).toEqual([]);
    const own = await searchAcademy(a, "full-stack");
    expect(own.courses.map((c) => c.href)).toContain("/departments/fswd");
    // B takes photography only: B must not see the web development lesson.
    expect((await searchAcademy(b, "responsive")).lessons.map((l) => l.href)).not.toContain("/missions/FSWD-L0-01");
    expect((await searchAcademy(b, "exposures")).lessons.map((l) => l.href)).toContain("/missions/PHOTO-L0-01");
    expect((await searchAcademy(a, "exposures")).lessons).toEqual([]);
  });

  it("lists courses the learner could add under their own heading, and the original programme still sees every course", async () => {
    const r = await searchAcademy(a, "photography");
    expect(r.explore.some((e) => e.href === "/courses")).toBe(true);
    expect(r.lessons).toEqual([]);
    expect((await searchAcademy(legacy, "exposures")).lessons.map((l) => l.href)).toContain("/missions/PHOTO-L0-01");
  });

  it("only ever returns a learner's own assessments", async () => {
    await startMission(b, "PHOTO-L0-01");
    const lm = await db.learnerMission.findFirstOrThrow({ where: { userId: b, mission: { code: "PHOTO-L0-01" } } });
    const sub = await db.submission.create({ data: { userId: b, learnerMissionId: lm.id, attempt: 1, status: "SUBMITTED", explanation: "x", submittedAt: new Date() } });
    expect((await searchAcademy(b, "exposures")).assessments.map((h) => h.href)).toContain(`/assessments/${sub.id}`);
    expect((await searchAcademy(a, "exposures")).assessments).toEqual([]);
  });

  it("treats odd text as plain text", async () => {
    for (const q of ["'; DROP TABLE \"User\"; --", "%%", "_ _", "<script>alert(1)</script>", "\\"]) {
      await expect(searchAcademy(a, q)).resolves.toMatchObject({ total: 0 }); // wildcard characters are removed, so they match nothing
    }
    expect(await db.user.count({ where: { email: { startsWith: "dash-test" } } })).toBeGreaterThan(0);
  });
});

describe("the new layout", () => {
  const nav = read("src/components/layout/nav-links.tsx");
  const home = read("src/components/home/learner-home.tsx");

  it("every navigation entry and the search form lead to a real page", () => {
    const routes = [...nav.matchAll(/to: "(\/[a-z-]*)"/g)].map((m) => m[1]);
    expect(routes.length).toBeGreaterThanOrEqual(10);
    for (const route of [...routes, "/search", "/settings", "/courses"]) {
      const pages = route === "/" ? ["src/app/(app)/page.tsx"] : [`src/app/(app)${route}/page.tsx`, `src/app/(account)${route}/page.tsx`];
      expect(pages.some((p) => existsSync(p)), `${route} -> ${pages.join(" or ")}`).toBe(true);
    }
    expect(read("src/components/layout/header-bar.tsx")).toContain('action="/search"');
  });

  it("offers no navigation for features the Academy does not have", () => {
    expect(nav).not.toMatch(/Challenges|Community|Friends|Leaderboard/);
    expect(home).not.toMatch(/Leaderboard|leaderboard/); // no rankings exist, so none are shown
  });

  it("keeps the existing theme: no colours are written into the new components, only the theme tokens", () => {
    for (const file of ["src/components/home/learner-home.tsx", "src/components/home/hero-illustration.tsx", "src/components/layout/header-bar.tsx", "src/components/layout/nav-links.tsx"]) {
      const text = read(file);
      expect(text, file).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgb\(|(?<![\w-])hsl\(\s*\d/);
    }
  });

  it("the illustration and its movement are decorative and stop for reduced motion", () => {
    expect(read("src/components/home/hero-illustration.tsx")).toContain('aria-hidden="true"');
    const css = read("src/components/home/doodles.css");
    const reduced = css.slice(css.lastIndexOf("@media (prefers-reduced-motion: reduce)"));
    for (const selector of [".hero-a", ".dash-card", ".ring-arc", ".bar-fill"]) expect(reduced, selector).toContain(selector);
    const keyframes = css.slice(css.indexOf("@keyframes hero-float-a"));
    expect(keyframes.split("@media")[0]).not.toMatch(/\b(left|top|width|height|margin|box-shadow|filter)\s*:/);
  });

  it("the page still falls back to the original Command page for learners who are not on a personalised plan", () => {
    const page = read("src/app/(app)/page.tsx");
    expect(page).toContain("getLearnerHome");
    expect(page).toContain("LearnerHomeView");
  });
});
