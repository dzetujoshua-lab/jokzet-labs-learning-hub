import { execFileSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getAnalytics, lastMonthKeys, lastWeekKeys } from "@/lib/analytics/service";
import { db } from "@/lib/db";
import {
  addFromMission, deletePiece, listPortfolio, listSuggestions, moveCapstoneStage, parseTools, saveCapstone, savePiece,
} from "@/lib/portfolio/service";

let userA = "";
let userB = "";
const email = (n: string) => `pfa-test-${n}@example.test`;

async function imageEvidence(userId: string, title: string) {
  const dept = await db.department.findUniqueOrThrow({ where: { code: "fswd" } });
  const file = await db.submissionFile.create({
    data: { userId, storageKey: `${userId.slice(-8)}${title.length}`.padEnd(32, "a"), originalName: "a.png", mimeType: "image/png", sizeBytes: 10, kind: "IMAGE", sha256: "0".repeat(64) },
  });
  return db.evidenceItem.create({ data: { userId, departmentId: dept.id, title, kind: "SCREENSHOT", capturedDate: new Date("2026-11-16"), fileId: file.id } });
}

beforeAll(async () => {
  await db.user.deleteMany({ where: { email: { startsWith: "pfa-test" } } });
  execFileSync("npx", ["tsx", "prisma/seed.ts"], { env: process.env, stdio: "ignore", shell: true });
  userA = (await db.user.create({ data: { email: email("a"), passwordHash: "x" } })).id;
  userB = (await db.user.create({ data: { email: email("b"), passwordHash: "x" } })).id;
}, 120_000);

afterAll(async () => {
  await db.user.deleteMany({ where: { email: { startsWith: "pfa-test" } } });
  await db.$disconnect();
});

describe("portfolio pieces", () => {
  it("splits tools into a clean, de-duplicated list", () => {
    expect(parseTools("React · Figma, Postgres | React;  ")).toEqual(["React", "Figma", "Postgres"]);
  });

  it("creates, edits and deletes only the owner's pieces", async () => {
    const created = await savePiece(userA, null, { title: "Invoice dashboard", departmentCode: "fswd", status: "building", summary: "A dashboard.", tools: "React, Postgres", repoUrl: "https://github.com/a/b", liveUrl: "" });
    if (!created.ok) throw new Error(created.error);
    expect((await listPortfolio(userA)).pieces[0]).toMatchObject({ title: "Invoice dashboard", status: "building", tools: ["React", "Postgres"], departmentCode: "fswd" });

    // Shipping stamps a completion date; moving back clears it.
    await savePiece(userA, created.id, { title: "Invoice dashboard", status: "shipped" });
    expect((await listPortfolio(userA)).pieces[0].completedDate).not.toBeNull();
    await savePiece(userA, created.id, { title: "Invoice dashboard", status: "concept" });
    expect((await listPortfolio(userA)).pieces[0].completedDate).toBeNull();

    // Another user can neither edit nor delete it.
    expect(await savePiece(userB, created.id, { title: "Hijacked" })).toMatchObject({ ok: false, error: "Piece not found." });
    expect(await deletePiece(userB, created.id)).toBe(false);
    expect((await listPortfolio(userB)).pieces).toHaveLength(0);

    expect(await deletePiece(userA, created.id)).toBe(true);
    expect((await listPortfolio(userA)).pieces).toHaveLength(0);
  });

  it("rejects bad links, secrets and invalid input without saving anything", async () => {
    expect(await savePiece(userA, null, { title: "x", repoUrl: "javascript:alert(1)" })).toMatchObject({ ok: false });
    expect(await savePiece(userA, null, { title: "x", liveUrl: "ftp://host/file" })).toMatchObject({ ok: false });
    expect(await savePiece(userA, null, { title: "   " })).toMatchObject({ ok: false });
    expect(await savePiece(userA, null, { title: "x", departmentCode: "nope" as never })).toMatchObject({ ok: false });
    expect(await savePiece(userA, null, { title: "x", summary: "my password = hunter2hunter2" })).toMatchObject({ ok: false, error: expect.stringMatching(/secret/i) });
    expect((await listPortfolio(userA)).pieces).toHaveLength(0);
  });

  it("accepts only the owner's own image evidence as a cover", async () => {
    const mine = await imageEvidence(userA, "mine");
    const theirs = await imageEvidence(userB, "theirs");
    expect(await savePiece(userA, null, { title: "Covered", coverEvidenceId: theirs.id })).toMatchObject({ ok: false });
    const ok = await savePiece(userA, null, { title: "Covered", coverEvidenceId: mine.id });
    expect(ok.ok).toBe(true);
    expect((await listPortfolio(userA)).pieces[0].coverEvidenceId).toBe(mine.id);
    // Deleting the evidence leaves the piece, just without a cover.
    await db.evidenceItem.delete({ where: { id: mine.id } });
    expect((await listPortfolio(userA)).pieces[0].coverEvidenceId).toBeNull();
  });
});

