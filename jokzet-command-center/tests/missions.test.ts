import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { db } from "@/lib/db";
import { registerUser } from "@/lib/auth/service";
import {
  createCustomMission, deleteMission, getTotalXp, listDepartments, listMissions, saveNextMilestone, setMissionDone,
} from "@/lib/missions/service";
import { getMissionDetail, saveProgress, startMission, submitMission } from "@/lib/missions/progress";
import { computeStreak, levelProgress, sameIsoWeek, todayISO } from "@/lib/programme";
import { MAX_CUSTOM_XP } from "@/lib/missions/schema";

const A = "mission-test-a@example.test";
const B = "mission-test-b@example.test";
const PASSWORD = "correct-horse-42battery";
let userA = "";
let userB = "";

beforeAll(async () => {
  await db.user.deleteMany({ where: { email: { startsWith: "mission-test" } } });
  // Seed the curriculum into the TEST database (setup-env points DATABASE_URL at it).
  execFileSync("npx", ["tsx", "prisma/seed.ts"], { env: process.env, stdio: "ignore", shell: true });
  const a = await registerUser({ displayName: "A", email: A, password: PASSWORD });
  const b = await registerUser({ displayName: "B", email: B, password: PASSWORD });
  if (!a.ok || !b.ok) throw new Error("registration failed");
  userA = a.userId;
  userB = b.userId;
}, 120_000);

afterAll(async () => {
  await db.user.deleteMany({ where: { email: { startsWith: "mission-test" } } });
  await db.$disconnect();
});

describe("curriculum seed", () => {
  it("has 9 departments, 18 published Level 0 missions, each with full methodology", async () => {
    expect(await db.department.count()).toBe(9);
    const missions = await db.mission.findMany({
      where: { createdById: null }, include: { steps: true, rubric: { include: { criteria: true } }, resources: true },
    });
    expect(missions).toHaveLength(18);
    for (const m of missions) {
      expect(m.isPublished).toBe(true);
      expect(m.objective && m.experimentChallenge && m.submissionRequirements && m.remediation).toBeTruthy();
      expect(m.durationMinutes).toBeGreaterThan(0);
      expect(m.requiredTools.length).toBeGreaterThan(0);
      const phases = new Set(m.steps.map((s) => s.phase));
      expect([...phases].sort()).toEqual(["DO", "EXPERIMENT", "SHOW", "WATCH"]);
      expect(m.rubric?.passingScore).toBe(70);
      expect(m.rubric?.criteria.reduce((s, c) => s + c.maxPoints, 0)).toBe(100);
      expect(m.resources.every((r) => r.url === null)).toBe(true); // never invented
    }
  });
});

describe("registration schedules Level 0", () => {
  it("starts every department at Level 0 and schedules missions from 16 Nov 2026 on the right weekday", async () => {
    const departments = await listDepartments(userA);
    expect(departments).toHaveLength(9);
    expect(departments.every((d) => d.level === 0 && d.xp === 0)).toBe(true);

    const missions = await listMissions(userA);
    expect(missions).toHaveLength(18);
    const fswd = missions.filter((m) => m.departmentCode === "fswd").map((m) => m.date);
    expect(fswd).toEqual(["2026-11-16", "2026-11-23"]); // Mondays
    expect(missions.find((m) => m.departmentCode === "uxui")?.date).toBe("2026-11-17"); // Tuesday
    expect(missions.find((m) => m.departmentCode === "sec")?.date).toBe("2026-11-18"); // Wednesday
    expect(missions.find((m) => m.departmentCode === "photo")?.date).toBe("2026-11-21"); // Saturday
  });
});

describe("XP and levels (server side, idempotent)", () => {
  it("awards XP once, never twice, and revokes it when un-done", async () => {
    const [m] = (await listMissions(userA)).filter((x) => x.departmentCode === "fswd");
    expect(await setMissionDone(userA, m.id, true)).toBe(true);
    await setMissionDone(userA, m.id, true); // repeat: must not double-award
    let fswd = (await listDepartments(userA)).find((d) => d.code === "fswd")!;
    expect(fswd.xp).toBe(m.xpReward);

    await setMissionDone(userA, m.id, false);
    await setMissionDone(userA, m.id, false);
    fswd = (await listDepartments(userA)).find((d) => d.code === "fswd")!;
    expect(fswd.xp).toBe(0);
    expect(fswd.level).toBe(0);
  });

  it("raises the level at 300 XP", async () => {
    const custom = [];
    for (let i = 0; i < 6; i++) {
      custom.push(await createCustomMission(userA, {
        title: `XP farm ${i}`, departmentCode: "uxui", date: "2026-11-17", minutes: 30, kind: "Design",
        evidenceType: "Screenshot", xpReward: MAX_CUSTOM_XP, notes: "",
      }));
    }
    for (const c of custom) await setMissionDone(userA, c.id, true);
    const uxui = (await listDepartments(userA)).find((d) => d.code === "uxui")!;
    expect(uxui.xp).toBe(300);
    expect(uxui.level).toBe(1);
    expect(levelProgress(uxui.xp).pct).toBe(0);
    expect(await getTotalXp(userA)).toBe(300);
    for (const c of custom) await deleteMission(userA, c.id); // deleting revokes XP
    expect((await listDepartments(userA)).find((d) => d.code === "uxui")!.xp).toBe(0);
  });

  it("caps client-supplied XP on self-made missions", async () => {
    await expect(createCustomMission(userA, {
      title: "cheat", departmentCode: "fswd", date: "2026-11-16", minutes: 30, kind: "Build",
      evidenceType: "Code", xpReward: 99999, notes: "",
    })).rejects.toThrow();
  });
});

