import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { checkProvider, getAiCentre } from "@/lib/admin/ai-centre";
import { listLearners } from "@/lib/admin/learners";
import { getQuality, verifyResourceLinks } from "@/lib/admin/quality";
import { ProviderError, setProviderForTests, type AssessmentProvider, type ProviderOutput } from "@/lib/ai/provider";
import { registerUser } from "@/lib/auth/service";
import { db } from "@/lib/db";
import { startMission } from "@/lib/missions/progress";
import { listContentGaps } from "@/lib/resources/gaps";

vi.setConfig({ testTimeout: 120_000 });

const PASSWORD = "correct-horse-42battery";
const mail = (n: string) => `p2-test-${n}@example.test`;
const read = (p: string) => readFileSync(p, "utf8");
const seed = () => execFileSync("npx", ["tsx", "prisma/seed.ts"], { env: process.env, stdio: "ignore", shell: true });
const ids: Record<string, string> = {};
const cleanup = async () => {
  await db.user.deleteMany({ where: { email: { startsWith: "p2-test-" } } });
  await db.learningResource.deleteMany({ where: { canonicalUrl: { contains: "evil.example" } } });
};

async function member(name: string) {
  const r = await registerUser({ displayName: `${name} P2`, email: mail(name.toLowerCase()), password: PASSWORD }, { adultConfirmed: true });
  if (!r.ok) throw new Error("registration failed");
  ids[name] = r.userId;
}
class FakeProvider implements AssessmentProvider {
  readonly name = "fake";
  calls = 0;
  constructor(private readonly step: ProviderOutput | ProviderError) {}
  supportsImages() { return true; }
  async assess(): Promise<ProviderOutput> { this.calls += 1; if (this.step instanceof Error) throw this.step; return this.step; }
}
const ok: ProviderOutput = { content: '{"ok":true}', model: "fake-model", tokensIn: 5, tokensOut: 5, finishReason: "stop" };
const ENV = ["DEEPSEEK_ENABLED", "DEEPSEEK_API_KEY", "AI_PROVIDER"] as const;
const saved: Record<string, string | undefined> = {};

beforeAll(async () => {
  for (const k of ENV) saved[k] = process.env[k];
  await cleanup();
  seed();
  for (const n of ["Boss", "Plain", "Other"]) await member(n);
  await db.user.update({ where: { id: ids.Boss }, data: { role: "ADMIN" } });
}, 300_000);
afterAll(async () => {
  for (const k of ENV) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
  await cleanup();
  await db.rateLimitBucket.deleteMany({ where: { key: { contains: "ai:check" } } });
  await db.$disconnect();
});
afterEach(() => setProviderForTests(undefined));
beforeEach(async () => {
  await db.rateLimitBucket.deleteMany({ where: { OR: [{ key: { startsWith: "ai:check" } }, { key: { startsWith: "resources:verify" } }] } });
  process.env.AI_PROVIDER = "deepseek";
  process.env.DEEPSEEK_ENABLED = "true";
  process.env.DEEPSEEK_API_KEY = "sk-test-secret-value-123";
});

describe("every admin data call refuses anyone who is not an Academy Admin", () => {
  it("AI centre, provider check, learner directory, quality checks and link verification", async () => {
    for (const who of [ids.Plain, "no-such-user"]) {
      expect(await getAiCentre(who)).toMatchObject({ ok: false });
      expect(await checkProvider(who)).toMatchObject({ ok: false });
      expect(await listLearners(who, {})).toMatchObject({ ok: false });
      expect(await getQuality(who, {})).toMatchObject({ ok: false });
      expect(await verifyResourceLinks(who)).toMatchObject({ ok: false });
    }
    await db.user.update({ where: { id: ids.Plain }, data: { role: "AUTHOR" } });
    expect(await getAiCentre(ids.Plain)).toMatchObject({ ok: false }); // a Curriculum Manager is not an administrator
    await db.user.update({ where: { id: ids.Plain }, data: { role: "LEARNER" } });
  });
});

