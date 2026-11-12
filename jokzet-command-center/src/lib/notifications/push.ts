import { z } from "zod";
import { db } from "@/lib/db";

type EnvLike = Record<string, string | undefined>;

/**
 * Web Push. Credentials live ONLY in server environment variables (VAPID_PRIVATE_KEY never leaves the server;
 * only the public key is ever exposed). Nothing here is "NEXT_PUBLIC_".
 */
export function getPushConfig(env: EnvLike = process.env): { configured: boolean; publicKey: string | null } {
  const publicKey = env.VAPID_PUBLIC_KEY;
  const configured = Boolean(publicKey && env.VAPID_PRIVATE_KEY && env.VAPID_SUBJECT);
  return { configured, publicKey: configured ? (publicKey as string) : null };
}

// Push endpoints are URLs the SERVER will POST to, so only the real push services are accepted (SSRF guard).
const ALLOWED_HOSTS: RegExp[] = [
  /^fcm\.googleapis\.com$/,
  /^android\.googleapis\.com$/,
  /(^|\.)push\.services\.mozilla\.com$/,
  /(^|\.)notify\.windows\.com$/,
  /(^|\.)push\.apple\.com$/,
];
const extraHosts = (env: EnvLike) => (env.PUSH_EXTRA_HOSTS ?? "").split(",").map((h) => h.trim().toLowerCase()).filter(Boolean);

export function isAllowedPushEndpoint(endpoint: string, env: EnvLike = process.env): boolean {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port) return false;
  const host = url.hostname.toLowerCase();
  return ALLOWED_HOSTS.some((re) => re.test(host)) || extraHosts(env).includes(host);
}

const b64url = (min: number, max: number) => z.string().min(min).max(max).regex(/^[A-Za-z0-9_-]+={0,2}$/, "Invalid key encoding");

export const subscriptionSchema = z.object({
  endpoint: z.string().max(2048),
  keys: z.object({ p256dh: b64url(80, 100), auth: b64url(20, 26) }),
});

export type SubscriptionInput = z.input<typeof subscriptionSchema>;
export const MAX_SUBSCRIPTIONS_PER_USER = 10;

export type SaveResult = { ok: true } | { ok: false; error: string };

export async function saveSubscription(userId: string, input: unknown, userAgent: string | null, env: EnvLike = process.env): Promise<SaveResult> {
  const parsed = subscriptionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid push subscription." };
  const { endpoint, keys } = parsed.data;
  if (!isAllowedPushEndpoint(endpoint, env)) return { ok: false, error: "That push service is not allowed." };

  // The endpoint is unique. If this browser was previously registered by another account, it now belongs to the
  // signed-in user (an endpoint is unguessable, so only the browser's own session can present it).
  await db.pushSubscription.upsert({
    where: { endpoint },
    update: { userId, p256dh: keys.p256dh, auth: keys.auth, userAgent: userAgent?.slice(0, 255) ?? null, failureCount: 0 },
    create: { userId, endpoint, p256dh: keys.p256dh, auth: keys.auth, userAgent: userAgent?.slice(0, 255) ?? null },
  });

  const all = await db.pushSubscription.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, select: { id: true } });
  if (all.length > MAX_SUBSCRIPTIONS_PER_USER) {
    await db.pushSubscription.deleteMany({ where: { id: { in: all.slice(MAX_SUBSCRIPTIONS_PER_USER).map((s) => s.id) } } });
  }
  return { ok: true };
}

export async function removeSubscription(userId: string, endpoint: string): Promise<number> {
  const { count } = await db.pushSubscription.deleteMany({ where: { userId, endpoint } }); // owner-scoped
  return count;
}

export type PushTarget = { endpoint: string; keys: { p256dh: string; auth: string } };
export type PushSender = (target: PushTarget, payload: string) => Promise<void>;

/** Real sender: lazily configures web-push with the server-side VAPID credentials. */
export const webPushSender: PushSender = async (target, payload) => {
  const webpush = (await import("web-push")).default;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT as string, process.env.VAPID_PUBLIC_KEY as string, process.env.VAPID_PRIVATE_KEY as string);
  await webpush.sendNotification(target, payload, { TTL: 60 * 60, urgency: "high" });
};

export const MAX_PUSH_ATTEMPTS = 5;

export type DispatchStats = { attempted: number; delivered: number; failed: number; skipped: number };

/**
 * Sends pending PUSH deliveries. Each delivery is claimed atomically (attempts compare-and-increment), so two
 * schedulers running at once cannot send the same push twice. Dead subscriptions (404/410) are removed.
 */
export async function dispatchPush(now: Date = new Date(), sender?: PushSender): Promise<DispatchStats> {
  const stats: DispatchStats = { attempted: 0, delivered: 0, failed: 0, skipped: 0 };
  const send = sender ?? (getPushConfig().configured ? webPushSender : null);

  const pending = await db.notificationDelivery.findMany({
    where: { channel: "PUSH", status: "PENDING", attempts: { lt: MAX_PUSH_ATTEMPTS } },
    include: { notification: true },
    take: 100,
    orderBy: { createdAt: "asc" },
  });

  for (const d of pending) {
    if (!send) {
      await db.notificationDelivery.updateMany({ where: { id: d.id, status: "PENDING" }, data: { status: "SKIPPED", lastError: "Web Push is not configured on the server" } });
      stats.skipped += 1;
      continue;
    }
    const claimed = await db.notificationDelivery.updateMany({ where: { id: d.id, status: "PENDING", attempts: d.attempts }, data: { attempts: d.attempts + 1 } });
    if (claimed.count === 0) continue; // someone else is handling it
    stats.attempted += 1;

    const subs = await db.pushSubscription.findMany({ where: { userId: d.notification.userId } });
    if (!subs.length) {
      await db.notificationDelivery.update({ where: { id: d.id }, data: { status: "SKIPPED", lastError: "No push subscription" } });
      stats.skipped += 1;
      continue;
    }
    const payload = JSON.stringify({ title: d.notification.title, body: d.notification.body ?? "", url: d.notification.href ?? "/", tag: d.notification.dedupeKey ?? d.notificationId });

    let delivered = false;
    let lastError = "";
    for (const sub of subs) {
      try {
        await send({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload);
        delivered = true;
        await db.pushSubscription.update({ where: { id: sub.id }, data: { lastSuccessAt: now, failureCount: 0 } });
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        lastError = status ? `Push service returned ${status}` : "Push send failed";
        if (status === 404 || status === 410) await db.pushSubscription.delete({ where: { id: sub.id } }).catch(() => undefined);
        else await db.pushSubscription.update({ where: { id: sub.id }, data: { failureCount: { increment: 1 } } }).catch(() => undefined);
      }
    }

    if (delivered) {
      await db.notificationDelivery.update({ where: { id: d.id }, data: { status: "DELIVERED", deliveredAt: now, lastError: null } });
      stats.delivered += 1;
    } else {
      const exhausted = d.attempts + 1 >= MAX_PUSH_ATTEMPTS;
      await db.notificationDelivery.update({ where: { id: d.id }, data: { status: exhausted ? "FAILED" : "PENDING", lastError } });
      if (exhausted) stats.failed += 1;
    }
  }
  return stats;
}
