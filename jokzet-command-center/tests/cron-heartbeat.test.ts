import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/cron/dispatch/route";
import { db } from "@/lib/db";

const SECRET = "test-cron-secret-0123456789-abcdef";
const call = (auth?: string) => POST(new NextRequest("https://example.test/api/cron/dispatch", { method: "POST", headers: auth ? { authorization: auth } : undefined }));
const beats = () => db.rateLimitBucket.count({ where: { key: { startsWith: "cron:heartbeat" } } });
let saved: string | undefined;

beforeAll(async () => {
  saved = process.env.CRON_SECRET;
  process.env.CRON_SECRET = SECRET;
  await db.rateLimitBucket.deleteMany({ where: { key: { startsWith: "cron:heartbeat" } } });
});
afterAll(async () => {
  if (saved === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = saved;
  await db.rateLimitBucket.deleteMany({ where: { key: { startsWith: "cron:heartbeat" } } });
  await db.$disconnect();
});

describe("scheduler heartbeat", () => {
  it("records nothing for a request without the secret, or with a wrong one", async () => {
    expect((await call()).status).toBe(401);
    expect((await call("Bearer wrong-secret-value-0123456789-abcd")).status).toBe(401);
    expect(await beats()).toBe(0);
  });

  it("records one row for the current minute per authorised call, and counts repeat calls in that row", async () => {
    const first = await call(`Bearer ${SECRET}`);
    expect(first.status).toBe(200);
    expect(await beats()).toBe(1);
    expect((await call(`Bearer ${SECRET}`)).status).toBe(200);
    const total = await db.rateLimitBucket.aggregate({ where: { key: { startsWith: "cron:heartbeat" } }, _sum: { count: true } });
    expect(total._sum.count).toBeGreaterThanOrEqual(2); // two minutes at most, one row each
  });
});
