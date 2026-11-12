import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { assessSubmission, getAssessmentOverview, outcomeFor, setCorrectionResolved } from "@/lib/assessments/service";
import { db } from "@/lib/db";
import { createEvidence } from "@/lib/evidence/service";
import { startMission, submitMission } from "@/lib/missions/progress";
import { listDepartments, setMissionDone } from "@/lib/missions/service";
import { LocalDiskStorage, setStorageForTests } from "@/lib/storage";

let dir = "";
let userA = "";
let userB = "";
const EXPLAIN = "I completed every step and tested the edge cases carefully.";

async function submitFor(userId: string, code: string, link = "https://github.com/jokzet/work") {
  await startMission(userId, code);
  const lm = await db.learnerMission.findFirstOrThrow({ where: { userId, mission: { code } } });
  const ev = await createEvidence(userId, { title: `Evidence for ${code}`, departmentCode: code.startsWith("SEC") ? "sec" : "fswd", kind: "Link", description: "", linkUrl: link, capturedDate: "2026-11-16" }, undefined, lm.id);
  if (!ev.ok) throw new Error(ev.error);
  const sent = await submitMission(userId, lm.id, { explanation: EXPLAIN, githubUrl: "", liveUrl: "" });
  if (!sent.ok) throw new Error(sent.error);
  const submission = await db.submission.findFirstOrThrow({ where: { learnerMissionId: lm.id, attempt: sent.attempt } });
  const criteria = await db.rubricCriterion.findMany({ where: { rubric: { mission: { code } } }, orderBy: { position: "asc" } });
  return { lm, submission, criteria, evidenceId: ev.id };
}
const scoresOf = (criteria: { id: string; maxPoints: number }[], pts: number[]) => criteria.map((c, i) => ({ criterionId: c.id, points: pts[i] }));
const xpOf = async (userId: string, code: string) => (await listDepartments(userId)).find((d) => d.code === code)!.xp;

beforeAll(async () => {
  dir = mkdtempSync(path.join(tmpdir(), "jz-assess-"));
  setStorageForTests(new LocalDiskStorage(dir));
  await db.user.deleteMany({ where: { email: { startsWith: "assess-test" } } });
  execFileSync("npx", ["tsx", "prisma/seed.ts"], { env: process.env, stdio: "ignore", shell: true });
  userA = (await db.user.create({ data: { email: "assess-test-a@example.test", passwordHash: "x" } })).id;
  userB = (await db.user.create({ data: { email: "assess-test-b@example.test", passwordHash: "x" } })).id;
  for (const userId of [userA, userB]) {
    const departments = await db.department.findMany({ select: { id: true } });
    await db.learnerDepartment.createMany({ data: departments.map((d) => ({ userId, departmentId: d.id })), skipDuplicates: true });
  }
}, 120_000);

afterAll(async () => {
  await db.user.deleteMany({ where: { email: { startsWith: "assess-test" } } });
  await db.$disconnect();
  setStorageForTests(undefined);
  rmSync(dir, { recursive: true, force: true });
});

describe("outcome thresholds", () => {
  it("passes at the passing score, revises below it, and fails under 40%", () => {
    expect(outcomeFor(70, 70)).toBe("PASS");
    expect(outcomeFor(100, 70)).toBe("PASS");
    expect(outcomeFor(69, 70)).toBe("REVISE");
    expect(outcomeFor(40, 70)).toBe("REVISE");
    expect(outcomeFor(39, 70)).toBe("FAIL");
    expect(outcomeFor(0, 70)).toBe("FAIL");
  });
});

