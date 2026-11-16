import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { SESSION_COOKIE, sessionCookieOptions } from "./cookie";
import { createSessionRecord, deleteSessionByToken, resolveSession, type Role, type SessionUser } from "./sessions";

/** Reads the session cookie and resolves it against the database on every call (no caching, so revocation is immediate). */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return resolveSession(token);
}

/** Use in every page, server action and route handler that touches user data. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** True for a PERSONALISED learner who has not confirmed their plan yet. Read from the database on every call. */
async function onboardingIncomplete(userId: string): Promise<boolean> {
  const p = await db.profile.findUnique({ where: { userId }, select: { learnerMode: true, onboardingStatus: true } });
  return !!p && p.learnerMode === "PERSONALISED" && p.onboardingStatus !== "COMPLETE";
}

/**
 * requireUser for server actions: also refuses a learner who has not finished onboarding (sent back to the wizard). The page
 * gate alone is not enough because a server action can be invoked without rendering a page.
 */
export async function requireOnboardedUser(): Promise<SessionUser> {
  const user = await requireUser();
  if (await onboardingIncomplete(user.id)) redirect("/onboarding");
  return user;
}

/** getCurrentUser for route handlers: null (so the usual 401) while the learner has not finished onboarding. */
export async function getOnboardedUser(): Promise<SessionUser | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  return (await onboardingIncomplete(user.id)) ? null : user;
}

/** Roles that may review other learners' work (administrators review every department; reviewers only their own scope). */
export const canReview = (role: Role): boolean => role === "ADMIN" || role === "REVIEWER";

/**
 * Like requireUser, but also requires one of the given roles. Anyone else is sent to the dashboard without being told the
 * page exists. Roles are read from the database on every request (never from the cookie), so a revoked role stops working
 * immediately.
 */
export async function requireRole(...roles: Role[]): Promise<SessionUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) redirect("/");
  return user;
}

export async function startSession(userId: string, meta: { userAgent?: string | null; ipAddress?: string | null }) {
  const { token, expiresAt } = await createSessionRecord(userId, meta);
  (await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions(expiresAt));
}

export async function endSession() {
  const jar = await cookies();
  await deleteSessionByToken(jar.get(SESSION_COOKIE)?.value);
  jar.delete(SESSION_COOKIE);
}
