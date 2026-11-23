import { z } from "zod";
import { issueCode, isEmail, normalizeEmail } from "@/lib/auth/otp";
import { sendEmail } from "@/lib/notify/email";
import { BRAND } from "@/lib/brand";
import { error, isResponse, json, parseBody } from "@/lib/http";
import { detectLocale } from "@/lib/i18n";

export async function POST(req: Request) {
  const body = await parseBody(req, z.object({ email: z.string().max(200) }));
  if (isResponse(body)) return body;
  if (!isEmail(body.email)) return error("invalid_email", 400);
  const email = normalizeEmail(body.email);
  const r = await issueCode(email);
  if (!r.ok) return error("rate_limited", 429, "Too many codes requested. Try again in an hour.");
  const ru = detectLocale(req.headers.get("accept-language")) === "ru";
  await sendEmail({
    to: email,
    subject: ru ? `Код входа в ${BRAND.name}: ${r.code}` : `Your ${BRAND.name} sign-in code: ${r.code}`,
    markdown: ru
      ? `Ваш код входа: **${r.code}**\n\nКод действует 10 минут. Если вы не запрашивали вход, просто проигнорируйте письмо.`
      : `Your sign-in code is **${r.code}**\n\nIt expires in 10 minutes. If you didn't request it, you can ignore this email.`,
  });
  return json({ ok: true });
}
