import { z } from "zod";
import { verifyCode } from "@/lib/auth/otp";
import { startSession } from "@/lib/auth/session";
import { error, isResponse, json, parseBody } from "@/lib/http";
import { primaryProfile } from "@/lib/profiles";
import { detectLocale } from "@/lib/i18n";

export async function POST(req: Request) {
  const body = await parseBody(req, z.object({ email: z.string().max(200), code: z.string().regex(/^\d{6}$/) }));
  if (isResponse(body)) return body;
  const r = await verifyCode(body.email, body.code, detectLocale(req.headers.get("accept-language")));
  if (!r.ok) return error(r.reason, 400);
  await startSession(r.userId);
  const hasProfile = !!(await primaryProfile(r.userId));
  return json({ ok: true, next: hasProfile ? "/chat" : "/onboarding" });
}
