import type { NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/dal";
import { isSameOrigin, json } from "@/lib/http";
import { getPushConfig, removeSubscription, saveSubscription } from "@/lib/notifications/push";
import { setChannelFlag } from "@/lib/schedule/settings";

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return json({ error: "Forbidden" }, 403);
  const user = await getCurrentUser();
  if (!user) return json({ error: "Unauthorized" }, 401);
  if (!getPushConfig().configured) return json({ error: "Web Push is not configured on this server." }, 503);

  const result = await saveSubscription(user.id, await request.json().catch(() => null), request.headers.get("user-agent"));
  if (!result.ok) return json({ error: result.error }, 400);
  await setChannelFlag(user.id, "pushEnabled", true);
  return json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  if (!isSameOrigin(request)) return json({ error: "Forbidden" }, 403);
  const user = await getCurrentUser();
  if (!user) return json({ error: "Unauthorized" }, 401);
  const parsed = z.object({ endpoint: z.string().max(2048) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: "Bad request" }, 400);
  await removeSubscription(user.id, parsed.data.endpoint);
  await setChannelFlag(user.id, "pushEnabled", false);
  return json({ ok: true });
}
