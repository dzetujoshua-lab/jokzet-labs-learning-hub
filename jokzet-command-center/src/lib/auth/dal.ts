import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, sessionCookieOptions } from "./cookie";
import { createSessionRecord, deleteSessionByToken, resolveSession, type SessionUser } from "./sessions";

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

export async function startSession(userId: string, meta: { userAgent?: string | null; ipAddress?: string | null }) {
  const { token, expiresAt } = await createSessionRecord(userId, meta);
  (await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions(expiresAt));
}

export async function endSession() {
  const jar = await cookies();
  await deleteSessionByToken(jar.get(SESSION_COOKIE)?.value);
  jar.delete(SESSION_COOKIE);
}
