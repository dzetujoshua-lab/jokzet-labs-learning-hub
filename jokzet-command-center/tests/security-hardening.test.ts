import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { waitForWindowRoom } from "./helpers/window";
import { db } from "@/lib/db";
import { authenticate, registerUser } from "@/lib/auth/service";
import { createCustomMission, deleteMission, getTotalXp, setMissionDone } from "@/lib/missions/service";
import { createMissionSchema, milestoneSchema } from "@/lib/missions/schema";
import { saveProgressSchema } from "@/lib/missions/progress";
import { parseScheduleFile } from "@/lib/schedule/schema";
import {
  LIMITS, bucketKey, clientIp, purgeOldBuckets, rateLimitHit, rateLimitPeek, rateLimitReset,
} from "@/lib/ratelimit";

const PASSWORD = "correct-horse-42battery";
const mail = (n: string) => `sec-test-${n}@example.test`;
// Built at runtime so no secret-shaped literal sits in the repository (GitHub push protection).
const LEAKY = "pass" + "word = hunter2hunter2";

// Only this file's own keys: test files run in parallel against one database.
async function clearBuckets() {
  await db.rateLimitBucket.deleteMany({ where: { OR: [{ key: { startsWith: "t:" } }, { key: { startsWith: "login:" } }] } });
}

beforeAll(async () => {
  await db.user.deleteMany({ where: { email: { startsWith: "sec-test" } } });
  execFileSync("npx", ["tsx", "prisma/seed.ts"], { env: process.env, stdio: "ignore", shell: true });
  await clearBuckets();
}, 120_000);

afterAll(async () => {
  await db.user.deleteMany({ where: { email: { startsWith: "sec-test" } } });
  await clearBuckets();
  await db.$disconnect();
});

describe("rate limiter", () => {
  const limit = { limit: 3, windowSeconds: 60 };
  const t0 = new Date("2026-11-20T12:00:10Z");

  it("allows up to the limit, then refuses, and reports when to retry", async () => {
    const key = bucketKey("t:basic", "a");
    const results = [];
    for (let i = 0; i < 5; i++) results.push(await rateLimitHit(key, limit, t0));
    expect(results.map((r) => r.ok)).toEqual([true, true, true, false, false]);
    expect(results.map((r) => r.count)).toEqual([1, 2, 3, 4, 5]);
    expect(results[3].retryAfterSeconds).toBe(50); // window ends at 12:01:00
  });

  it("starts a fresh window afterwards and keeps keys independent", async () => {
    const key = bucketKey("t:window", "a");
    for (let i = 0; i < 4; i++) await rateLimitHit(key, limit, t0);
    expect((await rateLimitHit(key, limit, t0)).ok).toBe(false);
    expect((await rateLimitHit(key, limit, new Date("2026-11-20T12:01:05Z"))).ok).toBe(true); // next window
    expect((await rateLimitHit(bucketKey("t:window", "other"), limit, t0)).ok).toBe(true); // other key
  });

  it("is atomic: concurrent requests cannot slip past the limit", async () => {
    const key = bucketKey("t:race", "a");
    const results = await Promise.all(Array.from({ length: 25 }, () => rateLimitHit(key, { limit: 10, windowSeconds: 60 }, t0)));
    expect(results.filter((r) => r.ok)).toHaveLength(10);
    expect(await rateLimitPeek(key, { limit: 10, windowSeconds: 60 }, t0)).toMatchObject({ ok: false, count: 25 });
  });

  it("peek never counts, and reset forgets a key", async () => {
    const key = bucketKey("t:peek", "a");
    for (let i = 0; i < 3; i++) expect((await rateLimitPeek(key, limit, t0)).count).toBe(0);
    for (let i = 0; i < 3; i++) await rateLimitHit(key, limit, t0);
    expect((await rateLimitPeek(key, limit, t0)).ok).toBe(false);
    await rateLimitReset(key);
    expect((await rateLimitPeek(key, limit, t0)).ok).toBe(true);
  });

  it("never stores an email or an address in the clear", async () => {
    const key = bucketKey("login:ie", "203.0.113.7", "someone@example.test");
    expect(key).not.toContain("203.0.113.7");
    expect(key).not.toContain("someone");
    await rateLimitHit(key, limit, t0);
    const rows = await db.rateLimitBucket.findMany({ where: { key } });
    expect(rows).toHaveLength(1);
  });

  it("purges only rows older than a day", async () => {
    const now = new Date("2026-11-20T12:00:00Z");
    await db.rateLimitBucket.createMany({
      data: [
        { key: "t:old", windowStart: new Date("2026-11-18T12:00:00Z") },
        { key: "t:recent", windowStart: new Date("2026-11-20T11:00:00Z") },
      ],
    });
    expect(await purgeOldBuckets(now)).toBeGreaterThanOrEqual(1);
    expect(await db.rateLimitBucket.count({ where: { key: "t:old" } })).toBe(0);
    expect(await db.rateLimitBucket.count({ where: { key: "t:recent" } })).toBe(1);
  });

  it("fails open (and does not throw) when the database is unavailable", async () => {
    const spy = vi.spyOn(db, "$queryRaw").mockRejectedValueOnce(new Error("connection refused"));
    const quiet = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const result = await rateLimitHit(bucketKey("t:open", "a"), limit, t0);
    expect(result.ok).toBe(true);
    spy.mockRestore();
    quiet.mockRestore();
  });

  it("reads the platform client address first and falls back without trusting an empty value", () => {
    const h = (m: Record<string, string>) => ({ get: (n: string) => m[n.toLowerCase()] ?? null });
    expect(clientIp(h({ "x-nf-client-connection-ip": "198.51.100.9", "x-forwarded-for": "1.2.3.4" }))).toBe("198.51.100.9");
    expect(clientIp(h({ "x-real-ip": "198.51.100.8" }))).toBe("198.51.100.8");
    expect(clientIp(h({ "x-forwarded-for": "192.0.2.5, 10.0.0.1" }))).toBe("192.0.2.5");
    expect(clientIp(h({}))).toBe("unknown");
  });

  it("keeps the reminder poll limits consistent with the client (30 s poll)", () => {
    expect(LIMITS.pendingTick).toEqual({ limit: 1, windowSeconds: 20 });
    expect(LIMITS.pendingUser.limit).toBeGreaterThan(60 / 30); // a tab polls twice a minute
  });
});

