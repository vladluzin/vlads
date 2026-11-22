import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { error, isResponse, json, requireUser } from "@/lib/http";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  const { id } = await params;
  const rows = await db
    .delete(schema.birthProfiles)
    .where(and(eq(schema.birthProfiles.id, id), eq(schema.birthProfiles.userId, user.id), eq(schema.birthProfiles.isPrimary, false)))
    .returning({ id: schema.birthProfiles.id });
  return rows.length ? json({ ok: true }) : error("not_found", 404);
}
