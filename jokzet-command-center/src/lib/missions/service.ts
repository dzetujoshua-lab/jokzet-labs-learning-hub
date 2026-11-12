import { addDays } from "date-fns";
import type { LearnerMissionStatus, Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { WEEKLY_SCHEDULE } from "@/lib/departments";
import { dateToISO, isoToDate, levelFromXp, toEnum, toLabel } from "@/lib/programme";
import { createMissionSchema, milestoneSchema, type CreateMissionInput } from "./schema";

/** Mission shape used by the UI. Mirrors the Base44 Mission entity so the original components keep working. */
export type MissionView = {
  id: string; // LearnerMission id
  missionId: string;
  code: string | null;
  title: string;
  departmentCode: string;
  date: string | null;
  minutes: number;
  kind: string;
  evidenceType: string;
  status: "planned" | "active" | "done" | "skipped";
  xpReward: number;
  custom: boolean;
};

export type DepartmentView = {
  id: string;
  code: string;
  name: string;
  xp: number;
  level: number;
  nextMilestone: string | null;
  sortOrder: number;
};

const COUNTS_AS_DONE: LearnerMissionStatus[] = ["COMPLETED", "PASSED"];

export function statusToView(status: LearnerMissionStatus): MissionView["status"] {
  if (COUNTS_AS_DONE.includes(status)) return "done";
  if (status === "SKIPPED") return "skipped";
  if (status === "NOT_STARTED") return "planned";
  return "active";
}

type LearnerMissionWithMission = Prisma.LearnerMissionGetPayload<{
  include: { mission: { include: { department: { select: { code: true } } } } };
}>;

function toView(lm: LearnerMissionWithMission): MissionView {
  return {
    id: lm.id,
    missionId: lm.missionId,
    code: lm.mission.code,
    title: lm.mission.title,
    departmentCode: lm.mission.department.code,
    date: lm.scheduledFor ? dateToISO(lm.scheduledFor) : null,
    minutes: lm.mission.durationMinutes,
    kind: toLabel(lm.mission.kind),
    evidenceType: toLabel(lm.mission.evidenceType),
    status: statusToView(lm.status),
    xpReward: lm.mission.xpReward,
    custom: lm.mission.createdById !== null,
  };
}

const missionInclude = { mission: { include: { department: { select: { code: true } } } } } as const;

export async function listMissions(userId: string): Promise<MissionView[]> {
  const rows = await db.learnerMission.findMany({
    where: { userId },
    include: missionInclude,
    orderBy: [{ scheduledFor: "asc" }, { createdAt: "asc" }],
  });
  return rows.map(toView);
}

export async function listDepartments(userId: string): Promise<DepartmentView[]> {
  const [rows, levels] = await Promise.all([
    db.learnerDepartment.findMany({
      where: { userId },
      include: { department: true },
      orderBy: { department: { sortOrder: "asc" } },
    }),
    db.level.findMany({ where: { number: 0 }, select: { milestone: true, learningPath: { select: { departmentId: true } } } }),
  ]);
  // The learner-edited milestone wins; otherwise show the curriculum milestone for Level 0.
  const fallback = new Map(levels.map((l) => [l.learningPath.departmentId, l.milestone]));
  return rows.map((r) => ({
    id: r.departmentId,
    code: r.department.code,
    name: r.department.name,
    xp: r.xp,
    level: r.level,
    nextMilestone: r.nextMilestone ?? fallback.get(r.departmentId) ?? null,
    sortOrder: r.department.sortOrder,
  }));
}

/**
 * Marks a mission done (or back to planned) and moves the department's XP in the same transaction.
 * XP is awarded once (tracked in xpAwarded) and fully revoked when un-done, so toggling cannot farm XP.
 * Returns false when the mission does not exist or does not belong to the user.
 */
export async function setMissionDone(userId: string, learnerMissionId: string, done: boolean): Promise<boolean> {
  return db.$transaction(async (tx) => {
    const lm = await tx.learnerMission.findFirst({
      where: { id: learnerMissionId, userId },
      include: { mission: true },
    });
    if (!lm) return false;

    const wasDone = COUNTS_AS_DONE.includes(lm.status);
    if (lm.status === "PASSED" && !done) return false; // an assessed pass cannot be undone from the board
    if (done === wasDone) return true;

    const now = new Date();
    if (done) {
      const award = lm.mission.xpReward;
      await tx.learnerMission.update({
        where: { id: lm.id },
        data: { status: "COMPLETED", completedAt: now, startedAt: lm.startedAt ?? now, xpAwarded: award },
      });
      await adjustDepartmentXp(tx, userId, lm.mission.departmentId, award);
      await tx.activityRecord.create({
        data: {
          userId, type: "MISSION_COMPLETED", entityType: "Mission", entityId: lm.missionId,
          minutes: lm.mission.durationMinutes, occurredAt: now,
        },
      });
    } else {
      const revoke = lm.xpAwarded;
      await tx.learnerMission.update({
        where: { id: lm.id },
        data: { status: "NOT_STARTED", completedAt: null, xpAwarded: 0 },
      });
      if (revoke > 0) await adjustDepartmentXp(tx, userId, lm.mission.departmentId, -revoke);
    }
    return true;
  });
}

export async function adjustDepartmentXp(tx: Prisma.TransactionClient, userId: string, departmentId: string, delta: number) {
  const current = await tx.learnerDepartment.findUniqueOrThrow({
    where: { userId_departmentId: { userId, departmentId } },
  });
  const xp = Math.max(0, current.xp + delta);
  await tx.learnerDepartment.update({
    where: { id: current.id },
    data: { xp, level: levelFromXp(xp) },
  });
}

export async function createCustomMission(userId: string, input: CreateMissionInput): Promise<MissionView> {
  const data = createMissionSchema.parse(input);
  const department = await db.department.findUniqueOrThrow({ where: { code: data.departmentCode } });
  const lm = await db.$transaction(async (tx) => {
    const mission = await tx.mission.create({
      data: {
        departmentId: department.id,
        createdById: userId,
        title: data.title,
        durationMinutes: data.minutes,
        kind: toEnum(data.kind) as never,
        evidenceType: toEnum(data.evidenceType) as never,
        xpReward: data.xpReward,
        notes: data.notes || null,
        isPublished: false,
      },
    });
    return tx.learnerMission.create({
      data: { userId, missionId: mission.id, scheduledFor: isoToDate(data.date) },
      include: missionInclude,
    });
  });
  return toView(lm);
}

/** Deletes the learner's mission entry, revoking its XP. Learner-created missions are removed entirely. */
export async function deleteMission(userId: string, learnerMissionId: string): Promise<boolean> {
  return db.$transaction(async (tx) => {
    const lm = await tx.learnerMission.findFirst({
      where: { id: learnerMissionId, userId },
      include: { mission: true },
    });
    if (!lm) return false;
    if (lm.xpAwarded > 0) await adjustDepartmentXp(tx, userId, lm.mission.departmentId, -lm.xpAwarded);
    await tx.learnerMission.delete({ where: { id: lm.id } });
    if (lm.mission.createdById === userId) await tx.mission.delete({ where: { id: lm.missionId } });
    return true;
  });
}

export async function saveNextMilestone(userId: string, departmentId: string, text: string): Promise<boolean> {
  const value = milestoneSchema.parse(text);
  const { count } = await db.learnerDepartment.updateMany({
    where: { userId, departmentId },
    data: { nextMilestone: value || null },
  });
  return count > 0;
}

/**
 * Schedules each published Level 0 curriculum mission on its department's weekday, one per week per
 * department, starting from the programme start date (default Monday 16 Nov 2026, Africa/Accra).
 * Idempotent: existing learner missions are never duplicated or rescheduled.
 */
export async function scheduleLevelZero(tx: Prisma.TransactionClient, userId: string, programmeStart: Date) {
  const missions = await tx.mission.findMany({
    where: { createdById: null, isPublished: true, level: { number: 0 } },
    include: { department: { select: { code: true } } },
    orderBy: [{ departmentId: "asc" }, { sortOrder: "asc" }],
  });

  const perDepartmentIndex = new Map<string, number>();
  const rows = missions.map((m) => {
    const index = perDepartmentIndex.get(m.departmentId) ?? 0;
    perDepartmentIndex.set(m.departmentId, index + 1);
    const weekday = m.weekday ?? weekdayFor(m.department.code);
    const offset = (weekday - programmeStart.getUTCDay() + 7) % 7;
    return {
      userId,
      missionId: m.id,
      scheduledFor: addDays(programmeStart, offset + 7 * index),
    };
  });
  if (rows.length) await tx.learnerMission.createMany({ data: rows, skipDuplicates: true });
}

function weekdayFor(code: string): number {
  for (const [day, entry] of Object.entries(WEEKLY_SCHEDULE)) {
    if ((entry.departments as string[]).includes(code)) return Number(day);
  }
  return 0;
}

/** Sum of department XP; drives the programme level (900 XP per level, as in Base44). */
export async function getTotalXp(userId: string): Promise<number> {
  const { _sum } = await db.learnerDepartment.aggregate({ where: { userId }, _sum: { xp: true } });
  return _sum.xp ?? 0;
}

/**
 * Self-healing setup for accounts created before the curriculum existed (or before a department was added):
 * makes sure every department has a progress row and that Level 0 is scheduled once. Idempotent and cheap.
 */
export async function ensureLearnerSetup(userId: string): Promise<void> {
  const [departments, existing, scheduled, profile] = await Promise.all([
    db.department.findMany({ select: { id: true } }),
    db.learnerDepartment.count({ where: { userId } }),
    db.learnerMission.count({ where: { userId, mission: { createdById: null } } }),
    db.profile.findUnique({ where: { userId }, select: { programmeStart: true } }),
  ]);
  if (existing >= departments.length && scheduled > 0) return;
  await db.$transaction(async (tx) => {
    if (existing < departments.length) {
      await tx.learnerDepartment.createMany({
        data: departments.map((d) => ({ userId, departmentId: d.id })),
        skipDuplicates: true,
      });
    }
    if (scheduled === 0) {
      await scheduleLevelZero(tx, userId, profile?.programmeStart ?? isoToDate("2026-11-16"));
    }
  });
}
