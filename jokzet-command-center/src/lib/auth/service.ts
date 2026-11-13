import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { PROGRAMME_START } from "@/lib/departments";
import { personalisedLearningEnabled } from "@/lib/plan/flag";
import { scheduleLevelZero } from "@/lib/missions/service";
import { isoToDate } from "@/lib/programme";
import { LIMITS, bucketKey, rateLimitHit, rateLimitPeek, rateLimitReset } from "@/lib/ratelimit";
import { burnPasswordCheck, hashPassword, verifyPassword } from "./password";
import type { LoginInput, RegisterInput } from "./validation";

export type AuthResult = { ok: true; userId: string } | { ok: false; error: "EMAIL_TAKEN" | "INVALID_CREDENTIALS" };

/**
 * Creates the user, profile and a progress record for every department in one transaction. While the personalised-learning
 * flag is off (the default) every new account gets the original programme (LEGACY, onboarding COMPLETE, Level 0 scheduled).
 * With the flag on, a new account is PERSONALISED, starts onboarding and is not given the fixed schedule.
 */
export async function registerUser(input: RegisterInput): Promise<AuthResult> {
  const passwordHash = await hashPassword(input.password);
  const personalised = personalisedLearningEnabled();
  try {
    const user = await db.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: input.email,
          passwordHash,
          profile: {
            create: personalised
              ? { displayName: input.displayName, learnerMode: "PERSONALISED", onboardingStatus: "NOT_STARTED" }
              : { displayName: input.displayName, learnerMode: "LEGACY", onboardingStatus: "COMPLETE" },
          },
        },
      });
      const departments = await tx.department.findMany({ select: { id: true } });
      await tx.learnerDepartment.createMany({
        data: departments.map((d) => ({ userId: created.id, departmentId: d.id, level: 0, xp: 0 })),
      });
      if (!personalised) await scheduleLevelZero(tx, created.id, isoToDate(PROGRAMME_START));
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
 * Verifies credentials. Every failure looks the same to the caller: an unknown email, a wrong password, a disabled
 * account and a throttled attempt all return INVALID_CREDENTIALS after a comparable amount of work, so the response
 * never reveals whether an account exists or whether it is being throttled.
 *
 * Brute force is limited by the database-backed rate limiter rather than by locking the account (an account lock lets
 * anyone lock anyone out and leaks which emails exist):
 *  - failures for one email from one address, and for one email from anywhere (slow distributed guessing),
 *  - all attempts from one address (password spraying across many emails).
 * A successful sign-in clears the per-address failure counter for that email.
 */
export async function authenticate(input: LoginInput, ctx: { ip?: string } = {}): Promise<AuthResult & { throttled?: boolean }> {
  const ip = ctx.ip || "unknown";
  const ipKey = bucketKey("login:ip", ip);
  const ipEmailKey = bucketKey("login:ie", ip, input.email);
  const emailKey = bucketKey("login:e", input.email);

  // Count every attempt from this address; check (without counting) the failure buckets.
  const spray = await rateLimitHit(ipKey, LIMITS.loginIp);
  const [ipEmail, email] = await Promise.all([rateLimitPeek(ipEmailKey, LIMITS.loginIpEmail), rateLimitPeek(emailKey, LIMITS.loginEmail)]);
  if (!spray.ok || !ipEmail.ok || !email.ok) {
    await burnPasswordCheck(input.password);
    return { ok: false, error: "INVALID_CREDENTIALS", throttled: true };
  }

  const user = await db.user.findUnique({ where: { email: input.email } });
  const valid = user && user.isActive ? await verifyPassword(user.passwordHash, input.password) : (await burnPasswordCheck(input.password), false);
  if (!user || !user.isActive || !valid) {
    await Promise.all([rateLimitHit(ipEmailKey, LIMITS.loginIpEmail), rateLimitHit(emailKey, LIMITS.loginEmail)]);
    return { ok: false, error: "INVALID_CREDENTIALS" };
  }

  await rateLimitReset(ipEmailKey);
  return { ok: true, userId: user.id };
}
