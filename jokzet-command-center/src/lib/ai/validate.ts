import { z } from "zod";
import type { RubricSnapshot } from "./prompt";
import { SCHEMA_VERSION } from "./config";

const text = (max: number) => z.string().trim().min(1).max(max);
const list = (max: number, each = 400) => z.array(text(each)).max(max);

/** What the model must return. Strict: any extra, missing or mistyped field rejects the whole answer. */
export const aiResultSchema = z
  .object({
    schemaVersion: z.literal(SCHEMA_VERSION),
    overallScore: z.number().int().min(0),
    maxScore: z.number().int().min(1),
    percentage: z.number().int().min(0).max(100),
    decision: z.enum(["PASS", "NEEDS_IMPROVEMENT"]),
    confidence: z.number().min(0).max(1),
    summary: text(1500),
    strengths: list(8),
    improvements: list(8),
    limitations: list(8),
    nextSteps: list(8),
    criteria: z
      .array(
        z.object({
          criterionId: text(64),
          score: z.number().int().min(0),
          maxScore: z.number().int().min(0),
          feedback: text(1000),
          evidenceRefs: z.array(text(16)).max(8),
        }).strict(),
      )
      .min(1)
      .max(30),
  })
  .strict();
export type AiResult = z.infer<typeof aiResultSchema>;

export type Validated = { ok: true; result: AiResult; totalPoints: number; maxPoints: number; percentage: number } | { ok: false; reason: string };

/**
 * Checks the model's answer against the exact rubric snapshot and the evidence package. The score is whatever the criteria
 * add up to under the rubric's own points; the model's overall figures must agree with it, or the answer is rejected. Ids
 * of users, submissions, courses and rubrics in the answer are never read: the server already knows them.
 */
export function validateAiResult(raw: string, rubric: RubricSnapshot, allowedRefs: Set<string>): Validated {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { ok: false, reason: "NOT_JSON" };
  }
  const parsed = aiResultSchema.safeParse(json);
  if (!parsed.success) return { ok: false, reason: "SCHEMA_INVALID" };
  const r = parsed.data;

  const byId = new Map(rubric.criteria.map((c) => [c.id, c]));
  const seen = new Set<string>();
  let total = 0;
  for (const c of r.criteria) {
    const base = byId.get(c.criterionId);
    if (!base) return { ok: false, reason: "UNKNOWN_CRITERION" };
    if (seen.has(c.criterionId)) return { ok: false, reason: "DUPLICATE_CRITERION" };
    seen.add(c.criterionId);
    if (c.maxScore !== base.maxPoints) return { ok: false, reason: "MAX_MISMATCH" };
    if (c.score > base.maxPoints) return { ok: false, reason: "SCORE_OUT_OF_RANGE" };
    if (c.evidenceRefs.some((ref) => !allowedRefs.has(ref))) return { ok: false, reason: "UNKNOWN_EVIDENCE_REF" };
    total += c.score;
  }
  if (seen.size !== rubric.criteria.length) return { ok: false, reason: "MISSING_CRITERION" };

  const max = rubric.criteria.reduce((n, c) => n + c.maxPoints, 0);
  if (r.maxScore !== max) return { ok: false, reason: "MAX_TOTAL_MISMATCH" };
  if (r.overallScore !== total) return { ok: false, reason: "TOTAL_MISMATCH" };
  const percentage = Math.round((total / max) * 100);
  if (r.percentage !== percentage) return { ok: false, reason: "PERCENTAGE_MISMATCH" };
  const pass = percentage >= rubric.passingScore;
  if ((r.decision === "PASS") !== pass) return { ok: false, reason: "DECISION_CONTRADICTS_SCORE" };
  return { ok: true, result: r, totalPoints: total, maxPoints: max, percentage };
}
