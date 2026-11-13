import { createHash, randomBytes } from "node:crypto";
import { db } from "@/lib/db";

export const SESSION_TTL_MS = 14 * 24 * 60 * 60 * 1000; // 14 days
const RENEW_WHEN_LESS_THAN_MS = 7 * 24 * 60 * 60 * 1000;

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Creates a session row and returns the raw token (only ever sent to the browser as a cookie). */
export async function createSessionRecord(userId: string, meta: { userAgent?: string | null; ipAddress?: string | null } = {}) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.session.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      expiresAt,
      userAgent: meta.userAgent?.slice(0, 255) ?? null,
      ipAddress: meta.ipAddress?.slice(0, 64) ?? null,
    },
  });
  return { token, expiresAt };
}

export type Role = "LEARNER" | "ADMIN" | "AUTHOR" | "REVIEWER";
export type SessionUser = { id: string; email: string; displayName: string; role: Role };

/** Resolves a raw cookie token to its user. Expired sessions and disabled users resolve to null. */
export async function resolveSession(token: string | undefined): Promise<SessionUser | null> {
  if (!token || token.length > 128) return null;
  const session = await db.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { include: { profile: true } } },
  });
  if (!session) return null;
  if (session.expiresAt <= new Date()) {
    await db.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }
  if (!session.user.isActive) return null;

  if (session.expiresAt.getTime() - Date.now() < RENEW_WHEN_LESS_THAN_MS) {
    await db.session.update({
      where: { id: session.id },
      data: { expiresAt: new Date(Date.now() + SESSION_TTL_MS), lastUsedAt: new Date() },
    });
  }
  return {
    id: session.user.id,
    email: session.user.email,
    displayName: session.user.profile?.displayName ?? session.user.email,
    role: session.user.role,
  };
}

export async function deleteSessionByToken(token: string | undefined): Promise<void> {
  if (!token) return;
  await db.session.deleteMany({ where: { tokenHash: hashToken(token) } });
}

export async function deleteExpiredSessions(): Promise<number> {
  const { count } = await db.session.deleteMany({ where: { expiresAt: { lte: new Date() } } });
  return count;
}
