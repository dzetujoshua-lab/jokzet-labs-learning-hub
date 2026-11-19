import { aiConfig } from "@/lib/ai/config";
import { listAiJobProblems, type AiJobProblem } from "@/lib/ai/jobs";
import { getProvider, ProviderError } from "@/lib/ai/provider";
import { db } from "@/lib/db";
import { bucketKey, rateLimitHit } from "@/lib/ratelimit";
export { CHECK_MEANING } from "./meanings";

/**
 * Everything the AI Assessment Centre shows, for Academy Admins only (the acting account is re-read and must be an ADMIN right
 * now). It reports job states and settings as they are stored. It never shows a key, a header, a provider message or any learner
 * identity, and it never says the provider is working unless a real call has just succeeded.
 */
export type Result<T> = ({ ok: true } & T) | { ok: false; error: string };

export type AiSettings = {
  enabled: boolean;
  provider: "deepseek" | "gemini";
  model: string;
  advancedModel: string | null;
  keyPresent: boolean;
  timeoutSeconds: number;
  maxAttempts: number;
  userDailyLimit: number;
  globalDailyLimit: number;
  minConfidencePercent: number;
};
export type AiJobRow = { id: string; status: string; code: string | null; escalation: string | null; attempts: number; model: string | null; confidencePercent: number | null; tokensIn: number | null; tokensOut: number | null; lesson: string; at: Date };
export type AiCentre = {
  settings: AiSettings;
  counts: { processing: number; retrying: number; complete: number; scoredForReview: number; stopped: number; total: number };
  usage: { days: number; jobs: number; tokensIn: number; tokensOut: number };
  recent: AiJobRow[];
  problems: AiJobProblem[];
  generatedAt: Date;
};

const DAY = 24 * 60 * 60 * 1000;
const USAGE_DAYS = 30;

async function admin(actorId: string) {
  const a = await db.user.findUnique({ where: { id: actorId }, select: { id: true, role: true } });
  return a?.role === "ADMIN" ? a : null;
}

export async function getAiCentre(actorId: string, now: Date = new Date()): Promise<Result<{ centre: AiCentre }>> {
  if (!(await admin(actorId))) return { ok: false, error: "Only an Academy Admin can open the AI Assessment Centre." };
  const cfg = aiConfig();
  const since = new Date(now.getTime() - USAGE_DAYS * DAY);
  const [byStatus, stoppedNoResult, usage, recent, problems] = await Promise.all([
    db.assessmentJob.groupBy({ by: ["status"], _count: { _all: true } }),
    db.assessmentJob.count({ where: { status: "NEEDS_HUMAN_REVIEW", assessmentId: null } }),
    db.assessmentJob.aggregate({ where: { createdAt: { gte: since } }, _count: { _all: true }, _sum: { tokensIn: true, tokensOut: true } }),
    db.assessmentJob.findMany({
      orderBy: { createdAt: "desc" }, take: 20,
      select: { id: true, status: true, errorCode: true, escalation: true, attempts: true, model: true, confidence: true, tokensIn: true, tokensOut: true, createdAt: true, submission: { select: { learnerMission: { select: { mission: { select: { title: true } } } } } } },
    }),
    listAiJobProblems(),
  ]);
  const n = (s: string) => byStatus.find((b) => b.status === s)?._count._all ?? 0;
  const total = byStatus.reduce((t, b) => t + b._count._all, 0);
  return {
    ok: true,
    centre: {
      settings: {
        enabled: cfg.enabled, provider: cfg.provider, model: cfg.assessmentModel, advancedModel: cfg.advancedModel,
        keyPresent: (cfg.provider === "gemini" ? (process.env.GEMINI_API_KEY ?? "") : (process.env.DEEPSEEK_API_KEY ?? "")).trim().length > 0,
        timeoutSeconds: Math.round(cfg.timeoutMs / 1000), maxAttempts: cfg.maxAttempts, userDailyLimit: cfg.userDailyLimit, globalDailyLimit: cfg.globalDailyLimit,
        minConfidencePercent: Math.round(cfg.minConfidence * 100),
      },
      counts: {
        processing: n("QUEUED") + n("REVIEWING_EVIDENCE") + n("AI_IN_PROGRESS"), retrying: n("RETRY_PENDING"), complete: n("AI_COMPLETE"),
        scoredForReview: Math.max(0, n("NEEDS_HUMAN_REVIEW") - stoppedNoResult), stopped: stoppedNoResult + n("FAILED"), total,
      },
      usage: { days: USAGE_DAYS, jobs: usage._count._all, tokensIn: usage._sum.tokensIn ?? 0, tokensOut: usage._sum.tokensOut ?? 0 },
      recent: recent.map((j) => ({
        id: j.id, status: j.status, code: j.errorCode, escalation: j.escalation, attempts: j.attempts, model: j.model, confidencePercent: j.confidence === null ? null : Math.round(j.confidence * 100),
        tokensIn: j.tokensIn, tokensOut: j.tokensOut, lesson: j.submission.learnerMission.mission.title, at: j.createdAt,
      })),
      problems, generatedAt: now,
    },
  };
}

export type ProviderCheck =
  | { state: "OPERATIONAL"; model: string; provider: string; at: Date }
  | { state: "NOT_CONFIGURED"; at: Date }
  | { state: "REFUSED"; code: string; provider: string; at: Date }
  | { state: "LIMITED"; at: Date };

/**
 * A real, tiny call to the configured provider (about a dozen tokens). The only way this page ever reports "operational".
 * At most one check a minute per administrator, so it cannot be used to spend the allowance.
 */
export async function checkProvider(actorId: string, now: Date = new Date()): Promise<Result<{ check: ProviderCheck }>> {
  if (!(await admin(actorId))) return { ok: false, error: "Only an Academy Admin can check the provider." };
  const cfg = aiConfig();
  if (!cfg.enabled) return { ok: true, check: { state: "NOT_CONFIGURED", at: now } };
  const hit = await rateLimitHit(bucketKey("ai:check", actorId), { limit: 1, windowSeconds: 60 }, now);
  if (!hit.ok) return { ok: true, check: { state: "LIMITED", at: now } };
  const provider = getProvider();
  try {
    const out = await provider.assess({ model: cfg.assessmentModel, messages: [{ role: "user", content: "Reply with the JSON object {\"ok\": true} and nothing else." }], maxOutputTokens: 300, timeoutMs: Math.min(cfg.timeoutMs, 30_000) });
    return { ok: true, check: out.content.trim() ? { state: "OPERATIONAL", model: out.model || cfg.assessmentModel, provider: provider.name, at: now } : { state: "REFUSED", code: "EMPTY", provider: provider.name, at: now } };
  } catch (error) {
    const code = error instanceof ProviderError ? error.code : "NETWORK";
    return { ok: true, check: { state: "REFUSED", code, provider: provider.name, at: now } };
  }
}
