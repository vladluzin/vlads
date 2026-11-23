import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { isResponse, json, requireUser } from "@/lib/http";

export async function GET() {
  const user = await requireUser();
  if (isResponse(user)) return user;
  const rows = await db
    .select({ id: schema.conversations.id, title: schema.conversations.title, channel: schema.conversations.channel, updatedAt: schema.conversations.updatedAt })
    .from(schema.conversations)
    .where(eq(schema.conversations.userId, user.id))
    .orderBy(desc(schema.conversations.updatedAt))
    .limit(100);
  return json({ conversations: rows });
}
