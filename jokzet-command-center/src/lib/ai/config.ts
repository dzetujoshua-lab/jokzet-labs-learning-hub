/**
 * AI assessment configuration. Everything comes from server environment variables; nothing here is ever sent to the browser
 * (no NEXT_PUBLIC_ names) and nothing here is logged. Verified against the official DeepSeek API documentation on 2026-11-18:
 * base URL https://api.deepseek.com, chat endpoint /chat/completions, model identifiers `deepseek-flash` (accepts images) and
 * `deepseek-v4-pro` (text only), JSON mode via response_format { type: "json_object" }.
 */
export type AiConfig = {
  enabled: boolean; // owner kill switch AND a key present
  baseUrl: string;
  assessmentModel: string; // default for ordinary work and the only model used when images are present (vision)
  advancedModel: string | null; // text-only, for large complex text evidence
  timeoutMs: number;
  maxAttempts: number;
  userDailyLimit: number; // AI assessments one learner may start per day
  globalDailyLimit: number; // AI calls the whole Academy may start per day
  minConfidence: number; // below this a human reviews the result
  maxOutputTokens: number;
};

const int = (v: string | undefined, d: number, min: number, max: number) => {
  const n = Number.parseInt(v ?? "", 10);
  return Number.isInteger(n) && n >= min && n <= max ? n : d;
};

export function aiConfig(env: NodeJS.ProcessEnv = process.env): AiConfig {
  const key = (env.DEEPSEEK_API_KEY ?? "").trim();
  const base = (env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com").trim().replace(/\/+$/, "");
  const httpsOk = /^https:\/\/[a-z0-9.-]+(:\d+)?(\/[A-Za-z0-9._~/-]*)?$/i.test(base);
  return {
    enabled: env.DEEPSEEK_ENABLED === "true" && key.length > 0 && httpsOk,
    baseUrl: base,
    assessmentModel: (env.DEEPSEEK_ASSESSMENT_MODEL ?? "deepseek-flash").trim() || "deepseek-flash",
    advancedModel: (env.DEEPSEEK_ADVANCED_MODEL ?? "").trim() || null,
    timeoutMs: int(env.DEEPSEEK_TIMEOUT_MS, 90_000, 5_000, 240_000),
    maxAttempts: int(env.DEEPSEEK_MAX_ATTEMPTS, 3, 1, 6),
    userDailyLimit: int(env.DEEPSEEK_USER_DAILY_LIMIT, 10, 1, 200),
    globalDailyLimit: int(env.DEEPSEEK_GLOBAL_DAILY_LIMIT, 200, 1, 100_000),
    minConfidence: Math.min(0.95, Math.max(0.3, Number.parseFloat(env.DEEPSEEK_MIN_CONFIDENCE ?? "0.6") || 0.6)),
    maxOutputTokens: int(env.DEEPSEEK_MAX_OUTPUT_TOKENS, 4_000, 500, 16_000),
  };
}

/** The key is read only at the moment of a call, so it never sits in a long-lived object that could be logged. */
export const deepseekKey = (env: NodeJS.ProcessEnv = process.env): string => (env.DEEPSEEK_API_KEY ?? "").trim();

export const PROMPT_VERSION = "assess-1";
export const SCHEMA_VERSION = "1";
