import { Prisma, type DeliveryChannel, type DeliveryStatus, type NotificationKind } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { generateInstances, getSettings, localTimeOf, reconcileMissed } from "./deps";
import { getPushConfig } from "./push";

export const DUE_WINDOW_MS = 24 * 60 * 60 * 1000; // a due reminder older than a day is history, not news
export const DEFAULT_ADVANCE_MINUTES = 15;

type NewNotification = {
  userId: string;
  instanceId: string | null;
  kind: NotificationKind;
  dedupeKey: string;
  scheduledFor: Date;
  title: string;
  body: string;
  channels: DeliveryChannel[];
};

/** Inserts a notification and its per-channel deliveries atomically. Returns false if this dedupeKey already exists. */
async function createOnce(n: NewNotification): Promise<boolean> {
  try {
    await db.notification.create({
      data: {
        userId: n.userId,
        instanceId: n.instanceId,
        kind: n.kind,
        type: n.kind,
        dedupeKey: n.dedupeKey,
        scheduledFor: n.scheduledFor,
        title: n.title,
        body: n.body,
        href: n.instanceId ? "/" : "/reminders",
        deliveries: { create: n.channels.map((channel) => ({ channel })) },
      },
    });
    return true;
  } catch (error) {
    // Unique violation on dedupeKey = already created (by another tab, tick or process). That is the idempotency guarantee.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return false;
    throw error;
  }
}

async function channelsFor(userId: string, settings: NonNullable<Awaited<ReturnType<typeof getSettings>>>): Promise<DeliveryChannel[]> {
  const channels: DeliveryChannel[] = [];
  if (settings.inAppEnabled) channels.push("IN_APP");
  if (settings.browserEnabled) channels.push("BROWSER");
  if (settings.pushEnabled && getPushConfig().configured && (await db.pushSubscription.count({ where: { userId } })) > 0) channels.push("PUSH");
  return channels;
}

/**
 * Creates the notifications that are due for a user right now: "at start" for every mission whose due time has
 * passed (within 24h) and, if enabled, an advance reminder. Safe to call as often as you like: dedupe keys make it
 * idempotent. Returns how many notifications were newly created.
 */
export async function planNotifications(userId: string, now: Date = new Date()): Promise<number> {
  const settings = await getSettings(userId);
  if (!settings?.enabled) return 0;
  const channels = await channelsFor(userId, settings);
  if (!channels.length) return 0;

  let created = 0;
  const due = await db.dailyMissionInstance.findMany({
    where: { userId, status: { in: ["SCHEDULED", "STARTED"] }, startAt: { lte: now, gt: new Date(now.getTime() - DUE_WINDOW_MS) } },
    include: { template: true },
  });
  for (const i of due) {
    const ok = await createOnce({
      userId, instanceId: i.id, kind: "DUE", dedupeKey: `due:${i.id}`, scheduledFor: i.startAt, channels,
      title: i.template.notificationTitle,
      body: `${localTimeOf(i.startAt, settings.timezone)} · ${i.template.durationMinutes} min — ${i.template.objective}`,
    });
    if (ok) created += 1;
  }

  if (settings.advanceEnabled && settings.advanceMinutes > 0) {
    const lead = settings.advanceMinutes * 60_000;
    const upcoming = await db.dailyMissionInstance.findMany({
      where: { userId, status: "SCHEDULED", startAt: { gt: now, lte: new Date(now.getTime() + lead) } },
      include: { template: true },
    });
    for (const i of upcoming) {
      const ok = await createOnce({
        userId, instanceId: i.id, kind: "ADVANCE", dedupeKey: `adv:${i.id}:${settings.advanceMinutes}`, scheduledFor: new Date(i.startAt.getTime() - lead), channels,
        title: `Starts in ${settings.advanceMinutes} minutes: ${i.template.title}`,
        body: `${localTimeOf(i.startAt, settings.timezone)} · ${i.template.durationMinutes} min`,
      });
      if (ok) created += 1;
    }
  }
  return created;
}

/** One scheduler pass for one user: make sure missions exist, reconcile missed ones, create due notifications. */
export async function tickUser(userId: string, now: Date = new Date()) {
  await generateInstances(userId, now);
  await reconcileMissed(userId, now);
  return planNotifications(userId, now);
}

export type PendingDelivery = { deliveryId: string; notificationId: string; channel: "IN_APP" | "BROWSER"; title: string; body: string; href: string; tag: string };

/** Deliveries a signed-in browser still has to show. PUSH deliveries are handled server-side and never returned. */
export async function pendingForClient(userId: string, now: Date = new Date()): Promise<PendingDelivery[]> {
  const rows = await db.notificationDelivery.findMany({
    where: {
      status: "PENDING",
      channel: { in: ["IN_APP", "BROWSER"] },
      notification: { userId, scheduledFor: { gt: new Date(now.getTime() - 2 * DUE_WINDOW_MS) } }, // by when it was due, not when the row was written
    },
    include: { notification: true },
    orderBy: { createdAt: "asc" },
    take: 20,
  });
  return rows.map((d) => ({
    deliveryId: d.id,
    notificationId: d.notificationId,
    channel: d.channel as "IN_APP" | "BROWSER",
    title: d.notification.title,
    body: d.notification.body ?? "",
    href: d.notification.href ?? "/",
    tag: d.notification.dedupeKey ?? d.notificationId, // same tag = the browser replaces instead of duplicating
  }));
}

/** Records the outcome of a delivery attempt. Owner-scoped and idempotent: only a PENDING delivery can change. */
export async function ackDelivery(userId: string, deliveryId: string, status: Extract<DeliveryStatus, "DELIVERED" | "SKIPPED" | "FAILED">, error?: string, now: Date = new Date()): Promise<boolean> {
  const { count } = await db.notificationDelivery.updateMany({
    where: { id: deliveryId, status: "PENDING", notification: { userId } },
    data: { status, attempts: { increment: 1 }, lastError: error?.slice(0, 200) ?? null, deliveredAt: status === "DELIVERED" ? now : null },
  });
  return count > 0;
}

export async function markAllRead(userId: string, now: Date = new Date()) {
  return db.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: now } });
}

/** A user-requested test. Always includes the in-app channel so the user sees the result even without permission. */
export async function createTestNotification(userId: string, now: Date = new Date()): Promise<string | null> {
  const settings = await getSettings(userId);
  const channels = new Set<DeliveryChannel>(["IN_APP"]);
  if (settings?.browserEnabled) channels.add("BROWSER");
  if (settings?.pushEnabled && getPushConfig().configured && (await db.pushSubscription.count({ where: { userId } })) > 0) channels.add("PUSH");
  const key = `test:${userId}:${now.getTime()}`;
  const ok = await createOnce({
    userId, instanceId: null, kind: "TEST", dedupeKey: key, scheduledFor: now, channels: [...channels],
    title: "JOKZET Labs test notification", body: "If you can read this, reminders can reach you.",
  });
  return ok ? key : null;
}

export async function listHistory(userId: string, take = 30) {
  const rows = await db.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take,
    include: { deliveries: { select: { channel: true, status: true, lastError: true, deliveredAt: true } } },
  });
  return rows.map((n) => ({
    id: n.id,
    kind: n.kind,
    title: n.title,
    body: n.body ?? "",
    createdAt: n.createdAt.toISOString(),
    readAt: n.readAt?.toISOString() ?? null,
    deliveries: n.deliveries.map((d) => ({ channel: d.channel, status: d.status, error: d.lastError })),
  }));
}
