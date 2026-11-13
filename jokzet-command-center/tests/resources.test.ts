import { execFileSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { registerUser } from "@/lib/auth/service";
import { LIMITS, bucketKey, rateLimitHit } from "@/lib/ratelimit";
import { isAllowedEmbedUrl, parseResourceUrl } from "@/lib/resources/embed";
import { COMPLETION_THRESHOLD, getMissionWatch, hasApprovedPrimary, recordEngagement } from "@/lib/resources/service";
import { getTotalXp } from "@/lib/missions/service";
import { LEVEL0 } from "../prisma/curriculum/level0";
import { syncResourceCatalogue } from "../prisma/curriculum/resource-sync";
import { resourceProblems } from "../prisma/curriculum/resource-validate";
import type { MissionResourceSpec, ResourceSpec } from "../prisma/curriculum/resources";
import nextConfig, { contentSecurityPolicy } from "../next.config";
import { waitForWindowRoom } from "./helpers/window";

const PASSWORD = "correct-horse-42battery";
const mail = (n: string) => `res-test-${n}@example.test`;
const CODES = new Set(LEVEL0.flatMap((s) => s.missions.map((m) => m.code)));
const M1 = "FSWD-L0-01";
const M2 = "FSWD-L0-02";
const seed = () => execFileSync("npx", ["tsx", "prisma/seed.ts"], { env: process.env, stdio: "pipe", shell: true });

// Fixtures use real hosts with made-up ids: they exist only in the test database and are never shown to a learner.
const VIDEO = "https://www.youtube.com/watch?v=AAAAAAAAAAA";
const VIDEO_2 = "https://youtu.be/BBBBBBBBBBB";
const DOC = "https://developer.mozilla.org/en-US/docs/Learn#fixture";
const DOC_CANONICAL = "https://developer.mozilla.org/en-US/docs/Learn"; // the fragment is dropped when catalogued
const approved = (over: Partial<ResourceSpec> = {}): ResourceSpec => ({
  url: VIDEO, kind: "VIDEO", title: "Fixture video", durationMinutes: 12, embeddable: true, status: "APPROVED",
  approvedBy: "Test Reviewer", approvedAt: "2026-11-10", lastVerifiedAt: "2026-11-12",
  reviews: [{ reviewerName: "Test Reviewer", decision: "APPROVED", note: "Clear and accurate.", at: "2026-11-10T10:00:00Z" }], ...over,
});
const catalogue = (): ResourceSpec[] => [
  approved(),
  approved({ url: VIDEO_2, title: "Second video" }),
  approved({ url: DOC, kind: "DOCUMENTATION", title: "MDN learn", embeddable: false }),
  approved({ url: "https://www.youtube.com/watch?v=CCCCCCCCCCC", title: "Still in review", status: "PENDING_REVIEW", approvedBy: undefined, approvedAt: undefined, reviews: [] }),
];
const links = (): MissionResourceSpec[] => [
  { missionCode: M1, url: VIDEO, role: "PRIMARY" },
  { missionCode: M1, url: DOC, role: "SUPPLEMENTARY", position: 1 },
  { missionCode: M1, url: "https://www.youtube.com/watch?v=CCCCCCCCCCC", role: "SUPPLEMENTARY", position: 2 },
];

let userA = "";
let userB = "";
let missionId = "";

async function cleanup() {
  const ids = ["AAAAAAAAAAA", "BBBBBBBBBBB", "CCCCCCCCCCC", "DDDDDDDDDDD"];
  await db.learningResource.deleteMany({ where: { OR: [...ids.map((id) => ({ canonicalUrl: { contains: id } })), { canonicalUrl: DOC_CANONICAL }] } });
  await db.rateLimitBucket.deleteMany({ where: { key: { startsWith: "resource:" } } });
}

beforeAll(async () => {
  await db.user.deleteMany({ where: { email: { startsWith: "res-test" } } });
  seed();
  await cleanup();
  const a = await registerUser({ displayName: "A", email: mail("a"), password: PASSWORD });
  const b = await registerUser({ displayName: "B", email: mail("b"), password: PASSWORD });
  if (!a.ok || !b.ok) throw new Error("registration failed");
  userA = a.userId;
  userB = b.userId;
  missionId = (await db.mission.findUniqueOrThrow({ where: { code: M1 } })).id;
}, 180_000);

afterAll(async () => {
  await cleanup();
  await db.user.deleteMany({ where: { email: { startsWith: "res-test" } } });
  await db.$disconnect();
});

describe("resource links (pure)", () => {
  it("canonicalises YouTube links and builds only the privacy-enhanced embed", () => {
    for (const input of ["https://www.youtube.com/watch?v=AAAAAAAAAAA", "https://youtu.be/AAAAAAAAAAA", "https://www.youtube.com/embed/AAAAAAAAAAA", "https://m.youtube.com/watch?v=AAAAAAAAAAA&t=30s"]) {
      expect(parseResourceUrl(input), input).toMatchObject({ ok: true, provider: "youtube", kind: "video", canonicalUrl: VIDEO, embedUrl: "https://www.youtube-nocookie.com/embed/AAAAAAAAAAA?rel=0" });
    }
    const list = parseResourceUrl("https://www.youtube.com/playlist?list=PLabcdefghij1234567890");
    expect(list).toMatchObject({ ok: true, kind: "playlist", canonicalUrl: "https://www.youtube.com/playlist?list=PLabcdefghij1234567890", embedUrl: "https://www.youtube-nocookie.com/embed/videoseries?list=PLabcdefghij1234567890&rel=0" });
  });

  it("accepts official documentation as an external link only, without a fragment", () => {
    expect(parseResourceUrl("https://developer.mozilla.org/en-US/docs/Learn#section")).toMatchObject({ ok: true, provider: "mdn", kind: "page", embedUrl: null, canonicalUrl: "https://developer.mozilla.org/en-US/docs/Learn" });
  });

  it("rejects insecure, unknown, credentialed, port-carrying and malformed links", () => {
    for (const bad of [
      "http://www.youtube.com/watch?v=AAAAAAAAAAA", "https://evil.example/watch?v=AAAAAAAAAAA", "https://youtube.com.evil.example/watch?v=AAAAAAAAAAA",
      "https://user:pw@www.youtube.com/watch?v=AAAAAAAAAAA", "https://www.youtube.com:8443/watch?v=AAAAAAAAAAA", "javascript:alert(1)", "not a url", "",
      "https://www.youtube.com/watch?v=short", "https://www.youtube.com/watch?v=AAAAAAAAAA%22%3E", "https://www.youtube.com/playlist?list=", "https://www.youtube.com/channel/UCxyz",
    ]) {
      expect(parseResourceUrl(bad).ok, bad).toBe(false);
    }
  });

  it("only allows our own privacy-enhanced embed host to be loaded into a frame", () => {
    expect(isAllowedEmbedUrl("https://www.youtube-nocookie.com/embed/AAAAAAAAAAA?rel=0")).toBe(true);
    for (const bad of ["https://www.youtube.com/embed/AAAAAAAAAAA", "http://www.youtube-nocookie.com/embed/AAAAAAAAAAA", "https://evil.example/embed/x", "javascript:alert(1)", "https://www.youtube-nocookie.com/watch?v=AAAAAAAAAAA"]) {
      expect(isAllowedEmbedUrl(bad), bad).toBe(false);
    }
  });
});

describe("catalogue validators (pure)", () => {
  it("accept a complete, reviewed catalogue and the empty one", () => {
    expect(resourceProblems(catalogue(), links(), CODES)).toEqual([]);
    expect(resourceProblems([], [], CODES)).toEqual([]);
  });

  it("reject unapproved-looking approvals, bad links and bad structure", () => {
    const noApprover = catalogue();
    noApprover[0].approvedBy = "";
    expect(resourceProblems(noApprover, links(), CODES).join()).toMatch(/needs approvedBy/);

    const noReview = catalogue();
    noReview[0].reviews = [];
    expect(resourceProblems(noReview, links(), CODES).join()).toMatch(/APPROVED review/);

    const noVerified = catalogue();
    noVerified[0].lastVerifiedAt = undefined;
    expect(resourceProblems(noVerified, links(), CODES).join()).toMatch(/lastVerifiedAt/);

    expect(resourceProblems([approved({ url: "http://www.youtube.com/watch?v=AAAAAAAAAAA" })], [], CODES).join()).toMatch(/https/);
    expect(resourceProblems([approved({ url: "https://evil.example/x" })], [], CODES).join()).toMatch(/not an approved resource host/);
    expect(resourceProblems([approved({ url: DOC, kind: "DOCUMENTATION", embeddable: true })], [], CODES).join()).toMatch(/can be embedded/);
    expect(resourceProblems([approved(), approved({ url: "https://youtu.be/AAAAAAAAAAA" })], [], CODES).join()).toMatch(/listed twice/);
    expect(resourceProblems([approved({ title: "pass" + "word = hunter2hunter2" })], [], CODES).join()).toMatch(/secret/);
    expect(resourceProblems([approved({ durationMinutes: 0 })], [], CODES).join()).toMatch(/durationMinutes/);

    expect(resourceProblems(catalogue(), [{ missionCode: "NOPE-L0-99", url: VIDEO, role: "PRIMARY" }], CODES).join()).toMatch(/unknown mission code/);
    expect(resourceProblems(catalogue(), [{ missionCode: M1, url: "https://www.youtube.com/watch?v=DDDDDDDDDDD", role: "PRIMARY" }], CODES).join()).toMatch(/not listed in the catalogue/);
    const twoPrimaries = [...links(), { missionCode: M1, url: VIDEO_2, role: "PRIMARY" as const }];
    expect(resourceProblems(catalogue(), twoPrimaries, CODES).join()).toMatch(/2 PRIMARY resources/);
  });
});

describe("catalogue sync is safe and repeatable", () => {
  it("creates resources, reviews and links, and does the same nothing the second time", async () => {
    const first = await syncResourceCatalogue(db, catalogue(), links());
    expect(first).toMatchObject({ resources: 4, links: 3, reviews: 3 });
    const second = await syncResourceCatalogue(db, catalogue(), links());
    expect(second).toMatchObject({ resources: 4, links: 3, reviews: 0, archived: 0 });
    expect(await db.learningResource.count({ where: { canonicalUrl: { in: [VIDEO, DOC_CANONICAL] } } })).toBe(2);
    expect(await db.resourceReview.count({ where: { resource: { canonicalUrl: VIDEO } } })).toBe(1); // append-only, not duplicated
  });

  it("switches the primary resource without ever having two, and never deletes a resource that left the file", async () => {
    const swapped: MissionResourceSpec[] = [
      { missionCode: M1, url: VIDEO_2, role: "PRIMARY" },
      { missionCode: M1, url: VIDEO, role: "SUPPLEMENTARY", position: 1 },
    ];
    await syncResourceCatalogue(db, catalogue(), swapped);
    const rows = await db.missionResource.findMany({ where: { missionId }, include: { resource: true }, orderBy: { position: "asc" } });
    expect(rows.filter((r) => r.role === "PRIMARY").map((r) => r.resource.canonicalUrl)).toEqual(["https://www.youtube.com/watch?v=BBBBBBBBBBB"]);
    expect(rows).toHaveLength(2); // the documentation link was dropped from this mission

    // A resource missing from the file is archived (kept for history), never deleted.
    await syncResourceCatalogue(db, [catalogue()[0], catalogue()[1]], swapped);
    const doc = await db.learningResource.findUniqueOrThrow({ where: { canonicalUrl: "https://developer.mozilla.org/en-US/docs/Learn" } });
    expect(doc.status).toBe("ARCHIVED");
    await syncResourceCatalogue(db, catalogue(), links()); // restore the full fixture for the next tests
  });
});

describe("what a learner sees (approved only)", () => {
  it("shows approved resources with the primary first, hides drafts, and gives embeds only for allowed ones", async () => {
    const watch = await getMissionWatch(userA, missionId);
    expect(watch.map((w) => [w.title, w.role])).toEqual([["Fixture video", "PRIMARY"], ["MDN learn", "SUPPLEMENTARY"]]); // the in-review one is hidden
    expect(watch[0].embedUrl).toBe("https://www.youtube-nocookie.com/embed/AAAAAAAAAAA?rel=0");
    expect(watch[1].embedUrl).toBeNull();
    expect(watch.every((w) => w.url.startsWith("https://"))).toBe(true);
  });

  it("knows whether a mission has an approved primary resource", async () => {
    expect(await hasApprovedPrimary(missionId)).toBe(true);
    const other = await db.mission.findUniqueOrThrow({ where: { code: M2 } });
    expect(await hasApprovedPrimary(other.id)).toBe(false); // the shortfall the plan generator must report
    await db.learningResource.update({ where: { canonicalUrl: VIDEO }, data: { status: "ARCHIVED" } });
    expect(await hasApprovedPrimary(missionId)).toBe(false);
    expect((await getMissionWatch(userA, missionId)).map((w) => w.title)).toEqual(["MDN learn"]);
    await db.learningResource.update({ where: { canonicalUrl: VIDEO }, data: { status: "APPROVED" } });
  });
});

describe("engagement is advisory, private and throttled", () => {
  let videoId = "";
  beforeAll(async () => {
    videoId = (await db.learningResource.findUniqueOrThrow({ where: { canonicalUrl: VIDEO } })).id;
    await waitForWindowRoom(60, 15_000);
  }, 60_000);

  it("records starting, bookmarking and opening a link without ever treating a link click as watching", async () => {
    expect(await recordEngagement(userA, { resourceId: videoId, event: "EXTERNAL_OPENED" })).toEqual({ ok: true });
    let row = await db.resourceEngagement.findUniqueOrThrow({ where: { userId_resourceId: { userId: userA, resourceId: videoId } } });
    expect(row).toMatchObject({ lastEvent: "EXTERNAL_OPENED", startedAt: null, completedAt: null, progressPct: null });
    expect(row.externalOpenedAt).not.toBeNull();

    await recordEngagement(userA, { resourceId: videoId, event: "STARTED" });
    await recordEngagement(userA, { resourceId: videoId, event: "BOOKMARKED" });
    row = await db.resourceEngagement.findUniqueOrThrow({ where: { userId_resourceId: { userId: userA, resourceId: videoId } } });
    expect(row.startedAt).not.toBeNull();
    expect(row.bookmarked).toBe(true);
    expect((await getMissionWatch(userA, missionId))[0]).toMatchObject({ bookmarked: true, started: true });
    await recordEngagement(userA, { resourceId: videoId, event: "UNBOOKMARKED" });
    expect((await getMissionWatch(userA, missionId))[0].bookmarked).toBe(false);
    expect(await db.resourceEngagement.count({ where: { userId: userA, resourceId: videoId } })).toBe(1); // one row, updated in place
  });

  it("accepts completion only at or above the reported threshold, and progress only moves forward", async () => {
    expect(await recordEngagement(userA, { resourceId: videoId, event: "COMPLETED" })).toMatchObject({ ok: false });
    expect(await recordEngagement(userA, { resourceId: videoId, event: "COMPLETED", progressPct: COMPLETION_THRESHOLD - 1 })).toMatchObject({ ok: false, error: expect.stringMatching(/at least 90%/) });
    expect(await recordEngagement(userA, { resourceId: videoId, event: "PROGRESS_UPDATED" })).toMatchObject({ ok: false });
    await recordEngagement(userA, { resourceId: videoId, event: "PROGRESS_UPDATED", progressPct: 60 });
    await recordEngagement(userA, { resourceId: videoId, event: "PROGRESS_UPDATED", progressPct: 20 });
    expect((await db.resourceEngagement.findUniqueOrThrow({ where: { userId_resourceId: { userId: userA, resourceId: videoId } } })).progressPct).toBe(60);
    expect(await recordEngagement(userA, { resourceId: videoId, event: "COMPLETED", progressPct: COMPLETION_THRESHOLD })).toEqual({ ok: true });
    const row = await db.resourceEngagement.findUniqueOrThrow({ where: { userId_resourceId: { userId: userA, resourceId: videoId } } });
    expect(row.completedAt).not.toBeNull();
    expect(row.progressPct).toBe(COMPLETION_THRESHOLD);
  });

  it("is private per learner and rejects invalid events and unavailable resources", async () => {
    expect((await getMissionWatch(userB, missionId))[0]).toMatchObject({ bookmarked: false, started: false, progressPct: null });
    expect(await db.resourceEngagement.count({ where: { userId: userB } })).toBe(0);
    expect(await recordEngagement(userA, { resourceId: videoId, event: "NOPE" as never })).toMatchObject({ ok: false });
    expect(await recordEngagement(userA, { resourceId: videoId, event: "PROGRESS_UPDATED", progressPct: 101 })).toMatchObject({ ok: false });
    const draft = await db.learningResource.findUniqueOrThrow({ where: { canonicalUrl: "https://www.youtube.com/watch?v=CCCCCCCCCCC" } });
    expect(await recordEngagement(userA, { resourceId: draft.id, event: "STARTED" })).toMatchObject({ ok: false, error: expect.stringMatching(/not available/) });
    expect(await recordEngagement(userA, { resourceId: "does-not-exist", event: "STARTED" })).toMatchObject({ ok: false });
  });

  it("never changes credit, XP, submissions or mission status (it is advisory)", async () => {
    const before = { xp: await getTotalXp(userA), lms: await db.learnerMission.count({ where: { userId: userA } }), passed: await db.learnerMission.count({ where: { userId: userA, status: { in: ["PASSED", "COMPLETED"] } } }), submissions: await db.submission.count({ where: { userId: userA } }) };
    await recordEngagement(userA, { resourceId: videoId, event: "COMPLETED", progressPct: 100 });
    expect({ xp: await getTotalXp(userA), lms: await db.learnerMission.count({ where: { userId: userA } }), passed: await db.learnerMission.count({ where: { userId: userA, status: { in: ["PASSED", "COMPLETED"] } } }), submissions: await db.submission.count({ where: { userId: userA } }) }).toEqual(before);
  });

  it("limits how often a learner can report interactions", async () => {
    await waitForWindowRoom(60, 15_000);
    const key = bucketKey("resource:engage", userB);
    for (let i = 0; i < LIMITS.resourceEngagementUser.limit; i++) await rateLimitHit(key, LIMITS.resourceEngagementUser);
    expect(await recordEngagement(userB, { resourceId: videoId, event: "STARTED" })).toMatchObject({ ok: false, error: expect.stringMatching(/slow down/i) });
    expect(await db.resourceEngagement.count({ where: { userId: userB } })).toBe(0);
  }, 60_000);
});

describe("database guarantees", () => {
  it("allows only one primary resource per mission, https links, approvals with an approver, and sane progress", async () => {
    const resource = await db.learningResource.findUniqueOrThrow({ where: { canonicalUrl: "https://developer.mozilla.org/en-US/docs/Learn" } });
    // VIDEO_2 is the second video: making it primary while another primary exists must fail.
    const v2 = await db.learningResource.findUniqueOrThrow({ where: { canonicalUrl: "https://www.youtube.com/watch?v=BBBBBBBBBBB" } });
    await expect(db.missionResource.create({ data: { missionId, resourceId: v2.id, role: "PRIMARY" } })).rejects.toThrow();
    await expect(db.missionResource.create({ data: { missionId, resourceId: resource.id, role: "BOSS" } })).rejects.toThrow();
    await expect(db.learningResource.create({ data: { canonicalUrl: "http://www.youtube.com/watch?v=DDDDDDDDDDD", provider: "youtube", kind: "VIDEO", title: "x" } })).rejects.toThrow();
    await expect(db.learningResource.create({ data: { canonicalUrl: "https://www.youtube.com/watch?v=DDDDDDDDDDD", provider: "youtube", kind: "VIDEO", title: "x", status: "APPROVED" } })).rejects.toThrow();
    await expect(db.resourceEngagement.create({ data: { userId: userA, resourceId: v2.id, lastEvent: "STARTED", progressPct: 150 } })).rejects.toThrow();
    await expect(db.resourceReview.create({ data: { resourceId: v2.id, reviewerName: "x", decision: "MAYBE", at: new Date() } })).rejects.toThrow();
  });
});

describe("the seed with an empty catalogue", () => {
  it("archives resources that are not in the file, keeps them, and leaves the legacy placeholders alone", async () => {
    const legacyBefore = await db.resource.count();
    seed();
    const fixtures = await db.learningResource.findMany({ where: { canonicalUrl: { contains: "AAAAAAAAAAA" } } });
    expect(fixtures).toHaveLength(1);
    expect(fixtures[0].status).toBe("ARCHIVED"); // kept, not deleted
    expect(await db.resourceReview.count({ where: { resourceId: fixtures[0].id } })).toBe(1); // history survives
    expect(await db.resource.count()).toBe(legacyBefore);
    expect(await hasApprovedPrimary(missionId)).toBe(false);
  }, 180_000);
});

describe("page security headers", () => {
  it("send a report-only CSP that allows only our own origin plus the privacy-enhanced video frame", async () => {
    const policy = Object.fromEntries(contentSecurityPolicy.split("; ").map((d) => [d.split(" ")[0], d.split(" ").slice(1)]));
    expect(policy["frame-src"]).toEqual(["'self'", "https://www.youtube-nocookie.com"]);
    expect(policy["default-src"]).toEqual(["'self'"]);
    expect(policy["object-src"]).toEqual(["'none'"]);
    expect(policy["frame-ancestors"]).toEqual(["'none'"]);
    expect(policy["form-action"]).toEqual(["'self'"]);
    expect(policy["base-uri"]).toEqual(["'self'"]);
    for (const [name, values] of Object.entries(policy)) {
      expect(values.some((v) => v === "*" || v.startsWith("http:")), name).toBe(false); // no wildcards, no insecure origins
    }
    expect(policy["script-src"].join(" ")).not.toMatch(/youtube|https:/); // no third-party scripts (no player API)

    const headers = await nextConfig.headers!();
    const all = headers.flatMap((h) => h.headers).map((h) => h.key);
    expect(all).toContain("Content-Security-Policy-Report-Only");
    expect(all).not.toContain("Content-Security-Policy"); // report-only for now: nothing is blocked
    expect(all).toContain("X-Frame-Options");
  });
});
