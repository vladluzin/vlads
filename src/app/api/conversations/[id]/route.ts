import { and, asc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { error, isResponse, json, requireUser } from "@/lib/http";

async function owned(userId: string, id: string) {
  const [c] = await db
    .select()
    .from(schema.conversations)
    .where(and(eq(schema.conversations.id, id), eq(schema.conversations.userId, userId)));
  return c ?? null;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  const { id } = await params;
  const conv = await owned(user.id, id);
  if (!conv) return error("not_found", 404);
  const msgs = await db
    .select({ id: schema.messages.id, role: schema.messages.role, content: schema.messages.content, createdAt: schema.messages.createdAt })
    .from(schema.messages)
    .where(eq(schema.messages.conversationId, id))
    .orderBy(asc(schema.messages.id));
  return json({ conversation: { id: conv.id, title: conv.title }, messages: msgs });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  const { id } = await params;
  if (!(await owned(user.id, id))) return error("not_found", 404);
  await db.delete(schema.conversations).where(eq(schema.conversations.id, id));
  return json({ ok: true });
}
