import type Anthropic from "@anthropic-ai/sdk";
import { and, asc, desc, eq, ne } from "drizzle-orm";
import { DateTime } from "luxon";
import { describeChart, type Chart } from "../astro";
import { db, schema } from "../db";
import { chartOf, type BirthProfile } from "../profiles";
import { SYSTEM_PROMPT } from "./prompt";

/** Messages kept verbatim in the prompt; older ones are folded into the conversation summary. */
export const VERBATIM_WINDOW = 24;

export interface AgentContext {
  user: typeof schema.users.$inferSelect;
  profile: BirthProfile;
  chart: Chart;
  timeZone: string;
  system: Anthropic.Beta.BetaTextBlockParam[];
  history: Anthropic.Beta.BetaMessageParam[];
}

async function memoryBlock(userId: string, conversationId: string | null): Promise<string> {
  const facts = await db
    .select()
    .from(schema.memories)
    .where(eq(schema.memories.userId, userId))
    .orderBy(asc(schema.memories.id));
  const others = await db
    .select({ title: schema.conversations.title, summary: schema.conversations.summary, updatedAt: schema.conversations.updatedAt })
    .from(schema.conversations)
    .where(
      conversationId
        ? and(eq(schema.conversations.userId, userId), ne(schema.conversations.id, conversationId))
        : eq(schema.conversations.userId, userId),
    )
    .orderBy(desc(schema.conversations.updatedAt))
    .limit(4);
  const L = ["WHAT YOU KNOW ABOUT THEM (from earlier conversations; ids for forget_fact):"];
  L.push(...(facts.length ? facts.map((f) => `- [${f.id}] ${f.fact}`) : ["- nothing saved yet"]));
  const recent = others.filter((o) => o.summary);
  if (recent.length) {
    L.push("", "RECENT CONVERSATIONS:");
    for (const o of recent) L.push(`- ${o.updatedAt.toISOString().slice(0, 10)} "${o.title}": ${o.summary}`);
  }
  return L.join("\n");
}

/**
 * Builds the prompt for one turn. Block order is chosen for prompt caching:
 *   1. stable system prompt (shared by all users)
 *   2. this person's chart + memory (stable for the day) ← cache breakpoint
 *   3. this conversation's rolling summary (changes rarely)
 * then the verbatim message window; a top-level cache_control caches the growing history.
 */
export async function buildContext(
  user: typeof schema.users.$inferSelect,
  profile: BirthProfile,
  conversationId: string | null,
  now = new Date(),
): Promise<AgentContext> {
  const { chart, label } = chartOf(profile);
  const [prefs] = await db.select().from(schema.notificationPrefs).where(eq(schema.notificationPrefs.userId, user.id));
  const timeZone = prefs?.timeZone ?? profile.timeZone;
  const today = DateTime.fromJSDate(now, { zone: timeZone });
  // Use local noon so the dasha "current" line only changes once per day (cache-friendly).
  const dayAnchor = today.set({ hour: 12, minute: 0, second: 0, millisecond: 0 }).toJSDate();

  const personBlock = [
    `TODAY: ${today.toFormat("cccc, yyyy-MM-dd")} in ${timeZone}.`,
    `THE PERSON: ${profile.name}${profile.gender ? `, ${profile.gender}` : ""}. App language: ${user.locale}.`,
    "",
    describeChart(chart, { birthLabel: label, now: dayAnchor }),
    "",
    await memoryBlock(user.id, conversationId),
  ].join("\n");

  const system: Anthropic.Beta.BetaTextBlockParam[] = [
    { type: "text", text: SYSTEM_PROMPT },
    { type: "text", text: personBlock, cache_control: { type: "ephemeral" } },
  ];

  let history: Anthropic.Beta.BetaMessageParam[] = [];
  if (conversationId) {
    const [conv] = await db.select().from(schema.conversations).where(eq(schema.conversations.id, conversationId));
    const rows = await db
      .select()
      .from(schema.messages)
      .where(eq(schema.messages.conversationId, conversationId))
      .orderBy(desc(schema.messages.id))
      .limit(VERBATIM_WINDOW + 1);
    // Only when older messages fell out of the window does the summary add information.
    if (rows.length > VERBATIM_WINDOW) {
      rows.pop();
      if (conv?.summary) system.push({ type: "text", text: `EARLIER IN THIS CONVERSATION (summary):\n${conv.summary}` });
    }
    history = rows.reverse().map((m) => ({ role: m.role, content: m.content }));
    // The API requires the first message to be from the user.
    while (history.length && history[0].role !== "user") history.shift();
  }
  return { user, profile, chart, timeZone, system, history };
}
