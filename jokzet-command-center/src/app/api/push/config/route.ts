import { getCurrentUser } from "@/lib/auth/dal";
import { json } from "@/lib/http";
import { getPushConfig } from "@/lib/notifications/push";

/** Exposes ONLY the public VAPID key (needed by the browser to subscribe). The private key never leaves the server. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return json({ error: "Unauthorized" }, 401);
  return json(getPushConfig());
}
