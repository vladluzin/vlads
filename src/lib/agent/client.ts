import Anthropic from "@anthropic-ai/sdk";

const g = globalThis as unknown as { anthropic?: Anthropic };

/** Shared client; credentials come from ANTHROPIC_API_KEY (or other SDK-supported sources). */
export const anthropic = () => (g.anthropic ??= new Anthropic());

export const AGENT_MODEL = process.env.AGENT_MODEL ?? "claude-opus-5-5";
/** Effort for chat replies. Opus 5.5 defaults to "medium"; set explicitly so it is visible and tunable. */
export const CHAT_EFFORT = (process.env.AGENT_EFFORT ?? "medium") as "low" | "medium" | "high" | "xhigh" | "max";
/** Effort for generated forecasts and summaries (high volume, short outputs). */
export const BATCH_EFFORT = (process.env.FORECAST_EFFORT ?? "low") as "low" | "medium" | "high";

/**
 * Server-side refusal fallback: if the model declines a request for policy reasons the API
 * retries it on a fallback model inside the same call. "default" lets the API pick by category.
 */
export const FALLBACK_BETA = "server-side-fallback-2026-07-01";
export const fallbackParams = { betas: [FALLBACK_BETA], fallbacks: "default" as const };
