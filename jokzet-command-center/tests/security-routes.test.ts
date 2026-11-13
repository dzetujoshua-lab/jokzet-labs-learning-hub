import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { waitForWindowRoom } from "./helpers/window";
import { db } from "@/lib/db";
import { LIMITS, bucketKey, rateLimitHit } from "@/lib/ratelimit";

// The route handlers read the session from cookies; stand in for it with a fixed learner.
const session = vi.hoisted(() => ({ user: { id: "route-test-user", email: "x@example.test", displayName: "R", role: "LEARNER" as const } as { id: string; email: string; displayName: string; role: "LEARNER" } | null }));
const engine = vi.hoisted(() => ({ tickUser: vi.fn(async () => 0), pendingForClient: vi.fn(async () => [] as unknown[]) }));

vi.mock("@/lib/auth/dal", () => ({ getCurrentUser: async () => session.user, requireUser: async () => session.user }));
vi.mock("@/lib/notifications/engine", () => engine);

import { GET as pendingGet } from "@/app/api/notifications/pending/route";
import { POST as evidencePost } from "@/app/api/evidence/route";

// Only this file's own keys: test files run in parallel against one database.
async function clearBuckets() {
  await db.rateLimitBucket.deleteMany({ where: { OR: [{ key: { startsWith: "pending:" } }, { key: { startsWith: "evidence:" } }] } });
}

beforeAll(async () => {
  await clearBuckets();
});
beforeEach(async () => {
  await waitForWindowRoom(60, 10_000); // the poll limits count per minute
  await clearBuckets();
  engine.tickUser.mockClear();
  engine.pendingForClient.mockClear();
  session.user = { id: "route-test-user", email: "x@example.test", displayName: "R", role: "LEARNER" };
}, 60_000);
afterAll(async () => {
  await clearBuckets();
  await db.$disconnect();
});

describe("reminder poll (/api/notifications/pending)", () => {
  it("requires a session", async () => {
    session.user = null;
    expect((await pendingGet()).status).toBe(401);
    expect(engine.tickUser).not.toHaveBeenCalled();
  });

  it("runs the reminder bookkeeping at most once per 20 s per learner, however often it is polled", async () => {
    for (let i = 0; i < 5; i++) expect((await pendingGet()).status).toBe(200);
    expect(engine.tickUser).toHaveBeenCalledTimes(1); // the other four polls only read what is pending
    expect(engine.pendingForClient).toHaveBeenCalledTimes(5);
  });

  it("answers 429 with Retry-After once a learner polls far too often, and other learners are unaffected", async () => {
    for (let i = 0; i < LIMITS.pendingUser.limit; i++) await pendingGet();
    const blocked = await pendingGet();
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get("Retry-After"))).toBeGreaterThan(0);

    session.user = { id: "route-test-other", email: "y@example.test", displayName: "O", role: "LEARNER" };
    expect((await pendingGet()).status).toBe(200);
  });
});

describe("evidence upload (/api/evidence)", () => {
  const post = () =>
    evidencePost(new NextRequest("http://localhost/api/evidence", { method: "POST", headers: { origin: "http://localhost", "x-nf-client-connection-ip": "198.51.100.77" }, body: new FormData() }));

  it("rejects cross-site requests and anonymous callers before any throttling or parsing", async () => {
    const cross = await evidencePost(new NextRequest("http://localhost/api/evidence", { method: "POST", headers: { origin: "http://evil.example" }, body: new FormData() }));
    expect(cross.status).toBe(403);
    session.user = null;
    expect((await post()).status).toBe(401);
  });

  it("answers 429 with Retry-After once a learner has used up their upload allowance", async () => {
    const key = bucketKey("evidence:user", "route-test-user");
    for (let i = 0; i < LIMITS.evidenceUser.limit; i++) await rateLimitHit(key, LIMITS.evidenceUser);
    const blocked = await post();
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect((await blocked.json()).error).toMatch(/too many uploads/i);
  });

  it("also limits by network address, so many accounts from one address cannot flood uploads", async () => {
    const key = bucketKey("evidence:ip", "198.51.100.77");
    for (let i = 0; i < LIMITS.evidenceIp.limit; i++) await rateLimitHit(key, LIMITS.evidenceIp);
    expect((await post()).status).toBe(429);
  });
});