describe("assessment validation and authorization", () => {
  it("only assesses submitted evidence, completely, exactly once, and only for the owner", async () => {
    await startMission(userA, "FSWD-L0-01");
    const lm = await db.learnerMission.findFirstOrThrow({ where: { userId: userA, mission: { code: "FSWD-L0-01" } } });
    const criteria = await db.rubricCriterion.findMany({ where: { rubric: { mission: { code: "FSWD-L0-01" } } }, orderBy: { position: "asc" } });
    // A draft (not yet submitted) cannot be assessed.
    const draft = await db.submission.create({ data: { userId: userA, learnerMissionId: lm.id, attempt: 1, status: "DRAFT" } });
    expect(await assessSubmission(userA, draft.id, { scores: scoresOf(criteria, [25, 30, 20, 25]) })).toMatchObject({ ok: false, error: expect.stringMatching(/Submit the mission/) });
    await db.submission.delete({ where: { id: draft.id } });
    await db.learnerMission.update({ where: { id: lm.id }, data: { status: "NOT_STARTED" } });

    const { submission, criteria: c } = await submitFor(userA, "FSWD-L0-01");
    const full = scoresOf(c, [25, 30, 20, 25]);

    expect(await assessSubmission(userB, submission.id, { scores: full })).toMatchObject({ ok: false, error: "Submission not found." }); // someone else's
    expect(await assessSubmission(userA, submission.id, { scores: full.slice(1) })).toMatchObject({ ok: false, error: expect.stringMatching(/every criterion/) });
    expect(await assessSubmission(userA, submission.id, { scores: [...full.slice(0, 3), full[0]] })).toMatchObject({ ok: false, error: expect.stringMatching(/only once/) });
    expect(await assessSubmission(userA, submission.id, { scores: scoresOf(c, [26, 30, 20, 25]) })).toMatchObject({ ok: false, error: expect.stringMatching(/out of 25/) });
    expect(await assessSubmission(userA, submission.id, { scores: scoresOf(c, [-1, 30, 20, 25]) })).toMatchObject({ ok: false });
    expect(await assessSubmission(userA, submission.id, { scores: [{ criterionId: "not-a-criterion", points: 5 }, ...full.slice(1)] })).toMatchObject({ ok: false, error: expect.stringMatching(/not part of this rubric/) });
    expect(await assessSubmission(userA, submission.id, { scores: full, feedback: "my password = hunter2hunter2" })).toMatchObject({ ok: false, error: expect.stringMatching(/secret/i) });
    // Nothing above may have changed anything.
    expect(await db.assessment.count({ where: { userId: userA } })).toBe(0);
    expect((await db.submission.findUniqueOrThrow({ where: { id: submission.id } })).status).toBe("SUBMITTED");
  });
});