describe("AI Assessment Centre", () => {
  it("counts job states as stored, separates scored-for-review from stopped, and never exposes a key or a learner", async () => {
    await startMission(ids.Plain, "FSWD-L0-01");
    const lm = await db.learnerMission.findFirstOrThrow({ where: { userId: ids.Plain, mission: { code: "FSWD-L0-01" } } });
    const make = async (attempt: number, status: "QUEUED" | "AI_COMPLETE" | "NEEDS_HUMAN_REVIEW", extra: Record<string, unknown> = {}) => {
      const sub = await db.submission.create({ data: { userId: ids.Plain, learnerMissionId: lm.id, attempt, status: "SUBMITTED", explanation: "x", submittedAt: new Date() } });
      return db.assessmentJob.create({ data: { userId: ids.Plain, submissionId: sub.id, rubricVersion: 1, rubricSnapshot: {}, status, tokensIn: 100, tokensOut: 40, ...extra } });
    };
    const before = await getAiCentre(ids.Boss);
    if (!before.ok) throw new Error("expected ok");
    await make(1, "QUEUED");
    await make(2, "NEEDS_HUMAN_REVIEW", { errorCode: "BILLING", escalation: "AI_UNAVAILABLE" }); // stopped: no score
    await make(3, "AI_COMPLETE", { confidence: 0.9, model: "fake-model" });
    const after = await getAiCentre(ids.Boss);
    if (!after.ok) throw new Error("expected ok");
    expect(after.centre.counts.processing).toBe(before.centre.counts.processing + 1);
    expect(after.centre.counts.stopped).toBe(before.centre.counts.stopped + 1);
    expect(after.centre.counts.complete).toBe(before.centre.counts.complete + 1);
    expect(after.centre.counts.total).toBe(before.centre.counts.total + 3);
    expect(after.centre.usage.tokensIn).toBe(before.centre.usage.tokensIn + 300);
    expect(after.centre.problems.some((p) => p.code === "BILLING")).toBe(true); // the stopped job can be re-run from here
    expect(after.centre.recent[0]).toHaveProperty("lesson");
    const json = JSON.stringify(after.centre);
    expect(json).not.toContain("sk-test-secret-value-123"); // the key is never shown, only whether it is present
    expect(json).not.toMatch(/P2|p2-test|@example\.test/); // no learner name or email
    expect(after.centre.settings).toMatchObject({ keyPresent: true, enabled: true, provider: "deepseek" });
  });

  it("reports 'operational' only after a real call succeeded, names the reason when it fails, and rate-limits itself", async () => {
    const good = new FakeProvider(ok);
    setProviderForTests(good);
    expect(await checkProvider(ids.Boss)).toMatchObject({ ok: true, check: { state: "OPERATIONAL", model: "fake-model", provider: "fake" } });
    expect(good.calls).toBe(1);
    expect(await checkProvider(ids.Boss)).toMatchObject({ ok: true, check: { state: "LIMITED" } }); // a second check inside a minute is refused
    expect(good.calls).toBe(1);

    await db.rateLimitBucket.deleteMany({ where: { key: { startsWith: "ai:check" } } });
    setProviderForTests(new FakeProvider(new ProviderError("BILLING", false)));
    expect(await checkProvider(ids.Boss)).toMatchObject({ ok: true, check: { state: "REFUSED", code: "BILLING" } });

    await db.rateLimitBucket.deleteMany({ where: { key: { startsWith: "ai:check" } } });
    process.env.DEEPSEEK_ENABLED = "false";
    const idle = new FakeProvider(ok);
    setProviderForTests(idle);
    expect(await checkProvider(ids.Boss)).toMatchObject({ ok: true, check: { state: "NOT_CONFIGURED" } });
    expect(idle.calls).toBe(0); // switched off: no call is made, and nothing is claimed
  });
});

