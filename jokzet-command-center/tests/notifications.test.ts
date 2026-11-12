import { readFileSync } from "node:fs";
import { NextRequest } from "next/server";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { ackDelivery, createTestNotification, pendingForClient, planNotifications, tickUser } from "@/lib/notifications/engine";
import { decideBrowserDelivery } from "@/lib/notifications/permission";
import {
  MAX_PUSH_ATTEMPTS, MAX_SUBSCRIPTIONS_PER_USER, dispatchPush, getPushConfig, isAllowedPushEndpoint, removeSubscription, saveSubscription,
  type PushSender,
} from "@/lib/notifications/push";
import { runSchedulerOnce } from "@/lib/notifications/scheduler";
import { hasValidCronSecret, isSameOrigin } from "@/lib/http";
import { setDailyStatus } from "@/lib/schedule/daily";
import { confirmImport } from "@/lib/schedule/importer";
import { updateSettings } from "@/lib/schedule/settings";

const FIXTURE = readFileSync("tests/fixtures/schedule.json", "utf8");
const D = (iso: string) => new Date(iso);
const DUE = D("2026-11-16T12:00:30Z"); // Monday just after the 12:00 reminder (Accra = UTC)

const SETTINGS = { enabled: true, reminderTime: "", timezone: "Africa/Accra", advanceEnabled: false, advanceMinutes: 15, inAppEnabled: true, browserEnabled: false, pushEnabled: false } as const;

// Realistic key shapes (base64url): 65-byte P-256 key = 87 chars, 16-byte auth = 22 chars.
const KEYS = { p256dh: "B".repeat(87), auth: "a".repeat(22) };
const FCM = (id: string) => `https://fcm.googleapis.com/fcm/send/${id}`;

let userA = "";
let userB = "";
const mkUser = async (email: string) => (await db.user.create({ data: { email, passwordHash: "x" } })).id;

async function reset(userId: string) {
  await db.notification.deleteMany({ where: { userId } });
  await db.pushSubscription.deleteMany({ where: { userId } });
  await db.dailyMissionInstance.updateMany({ where: { userId }, data: { status: "SCHEDULED", completedAt: null } });
  await updateSettings(userId, { ...SETTINGS }, D("2026-11-16T10:00:00Z"));
}

beforeAll(async () => {
  await db.user.deleteMany({ where: { email: { startsWith: "notif-test" } } });
  userA = await mkUser("notif-test-a@example.test");
  userB = await mkUser("notif-test-b@example.test");
  await confirmImport(userA, FIXTURE, D("2026-11-16T10:00:00Z"));
  await confirmImport(userB, FIXTURE, D("2026-11-16T10:00:00Z"));
});
afterAll(async () => {
  await db.user.deleteMany({ where: { email: { startsWith: "notif-test" } } });
  await db.$disconnect();
});
beforeEach(async () => {
  await reset(userA);
  await reset(userB);
});
afterEach(() => {
  delete process.env.VAPID_PUBLIC_KEY;
  delete process.env.VAPID_PRIVATE_KEY;
  delete process.env.VAPID_SUBJECT;
});

const enablePush = () => {
  process.env.VAPID_PUBLIC_KEY = "P".repeat(87);
  process.env.VAPID_PRIVATE_KEY = "S".repeat(43);
  process.env.VAPID_SUBJECT = "mailto:test@example.test";
};

