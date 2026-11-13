import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { assessSubmission } from "@/lib/assessments/service";
import { registerUser } from "@/lib/auth/service";
import { db } from "@/lib/db";
import { createEvidence } from "@/lib/evidence/service";
import { startMission, submitMission } from "@/lib/missions/progress";
import { claimRequest, releaseRequest, requestReview, type Actor } from "@/lib/reviews/service";
import { LocalDiskStorage, setStorageForTests } from "@/lib/storage";

// The route reads the session from cookies; stand in for it with a fixed user.
type SessionUser = { id: string; email: string; displayName: string; role: "LEARNER" | "ADMIN" | "AUTHOR" | "REVIEWER" };
const session = vi.hoisted(() => ({ user: null as SessionUser | null }));
vi.mock("@/lib/auth/dal", () => ({ getCurrentUser: async () => session.user, requireUser: async () => session.user }));

import { GET as ownerFile } from "@/app/api/evidence/[id]/file/route";
import { GET as reviewerFile } from "@/app/api/review/[requestId]/evidence/[evidenceId]/file/route";

const PASSWORD = "correct-horse-42battery";
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64, 7)]);
const seed = () => execFileSync("npx", ["tsx", "prisma/seed.ts"], { env: process.env, stdio: "ignore", shell: true });

let dir = "";
const u: Record<string, SessionUser> = {};
let requestId = "";
let evidenceId = "";
let otherEvidenceId = "";

async function make(name: string, role: SessionUser["role"], scopes: string[] = []) {
  const reg = await registerUser({ displayName: name, email: `rrt-test-${name.toLowerCase()}@example.test`, password: PASSWORD });
  if (!reg.ok) throw new Error("registration failed");
  if (role !== "LEARNER") await db.user.update({ where: { id: reg.userId }, data: { role } });
  for (const code of scopes) await db.reviewerScope.create({ data: { userId: reg.userId, departmentId: (await db.department.findUniqueOrThrow({ where: { code } })).id } });
  u[name] = { id: reg.userId, email: `rrt-test-${name.toLowerCase()}@example.test`, displayName: name, role };
}
const actor = (x: SessionUser): Actor => ({ id: x.id, role: x.role, displayName: x.displayName });
const call = (route: typeof reviewerFile, who: SessionUser | null, rid: string, eid: string) => {
  session.user = who;
  return route(new NextRequest(`http://localhost/api/review/${rid}/evidence/${eid}/file`), { params: Promise.resolve({ requestId: rid, evidenceId: eid }) });
};

beforeAll(async () => {
  dir = mkdtempSync(path.join(tmpdir(), "jz-review-"));
  setStorageForTests(new LocalDiskStorage(dir));
  await db.user.deleteMany({ where: { email: { startsWith: "rrt-test" } } });
  seed();
  await make("Learner", "LEARNER");
  await make("Peer", "LEARNER");
  await make("Rita", "REVIEWER", ["fswd"]);
  await make("Uma", "REVIEWER", ["uxui"]);
  await make("Ada", "ADMIN");

  const L = u.Learner.id;
  await startMission(L, "FSWD-L0-01");
  const lm = await db.learnerMission.findFirstOrThrow({ where: { userId: L, mission: { code: "FSWD-L0-01" } } });
  const ev = await createEvidence(L, { title: "Screenshot", departmentCode: "fswd", kind: "Screenshot", description: "", linkUrl: "", capturedDate: "2026-11-16" }, { name: "shot.png", data: PNG }, lm.id);
  if (!ev.ok) throw new Error(ev.error);
  evidenceId = ev.id;
  const other = await createEvidence(L, { title: "Private, unrelated", departmentCode: "fswd", kind: "Screenshot", description: "", linkUrl: "", capturedDate: "2026-11-16" }, { name: "private.png", data: PNG });
  if (!other.ok) throw new Error(other.error);
  otherEvidenceId = other.id;
  const sent = await submitMission(L, lm.id, { explanation: "I completed every step and tested the edge cases carefully.", githubUrl: "", liveUrl: "" });
  if (!sent.ok) throw new Error(sent.error);
  const submission = await db.submission.findFirstOrThrow({ where: { learnerMissionId: lm.id } });
  const criteria = await db.rubricCriterion.findMany({ where: { rubric: { mission: { code: "FSWD-L0-01" } } }, orderBy: { position: "asc" } });
  await assessSubmission(L, submission.id, { scores: criteria.map((c) => ({ criterionId: c.id, points: c.maxPoints })) });
  const assessment = await db.assessment.findUniqueOrThrow({ where: { submissionId: submission.id } });
  await requestReview(L, assessment.id);
  requestId = (await db.reviewRequest.findUniqueOrThrow({ where: { assessmentId: assessment.id } })).id;
}, 240_000);