describe("learner directory", () => {
  it("lists learners only (never staff), searches names and emails, and filters without one replacing another", async () => {
    const all = await listLearners(ids.Boss, {});
    if (!all.ok) throw new Error("expected ok");
    const emails = all.data.rows.map((r) => r.email);
    expect(emails).toEqual(expect.arrayContaining([mail("plain"), mail("other")]));
    expect(emails).not.toContain(mail("boss")); // an administrator is staff, not a learner
    expect(all.data.total).toBe(await db.user.count({ where: { role: "LEARNER" } }));
    const found = await listLearners(ids.Boss, { q: "p2-test-other" });
    expect(found.ok && found.data.rows.map((r) => r.email)).toEqual([mail("other")]);
    await db.profile.update({ where: { userId: ids.Other }, data: { onboardingStatus: "IN_PROGRESS" } }); // test accounts are created already onboarded; make this one unfinished
    // not onboarded AND matching the search: both conditions apply
    const both = await listLearners(ids.Boss, { q: "p2-test-other", filter: "onboarding" });
    expect(both.ok && both.data.rows.map((r) => r.email)).toEqual([mail("other")]);
    const neither = await listLearners(ids.Boss, { q: "zzzz-nobody", filter: "onboarding" });
    expect(neither.ok && neither.data.total).toBe(0);
    const inactive = await listLearners(ids.Boss, { q: "p2-test-other", filter: "inactive" });
    expect(inactive.ok && inactive.data.total).toBe(1);
    const active = await listLearners(ids.Boss, { q: "p2-test-other", filter: "active" });
    expect(active.ok && active.data.total).toBe(0);
    await db.activityRecord.create({ data: { userId: ids.Other, type: "MISSION_STARTED", entityType: "Mission", entityId: "x", occurredAt: new Date() } });
    const nowActive = await listLearners(ids.Boss, { q: "p2-test-other", filter: "active" });
    expect(nowActive.ok && nowActive.data.rows[0]?.active).toBe(true);
  });

  it("ignores wildcard characters and bad input, clamps the page, and holds no evidence or scores", async () => {
    const wild = await listLearners(ids.Boss, { q: "%%" });
    const everyone = await listLearners(ids.Boss, {});
    expect(wild.ok && wild.data.total).toBe(everyone.ok && everyone.data.total); // a wildcard-only search is ignored, not "match everything" by accident
    expect(await listLearners(ids.Boss, { filter: "DROP TABLE", page: -3 })).toMatchObject({ ok: true });
    const far = await listLearners(ids.Boss, { page: 9999 });
    expect(far.ok && far.data.page).toBe(far.ok && far.data.pages);
    expect(Object.keys((everyone.ok && everyone.data.rows[0]) || {}).sort()).toEqual(["active", "courses", "displayName", "email", "joined", "lastActivity", "mode", "onboarding", "passed", "submitted"]);
  });
});