describe("due-time reminder at 12:00 and deduplication", () => {
  it("creates nothing before the due time", async () => {
    expect(await planNotifications(userA, D("2026-11-16T11:59:59Z"))).toBe(0);
  });

  it("creates the 12:00 reminder with the template's title and an in-app delivery", async () => {
    expect(await planNotifications(userA, DUE)).toBe(1);
    const n = await db.notification.findFirstOrThrow({ where: { userId: userA }, include: { deliveries: true } });
    expect(n.kind).toBe("DUE");
    expect(n.title).toBe("Today's JOKZET Labs mission: Full-stack Development");
    expect(n.dedupeKey).toMatch(/^due:/);
    expect(n.deliveries.map((d) => `${d.channel}:${d.status}`)).toEqual(["IN_APP:PENDING"]);
  });

  it("never sends the same reminder twice, however often the scheduler ticks", async () => {
    for (let i = 0; i < 4; i++) await planNotifications(userA, new Date(DUE.getTime() + i * 60_000));
    expect(await db.notification.count({ where: { userId: userA } })).toBe(1);
    expect(await db.notificationDelivery.count({ where: { notification: { userId: userA } } })).toBe(1);
  });

  it("stays at one notification even when many ticks race each other", async () => {
    const results = await Promise.all(Array.from({ length: 8 }, () => planNotifications(userA, DUE)));
    expect(results.reduce((a, b) => a + b, 0)).toBe(1);
    expect(await db.notification.count({ where: { userId: userA } })).toBe(1);
  });

  it("does not remind about finished missions, disabled reminders, or stale ones older than a day", async () => {
    const mon = await db.dailyMissionInstance.findFirstOrThrow({ where: { userId: userA, date: D("2026-11-16T00:00:00Z") } });
    await setDailyStatus(userA, mon.id, "COMPLETED", DUE);
    expect(await planNotifications(userA, DUE)).toBe(0);

    await reset(userA);
    await updateSettings(userA, { ...SETTINGS, enabled: false });
    expect(await planNotifications(userA, DUE)).toBe(0);

    await reset(userA);
    // Friday 08:00: Monday's reminder is >24h old (not news); Thursday 12:00 was 20h ago and still is.
    expect(await planNotifications(userA, D("2026-11-20T08:00:00Z"))).toBe(1);
    expect((await db.notification.findFirstOrThrow({ where: { userId: userA } })).title).toContain("Cloud");
  });

  it("creates no notification at all when every channel is off", async () => {
    await updateSettings(userA, { ...SETTINGS, inAppEnabled: false });
    expect(await planNotifications(userA, DUE)).toBe(0);
  });
});

describe("optional advance reminders", () => {
  it("fires once, N minutes before, and is separate from the due reminder", async () => {
    await updateSettings(userA, { ...SETTINGS, advanceEnabled: true, advanceMinutes: 15 });
    expect(await planNotifications(userA, D("2026-11-16T11:44:59Z"))).toBe(0); // too early
    expect(await planNotifications(userA, D("2026-11-16T11:50:00Z"))).toBe(1);
    expect(await planNotifications(userA, D("2026-11-16T11:55:00Z"))).toBe(0); // deduped
    expect(await planNotifications(userA, DUE)).toBe(1); // the due reminder is its own event

    const kinds = (await db.notification.findMany({ where: { userId: userA }, orderBy: { createdAt: "asc" } })).map((n) => n.kind);
    expect(kinds).toEqual(["ADVANCE", "DUE"]);
    const advance = await db.notification.findFirstOrThrow({ where: { userId: userA, kind: "ADVANCE" } });
    expect(advance.title).toBe("Starts in 15 minutes: Full-stack Development");
  });

  it("is off by default", async () => {
    expect(await planNotifications(userA, D("2026-11-16T11:55:00Z"))).toBe(0);
  });
});

describe("channels and notification permission", () => {
  it("adds a BROWSER delivery only when browser notifications were enabled", async () => {
    await updateSettings(userA, { ...SETTINGS, browserEnabled: true });
    await planNotifications(userA, DUE);
    const d = await db.notificationDelivery.findMany({ where: { notification: { userId: userA } }, orderBy: { channel: "asc" } });
    expect(d.map((x) => x.channel).sort()).toEqual(["BROWSER", "IN_APP"]);
  });

  it("maps browser permission to an action: only 'granted' shows; denied/undecided/unsupported are skipped", () => {
    expect(decideBrowserDelivery("granted")).toEqual({ action: "show" });
    for (const p of ["denied", "default", "unsupported"] as const) {
      const decision = decideBrowserDelivery(p);
      expect(decision.action).toBe("skip");
    }
    expect(decideBrowserDelivery("denied")).toMatchObject({ reason: expect.stringMatching(/denied/i) });
  });

  it("keeps the in-app reminder working when the browser channel is skipped", async () => {
    await updateSettings(userA, { ...SETTINGS, browserEnabled: true });
    await planNotifications(userA, DUE);
    const pending = await pendingForClient(userA, DUE);
    expect(pending.map((p) => p.channel).sort()).toEqual(["BROWSER", "IN_APP"]);
    const browser = pending.find((p) => p.channel === "BROWSER")!;
    const inApp = pending.find((p) => p.channel === "IN_APP")!;
    expect(await ackDelivery(userA, browser.deliveryId, "SKIPPED", "Browser notification permission was denied")).toBe(true);
    expect(await ackDelivery(userA, inApp.deliveryId, "DELIVERED")).toBe(true);
    const rows = await db.notificationDelivery.findMany({ where: { notification: { userId: userA } } });
    expect(Object.fromEntries(rows.map((r) => [r.channel, r.status]))).toEqual({ BROWSER: "SKIPPED", IN_APP: "DELIVERED" });
    expect(rows.find((r) => r.channel === "BROWSER")?.lastError).toMatch(/denied/);
  });
});

