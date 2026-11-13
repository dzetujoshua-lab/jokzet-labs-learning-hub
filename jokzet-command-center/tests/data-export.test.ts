import { readFileSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { EXCLUDED, EXPORTED, SHARED } from "@/lib/privacy/export-spec";
import { buildUserExport, serializeExport } from "@/lib/privacy/export";
import { bucketKey } from "@/lib/ratelimit";

const session = vi.hoisted(() => ({ user: null as { id: string; email: string; displayName: string; role: "LEARNER" } | null }));
vi.mock("@/lib/auth/dal", () => ({ getCurrentUser: async () => session.user, requireUser: async () => session.user }));

import { GET } from "@/app/api/account/export/route";

let a = "";
let b = "";

beforeAll(async () => {
  await db.user.deleteMany({ where: { email: { startsWith: "export-test" } } });
  a = (await db.user.create({ data: { email: "export-test-a@example.test", passwordHash: "ARGON-HASH-OF-A" } })).id;
  b = (await db.user.create({ data: { email: "export-test-b@example.test", passwordHash: "ARGON-HASH-OF-B" } })).id;
  for (const [id, tag] of [[a, "A"], [b, "B"]] as const) {
    await db.profile.create({ data: { userId: id, displayName: `Learner ${tag} Name` } });
    await db.session.create({ data: { userId: id, tokenHash: `TOKENHASH-${tag}`, expiresAt: new Date(Date.now() + 1e8), ipAddress: "203.0.113.9" } });
    await db.pushSubscription.create({ data: { userId: id, endpoint: `https://push.example.test/${tag}`, p256dh: `P256-${tag}`, auth: `AUTH-${tag}` } });
  }
}, 60_000);

beforeEach(async () => {
  await db.rateLimitBucket.deleteMany({ where: { key: { startsWith: "export:" } } });
  session.user = { id: a, email: "export-test-a@example.test", displayName: "A", role: "LEARNER" };
});

afterAll(async () => {
  await db.rateLimitBucket.deleteMany({ where: { key: { startsWith: "export:" } } });
  await db.user.deleteMany({ where: { email: { startsWith: "export-test" } } });
  await db.$disconnect();
});

describe("the export covers every table, deliberately", () => {
  it("classifies every model in schema.prisma as exported, shared or excluded (and nothing else)", () => {
    const schema = readFileSync(path.resolve(import.meta.dirname, "../prisma/schema.prisma"), "utf8");
    const models = [...schema.matchAll(/^model (\w+) \{/gm)].map((m) => m[1]);
    const classified = [...EXPORTED.map((s) => s.model), ...SHARED, ...Object.keys(EXCLUDED)];
    expect(models.filter((m) => !classified.includes(m)), "new model: decide whether it belongs in the personal-data export").toEqual([]);
    expect(classified.filter((m) => !models.includes(m)), "listed model no longer exists").toEqual([]);
    expect(new Set(classified).size, "a model is classified twice").toBe(classified.length);
    expect(new Set(EXPORTED.map((s) => s.key)).size).toBe(EXPORTED.length);
  });

  it("queries every exported table without error", async () => {
    const out = await buildUserExport(a);
    expect(Object.keys(out.data).sort()).toEqual(EXPORTED.map((s) => s.key).sort());
    for (const v of Object.values(out.data)) expect(Array.isArray(v)).toBe(true);
  });
});

describe("what is in the file", () => {
  it("contains the learner's own records", async () => {
    const out = await buildUserExport(a);
    expect(out.account).toMatchObject({ id: a, email: "export-test-a@example.test" });
    expect(out.data.profile).toHaveLength(1);
    expect((out.data.profile[0] as { displayName: string }).displayName).toBe("Learner A Name");
    expect(out.counts.sessions).toBe(1);
    expect(out.counts.pushSubscriptions).toBe(1);
  });

  it("never contains another learner's data", async () => {
    const text = serializeExport(await buildUserExport(a));
    for (const needle of [b, "export-test-b@example.test", "Learner B Name", "TOKENHASH-B"]) expect(text, needle).not.toContain(needle);
  });

  it("never contains credentials or storage internals", async () => {
    const text = serializeExport(await buildUserExport(a));
    for (const secret of ["ARGON-HASH-OF-A", "passwordHash", "TOKENHASH-A", "tokenHash", "P256-A", "AUTH-A", "push.example.test", "storageKey", "failedLogins"]) {
      expect(text, secret).not.toContain(secret);
    }
  });
});

describe("the page and the policy agree with the feature", () => {
  it("links the download from Settings and says so in the policy", () => {
    const settings = readFileSync(path.resolve(import.meta.dirname, "../src/app/(app)/settings/page.tsx"), "utf8");
    expect(settings).toContain('href="/api/account/export"');
    const policy = readFileSync(path.resolve(import.meta.dirname, "../src/app/privacy-policy/page.tsx"), "utf8");
    expect(policy).toContain("download a copy of your data from Settings");
  });
});

describe("GET /api/account/export", () => {
  const call = (headers: Record<string, string> = {}) => GET(new NextRequest("http://localhost/api/account/export", { headers }));

  it("requires a session", async () => {
    session.user = null;
    expect((await call()).status).toBe(401);
  });

  it("downloads the signed-in learner's data as an uncached JSON attachment", async () => {
    const res = await call();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
    expect(res.headers.get("content-disposition")).toMatch(/^attachment; filename="jokzet-labs-my-data-\d{4}-\d{2}-\d{2}\.json"$/);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const body = JSON.parse(await res.text());
    expect(body.exportVersion).toBe(1);
    expect(body.account.id).toBe(a);
    expect(body.notes.length).toBeGreaterThan(0);
  });

  it("takes the learner from the session, never from the request", async () => {
    const res = await GET(new NextRequest(`http://localhost/api/account/export?userId=${b}&id=${b}`));
    expect(JSON.parse(await res.text()).account.id).toBe(a);
  });

  it("refuses a background request triggered by another site, but allows a normal navigation", async () => {
    expect((await call({ "sec-fetch-site": "cross-site", "sec-fetch-mode": "no-cors" })).status).toBe(403);
    expect((await call({ "sec-fetch-site": "same-origin", "sec-fetch-mode": "navigate" })).status).toBe(200);
  });

  it("is throttled", async () => {
    const results: number[] = [];
    for (let i = 0; i < 7; i++) results.push((await call()).status);
    expect(results.slice(0, 5).every((s) => s === 200)).toBe(true);
    expect(results.slice(5)).toEqual([429, 429]);
    expect(bucketKey("export:user", a)).toContain("export:user");
  });
});