afterAll(async () => {
  await db.user.deleteMany({ where: { email: { startsWith: "rrt-test" } } });
  await db.$disconnect();
  setStorageForTests(undefined);
  rmSync(dir, { recursive: true, force: true });
});

describe("reviewer access to learner evidence (/api/review/.../file)", () => {
  it("needs a session and a reviewer role, and answers 404 (not 403) to anyone else", async () => {
    expect((await call(reviewerFile, null, requestId, evidenceId)).status).toBe(401);
    for (const who of [u.Learner, u.Peer]) expect((await call(reviewerFile, who, requestId, evidenceId)).status, who.displayName).toBe(404);
  });

  it("is closed until a reviewer has claimed the request, and then only for that reviewer", async () => {
    expect((await call(reviewerFile, u.Rita, requestId, evidenceId)).status).toBe(404); // open, not claimed
    expect(await claimRequest(actor(u.Rita), requestId)).toEqual({ ok: true });
    expect((await call(reviewerFile, u.Ada, requestId, evidenceId)).status).toBe(404); // another reviewer
    expect((await call(reviewerFile, u.Uma, requestId, evidenceId)).status).toBe(404); // out of scope

    const ok = await call(reviewerFile, u.Rita, requestId, evidenceId);
    expect(ok.status).toBe(200);
    expect(ok.headers.get("content-type")).toBe("image/png");
    expect(ok.headers.get("x-content-type-options")).toBe("nosniff");
    expect(ok.headers.get("content-security-policy")).toBe("default-src 'none'; sandbox");
    expect(ok.headers.get("cache-control")).toBe("private, no-store");
    expect(Buffer.from(await ok.arrayBuffer()).equals(PNG)).toBe(true);
  });

  it("never exposes evidence outside the submission under review, or with mismatched ids", async () => {
    expect((await call(reviewerFile, u.Rita, requestId, otherEvidenceId)).status).toBe(404);
    expect((await call(reviewerFile, u.Rita, requestId, "does-not-exist")).status).toBe(404);
    expect((await call(reviewerFile, u.Rita, "does-not-exist", evidenceId)).status).toBe(404);
  });

  it("writes an audit row for every successful access (and none for refused ones)", async () => {
    const log = await db.evidenceAccessLog.findMany({ where: { evidenceId }, orderBy: { at: "asc" } });
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({ reviewerId: u.Rita.id, learnerId: u.Learner.id, reviewRequestId: requestId, action: "VIEW_FILE" });
    expect(await db.evidenceAccessLog.count({ where: { evidenceId: otherEvidenceId } })).toBe(0);
    await call(reviewerFile, u.Rita, requestId, evidenceId);
    expect(await db.evidenceAccessLog.count({ where: { evidenceId } })).toBe(2);
  });

  it("stops working as soon as the request is released", async () => {
    expect(await releaseRequest(actor(u.Rita), requestId)).toEqual({ ok: true });
    expect((await call(reviewerFile, u.Rita, requestId, evidenceId)).status).toBe(404);
  });

  it("leaves the learner's own file route exactly as it was: owner only", async () => {
    const own = (who: SessionUser | null) => {
      session.user = who;
      return ownerFile(new NextRequest(`http://localhost/api/evidence/${evidenceId}/file`), { params: Promise.resolve({ id: evidenceId }) });
    };
    expect((await own(u.Learner)).status).toBe(200);
    expect((await own(u.Peer)).status).toBe(404);
    expect((await own(u.Rita)).status).toBe(404); // a reviewer has no standing access to a learner's vault
    expect((await own(null)).status).toBe(401);
  });
});