describe("delivery status is idempotent and owner-scoped", () => {
  it("a delivery can be acknowledged once; repeats and other users change nothing", async () => {
    await planNotifications(userA, DUE);
    const [p] = await pendingForClient(userA, DUE);
    expect(await ackDelivery(userB, p.deliveryId, "DELIVERED")).toBe(false); // someone else's delivery
    expect((await db.notificationDelivery.findUniqueOrThrow({ where: { id: p.deliveryId } })).status).toBe("PENDING");

    expect(await ackDelivery(userA, p.deliveryId, "DELIVERED", undefined, DUE)).toBe(true);
    expect(await ackDelivery(userA, p.deliveryId, "FAILED", "late duplicate")).toBe(false); // already settled
    const row = await db.notificationDelivery.findUniqueOrThrow({ where: { id: p.deliveryId } });
    expect(row).toMatchObject({ status: "DELIVERED", attempts: 1 });
    expect(row.deliveredAt?.toISOString()).toBe(DUE.toISOString());
    expect(await pendingForClient(userA, DUE)).toHaveLength(0); // not shown again
  });

  it("only returns the signed-in user's pending notifications", async () => {
    await planNotifications(userA, DUE);
    await planNotifications(userB, DUE);
    expect((await pendingForClient(userA, DUE)).length).toBe(1);
    expect((await pendingForClient(userB, DUE)).length).toBe(1);
    const a = await pendingForClient(userA, DUE);
    const b = await pendingForClient(userB, DUE);
    expect(a[0].deliveryId).not.toBe(b[0].deliveryId);
  });

  it("test notifications always include the in-app channel and each one is distinct", async () => {
    const k1 = await createTestNotification(userA, D("2026-11-16T12:00:00.000Z"));
    const k2 = await createTestNotification(userA, D("2026-11-16T12:00:00.001Z"));
    expect(k1).not.toBeNull();
    expect(k1).not.toBe(k2);
    const rows = await db.notification.findMany({ where: { userId: userA, kind: "TEST" }, include: { deliveries: true } });
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.deliveries.some((d) => d.channel === "IN_APP"))).toBe(true);
    expect(await createTestNotification(userA, D("2026-11-16T12:00:00.000Z"))).toBeNull(); // same instant = same key = no duplicate
  });
});