describe("pass: completes the mission, awards XP once, verifies evidence, records skills", () => {
  it("a full-marks assessment passes and credits the mission's XP and skills", async () => {
    const sub = await db.submission.findFirstOrThrow({ where: { userId: userA, learnerMission: { mission: { code: "FSWD-L0-01" } }, status: "SUBMITTED" }, include: { learnerMission: { include: { mission: { include: { skills: true } } } } } });
    const criteria = await db.rubricCriterion.findMany({ where: { rubric: { mission: { code: "FSWD-L0-01" } } }, orderBy: { position: "asc" } });
    const xpBefore = await xpOf(userA, "fswd");

    const result = await assessSubmission(userA, sub.id, { scores: scoresOf(criteria, [25, 30, 20, 25]), feedback: "Clean work." });
    expect(result).toMatchObject({ ok: true, outcome: "PASS", percentage: 100, totalPoints: 100, xpAwarded: 40 });
    expect(await xpOf(userA, "fswd")).toBe(xpBefore + 40);

    const lm = await db.learnerMission.findUniqueOrThrow({ where: { id: sub.learnerMissionId } });
    expect(lm).toMatchObject({ status: "PASSED", xpAwarded: 40 });
    expect((await db.submission.findUniqueOrThrow({ where: { id: sub.id } })).status).toBe("ASSESSED");
    expect((await db.evidenceItem.findMany({ where: { submissionId: sub.id } })).every((e) => e.status === "VERIFIED")).toBe(true);
    expect(await db.userSkill.count({ where: { userId: userA } })).toBe(sub.learnerMission.mission.skills.length);
    expect(await db.feedback.count({ where: { assessment: { submissionId: sub.id }, kind: "GENERAL" } })).toBe(1);
    expect(await db.feedback.count({ where: { assessment: { submissionId: sub.id }, kind: { in: ["CORRECTION", "REMEDIATION"] } } })).toBe(0); // a pass has none

    // Assessing again is refused and XP does not move.
    expect(await assessSubmission(userA, sub.id, { scores: scoresOf(criteria, [25, 30, 20, 25]) })).toMatchObject({ ok: false, error: expect.stringMatching(/already assessed/) });
    expect(await xpOf(userA, "fswd")).toBe(xpBefore + 40);
    // A passed mission cannot be un-done from the board.
    expect(await setMissionDone(userA, sub.learnerMissionId, false)).toBe(false);
    expect((await db.learnerMission.findUniqueOrThrow({ where: { id: sub.learnerMissionId } })).status).toBe("PASSED");
  });

  it("does not double-award XP when the mission was already ticked done on the board", async () => {
    const { lm: lm0 } = await submitFor(userB, "FSWD-L0-02");
    // Ticking done awards XP, but the mission is SUBMITTED so reset to allow the legacy toggle first.
    await db.learnerMission.update({ where: { id: lm0.id }, data: { status: "NOT_STARTED" } });
    await setMissionDone(userB, lm0.id, true); // +40 via the board
    const xp1 = await xpOf(userB, "fswd");
    await db.learnerMission.update({ where: { id: lm0.id }, data: { status: "SUBMITTED" } });
    const sub = await db.submission.findFirstOrThrow({ where: { learnerMissionId: lm0.id } });
    const criteria = await db.rubricCriterion.findMany({ where: { rubric: { mission: { code: "FSWD-L0-02" } } }, orderBy: { position: "asc" } });
    const r = await assessSubmission(userB, sub.id, { scores: scoresOf(criteria, [20, 35, 25, 20]) });
    expect(r).toMatchObject({ ok: true, outcome: "PASS", xpAwarded: 0 });
    expect(await xpOf(userB, "fswd")).toBe(xp1);
  });
});

