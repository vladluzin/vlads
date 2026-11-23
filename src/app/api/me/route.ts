import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { activePlan } from "@/lib/billing/plans";
import { isResponse, json, parseBody, requireUser } from "@/lib/http";
import { primaryProfile } from "@/lib/profiles";

export async function GET() {
  const user = await requireUser();
  if (isResponse(user)) return user;
  const plan = activePlan(user);
  return json({
    id: user.id,
    email: user.email,
    name: user.name,
    locale: user.locale,
    plan: plan.id,
    planExpiresAt: user.planExpiresAt,
    freeMessagesLeft: user.freeMessagesLeft,
    telegramConnected: user.telegramId !== null,
    profile: await primaryProfile(user.id),
  });
}

export async function PATCH(req: Request) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  const body = await parseBody(req, z.object({ locale: z.enum(["en", "ru"]).optional(), name: z.string().max(80).optional() }));
  if (isResponse(body)) return body;
  await db.update(schema.users).set(body).where(eq(schema.users.id, user.id));
  return json({ ok: true });
}
