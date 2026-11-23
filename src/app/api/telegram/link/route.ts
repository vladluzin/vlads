import { randomBytes } from "node:crypto";
import { db, schema } from "@/lib/db";
import { error, isResponse, json, requireUser } from "@/lib/http";

/** Creates a one-time deep link that connects the user's Telegram account (valid 15 minutes). */
export async function POST() {
  const user = await requireUser();
  if (isResponse(user)) return user;
  const bot = process.env.TELEGRAM_BOT_USERNAME;
  if (!bot) return error("not_configured", 503);
  const token = randomBytes(18).toString("base64url");
  await db.insert(schema.linkTokens).values({ token, userId: user.id, expiresAt: new Date(Date.now() + 15 * 60_000) });
  return json({ url: `https://t.me/${bot}?start=link_${token}` });
}
