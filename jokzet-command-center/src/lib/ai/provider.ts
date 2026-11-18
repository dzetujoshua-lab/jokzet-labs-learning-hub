import { aiConfig, deepseekKey } from "./config";

/** A part of a message: text, or an image as a data URL (only ever sent to a model that accepts images). */
export type ContentPart = { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } };
export type ChatMessage = { role: "system" | "user"; content: string | ContentPart[] };

export type ProviderInput = { model: string; messages: ChatMessage[]; maxOutputTokens: number; timeoutMs: number };
export type ProviderOutput = { content: string; model: string; tokensIn: number | null; tokensOut: number | null; finishReason: string | null };

export type ProviderErrorCode = "NOT_CONFIGURED" | "AUTH" | "BILLING" | "RATE_LIMIT" | "SERVER" | "TIMEOUT" | "NETWORK" | "INVALID_REQUEST" | "EMPTY" | "TRUNCATED";

/** Never carries a provider message body, a header or a key: only a short code the owner can act on. */
export class ProviderError extends Error {
  constructor(readonly code: ProviderErrorCode, readonly retryable: boolean) {
    super(code);
  }
}

/** The seam for another provider later: the worker only knows this interface. */
export interface AssessmentProvider {
  readonly name: string;
  supportsImages(model: string): boolean;
  assess(input: ProviderInput): Promise<ProviderOutput>;
}

type Fetch = typeof fetch;

/** DeepSeek over its OpenAI-format chat completions endpoint. */
export class DeepSeekProvider implements AssessmentProvider {
  readonly name = "deepseek";
  constructor(private readonly fetchImpl: Fetch = fetch) {}

  // Per the official model list: deepseek-flash takes text and images; deepseek-v4-pro takes text only.
  supportsImages(model: string): boolean {
    return model === "deepseek-flash";
  }

  async assess(input: ProviderInput): Promise<ProviderOutput> {
    const cfg = aiConfig();
    const key = deepseekKey();
    if (!cfg.enabled || !key) throw new ProviderError("NOT_CONFIGURED", false);
    if (!this.supportsImages(input.model) && input.messages.some((m) => Array.isArray(m.content) && m.content.some((p) => p.type === "image_url"))) {
      throw new ProviderError("INVALID_REQUEST", false); // never send an image to a model that cannot see it
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), input.timeoutMs);
    let response: Response;
    try {
      response = await this.fetchImpl(`${cfg.baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: input.model,
          messages: input.messages,
          response_format: { type: "json_object" },
          max_tokens: input.maxOutputTokens,
          stream: false,
        }),
        signal: controller.signal,
        redirect: "error", // the provider address is fixed configuration; never follow a redirect with the key attached
      });
    } catch (error) {
      clearTimeout(timer);
      if (error instanceof Error && error.name === "AbortError") throw new ProviderError("TIMEOUT", true);
      throw new ProviderError("NETWORK", true);
    }
    clearTimeout(timer);

    const s = response.status;
    if (s === 401) throw new ProviderError("AUTH", false);
    if (s === 402) throw new ProviderError("BILLING", false);
    if (s === 429) throw new ProviderError("RATE_LIMIT", true);
    if (s === 400 || s === 422 || s === 404) throw new ProviderError("INVALID_REQUEST", false);
    if (s >= 500 || s === 408) throw new ProviderError("SERVER", true);
    if (!response.ok) throw new ProviderError("INVALID_REQUEST", false);

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new ProviderError("EMPTY", true);
    }
    const b = body as { model?: unknown; choices?: { message?: { content?: unknown }; finish_reason?: unknown }[]; usage?: { prompt_tokens?: unknown; completion_tokens?: unknown } };
    const choice = b.choices?.[0];
    const content = typeof choice?.message?.content === "string" ? choice.message.content : "";
    const finish = typeof choice?.finish_reason === "string" ? choice.finish_reason : null;
    if (finish === "length") throw new ProviderError("TRUNCATED", true);
    // JSON mode can return blank content when the model's output was not JSON; the docs say to treat that as a retry.
    if (content.trim() === "") throw new ProviderError("EMPTY", true);
    return {
      content,
      model: typeof b.model === "string" ? b.model : input.model,
      tokensIn: typeof b.usage?.prompt_tokens === "number" ? b.usage.prompt_tokens : null,
      tokensOut: typeof b.usage?.completion_tokens === "number" ? b.usage.completion_tokens : null,
      finishReason: finish,
    };
  }
}

let override: AssessmentProvider | undefined;
/** Tests inject a fake provider here. Never used in production code paths. */
export function setProviderForTests(p: AssessmentProvider | undefined): void {
  override = p;
}
export function getProvider(): AssessmentProvider {
  return override ?? new DeepSeekProvider();
}