describe("sign-in: no account oracle, no lockout abuse", () => {
  // These tests fill fixed 15-minute and 1-hour windows; do not start one just before the window rolls over.
  beforeEach(async () => {
    await waitForWindowRoom(15 * 60);
    await waitForWindowRoom(60 * 60);
  }, 120_000);

  it("returns an identical result for unknown email, wrong password and a disabled account", async () => {
    await registerUser({ displayName: "Sec", email: mail("uniform"), password: PASSWORD });
    const ip = "198.51.100.10";
    const unknown = await authenticate({ email: mail("nobody"), password: "whatever-123456" }, { ip });
    const wrong = await authenticate({ email: mail("uniform"), password: "wrong-password-123" }, { ip });
    await db.user.update({ where: { email: mail("uniform") }, data: { isActive: false } });
    const disabled = await authenticate({ email: mail("uniform"), password: PASSWORD }, { ip: "198.51.100.11" });
    expect(unknown).toEqual({ ok: false, error: "INVALID_CREDENTIALS" });
    expect(wrong).toEqual({ ok: false, error: "INVALID_CREDENTIALS" });
    expect(disabled).toEqual({ ok: false, error: "INVALID_CREDENTIALS" });
  });

  it("throttles repeated failures from one address, with the same error, even for the right password", async () => {
    await registerUser({ displayName: "Sec", email: mail("burst"), password: PASSWORD });
    const ip = "198.51.100.20";
    for (let i = 0; i < LIMITS.loginIpEmail.limit; i++) {
      expect(await authenticate({ email: mail("burst"), password: "bad-password-123" }, { ip })).toEqual({ ok: false, error: "INVALID_CREDENTIALS" });
    }
    const blocked = await authenticate({ email: mail("burst"), password: PASSWORD }, { ip });
    expect(blocked).toMatchObject({ ok: false, error: "INVALID_CREDENTIALS", throttled: true });
    // The account row itself is never locked any more.
    const row = await db.user.findUniqueOrThrow({ where: { email: mail("burst") } });
    expect(row.lockedUntil).toBeNull();
    expect(row.failedLogins).toBe(0);
  });

  it("does not let an attacker on another address lock the real user out", async () => {
    await registerUser({ displayName: "Sec", email: mail("victim"), password: PASSWORD });
    const attacker = "198.51.100.30";
    for (let i = 0; i < LIMITS.loginIpEmail.limit + 2; i++) await authenticate({ email: mail("victim"), password: "guess-guess-123" }, { ip: attacker });
    const owner = await authenticate({ email: mail("victim"), password: PASSWORD }, { ip: "198.51.100.31" });
    expect(owner.ok).toBe(true);
  });

  it("stops slow distributed guessing against one email across many addresses", async () => {
    await registerUser({ displayName: "Sec", email: mail("distributed"), password: PASSWORD });
    for (let i = 0; i < LIMITS.loginEmail.limit; i++) {
      await authenticate({ email: mail("distributed"), password: "guess-guess-123" }, { ip: `203.0.113.${100 + (i % 50)}.${i}` });
    }
    const after = await authenticate({ email: mail("distributed"), password: PASSWORD }, { ip: "203.0.113.250" });
    expect(after).toMatchObject({ ok: false, throttled: true });
  });

  it("a successful sign-in clears the per-address failure count", async () => {
    await registerUser({ displayName: "Sec", email: mail("reset"), password: PASSWORD });
    const ip = "198.51.100.40";
    for (let i = 0; i < LIMITS.loginIpEmail.limit - 1; i++) await authenticate({ email: mail("reset"), password: "bad-password-123" }, { ip });
    expect((await authenticate({ email: mail("reset"), password: PASSWORD }, { ip })).ok).toBe(true);
    for (let i = 0; i < LIMITS.loginIpEmail.limit - 1; i++) await authenticate({ email: mail("reset"), password: "bad-password-123" }, { ip });
    expect((await authenticate({ email: mail("reset"), password: PASSWORD }, { ip })).ok).toBe(true);
  });

  it("limits password spraying from one address across many emails", async () => {
    const ip = "198.51.100.50";
    for (let i = 0; i < LIMITS.loginIp.limit; i++) await authenticate({ email: mail(`spray-${i}`), password: "bad-password-123" }, { ip });
    expect(await authenticate({ email: mail("spray-final"), password: "bad-password-123" }, { ip })).toMatchObject({ throttled: true });
  });
});