describe("curriculum quality checks", () => {
  it("match the stored data, support the filters, and flag links not checked recently", async () => {
    const res = await getQuality(ids.Boss, {});
    if (!res.ok) throw new Error("expected ok");
    const q = res.quality;
    expect(q.gaps.map((g) => g.code).sort()).toEqual((await listContentGaps()).map((g) => g.code).sort());
    const published = await db.mission.count({ where: { createdById: null, isPublished: true, category: "CURRICULUM_MISSION", code: { not: null }, rubric: null } });
    expect(q.noRubric).toHaveLength(published);
    expect(q.programmes).toHaveLength(9);
    expect(q.programmes.find((p) => p.code === "fswd")).toMatchObject({ lessons: 2, withPrimary: 2, withRubric: 2 });

    const approved = await db.learningResource.findFirstOrThrow({ where: { status: "APPROVED" }, select: { id: true, lastVerifiedAt: true } });
    await db.learningResource.update({ where: { id: approved.id }, data: { lastVerifiedAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000) } });
    const stale = await getQuality(ids.Boss, {});
    expect(stale.ok && stale.quality.unverified.map((r) => r.id)).toContain(approved.id);
    await db.learningResource.update({ where: { id: approved.id }, data: { lastVerifiedAt: approved.lastVerifiedAt } });

    const videos = await getQuality(ids.Boss, { kind: "VIDEO", status: "APPROVED" });
    expect(videos.ok && videos.quality.resources.every((r) => r.kind === "VIDEO" && r.status === "APPROVED")).toBe(true);
    const photo = await getQuality(ids.Boss, { programme: "photo" });
    expect(photo.ok && photo.quality.resources.length).toBeGreaterThan(0);
    expect(photo.ok && photo.quality.resources.length).toBeLessThan(q.resources.length);
    expect(await getQuality(ids.Boss, { kind: "NOT_A_KIND", programme: "x'; --" })).toMatchObject({ ok: true }); // bad filters are ignored, not trusted
  });

  it("verifies links safely: allow-listed hosts only, no redirects followed, failures reported, rate-limited", async () => {
    await db.learningResource.create({ data: { canonicalUrl: "https://evil.example/x", provider: "evil", kind: "DOCUMENTATION", title: "Off the allow-list", status: "APPROVED", approvedBy: "x", approvedAt: new Date(), lastVerifiedAt: new Date(0) } });
    const seen: { url: string; init: RequestInit }[] = [];
    const fakeFetch = (async (url: string | URL | Request, init?: RequestInit) => {
      seen.push({ url: String(url), init: init! });
      return new Response(null, { status: String(url).includes("nmap.org") ? 404 : 200 });
    }) as typeof fetch;
    const res = await verifyResourceLinks(ids.Boss, new Date(), fakeFetch);
    if (!res.ok || "limited" in res.result) throw new Error("expected a result");
    expect(res.result.checked).toBeGreaterThanOrEqual(34);
    const failures = res.result.failed.map((f) => `${f.title}: ${f.reason}`);
    expect(failures.some((f) => f.startsWith("Nmap Reference Guide") && f.includes("404"))).toBe(true);
    expect(failures.some((f) => f.startsWith("Off the allow-list") && f.includes("approved host"))).toBe(true);
    expect(seen.some((s) => s.url.includes("evil.example"))).toBe(false); // never requested
    for (const s of seen) {
      expect(["www.youtube.com", "developer.mozilla.org", "web.dev", "docs.aws.amazon.com", "docs.python.org", "nmap.org"], s.url).toContain(new URL(s.url).hostname);
      expect(s.init.redirect).toBe("manual");
    }
    expect(seen.some((s) => s.url.startsWith("https://www.youtube.com/oembed?"))).toBe(true); // videos are checked with YouTube's own lookup
    const fresh = await db.learningResource.findFirstOrThrow({ where: { canonicalUrl: { contains: "developer.mozilla.org" } }, select: { lastVerifiedAt: true } });
    expect(Date.now() - fresh.lastVerifiedAt!.getTime()).toBeLessThan(60_000); // answered links are dated now
    const again = await verifyResourceLinks(ids.Boss, new Date(), fakeFetch);
    expect(again).toMatchObject({ ok: true, result: { limited: true } });
  });
});

describe("the new pages", () => {
  it("every page and action repeats the administrator check, and the navigation lists them", () => {
    for (const p of ["ai/page.tsx", "learners/page.tsx", "curriculum/page.tsx"]) expect(read(`src/app/(admin)/admin/${p}`), p).toContain('requireRole("ADMIN")');
    for (const p of ["ai/actions.ts", "curriculum/actions.ts"]) expect(read(`src/app/(admin)/admin/${p}`), p).toContain('requireRole("ADMIN")');
    const nav = read("src/components/admin/admin-nav.tsx");
    for (const to of ["/admin/learners", "/admin/ai", "/admin/curriculum", "/admin/staff"]) expect(nav).toContain(`to: "${to}"`);
    expect(read("src/components/admin/admin-actions.tsx")).not.toMatch(/process\.env|API_KEY/); // the browser code never touches a key
  });
});