describe("Web Push security", () => {
  it("accepts real push-service endpoints only", () => {
    expect(isAllowedPushEndpoint(FCM("abc"))).toBe(true);
    expect(isAllowedPushEndpoint("https://updates.push.services.mozilla.com/wpush/v2/abc")).toBe(true);
    expect(isAllowedPushEndpoint("https://wns2-par02p.notify.windows.com/w/?token=abc")).toBe(true);
    expect(isAllowedPushEndpoint("https://web.push.apple.com/abc")).toBe(true);
    for (const bad of [
      "http://fcm.googleapis.com/fcm/send/abc", // not https
      "https://localhost/push", "https://127.0.0.1/push", "https://169.254.169.254/latest/meta-data", "https://10.0.0.5/x", // SSRF targets
      "https://evil.example.com/fcm.googleapis.com", "https://fcm.googleapis.com.evil.com/x", // look-alikes
      "https://user:pass@fcm.googleapis.com/x", "https://fcm.googleapis.com:8443/x", "javascript:alert(1)", "not a url", "",
    ]) {
      expect(isAllowedPushEndpoint(bad), bad).toBe(false);
    }
    expect(isAllowedPushEndpoint("https://push.internal.test/x", { PUSH_EXTRA_HOSTS: "push.internal.test" })).toBe(true);
  });

  it("validates subscription shape and stores it owner-scoped", async () => {
    expect(await saveSubscription(userA, { endpoint: FCM("1"), keys: { p256dh: "short", auth: KEYS.auth } }, "UA")).toMatchObject({ ok: false });
    expect(await saveSubscription(userA, { endpoint: "https://evil.example.com/x", keys: KEYS }, "UA")).toMatchObject({ ok: false });
    expect(await saveSubscription(userA, null, "UA")).toMatchObject({ ok: false });
    expect(await saveSubscription(userA, { endpoint: FCM("1"), keys: KEYS }, "UA")).toEqual({ ok: true });
    expect(await db.pushSubscription.count({ where: { userId: userA } })).toBe(1);

    // Another user cannot delete it; the owner can.
    expect(await removeSubscription(userB, FCM("1"))).toBe(0);
    expect(await db.pushSubscription.count({ where: { userId: userA } })).toBe(1);
    expect(await removeSubscription(userA, FCM("1"))).toBe(1);
  });

  it("caps subscriptions per user and re-registering the same endpoint does not duplicate", async () => {
    for (let i = 0; i < MAX_SUBSCRIPTIONS_PER_USER + 3; i++) await saveSubscription(userA, { endpoint: FCM(`n${i}`), keys: KEYS }, null);
    expect(await db.pushSubscription.count({ where: { userId: userA } })).toBe(MAX_SUBSCRIPTIONS_PER_USER);
    await saveSubscription(userA, { endpoint: FCM(`n${MAX_SUBSCRIPTIONS_PER_USER + 2}`), keys: KEYS }, null);
    expect(await db.pushSubscription.count({ where: { userId: userA } })).toBe(MAX_SUBSCRIPTIONS_PER_USER);
  });

  it("never exposes the private key: only the public key leaves the server", () => {
    expect(getPushConfig({})).toEqual({ configured: false, publicKey: null });
    const env = { VAPID_PUBLIC_KEY: "PUBLIC", VAPID_PRIVATE_KEY: "SECRET-PRIVATE", VAPID_SUBJECT: "mailto:a@b.test" };
    const config = getPushConfig(env);
    expect(config).toEqual({ configured: true, publicKey: "PUBLIC" });
    expect(JSON.stringify(config)).not.toContain("SECRET-PRIVATE");
    expect(Object.keys(config).sort()).toEqual(["configured", "publicKey"]);
    expect(getPushConfig({ VAPID_PUBLIC_KEY: "PUBLIC" }).configured).toBe(false); // partial config = off
  });

  it("source never references VAPID_PRIVATE_KEY outside the server push module", () => {
    // Static guard: the private key is read in exactly one place and never in client code or NEXT_PUBLIC_ variables.
    const files = ["src/lib/notifications/push.ts", "src/app/api/push/config/route.ts", "src/components/settings/browser-notifications.tsx", "public/sw.js"];
    const uses = files.filter((f) => readFileSync(f, "utf8").includes("VAPID_PRIVATE_KEY"));
    expect(uses).toEqual(["src/lib/notifications/push.ts"]);
    expect(readFileSync(".env.example", "utf8")).not.toMatch(/NEXT_PUBLIC_.*(VAPID|CRON)/);
  });

  it("protects the dispatch endpoint with a constant-time bearer secret and fails closed", () => {
    const req = (auth?: string) => new NextRequest("http://localhost/api/cron/dispatch", { method: "POST", headers: auth ? { authorization: auth } : {} });
    const secret = "s".repeat(32);
    expect(hasValidCronSecret(req(), undefined)).toBe(false); // no secret configured = closed
    expect(hasValidCronSecret(req(`Bearer short`), "short")).toBe(false); // weak secret refused
    expect(hasValidCronSecret(req(), secret)).toBe(false);
    expect(hasValidCronSecret(req("Bearer wrong".padEnd(39, "x")), secret)).toBe(false);
    expect(hasValidCronSecret(req(`Basic ${secret}`), secret)).toBe(false);
    expect(hasValidCronSecret(req(`Bearer ${secret}`), secret)).toBe(true);
  });

  it("rejects cross-site POSTs to cookie-authenticated routes", () => {
    const mk = (origin?: string) => new NextRequest("http://localhost:3000/api/push/subscribe", { method: "POST", headers: origin ? { origin } : {} });
    expect(isSameOrigin(mk("http://localhost:3000"))).toBe(true);
    expect(isSameOrigin(mk("https://evil.example.com"))).toBe(false);
    expect(isSameOrigin(mk())).toBe(false);
  });
});

