import Anthropic from "@anthropic-ai/sdk";
import { eq, sql } from "drizzle-orm";
import { db, schema } from "../db";
import { chatAllowance, consumeMessage } from "../billing/plans";
import { primaryProfile } from "../profiles";
import { AGENT_MODEL, CHAT_EFFORT, anthropic, fallbackParams } from "./client";
import { buildContext } from "./context";
import { buildTools } from "./tools";
import { maybeSummarize } from "./summarize";

export class AgentError extends Error {
  constructor(
    public code: "no_profile" | "free_exhausted" | "daily_limit" | "not_found" | "upstream",
    message: string,
  ) {
    super(message);
  }
}

export interface TurnInput {
  userId: string;
  /** Existing conversation, or null to start a new one. */
  conversationId: string | null;
  text: string;
  channel: "web" | "telegram";
  /** Called with each streamed text fragment. */
  onText?: (delta: string) => void;
  /** Called when the agent starts a tool, for "checking your transits…" style UI. */
  onTool?: (name: string) => void;
  signal?: AbortSignal;
}

export interface TurnResult {
  conversationId: string;
  text: string;
  toolCalls: { name: string; input: unknown }[];
  usage: { input: number; output: number; cacheRead: number; cacheWrite: number };
  remaining: number | null;
}

const REFUSAL_TEXT =
  "I can't help with that one. If something difficult is going on, please reach out to someone you trust or a local professional — I'm here for questions about your chart whenever you like.";

type Usage = TurnResult["usage"];

function addUsage(total: Usage, msg: Anthropic.Beta.BetaMessage) {
  const u = msg.usage;
  total.input += u.input_tokens ?? 0;
  total.output += u.output_tokens ?? 0;
  total.cacheRead += u.cache_read_input_tokens ?? 0;
  total.cacheWrite += u.cache_creation_input_tokens ?? 0;
}

export async function recordUsage(userId: string | null, kind: string, usage: Usage) {
  await db.insert(schema.usageEvents).values({
    userId,
    kind,
    model: AGENT_MODEL,
    inputTokens: usage.input,
    outputTokens: usage.output,
    cacheReadTokens: usage.cacheRead,
    cacheWriteTokens: usage.cacheWrite,
  });
}

export async function runTurn(input: TurnInput): Promise<TurnResult> {
  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, input.userId));
  if (!user) throw new AgentError("not_found", "User not found");
  const profile = await primaryProfile(user.id);
  if (!profile) throw new AgentError("no_profile", "Birth data is required before chatting");
  const allowance = await chatAllowance(user);
  if (!allowance.ok) throw new AgentError(allowance.reason, allowance.reason);

  let conversationId = input.conversationId;
  if (conversationId) {
    const [conv] = await db.select().from(schema.conversations).where(eq(schema.conversations.id, conversationId));
    if (!conv || conv.userId !== user.id) throw new AgentError("not_found", "Conversation not found");
  }

  // Context is built from the history *before* this message; the new message is appended below.
  const ctx = await buildContext(user, profile, conversationId);
  if (!conversationId) {
    const title = input.text.replace(/\s+/g, " ").trim().slice(0, 60);
    const [conv] = await db
      .insert(schema.conversations)
      .values({ userId: user.id, channel: input.channel, title: title || "New conversation" })
      .returning();
    conversationId = conv.id;
  }
  await db.insert(schema.messages).values({ conversationId, role: "user", content: input.text });

  const log: { name: string; input: unknown }[] = [];
  const tools = buildTools({ userId: user.id, profile, chart: ctx.chart, timeZone: ctx.timeZone, log });
  const usage: Usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
  const parts: string[] = [];
  let refused = false;

  const runner = anthropic().beta.messages.toolRunner(
    {
      model: AGENT_MODEL,
      max_tokens: 64000,
      output_config: { effort: CHAT_EFFORT },
      cache_control: { type: "ephemeral" },
      system: ctx.system,
      tools,
      messages: [...ctx.history, { role: "user", content: input.text }],
      max_iterations: 8,
      // One turn is at most a few tool iterations and the history is prompt-cached, so a
      // message thread adds little; full requests keep behaviour simple and predictable.
      thread: false,
      stream: true,
      ...fallbackParams,
    },
    { signal: input.signal },
  );

  try {
    for await (const stream of runner) {
      let current = "";
      for await (const event of stream) {
        if (event.type === "content_block_start" && event.content_block.type === "tool_use") {
          input.onTool?.(event.content_block.name);
        } else if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          // Separate text produced before and after tool calls.
          if (!current && parts.length) input.onText?.("\n\n");
          current += event.delta.text;
          input.onText?.(event.delta.text);
        }
      }
      const message = await stream.finalMessage();
      addUsage(usage, message);
      if (current.trim()) parts.push(current.trim());
      if (message.stop_reason === "refusal") {
        refused = true;
        break;
      }
    }
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      console.error("Agent API error", err.status, err.message);
      throw new AgentError("upstream", "The astrologer is temporarily unavailable. Please try again in a minute.");
    }
    throw err;
  }

  let text = parts.join("\n\n");
  if (refused) {
    text = text ? `${text}\n\n${REFUSAL_TEXT}` : REFUSAL_TEXT;
    if (!parts.length) input.onText?.(REFUSAL_TEXT);
  }
  if (!text) text = "…";

  await db.insert(schema.messages).values({ conversationId, role: "assistant", content: text, toolCalls: log.length ? log : null });
  await db.update(schema.conversations).set({ updatedAt: sql`now()` }).where(eq(schema.conversations.id, conversationId));
  await consumeMessage(user);
  await recordUsage(user.id, "chat", usage);

  return {
    conversationId,
    text,
    toolCalls: log,
    usage,
    remaining: allowance.remaining === null ? null : Math.max(allowance.remaining - 1, 0),
  };
}

/** Post-turn maintenance; call without awaiting the user's response (e.g. inside next/server `after`). */
export async function afterTurn(conversationId: string) {
  try {
    await maybeSummarize(conversationId);
  } catch (e) {
    console.error("summarize failed", e);
  }
}
