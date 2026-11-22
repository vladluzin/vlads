// Live smoke test of the agent against a real database and the Claude API.
// Usage: npm run agent:try -- "Your question"   (uses/creates a demo user)
import { eq } from "drizzle-orm";
import { db, schema } from "../src/lib/db";
import { createProfile, primaryProfile } from "../src/lib/profiles";
import { afterTurn, runTurn } from "../src/lib/agent/run";

const question = process.argv.slice(2).join(" ") || "Tell me about my personality and what this year holds for my career.";
const email = "demo@example.com";

let [user] = await db.select().from(schema.users).where(eq(schema.users.email, email));
if (!user) [user] = await db.insert(schema.users).values({ email, name: "Demo", freeMessagesLeft: 1000 }).returning();
if (!(await primaryProfile(user.id))) {
  await createProfile(user.id, {
    name: "Alex",
    relation: "self",
    birthDate: "1983-12-27",
    birthTime: "19:20",
    timeZone: "Asia/Bishkek",
    latitude: 42.8761424,
    longitude: 74.6036724,
    placeLabel: "Bishkek, Kyrgyzstan",
    gender: "male",
  });
}
const conversationId = process.env.CONVERSATION_ID ?? null;
const started = Date.now();
const res = await runTurn({
  userId: user.id,
  conversationId,
  text: question,
  channel: "web",
  onText: (t) => process.stdout.write(t),
  onTool: (n) => process.stdout.write(`\n[tool: ${n}]\n`),
});
await afterTurn(res.conversationId);
console.log(`\n\n---\nconversation ${res.conversationId} | ${((Date.now() - started) / 1000).toFixed(1)}s | tools: ${res.toolCalls.map((t) => t.name).join(", ") || "none"}`);
console.log("usage", res.usage);
process.exit(0);
