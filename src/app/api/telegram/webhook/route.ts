import { after } from "next/server";
import type { Update } from "grammy/types";
import { getBot } from "@/lib/telegram/bot";
import { error, json } from "@/lib/http";

export const maxDuration = 300;

/**
 * Telegram webhook. Replies 200 immediately and processes the update after the response,
 * so long agent turns don't trigger Telegram's redelivery.
 */
export async function POST(req: Request) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret || req.headers.get("x-telegram-bot-api-secret-token") !== secret) return error("forbidden", 403);
  const bot = await getBot();
  if (!bot) return error("not_configured", 503);
  const update = (await req.json()) as Update;
  after(() => bot.handleUpdate(update).catch((e) => console.error("telegram update", e)));
  return json({ ok: true });
}