describe("push delivery (injected sender; no real push service is contacted)", () => {
  async function setupPush() {
    enablePush();
    await updateSettings(userA, { ...SETTINGS, pushEnabled: true });
    await saveSubscription(userA, { endpoint: FCM("device1"), keys: KEYS }, "UA");
    await planNotifications(userA, DUE);
  }

  it("only plans a PUSH delivery when the server is configured AND a subscription exists", async () => {
    await updateSettings(userA, { ...SETTINGS, pushEnabled: true });
    await planNotifications(userA, DUE); // not configured, no subscription
    expect((await db.notificationDelivery.findMany({ where: { notification: { userId: userA } } })).map((d) => d.channel)).toEqual(["IN_APP"]);
  });

  it("delivers once, with a payload that contains no credentials", async () => {
    await setupPush();
    const sender = vi.fn<PushSender>().mockResolvedValue(undefined);
    const stats = await dispatchPush(DUE, sender);
    expect(stats).toMatchObject({ attempted: 1, delivered: 1 });
    expect(sender).toHaveBeenCalledTimes(1);
    const [target, payload] = sender.mock.calls[0];
    expect(target.endpoint).toBe(FCM("device1"));
    expect(JSON.parse(payload)).toMatchObject({ title: "Today's JOKZET Labs mission: Full-stack Development", url: "/" });
    expect(payload).not.toMatch(/VAPID|SECRET|private/i);

    expect(await dispatchPush(DUE, sender)).toMatchObject({ attempted: 0 }); // nothing left to send
    expect(sender).toHaveBeenCalledTimes(1);
    const d = await db.notificationDelivery.findFirstOrThrow({ where: { channel: "PUSH", notification: { userId: userA } } });
    expect(d.status).toBe("DELIVERED");
  });

  it("two schedulers running at once still send the push only once", async () => {
    await setupPush();
    const sender = vi.fn<PushSender>().mockImplementation(async () => { await new Promise((r) => setTimeout(r, 30)); });
    await Promise.all([dispatchPush(DUE, sender), dispatchPush(DUE, sender)]);
    expect(sender).toHaveBeenCalledTimes(1);
  });

  it("removes dead subscriptions (410) and records the failure instead of resending forever", async () => {
    await setupPush();
    const gone = vi.fn<PushSender>().mockRejectedValue(Object.assign(new Error("gone"), { statusCode: 410 }));
    await dispatchPush(DUE, gone);
    expect(await db.pushSubscription.count({ where: { userId: userA } })).toBe(0);
    // Next pass: no subscription left, so the delivery is skipped rather than retried.
    await dispatchPush(DUE, gone);
    const d = await db.notificationDelivery.findFirstOrThrow({ where: { channel: "PUSH", notification: { userId: userA } } });
    expect(d.status).toBe("SKIPPED");
    expect(gone).toHaveBeenCalledTimes(1);
  });

  it("gives up after the maximum number of attempts and reports FAILED", async () => {
    await setupPush();
    const failing = vi.fn<PushSender>().mockRejectedValue(Object.assign(new Error("boom"), { statusCode: 503 }));
    for (let i = 0; i < MAX_PUSH_ATTEMPTS + 2; i++) await dispatchPush(DUE, failing);
    expect(failing).toHaveBeenCalledTimes(MAX_PUSH_ATTEMPTS);
    const d = await db.notificationDelivery.findFirstOrThrow({ where: { channel: "PUSH", notification: { userId: userA } } });
    expect(d).toMatchObject({ status: "FAILED", attempts: MAX_PUSH_ATTEMPTS });
    expect(d.lastError).toMatch(/503/);
  });

  it("marks push as skipped (not delivered) when the server has no VAPID configuration", async () => {
    await setupPush();
    delete process.env.VAPID_PRIVATE_KEY; // misconfigured after the notification was planned
    const stats = await dispatchPush(DUE);
    expect(stats.delivered).toBe(0);
    const d = await db.notificationDelivery.findFirstOrThrow({ where: { channel: "PUSH", notification: { userId: userA } } });
    expect(d.status).toBe("SKIPPED");
    expect(d.lastError).toMatch(/not configured/i);
  });
});

describe("server-side scheduler (no browser open)", () => {
  it("creates due reminders and delivers push in one pass, and a second pass does nothing", async () => {
    enablePush();
    await updateSettings(userA, { ...SETTINGS, pushEnabled: true });
    await saveSubscription(userA, { endpoint: FCM("sched"), keys: KEYS }, null);
    const sender = vi.fn<PushSender>().mockResolvedValue(undefined);

    const first = await runSchedulerOnce(DUE, sender);
    expect(first?.created).toBeGreaterThanOrEqual(1);
    expect(first?.push.delivered).toBe(1);
    const second = await runSchedulerOnce(DUE, sender);
    expect(second?.created).toBe(0);
    expect(second?.push.attempted).toBe(0);
    expect(sender).toHaveBeenCalledTimes(1);
    expect(await db.notification.count({ where: { userId: userA, kind: "DUE" } })).toBe(1);
  });

  it("tickUser (used while the app is open) agrees with the server scheduler and does not duplicate", async () => {
    await runSchedulerOnce(DUE);
    expect(await tickUser(userA, DUE)).toBe(0);
    expect(await db.notification.count({ where: { userId: userA, kind: "DUE" } })).toBe(1);
  });
});
