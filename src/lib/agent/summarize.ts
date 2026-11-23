import { asc, eq } from "drizzle-orm";
import { db, schema } from "../db";
import { AGENT_MODEL, BATCH_EFFORT, anthropic, fallbackParams } from "./client";

/** Re-summarize after this many new messages (the first summary after 4). */
const RESUMMARIZE_EVERY = 8;

/**
 * Maintains a short rolling summary of each conversation. It covers messages
 * [0, summarizedCount). It serves two purposes: cross-session memory (shown in other
 * conversations) and, once a conversation outgrows the verbatim window, the record of the
 * messages that fell out of it.
 */
export async function maybeSummarize(conversationId: string) {
  const [conv] = await db.select().from(schema.conversations).where(eq(schema.conversations.id, conversationId));
  if (!conv) return;
  const rows = await db
    .select()
    .from(schema.messages)
    .where(eq(schema.messages.conversationId, conversationId))
    .orderBy(asc(schema.messages.id));
  const pending = rows.length - conv.summarizedCount;
  if (pending < (conv.summary ? RESUMMARIZE_EVERY : 4)) return;

  const transcript = rows
    .slice(conv.summarizedCount)
    .map((m) => `${m.role === "user" ? "Person" : "Astrologer"}: ${m.content}`)
    .join("\n\n");

  const msg = await anthropic().beta.messages.create({
    model: AGENT_MODEL,
    max_tokens: 2000,
    output_config: { effort: BATCH_EFFORT },
    system:
      "You maintain a running summary of a conversation between a person and their Vedic astrologer. Write in English, at most 120 words, as plain prose: what the person asked about, the key chart insights and timing windows given, situations or decisions they mentioned, and open threads. No preamble.",
    messages: [
      {
        role: "user",
        content: `${conv.summary ? `Existing summary:\n${conv.summary}\n\n` : ""}New messages:\n${transcript}\n\nReturn the updated summary.`,
      },
    ],
    ...fallbackParams,
  });
  if (msg.stop_reason === "refusal") return;
  const text = msg.content
    .flatMap((b) => (b.type === "text" ? [b.text] : []))
    .join("")
    .trim();
  if (!text) return;
  await db
    .update(schema.conversations)
    .set({ summary: text, summarizedCount: rows.length })
    .where(eq(schema.conversations.id, conversationId));
}
