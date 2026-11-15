import { createHash } from "node:crypto";
import type { PrismaClient } from "@/generated/prisma/client";
import { EXPORTED, EXPORT_NOTES, type ExportSpec } from "./export-spec";

/**
 * The privacy operations, written against a database client passed in. The app uses them through `export.ts` and
 * `deletion.ts` (which add sign-in checks and file storage); the owner command line (scripts/privacy.ts) uses them with its
 * own client. No `server-only` import here so both can share one implementation.
 */

export type Channel = "SELF_SERVICE" | "OWNER_REQUEST";
export const EXPORT_VERSION = 1;

/** One-way reference to a user for the audit trail: lets repeat requests be counted, reveals nobody. */
export const subjectRef = (userId: string) => createHash("sha256").update(userId).digest("hex").slice(0, 16);

type Delegate = { findMany(args: { where: unknown; omit?: unknown }): Promise<unknown[]> };

async function rows(client: PrismaClient, spec: ExportSpec, userId: string) {
  const delegate = (client as unknown as Record<string, Delegate>)[spec.delegate];
  if (!delegate) throw new Error(`Export spec ${spec.key} names an unknown model delegate (${spec.delegate}).`);
  return delegate.findMany({ where: spec.where(userId), ...(spec.omit ? { omit: spec.omit } : {}) });
}

/** Everything held about one user, as plain data, and a record in the audit trail that it was handed over. */
export async function collectExport(client: PrismaClient, userId: string, channel: Channel) {
  const account = await client.user.findUniqueOrThrow({
    where: { id: userId },
    select: { id: true, email: true, role: true, isActive: true, createdAt: true, updatedAt: true },
  });
  const results = await Promise.all(EXPORTED.map((spec) => rows(client, spec, userId)));
  const data: Record<string, unknown[]> = {};
  EXPORTED.forEach((spec, i) => { data[spec.key] = results[i]; });
  // Recorded before the data leaves this function: if the record cannot be written, nothing is handed over.
  await client.privacyEvent.create({ data: { kind: "EXPORT_DOWNLOADED", channel, subjectRef: subjectRef(userId) } });
  return {
    exportVersion: EXPORT_VERSION,
    generatedAt: new Date().toISOString(),
    format: "JOKZET Labs Learning Command Center personal data export",
    account,
    counts: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v.length])),
    notes: EXPORT_NOTES,
    data,
  };
}

export function serializeExport(payload: unknown): string {
  return JSON.stringify(payload, (_k, v) => (typeof v === "bigint" ? v.toString() : v), 2);
}

export type EraseResult = { ok: true; storageKeys: string[] } | { ok: false; error: "LAST_ADMIN" | "NOT_FOUND" };

/**
 * Permanently removes one account in a single transaction and records that it happened. Everything the person owns is
 * removed by the database (every learner-owned table cascades from User; tests/account-deletion.test.ts proves it). Three
 * things do not cascade and are handled here first: the reviewer name on reviews they gave, the log of who viewed their
 * evidence, and the email in the role audit. The last active administrator is refused. Returns the stored file keys so the
 * caller can remove the files after the commit.
 */
export async function eraseAccount(client: PrismaClient, userId: string, channel: Channel): Promise<EraseResult> {
  return client.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId }, select: { id: true, role: true } });
    if (!user) return { ok: false, error: "NOT_FOUND" } as const;
    if (user.role === "ADMIN") {
      // Lock the admin rows so two admins deleting at once cannot both pass the check.
      const admins = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "User" WHERE role = 'ADMIN' AND "isActive" = true FOR UPDATE`;
      if (!admins.some((a) => a.id !== userId)) return { ok: false, error: "LAST_ADMIN" } as const;
    }
    const files = await tx.submissionFile.findMany({ where: { userId }, select: { storageKey: true } });
    await tx.assessmentReview.updateMany({ where: { reviewerId: userId }, data: { reviewerLabel: "Former reviewer" } });
    await tx.evidenceAccessLog.deleteMany({ where: { learnerId: userId } });
    await tx.evidenceAccessLog.updateMany({ where: { reviewerId: userId }, data: { reviewerId: null } });
    await tx.roleAudit.updateMany({ where: { targetUserId: userId }, data: { targetEmail: "[deleted account]" } });
    await tx.privacyEvent.create({ data: { kind: "ACCOUNT_DELETED", channel, subjectRef: subjectRef(userId) } });
    await tx.user.delete({ where: { id: userId } });
    return { ok: true, storageKeys: files.map((f) => f.storageKey) } as const;
  });
}
