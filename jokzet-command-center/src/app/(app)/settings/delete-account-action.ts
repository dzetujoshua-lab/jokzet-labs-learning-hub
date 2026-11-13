"use server";

import { redirect } from "next/navigation";
import { endSession, requireUser } from "@/lib/auth/dal";
import { deleteAccount } from "@/lib/privacy/deletion";
import { LIMITS, bucketKey, rateLimitHit } from "@/lib/ratelimit";

export type DeleteAccountState = { error?: string } | undefined;

const MESSAGES = {
  WRONG_PHRASE: "Type DELETE MY ACCOUNT exactly as shown to confirm.",
  WRONG_PASSWORD: "That password is not correct.",
  LAST_ADMIN: "You are the only administrator. Make another account an administrator before deleting this one.",
  NOT_FOUND: "This account no longer exists.",
} as const;

/** Permanently deletes the signed-in learner's own account. The target is always the session's user. */
export async function deleteAccountAction(_prev: DeleteAccountState, formData: FormData): Promise<DeleteAccountState> {
  const user = await requireUser();
  const limited = await rateLimitHit(bucketKey("delete-account:user", user.id), LIMITS.deleteAccountUser);
  if (!limited.ok) return { error: "Too many attempts. Please try again later." };

  const password = formData.get("password");
  const phrase = formData.get("phrase");
  if (typeof password !== "string" || typeof phrase !== "string" || !password || password.length > 256) {
    return { error: "Enter your password and the confirmation phrase." };
  }
  const result = await deleteAccount(user.id, { password, phrase });
  if (!result.ok) return { error: MESSAGES[result.error] };

  await endSession(); // the sessions are already gone with the account; this clears the browser's cookie
  redirect("/login?deleted=1");
}
