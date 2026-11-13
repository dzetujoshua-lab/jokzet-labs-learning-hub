import "server-only";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { getStorage } from "@/lib/storage";

/** The learner must type this exactly (case-insensitive, surrounding spaces ignored). */
export const DELETE_PHRASE = "DELETE MY ACCOUNT";

export type DeleteError = "WRONG_PHRASE" | "WRONG_PASSWORD" | "LAST_ADMIN" | "NOT_FOUND";
export type DeleteResult = { ok: true; filesRemoved: number; filesNotRemoved: number } | { ok: false; error: DeleteError };

export const matchesPhrase = (input: string) => input.trim().replace(/\s+/g, " ").toUpperCase() === DELETE_PHRASE;

/**
 * Permanently deletes the caller's account. The id comes from the session, never from a request.
 *
 * Everything the learner owns is removed by the database in one statement (every learner-owned table cascades from User;
 * `tests/account-deletion.test.ts` proves this for every table). Three things do not cascade and are handled in the same
 * transaction first:
 *  - reviews this person gave to others keep their verdict but lose the reviewer's name (`reviewerLabel`),
 *  - the log of who viewed this person's evidence is deleted, and where they were the viewer the entry loses their id,
 *  - the role-change audit keeps its history but loses the email address.
 * Uploaded files are removed from storage after the database commit; a failure there is counted, not hidden.
 *
 * The last active administrator cannot delete their own account, so the platform is never left without one.
 */
export async function deleteAccount(userId: string, input: { password: string; phrase: string }): Promise<DeleteResult> {
  if (!matchesPhrase(input.phrase)) return { ok: false, error: "WRONG_PHRASE" };
  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true, passwordHash: true, role: true } });
  if (!user) return { ok: false, error: "NOT_FOUND" };
  if (!(await verifyPassword(user.passwordHash, input.password))) return { ok: false, error: "WRONG_PASSWORD" };

  const keys = await db.$transaction(async (tx) => {
    if (user.role === "ADMIN") {
      // Lock the admin rows so two admins deleting at once cannot both pass the check.
      const admins = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "User" WHERE role = 'ADMIN' AND "isActive" = true FOR UPDATE`;
      if (!admins.some((a) => a.id !== userId)) return "LAST_ADMIN" as const;
    }
    const files = await tx.submissionFile.findMany({ where: { userId }, select: { storageKey: true } });
    await tx.assessmentReview.updateMany({ where: { reviewerId: userId }, data: { reviewerLabel: "Former reviewer" } });
    await tx.evidenceAccessLog.deleteMany({ where: { learnerId: userId } });
    await tx.evidenceAccessLog.updateMany({ where: { reviewerId: userId }, data: { reviewerId: null } });
    await tx.roleAudit.updateMany({ where: { targetUserId: userId }, data: { targetEmail: "[deleted account]" } });
    await tx.user.delete({ where: { id: userId } });
    return files.map((f) => f.storageKey);
  });
  if (keys === "LAST_ADMIN") return { ok: false, error: "LAST_ADMIN" };

  const storage = getStorage();
  const results = await Promise.allSettled(keys.map((k) => storage.delete(k)));
  const failed = results.filter((r) => r.status === "rejected").length;
  if (failed) console.error(`account deletion: ${failed} of ${keys.length} stored files could not be removed`);
  return { ok: true, filesRemoved: keys.length - failed, filesNotRemoved: failed };
}