describe("revise: corrections, remediation, weakness tracking and resubmission", () => {
  it("below the passing score returns corrections and does not award XP", async () => {
    const { submission, criteria, evidenceId } = await submitFor(userA, "SEC-L0-01");
    const xpBefore = await xpOf(userA, "sec");

    const r = await assessSubmission(userA, submission.id, {
      scores: scoresOf(criteria, [20, 20, 10, 10]).map((s, i) => ({ ...s, comment: i === 1 ? "Network was not truly isolated" : undefined })),
      feedback: "Redo the isolation step.",
    });
    expect(r).toMatchObject({ ok: true, outcome: "REVISE", percentage: 60, xpAwarded: 0 });
    expect(await xpOf(userA, "sec")).toBe(xpBefore);

    expect((await db.learnerMission.findUniqueOrThrow({ where: { id: submission.learnerMissionId } })).status).toBe("NEEDS_REVISION");
    expect((await db.evidenceItem.findUniqueOrThrow({ where: { id: evidenceId } })).status).toBe("LOGGED"); // not verified

    const a = await db.assessment.findUniqueOrThrow({ where: { submissionId: submission.id }, include: { feedback: true } });
    expect(a.weaknesses).toHaveLength(4);
    const corrections = a.feedback.filter((f) => f.kind === "CORRECTION");
    expect(corrections).toHaveLength(4);
    expect(corrections.some((c) => c.body.includes("Network was not truly isolated"))).toBe(true); // learner's comment wins
    expect(a.feedback.filter((f) => f.kind === "REMEDIATION")).toHaveLength(1);
    expect(corrections.every((c) => c.resolvedAt === null)).toBe(true);
  });

  it("corrections can be ticked off and reopened, by their owner only", async () => {
    const correction = await db.feedback.findFirstOrThrow({ where: { kind: "CORRECTION", assessment: { userId: userA } } });
    expect(await setCorrectionResolved(userB, correction.id, true)).toBe(false);
    expect((await db.feedback.findUniqueOrThrow({ where: { id: correction.id } })).resolvedAt).toBeNull();
    expect(await setCorrectionResolved(userA, correction.id, true)).toBe(true);
    expect((await db.feedback.findUniqueOrThrow({ where: { id: correction.id } })).resolvedAt).not.toBeNull();
    expect(await setCorrectionResolved(userA, correction.id, false)).toBe(true);
    const general = await db.feedback.findFirstOrThrow({ where: { kind: "GENERAL", assessment: { userId: userA } } });
    expect(await setCorrectionResolved(userA, general.id, true)).toBe(false); // only corrections toggle
  });

  it("allows resubmission as attempt 2, and a pass then awards XP exactly once", async () => {
    const lm = await db.learnerMission.findFirstOrThrow({ where: { userId: userA, mission: { code: "SEC-L0-01" } } });
    // Without new evidence or links the resubmission is refused.
    expect(await submitMission(userA, lm.id, { explanation: EXPLAIN, githubUrl: "", liveUrl: "" })).toMatchObject({ ok: false, error: expect.stringMatching(/at least one piece of evidence/) });

    const fresh = await createEvidence(userA, { title: "Fixed isolation", departmentCode: "sec", kind: "Link", description: "", linkUrl: "https://example.test/fixed", capturedDate: "2026-11-17" }, undefined, lm.id);
    if (!fresh.ok) throw new Error(fresh.error);
    expect(await submitMission(userA, lm.id, { explanation: EXPLAIN, githubUrl: "", liveUrl: "" })).toEqual({ ok: true, attempt: 2 });

    const second = await db.submission.findFirstOrThrow({ where: { learnerMissionId: lm.id, attempt: 2 } });
    const criteria = await db.rubricCriterion.findMany({ where: { rubric: { mission: { code: "SEC-L0-01" } } }, orderBy: { position: "asc" } });
    const xpBefore = await xpOf(userA, "sec");
    expect(await assessSubmission(userA, second.id, { scores: scoresOf(criteria, [28, 33, 14, 18]) })).toMatchObject({ ok: true, outcome: "PASS", xpAwarded: 40 });
    expect(await xpOf(userA, "sec")).toBe(xpBefore + 40);
    expect(await db.assessment.count({ where: { userId: userA, rubric: { mission: { code: "SEC-L0-01" } } } })).toBe(2); // full history kept
  });

  it("a very low score is a FAIL and still returns corrections", async () => {
    const { submission, criteria } = await submitFor(userA, "UXUI-L0-01");
    expect(await assessSubmission(userA, submission.id, { scores: scoresOf(criteria, [2, 3, 3, 2]) })).toMatchObject({ ok: true, outcome: "FAIL", percentage: 10 });
    expect((await db.learnerMission.findUniqueOrThrow({ where: { id: submission.learnerMissionId } })).status).toBe("NEEDS_REVISION");
  });
});

describe("assessment overview", () => {
  it("summarises scores, outcomes and recurring weak areas for the owner only", async () => {
    const o = await getAssessmentOverview(userA);
    expect(o.stats.logged).toBe(4); // FSWD pass, SEC revise, SEC pass, UXUI fail
    expect(o.stats.passed).toBe(2);
    expect(o.stats.toRevise).toBe(2);
    expect(o.stats.average).toBe(Math.round((100 + 60 + 93 + 10) / 4));
    expect(o.rows.map((r) => r.outcome).sort()).toEqual(["fail", "pass", "pass", "revise"]);
    expect(o.weaknesses.length).toBeGreaterThan(0);
    expect(o.weaknesses.every((w) => w.count >= 1)).toBe(true);
    expect(o.pending).toEqual([]);

    const other = await getAssessmentOverview(userB);
    expect(other.stats.logged).toBe(1);
    expect(other.rows.every((r) => r.title !== "Set up an isolated practice lab")).toBe(true);
  });
});