describe("ownership and authorization", () => {
  it("never lets another user toggle, delete or read a mission", async () => {
    const [mine] = await listMissions(userA);
    expect(await setMissionDone(userB, mine.id, true)).toBe(false);
    expect(await deleteMission(userB, mine.id)).toBe(false);
    expect(await getTotalXp(userB)).toBe(0);
    expect((await listMissions(userB)).some((m) => m.id === mine.id)).toBe(false);
  });

  it("scopes milestones, progress and submissions to the owner", async () => {
    const depts = await listDepartments(userA);
    expect(await saveNextMilestone(userB, depts[0].id, "stolen")).toBe(true); // B edits B's own row
    expect((await listDepartments(userA))[0].nextMilestone).not.toBe("stolen"); // A is untouched (still the curriculum default)

    const detailA = await getMissionDetail(userA, "FSWD-L0-01");
    const lmA = detailA!.learnerMission!;
    expect(await saveProgress(userB, lmA.id, { completedSteps: [], notes: "x" })).toBe(false);
    const res = await submitMission(userB, lmA.id, { explanation: "x".repeat(30), githubUrl: "", liveUrl: "" });
    expect(res).toEqual({ ok: false, error: "Mission not found." });
  });
});

describe("mission workflow: start, save, submit, resubmit", () => {
  it("runs start → save progress → submit, rejects bad links, and blocks double submit", async () => {
    expect(await startMission(userA, "FSWD-L0-01")).toBe(true);
    const detail = await getMissionDetail(userA, "FSWD-L0-01");
    const lm = detail!.learnerMission!;
    expect(lm.status).toBe("IN_PROGRESS");

    const stepIds = detail!.mission.steps.map((s) => s.id);
    await saveProgress(userA, lm.id, { completedSteps: [stepIds[0], "foreign-step-id"], notes: "my notes" });
    const saved = await db.learnerMission.findUniqueOrThrow({ where: { id: lm.id } });
    expect(saved.completedSteps).toEqual([stepIds[0]]); // foreign ids dropped
    expect(saved.notes).toBe("my notes");

    const bad = await submitMission(userA, lm.id, { explanation: "short", githubUrl: "", liveUrl: "" });
    expect(bad.ok).toBe(false);
    const badLink = await submitMission(userA, lm.id, { explanation: "x".repeat(30), githubUrl: "javascript:alert(1)", liveUrl: "" });
    expect(badLink.ok).toBe(false);

    const first = await submitMission(userA, lm.id, { explanation: "I built it and tested it.", githubUrl: "https://example.test/repo", liveUrl: "" });
    expect(first).toEqual({ ok: true, attempt: 1 });
    const again = await submitMission(userA, lm.id, { explanation: "I built it and tested it.", githubUrl: "", liveUrl: "" });
    expect(again.ok).toBe(false); // waiting for assessment

    // Simulate an assessor asking for revision, then resubmit as attempt 2.
    await db.learnerMission.update({ where: { id: lm.id }, data: { status: "NEEDS_REVISION" } });
    expect(await submitMission(userA, lm.id, { explanation: "Fixed the layout bug.", githubUrl: "https://example.test/repo-fixed", liveUrl: "" })).toEqual({ ok: true, attempt: 2 });
  });
});

describe("programme date helpers (Africa/Accra)", () => {
  it("computes streaks, weeks and today in Accra time", () => {
    expect(computeStreak(["2026-11-14", "2026-11-15", "2026-11-16"], "2026-11-16")).toBe(3);
    expect(computeStreak(["2026-11-14", "2026-11-15"], "2026-11-16")).toBe(2); // yesterday still counts
    expect(computeStreak(["2026-11-10"], "2026-11-16")).toBe(0);
    expect(sameIsoWeek("2026-11-16", "2026-11-22")).toBe(true);
    expect(sameIsoWeek("2026-11-22", "2026-11-23")).toBe(false);
    expect(todayISO(new Date("2026-11-16T23:30:00Z"))).toBe("2026-11-16"); // Accra = UTC
  });
});
