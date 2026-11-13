import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
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
