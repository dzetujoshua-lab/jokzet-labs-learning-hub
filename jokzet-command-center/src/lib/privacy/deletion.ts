import "server-only";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { getStorage } from "@/lib/storage";
import { eraseAccount } from "./core";

/** The learner must type this exactly (case-insensitive, surrounding spaces ignored). */
export const DELETE_PHRASE = "DELETE MY ACCOUNT";

export type DeleteError = "WRONG_PHRASE" | "WRONG_PASSWORD" | "LAST_ADMIN" | "NOT_FOUND";
export type DeleteResult = { ok: true; filesRemoved: number; filesNotRemoved: number } | { ok: false; error: DeleteError };

export const matchesPhrase = (input: string) => input.trim().replace(/\s+/g, " ").toUpperCase() === DELETE_PHRASE;

/**
 * Self-service deletion of the caller's own account (the id comes from the session, never from a request). The phrase and
 * password are checked here; the deletion itself, and its audit record, are `eraseAccount` in core.ts. Uploaded files are
 * removed from storage after the database commit; a failure there is counted, not hidden.
 */
export async function deleteAccount(userId: string, input: { password: string; phrase: string }): Promise<DeleteResult> {
  if (!matchesPhrase(input.phrase)) return { ok: false, error: "WRONG_PHRASE" };
  const user = await db.user.findUnique({ where: { id: userId }, select: { passwordHash: true } });
  if (!user) return { ok: false, error: "NOT_FOUND" };
  if (!(await verifyPassword(user.passwordHash, input.password))) return { ok: false, error: "WRONG_PASSWORD" };

  const result = await eraseAccount(db, userId, "SELF_SERVICE");
  if (!result.ok) return result;

  const storage = getStorage();
  const settled = await Promise.allSettled(result.storageKeys.map((k) => storage.delete(k)));
  const failed = settled.filter((r) => r.status === "rejected").length;
  if (failed) console.error(`account deletion: ${failed} of ${result.storageKeys.length} stored files could not be removed`);
  return { ok: true, filesRemoved: result.storageKeys.length - failed, filesNotRemoved: failed };
}
