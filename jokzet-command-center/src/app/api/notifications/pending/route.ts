import { getCurrentUser } from "@/lib/auth/dal";
import { json } from "@/lib/http";
import { pendingForClient, tickUser } from "@/lib/notifications/engine";

/** Polled by the open app: runs one scheduler tick for the signed-in user and returns what the browser must show. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return json({ error: "Unauthorized" }, 401);
  await tickUser(user.id);
  return json({ notifications: await pendingForClient(user.id) });
}
