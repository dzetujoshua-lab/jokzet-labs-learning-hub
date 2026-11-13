import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/dal";
import { getEvidenceFile } from "@/lib/evidence/service";
import { json } from "@/lib/http";
import { streamEvidenceFile } from "@/lib/evidence/stream";

/**
 * Streams an evidence file to its OWNER only. Content type comes from the server's own sniffing at upload time;
 * only images and video render inline, everything else is a download. nosniff + a locked-down CSP keep uploaded
 * content inert even if a browser were tricked into opening it.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return json({ error: "Unauthorized" }, 401);
  const { id } = await params;

  const file = await getEvidenceFile(user.id, id);
  if (!file) return json({ error: "Not found" }, 404); // same answer for "missing" and "someone else's"

  return streamEvidenceFile(request, file);
}
