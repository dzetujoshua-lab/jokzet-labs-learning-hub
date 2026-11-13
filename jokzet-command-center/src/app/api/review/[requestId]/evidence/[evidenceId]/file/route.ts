import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/dal";
import { streamEvidenceFile } from "@/lib/evidence/stream";
import { json } from "@/lib/http";
import { authoriseEvidenceAccess, isReviewerRole, logEvidenceAccess } from "@/lib/reviews/service";

/**
 * Lets a REVIEWER open one file of a learner's evidence, and only while they hold the claimed review request that the
 * evidence belongs to. The answer is the same ("Not found") for a missing file, a file from another submission, a request
 * that is not theirs, one outside their scope or their own work. Every successful access is written to the audit log.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ requestId: string; evidenceId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return json({ error: "Unauthorized" }, 401);
  if (!isReviewerRole(user.role)) return json({ error: "Not found" }, 404);
  const { requestId, evidenceId } = await params;

  const actor = { id: user.id, role: user.role, displayName: user.displayName };
  const access = await authoriseEvidenceAccess(actor, requestId, evidenceId);
  if (!access) return json({ error: "Not found" }, 404);

  await logEvidenceAccess(actor, requestId, evidenceId, access.learnerId);
  return streamEvidenceFile(request, access.file);
}
