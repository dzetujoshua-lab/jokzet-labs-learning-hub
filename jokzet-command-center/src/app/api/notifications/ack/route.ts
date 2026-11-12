import type { NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/dal";
import { isSameOrigin, json } from "@/lib/http";
import { ackDelivery } from "@/lib/notifications/engine";

const bodySchema = z.object({
  deliveryId: z.string().min(1).max(64),
  status: z.enum(["DELIVERED", "SKIPPED", "FAILED"]),
  error: z.string().max(200).optional(),
});

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return json({ error: "Forbidden" }, 403);
  const user = await getCurrentUser();
  if (!user) return json({ error: "Unauthorized" }, 401);
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: "Bad request" }, 400);
  const changed = await ackDelivery(user.id, parsed.data.deliveryId, parsed.data.status, parsed.data.error);
  return json({ ok: true, changed });
}