describe("secret scanning on learner free text", () => {
  const base = { title: "Build the login form", departmentCode: "fswd", date: "2026-11-16", minutes: 45, kind: "Build", evidenceType: "Screenshot", xpReward: 25, notes: "" };

  it("rejects secrets in a self-made mission's title and notes, and accepts clean text", () => {
    expect(createMissionSchema.safeParse(base).success).toBe(true);
    const title = createMissionSchema.safeParse({ ...base, title: LEAKY });
    expect(title.success).toBe(false);
    expect(title.error?.issues[0].message).toMatch(/secret|password/i);
    expect(createMissionSchema.safeParse({ ...base, notes: LEAKY }).success).toBe(false);
  });

  it("rejects secrets in saved progress notes and in the next-milestone text", () => {
    expect(saveProgressSchema.safeParse({ completedSteps: [], notes: "Finished the header." }).success).toBe(true);
    expect(saveProgressSchema.safeParse({ completedSteps: [], notes: `my ${LEAKY}` }).success).toBe(false);
    expect(milestoneSchema.safeParse("Ship the site").success).toBe(true);
    expect(milestoneSchema.safeParse(LEAKY).success).toBe(false);
  });

  it("rejects secrets in an imported schedule file but still accepts the clean one", () => {
    const raw = readFileSync(path.join(__dirname, "fixtures", "schedule.json"), "utf8");
    expect(parseScheduleFile(raw).ok).toBe(true);
    const doc = JSON.parse(raw);
    doc.weeklyMissions[0].objective = `Do the task. ${LEAKY}`;
    const result = parseScheduleFile(JSON.stringify(doc));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]).toMatch(/secret|password/i);
  });
});

describe("assessed history cannot be deleted from the board", () => {
  it("refuses to delete a mission with submissions, but still deletes a self-made task and revokes its XP", async () => {
    const reg = await registerUser({ displayName: "Sec", email: mail("history"), password: PASSWORD });
    if (!reg.ok) throw new Error("registration failed");
    const userId = reg.userId;

    // A curriculum mission with a submitted attempt (history).
    const lm = await db.learnerMission.findFirstOrThrow({ where: { userId, mission: { code: "FSWD-L0-01" } } });
    await db.learnerMission.update({ where: { id: lm.id }, data: { status: "SUBMITTED" } });
    const submission = await db.submission.create({ data: { userId, learnerMissionId: lm.id, attempt: 1, status: "SUBMITTED", explanation: "Done and tested." } });
    expect(await deleteMission(userId, lm.id)).toBe(false);
    expect(await db.learnerMission.count({ where: { id: lm.id } })).toBe(1);
    expect(await db.submission.count({ where: { id: submission.id } })).toBe(1);

    // Another learner cannot delete it either.
    const other = await registerUser({ displayName: "Other", email: mail("history-other"), password: PASSWORD });
    if (!other.ok) throw new Error("registration failed");
    expect(await deleteMission(other.userId, lm.id)).toBe(false);

    // A self-made task (no submissions) still deletes and revokes its XP.
    const custom = await createCustomMission(userId, { title: "My own task", departmentCode: "fswd", date: "2026-11-16", minutes: 30, kind: "Build", evidenceType: "Screenshot", xpReward: 20, notes: "" });
    await setMissionDone(userId, custom.id, true);
    expect(await getTotalXp(userId)).toBe(20);
    expect(await deleteMission(userId, custom.id)).toBe(true);
    expect(await getTotalXp(userId)).toBe(0);
  });
});
