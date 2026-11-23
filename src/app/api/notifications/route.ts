import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/lib/db";
import { isResponse, json, parseBody, requireUser } from "@/lib/http";

export async function GET() {
  const user = await requireUser();
  if (isResponse(user)) return user;
  const [prefs] = await db.select().from(schema.notificationPrefs).where(eq(schema.notificationPrefs.userId, user.id));
  return json({ prefs: prefs ?? null });
}

const Prefs = z.object({
  dailyForecast: z.boolean(),
  weeklyForecast: z.boolean(),
  dashaAlerts: z.boolean(),
  transitAlerts: z.boolean(),
  deliveryHour: z.number().int().min(0).max(23),
  channel: z.enum(["telegram", "email"]),
});

export async function PUT(req: Request) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  const body = await parseBody(req, Prefs);
  if (isResponse(body)) return body;
  await db
    .insert(schema.notificationPrefs)
    .values({ userId: user.id, ...body })
    .onConflictDoUpdate({ target: schema.notificationPrefs.userId, set: body });
  return json({ ok: true });
}
