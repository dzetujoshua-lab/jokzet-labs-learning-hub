import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { PROGRAMME_START } from "@/lib/departments";
import { scheduleLevelZero } from "@/lib/missions/service";
import { isoToDate } from "@/lib/programme";
import { burnPasswordCheck, hashPassword, verifyPassword } from "./password";
import type { LoginInput, RegisterInput } from "./validation";

export const MAX_FAILED_LOGINS = 5;
export const LOCKOUT_MS = 15 * 60 * 1000;

export type AuthResult = { ok: true; userId: string } | { ok: false; error: "EMAIL_TAKEN" | "INVALID_CREDENTIALS" | "LOCKED" };

/** Creates the user, profile and a Level 0 record for every department in one transaction. */
export async function registerUser(input: RegisterInput): Promise<AuthResult> {
  const passwordHash = await hashPassword(input.password);
  try {
    const user = await db.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: input.email,
          passwordHash,
          profile: { create: { displayName: input.displayName } },
        },
      });
      const departments = await tx.department.findMany({ select: { id: true } });
      await tx.learnerDepartment.createMany({
        data: departments.map((d) => ({ userId: created.id, departmentId: d.id, level: 0, xp: 0 })),
      });
      await scheduleLevelZero(tx, created.id, isoToDate(PROGRAMME_START));
      return created;
    });
    return { ok: true, userId: user.id };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { ok: false, error: "EMAIL_TAKEN" };
    }
    throw error;
  }
}

/**
 * Verifies credentials with account lockout. Unknown emails and wrong passwords return the same
 * INVALID_CREDENTIALS result, and unknown emails still pay the cost of a hash check.
 */
export async function authenticate(input: LoginInput): Promise<AuthResult> {
  const user = await db.user.findUnique({ where: { email: input.email } });
  if (!user || !user.isActive) {
    await burnPasswordCheck(input.password);
    return { ok: false, error: "INVALID_CREDENTIALS" };
  }
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    return { ok: false, error: "LOCKED" };
  }

  const valid = await verifyPassword(user.passwordHash, input.password);
  if (!valid) {
    const failed = user.failedLogins + 1;
    const lock = failed >= MAX_FAILED_LOGINS;
    await db.user.update({
      where: { id: user.id },
      data: { failedLogins: lock ? 0 : failed, lockedUntil: lock ? new Date(Date.now() + LOCKOUT_MS) : null },
    });
    return { ok: false, error: lock ? "LOCKED" : "INVALID_CREDENTIALS" };
  }

  if (user.failedLogins > 0 || user.lockedUntil) {
    await db.user.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null } });
  }
  return { ok: true, userId: user.id };
}