describe("showcase from passed missions", () => {
  it("offers only passed, not-yet-added missions and never adds twice", async () => {
    const mission = await db.mission.findUniqueOrThrow({ where: { code: "FSWD-L0-01" } });
    await db.learnerMission.create({ data: { userId: userA, missionId: mission.id, status: "COMPLETED", completedAt: new Date() } });
    expect(await listSuggestions(userA)).toHaveLength(0); // completed is not the same as passed
    expect(await addFromMission(userA, "FSWD-L0-01")).toMatchObject({ ok: false });

    await db.learnerMission.updateMany({ where: { userId: userA, missionId: mission.id }, data: { status: "PASSED" } });
    expect((await listSuggestions(userA)).map((s) => s.missionCode)).toEqual(["FSWD-L0-01"]);
    expect(await listSuggestions(userB)).toHaveLength(0);

    const added = await addFromMission(userA, "FSWD-L0-01");
    expect(added.ok).toBe(true);
    expect(await addFromMission(userA, "FSWD-L0-01")).toMatchObject({ ok: false, error: expect.stringMatching(/already/) });
    expect(await listSuggestions(userA)).toHaveLength(0);
    expect((await listPortfolio(userA)).pieces.find((p) => p.missionCode === "FSWD-L0-01")).toMatchObject({ status: "shipped" });
  });
});

describe("capstone", () => {
  it("creates stages, advances and steps back within bounds, and never drops finished stages", async () => {
    expect(await moveCapstoneStage(userA, 1)).toBe(false); // nothing to advance yet
    expect(await saveCapstone(userA, { title: "BusinessOS Ghana", stages: 4 })).toEqual({ ok: true });
    let c = (await listPortfolio(userA)).capstone!;
    expect(c).toMatchObject({ title: "BusinessOS Ghana", stage: 0, stages: 4 });

    expect(await moveCapstoneStage(userA, -1)).toBe(false);
    await moveCapstoneStage(userA, 1);
    await moveCapstoneStage(userA, 1);
    c = (await listPortfolio(userA)).capstone!;
    expect(c.stage).toBe(2);

    // Shrinking below the finished stages keeps them.
    await saveCapstone(userA, { title: "BusinessOS Ghana", stages: 1 });
    expect((await listPortfolio(userA)).capstone).toMatchObject({ stage: 2, stages: 2 });

    await saveCapstone(userA, { title: "BusinessOS Ghana", stages: 3 });
    expect((await listPortfolio(userA)).capstone?.stages).toBe(3);
    expect(await moveCapstoneStage(userA, 1)).toBe(true);
    expect(await moveCapstoneStage(userA, 1)).toBe(false); // already complete
    expect(await db.capstoneProject.count({ where: { userId: userA } })).toBe(1); // one capstone, edited in place
    expect((await listPortfolio(userB)).capstone).toBeNull();
  });
});

describe("analytics", () => {
  it("builds contiguous week and month keys", () => {
    expect(lastWeekKeys("2026-11-18", 3)).toEqual(["2026-11-02", "2026-11-09", "2026-11-16"]);
    expect(lastMonthKeys("2026-02-10", 4)).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
  });

  it("counts hours, missions, skills and scores per period, scoped to the user", async () => {
    const now = new Date("2026-11-20T12:00:00Z");
    const m1 = await db.mission.findUniqueOrThrow({ where: { code: "FSWD-L0-02" } });
    const m2 = await db.mission.findUniqueOrThrow({ where: { code: "UXUI-L0-01" } });
    // userB: one mission this week (60 logged minutes), one 3 weeks earlier (planned duration).
    await db.learnerMission.create({ data: { userId: userB, missionId: m1.id, status: "COMPLETED", completedAt: new Date("2026-11-17T10:00:00Z"), minutesSpent: 60 } });
    await db.learnerMission.create({ data: { userId: userB, missionId: m2.id, status: "PASSED", completedAt: new Date("2026-10-27T10:00:00Z") } });
    const skill = await db.skill.findFirstOrThrow({ where: { department: { code: "fswd" } } });
    await db.userSkill.create({ data: { userId: userB, skillId: skill.id, earnedAt: new Date("2026-11-17T10:00:00Z") } });

    const a = await getAnalytics(userB, now);
    const thisWeek = a.weekly.find((w) => w.key === "2026-11-16")!;
    expect(thisWeek).toMatchObject({ minutes: 60, missions: 1, skills: 1 });
    expect(a.weekly.find((w) => w.key === "2026-10-26")).toMatchObject({ minutes: m2.durationMinutes, missions: 1 });
    expect(a.weekly).toHaveLength(8);
    expect(a.monthly).toHaveLength(6);
    expect(a.monthly.find((m) => m.key === "2026-11")).toMatchObject({ missions: 1, minutes: 60 });
    expect(a.monthly.find((m) => m.key === "2026-10")).toMatchObject({ missions: 1 });
    expect(a.totals).toMatchObject({ minutes: 60 + m2.durationMinutes, missionsCompleted: 2, skills: 1, assessments: 0, averageScore: null, passRate: null });

    // A user with no activity sees zeros, not someone else's numbers.
    const empty = await db.user.create({ data: { email: email("empty"), passwordHash: "x" } });
    const e = await getAnalytics(empty.id, now);
    expect(e.totals).toMatchObject({ minutes: 0, missionsCompleted: 0, skills: 0 });
    expect(e.weekly.every((w) => w.minutes === 0 && w.averageScore === null)).toBe(true);
  });
});
