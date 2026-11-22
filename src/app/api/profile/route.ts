import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { isResponse, json, parseBody, requireUser } from "@/lib/http";
import { updatePrimaryProfile } from "@/lib/profiles";
import { BirthInput } from "@/lib/validation";

/** Creates or updates the signed-in user's own birth profile. */
export async function PUT(req: Request) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  const body = await parseBody(req, BirthInput);
  if (isResponse(body)) return body;
  await updatePrimaryProfile(user.id, { ...body, relation: "self", gender: body.gender ?? null });
  if (!user.name) await db.update(schema.users).set({ name: body.name }).where(eq(schema.users.id, user.id));
  await db.update(schema.notificationPrefs).set({ timeZone: body.timeZone }).where(eq(schema.notificationPrefs.userId, user.id));
  return json({ ok: true });
}
