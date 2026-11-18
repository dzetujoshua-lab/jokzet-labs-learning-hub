import { execFileSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { getAssessmentContext } from "@/lib/assessments/service";
import { registerUser } from "@/lib/auth/service";
import { db } from "@/lib/db";
import { createEvidence } from "@/lib/evidence/service";
import { startMission, submitMission } from "@/lib/missions/progress";
import { getTotalXp } from "@/lib/missions/service";
import { listContentGaps } from "@/lib/resources/gaps";
import { getMissionWatch, recordEngagement } from "@/lib/resources/service";

vi.setConfig({ testTimeout: 60_000 });

// What a learner sees as preparation for an assessment: only APPROVED resources, the primary first, owner-scoped state, an honest gap.
const PASSWORD = "correct-horse-42battery";
const mail = (n: string) => `prep-test-${n}@example.test`;
const seed = () => execFileSync("npx", ["tsx", "prisma/seed.ts"], { env: process.env, stdio: "ignore", shell: true });
const URLS = {
  primary: "https://www.youtube.com/watch?v=PREPPRIMARY",
  extra: "https://developer.mozilla.org/en-US/docs/Learn/Test-prep",
  draft: "https://www.youtube.com/watch?v=PREPDRAFTXX",
  rejected: "https://www.youtube.com/watch?v=PREPREJECTD",
  archived: "https://www.youtube.com/watch?v=PREPARCHIVE",
};
let a = "";
let b = "";
let missionId = "";
let otherMissionId = "";

async function make(url: string, over: Record<string, unknown>) {
  const kind = url.includes("youtube") ? ("VIDEO" as const) : ("DOCUMENTATION" as const);
  const r = await db.learningResource.create({ data: { canonicalUrl: url, provider: url.includes("youtube") ? "youtube" : "mdn", kind, title: `Fixture ${url.slice(-10)}`, durationMinutes: 10, embeddable: kind === "VIDEO", status: "DRAFT" } });
  const status = (over.status as string) ?? "DRAFT";
  if (status === "APPROVED") await db.learningResource.update({ where: { id: r.id }, data: { status: "APPROVED", approvedBy: "Test Reviewer", approvedAt: new Date(), lastVerifiedAt: new Date() } });
  else if (status !== "DRAFT") await db.learningResource.update({ where: { id: r.id }, data: { status: status as "REJECTED" | "ARCHIVED" } });
  return r.id;
}

async function cleanup() {
  await db.user.deleteMany({ where: { email: { startsWith: "prep-test" } } });
  await db.missionResource.deleteMany({ where: { resource: { canonicalUrl: { in: Object.values(URLS) } } } });
  await db.learningResource.deleteMany({ where: { canonicalUrl: { in: Object.values(URLS) } } });
}
beforeAll(async () => {
  await cleanup();
  seed();
  const ra = await registerUser({ displayName: "A", email: mail("a"), password: PASSWORD }, { adultConfirmed: true });
  const rb = await registerUser({ displayName: "B", email: mail("b"), password: PASSWORD }, { adultConfirmed: true });
  if (!ra.ok || !rb.ok) throw new Error("registration failed");
  a = ra.userId;
  b = rb.userId;
  missionId = (await db.mission.findUniqueOrThrow({ where: { code: "FSWD-L0-01" } })).id;
  otherMissionId = (await db.mission.findUniqueOrThrow({ where: { code: "SEC-L0-01" } })).id;
  const ids = {
    primary: await make(URLS.primary, { status: "APPROVED" }),
    extra: await make(URLS.extra, { status: "APPROVED" }),
    draft: await make(URLS.draft, { status: "DRAFT" }),
    rejected: await make(URLS.rejected, { status: "REJECTED" }),
    archived: await make(URLS.archived, { status: "ARCHIVED" }),
  };
  // The supplementary is linked first on purpose: the primary must still come out first.
  await db.missionResource.createMany({
    data: [
      { missionId, resourceId: ids.extra, role: "SUPPLEMENTARY", position: 1 },
      { missionId, resourceId: ids.primary, role: "PRIMARY", position: 2 },
      { missionId, resourceId: ids.draft, role: "SUPPLEMENTARY", position: 3 },
      { missionId, resourceId: ids.rejected, role: "SUPPLEMENTARY", position: 4 },
      { missionId, resourceId: ids.archived, role: "SUPPLEMENTARY", position: 5 },
    ],
  });
}, 300_000);
afterAll(async () => {
  await cleanup();
  await db.$disconnect();
});

describe("preparation resources for an assessment", () => {
  it("shows only approved resources, the primary first, and never a draft, rejected or archived one", async () => {
    const r = await getMissionWatch(a, missionId);
    expect(r.map((x) => x.url)).toEqual([URLS.primary, URLS.extra]);
    expect(r.map((x) => x.role)).toEqual(["PRIMARY", "SUPPLEMENTARY"]);
    for (const hidden of [URLS.draft, URLS.rejected, URLS.archived]) expect(r.some((x) => x.url === hidden), hidden).toBe(false);
  });

  it("offers an embedded player only for an allowed video, and an external link for documentation", async () => {
    const [video, doc] = await getMissionWatch(a, missionId);
    expect(video.embedUrl).toBe("https://www.youtube-nocookie.com/embed/PREPPRIMARY?rel=0");
    expect(doc.embedUrl).toBeNull();
    expect(doc.url).toBe(URLS.extra);
  });

  it("a mission with no approved resource returns an empty list (the page then says so), not a substitute", async () => {
    expect(await getMissionWatch(a, otherMissionId)).toEqual([]);
  });

  it("keeps each learner's own viewing state private", async () => {
    const primary = await db.learningResource.findUniqueOrThrow({ where: { canonicalUrl: URLS.primary } });
    expect(await recordEngagement(a, { resourceId: primary.id, event: "BOOKMARKED" })).toMatchObject({ ok: true });
    expect((await getMissionWatch(a, missionId))[0].bookmarked).toBe(true);
    expect((await getMissionWatch(b, missionId))[0].bookmarked).toBe(false);
  });

  it("opening or finishing a video never awards XP, a pass or mastery", async () => {
    const primary = await db.learningResource.findUniqueOrThrow({ where: { canonicalUrl: URLS.primary } });
    for (const event of ["STARTED", "EXTERNAL_OPENED"] as const) await recordEngagement(a, { resourceId: primary.id, event });
    await recordEngagement(a, { resourceId: primary.id, event: "PROGRESS_UPDATED", progressPct: 100 });
    await recordEngagement(a, { resourceId: primary.id, event: "COMPLETED", progressPct: 100 });
    expect(await getTotalXp(a)).toBe(0);
    expect(await db.userSkill.count({ where: { userId: a } })).toBe(0);
    expect(await db.learnerMission.count({ where: { userId: a, status: { in: ["PASSED", "COMPLETED"] } } })).toBe(0);
  });

  it("a draft or rejected resource cannot be engaged with at all", async () => {
    const draft = await db.learningResource.findUniqueOrThrow({ where: { canonicalUrl: URLS.draft } });
    expect(await recordEngagement(a, { resourceId: draft.id, event: "STARTED" })).toMatchObject({ ok: false });
  });
});

describe("the assessment page's own data", () => {
  it("is owner-scoped: another learner's submission is simply not found", async () => {
    await startMission(a, "FSWD-L0-01");
    const lm = await db.learnerMission.findFirstOrThrow({ where: { userId: a, mission: { code: "FSWD-L0-01" } } });
    expect((await createEvidence(a, { title: "Proof", departmentCode: "fswd", kind: "Link", description: "", linkUrl: "https://github.com/jokzet/work", capturedDate: "2026-11-16" }, undefined, lm.id)).ok).toBe(true);
    const sent = await submitMission(a, lm.id, { explanation: "I built the page, tested it at two widths and fixed the spacing.", githubUrl: "", liveUrl: "" });
    expect(sent.ok).toBe(true);
    const submission = await db.submission.findFirstOrThrow({ where: { learnerMissionId: lm.id } });
    expect(await getAssessmentContext(a, submission.id)).not.toBeNull();
    expect(await getAssessmentContext(b, submission.id)).toBeNull();
    // and the resources the page loads for that mission are the approved ones
    expect((await getMissionWatch(a, lm.missionId)).length).toBe(2);
  });
});

describe("content gaps for staff", () => {
  it("lists published missions with no approved primary resource, and not the one that has one", async () => {
    const gaps = await listContentGaps();
    const codes = gaps.map((g) => g.code);
    expect(codes).toContain("SEC-L0-01");
    expect(codes).not.toContain("FSWD-L0-01");
    expect(gaps.every((g) => g.title && g.departmentName)).toBe(true);
  });

  it("a mission with only optional material is still a gap, and says so", async () => {
    const onlyExtra = await db.mission.findUniqueOrThrow({ where: { code: "FSWD-L0-02" } });
    const extra = await db.learningResource.findUniqueOrThrow({ where: { canonicalUrl: URLS.extra } });
    await db.missionResource.create({ data: { missionId: onlyExtra.id, resourceId: extra.id, role: "SUPPLEMENTARY", position: 1 } });
    const gap = (await listContentGaps()).find((g) => g.code === "FSWD-L0-02");
    expect(gap).toMatchObject({ hasSupplementary: true });
  });
});
