import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { and, desc, eq, gte, isNull, sql } from "drizzle-orm";
import { db, schema } from "../db";
import { FREE_MESSAGES } from "../billing/plans";

const CODE_TTL_MIN = 10;
const MAX_ATTEMPTS = 5;
const MAX_CODES_PER_HOUR = 5;

const pepper = () => process.env.SESSION_SECRET ?? "";
const hash = (email: string, code: string) => createHmac("sha256", pepper()).update(`${email}:${code}`).digest("hex");

export const normalizeEmail = (e: string) => e.trim().toLowerCase();
export const isEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);

export type IssueResult = { ok: true; code: string } | { ok: false; reason: "rate_limited" };

/** Issues a one-time 6-digit code. Codes are stored hashed and expire after 10 minutes. */
export async function issueCode(emailRaw: string): Promise<IssueResult> {
  const email = normalizeEmail(emailRaw);
  const hourAgo = new Date(Date.now() - 3600_000);
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.loginCodes)
    .where(and(eq(schema.loginCodes.email, email), gte(schema.loginCodes.createdAt, hourAgo)));
  if (n >= MAX_CODES_PER_HOUR) return { ok: false, reason: "rate_limited" };
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await db.insert(schema.loginCodes).values({
    email,
    codeHash: hash(email, code),
    expiresAt: new Date(Date.now() + CODE_TTL_MIN * 60_000),
  });
  return { ok: true, code };
}

export type VerifyResult = { ok: true; userId: string; isNew: boolean } | { ok: false; reason: "invalid" | "expired" | "too_many_attempts" };

/** Checks the latest unused code for the email; creates the user on first login. */
export async function verifyCode(emailRaw: string, code: string, locale = "en"): Promise<VerifyResult> {
  const email = normalizeEmail(emailRaw);
  const [row] = await db
    .select()
    .from(schema.loginCodes)
    .where(and(eq(schema.loginCodes.email, email), isNull(schema.loginCodes.consumedAt)))
    .orderBy(desc(schema.loginCodes.createdAt))
    .limit(1);
  if (!row) return { ok: false, reason: "invalid" };
  if (row.expiresAt < new Date()) return { ok: false, reason: "expired" };
  if (row.attempts >= MAX_ATTEMPTS) return { ok: false, reason: "too_many_attempts" };

  const expected = Buffer.from(row.codeHash, "hex");
  const given = Buffer.from(hash(email, code.trim()), "hex");
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
    await db.update(schema.loginCodes).set({ attempts: row.attempts + 1 }).where(eq(schema.loginCodes.id, row.id));
    return { ok: false, reason: row.attempts + 1 >= MAX_ATTEMPTS ? "too_many_attempts" : "invalid" };
  }
  await db.update(schema.loginCodes).set({ consumedAt: new Date() }).where(eq(schema.loginCodes.id, row.id));

  const [existing] = await db.select().from(schema.users).where(eq(schema.users.email, email));
  if (existing) return { ok: true, userId: existing.id, isNew: false };
  const [user] = await db
    .insert(schema.users)
    .values({ email, locale: locale === "ru" ? "ru" : "en", freeMessagesLeft: FREE_MESSAGES })
    .returning();
  return { ok: true, userId: user.id, isNew: true };
}
