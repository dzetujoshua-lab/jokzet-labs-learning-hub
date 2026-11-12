import type { DailyMissionStatus, Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { dateToISO, isoToDate } from "@/lib/programme";
import { DEFAULT_TIMEZONE, addDaysISO, localDateOf, localTimeOf, startInstant, weekdayOf } from "./time";

export const HORIZON_DAYS = 28; // how far ahead daily missions are generated
export const BACKFILL_DAYS = 30; // how far back missed missions are reconstructed on import

type Client = Prisma.TransactionClient | typeof db;

export type DailyMissionView = {
  id: string;
  templateKey: string;
  title: string;
  department: string;
  objective: string;
  date: string; // local calendar date
  time: string; // local HH:mm
  startAt: string; // ISO instant
  durationMinutes: number;
  status: DailyMissionStatus;
  stages: string[];
};

export async function getSettings(userId: string, client: Client = db) {
  return client.reminderSettings.findUnique({ where: { userId } });
}

export async function getActiveSchedule(userId: string, client: Client = db) {
  return client.scheduleConfig.findFirst({
    where: { userId, isActive: true },
    orderBy: { importedAt: "desc" },
    include: { templates: true },
  });
}

/**
 * Creates any missing daily mission instances from the weekly templates: from the programme start (or up to
 * BACKFILL_DAYS ago) to HORIZON_DAYS ahead. Idempotent: (userId, templateId, date) is unique, so repeats never duplicate.
 */
export async function generateInstances(userId: string, now: Date = new Date(), client: Client = db): Promise<number> {
  const schedule = await getActiveSchedule(userId, client);
  if (!schedule) return 0;
  const settings = await getSettings(userId, client);
  const tz = settings?.timezone ?? schedule.timezone ?? DEFAULT_TIMEZONE;

  const today = localDateOf(now, tz);
  const programmeStart = dateToISO(schedule.startDate);
  const from = programmeStart > addDaysISO(today, -BACKFILL_DAYS) ? programmeStart : addDaysISO(today, -BACKFILL_DAYS);
  const to = addDaysISO(today, HORIZON_DAYS);
  const byDay = new Map(schedule.templates.map((t) => [t.dayOfWeek, t]));

  const rows: Prisma.DailyMissionInstanceCreateManyInput[] = [];
  for (let date = from; date <= to; date = addDaysISO(date, 1)) {
    const template = byDay.get(weekdayOf(date));
    if (!template) continue;
    rows.push({
      userId,
      scheduleId: schedule.id,
      templateId: template.id,
      date: isoToDate(date),
      startAt: startInstant(date, settings?.reminderTime ?? template.startTime, tz),
    });
  }
  if (!rows.length) return 0;
  const { count } = await client.dailyMissionInstance.createMany({ data: rows, skipDuplicates: true });
  return count;
}

/** After the user changes reminder time or timezone, future (not yet due) instances move to the new due time. */
export async function recomputeFutureDueTimes(userId: string, now: Date = new Date()): Promise<number> {
  const settings = await getSettings(userId);
  const schedule = await getActiveSchedule(userId);
  if (!schedule) return 0;
  const tz = settings?.timezone ?? schedule.timezone;
  const today = localDateOf(now, tz);
  const templates = new Map(schedule.templates.map((t) => [t.id, t]));
  const future = await db.dailyMissionInstance.findMany({
    where: { userId, status: "SCHEDULED", date: { gte: isoToDate(today) } },
    select: { id: true, templateId: true, date: true },
  });
  let changed = 0;
  for (const inst of future) {
    const template = templates.get(inst.templateId);
    if (!template) continue;
    await db.dailyMissionInstance.update({
      where: { id: inst.id },
      data: { startAt: startInstant(dateToISO(inst.date), settings?.reminderTime ?? template.startTime, tz) },
    });
    changed += 1;
  }
  return changed;
}

/** Marks overdue, unfinished missions as MISSED (kept for review) and records the change. Idempotent. */
export async function reconcileMissed(userId: string, now: Date = new Date()): Promise<number> {
  const settings = await getSettings(userId);
  const schedule = await getActiveSchedule(userId);
  const tz = settings?.timezone ?? schedule?.timezone ?? DEFAULT_TIMEZONE;
  const today = localDateOf(now, tz);
  const overdue = await db.dailyMissionInstance.findMany({
    where: { userId, status: { in: ["SCHEDULED", "STARTED"] }, date: { lt: isoToDate(today) } },
    select: { id: true, status: true },
  });
  if (!overdue.length) return 0;
  await db.$transaction([
    db.dailyMissionInstance.updateMany({
      where: { id: { in: overdue.map((o) => o.id) }, status: { in: ["SCHEDULED", "STARTED"] } },
      data: { status: "MISSED" },
    }),
    db.missionCompletionRecord.createMany({
      data: overdue.map((o) => ({ userId, instanceId: o.id, fromStatus: o.status, toStatus: "MISSED" as const, note: "Not completed by the end of the day" })),
    }),
  ]);
  return overdue.length;
}

type InstanceWithTemplate = Prisma.DailyMissionInstanceGetPayload<{ include: { template: true } }>;

function toView(i: InstanceWithTemplate, tz: string): DailyMissionView {
  const agenda = Array.isArray(i.template.agenda) ? (i.template.agenda as { stage?: string }[]) : [];
  return {
    id: i.id,
    templateKey: i.template.key,
    title: i.template.title,
    department: i.template.department,
    objective: i.template.objective,
    date: dateToISO(i.date),
    time: localTimeOf(i.startAt, tz),
    startAt: i.startAt.toISOString(),
    durationMinutes: i.template.durationMinutes,
    status: i.status,
    stages: agenda.map((a) => a.stage ?? "").filter(Boolean),
  };
}

export async function getTimezone(userId: string): Promise<string> {
  const settings = await getSettings(userId);
  if (settings?.timezone) return settings.timezone;
  return (await getActiveSchedule(userId))?.timezone ?? DEFAULT_TIMEZONE;
}

async function list(userId: string, where: Prisma.DailyMissionInstanceWhereInput, opts: { take?: number; order: "asc" | "desc" }) {
  const tz = await getTimezone(userId);
  const rows = await db.dailyMissionInstance.findMany({
    where: { userId, ...where },
    include: { template: true },
    orderBy: { date: opts.order },
    take: opts.take,
  });
  return rows.map((r) => toView(r, tz));
}

export async function listToday(userId: string, now: Date = new Date()) {
  const today = localDateOf(now, await getTimezone(userId));
  return list(userId, { date: isoToDate(today) }, { order: "asc" });
}

export async function listUpcoming(userId: string, now: Date = new Date(), take = 6) {
  const today = localDateOf(now, await getTimezone(userId));
  return list(userId, { date: { gt: isoToDate(today) }, status: "SCHEDULED" }, { order: "asc", take });
}

export async function listMissed(userId: string, take = 30) {
  return list(userId, { status: "MISSED" }, { order: "desc", take });
}

export async function listHistory(userId: string, take = 20) {
  const tz = await getTimezone(userId);
  const records = await db.missionCompletionRecord.findMany({
    where: { userId },
    orderBy: { occurredAt: "desc" },
    take,
    include: { instance: { include: { template: true } } },
  });
  return records.map((r) => ({
    id: r.id,
    title: r.instance.template.title,
    date: dateToISO(r.instance.date),
    from: r.fromStatus,
    to: r.toStatus,
    note: r.note,
    at: r.occurredAt.toISOString(),
    localTime: localTimeOf(r.occurredAt, tz),
  }));
}

export const USER_SETTABLE: DailyMissionStatus[] = ["STARTED", "AWAITING_ASSESSMENT", "COMPLETED"];

export type TransitionResult = { ok: true } | { ok: false; error: string };

/**
 * Moves a daily mission to STARTED, AWAITING_ASSESSMENT or COMPLETED, scoped to the owner. Future missions cannot be
 * advanced. Every change is appended to the completion history. Re-applying the current status is a no-op.
 */
export async function setDailyStatus(userId: string, instanceId: string, target: DailyMissionStatus, now: Date = new Date()): Promise<TransitionResult> {
  if (!USER_SETTABLE.includes(target)) return { ok: false, error: "That status cannot be set manually." };
  return db.$transaction(async (tx) => {
    const instance = await tx.dailyMissionInstance.findFirst({ where: { id: instanceId, userId } });
    if (!instance) return { ok: false as const, error: "Mission not found." };

    const tz = (await tx.reminderSettings.findUnique({ where: { userId } }))?.timezone ?? DEFAULT_TIMEZONE;
    if (dateToISO(instance.date) > localDateOf(now, tz)) return { ok: false as const, error: "This mission is not due yet." };
    if (instance.status === target) return { ok: true as const };
    if (instance.status === "COMPLETED") return { ok: false as const, error: "This mission is already completed." };

    await tx.dailyMissionInstance.update({
      where: { id: instance.id },
      data: {
        status: target,
        startedAt: instance.startedAt ?? now,
        submittedAt: target === "AWAITING_ASSESSMENT" ? now : instance.submittedAt,
        completedAt: target === "COMPLETED" ? now : null,
      },
    });
    await tx.missionCompletionRecord.create({
      data: {
        userId, instanceId: instance.id, fromStatus: instance.status, toStatus: target,
        note: instance.status === "MISSED" ? "Late update after the day had passed" : null, occurredAt: now,
      },
    });
    return { ok: true as const };
  });
}
