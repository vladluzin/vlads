import { and, eq, gte, sql } from "drizzle-orm";
import { db, schema } from "../db";

export type PlanId = "free" | "plus" | "pro";

export interface Plan {
  id: PlanId;
  title: string;
  /** Monthly price in USD cents (Stripe) — 0 for free. */
  priceCents: number;
  /** Price in Telegram Stars for 30 days. */
  stars: number;
  /** Chat messages per day; free users instead get a one-off allowance (users.freeMessagesLeft). */
  dailyMessages: number;
  savedPeople: number;
  dailyForecast: boolean;
  weeklyForecast: boolean;
  alerts: boolean;
}

export const PLANS: Record<PlanId, Plan> = {
  free: { id: "free", title: "Free", priceCents: 0, stars: 0, dailyMessages: 0, savedPeople: 1, dailyForecast: false, weeklyForecast: true, alerts: true },
  plus: { id: "plus", title: "Plus", priceCents: 999, stars: 650, dailyMessages: 40, savedPeople: 5, dailyForecast: true, weeklyForecast: true, alerts: true },
  pro: { id: "pro", title: "Pro", priceCents: 2499, stars: 1600, dailyMessages: 200, savedPeople: 50, dailyForecast: true, weeklyForecast: true, alerts: true },
};

export const FREE_MESSAGES = Number(process.env.FREE_MESSAGES ?? 5);

type User = typeof schema.users.$inferSelect;

/** The plan in force now (an expired paid plan falls back to free). */
export function activePlan(user: User, now = new Date()): Plan {
  if (user.plan !== "free" && user.planExpiresAt && user.planExpiresAt > now) return PLANS[user.plan];
  return PLANS.free;
}

async function messagesToday(userId: string, now: Date): Promise<number> {
  const since = new Date(now);
  since.setUTCHours(0, 0, 0, 0);
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.messages)
    .innerJoin(schema.conversations, eq(schema.conversations.id, schema.messages.conversationId))
    .where(and(eq(schema.conversations.userId, userId), eq(schema.messages.role, "user"), gte(schema.messages.createdAt, since)));
  return row?.n ?? 0;
}

export type ChatAllowance = { ok: true; remaining: number | null } | { ok: false; reason: "free_exhausted" | "daily_limit" };

export async function chatAllowance(user: User, now = new Date()): Promise<ChatAllowance> {
  const plan = activePlan(user, now);
  if (plan.id === "free") {
    return user.freeMessagesLeft > 0 ? { ok: true, remaining: user.freeMessagesLeft } : { ok: false, reason: "free_exhausted" };
  }
  const used = await messagesToday(user.id, now);
  return used < plan.dailyMessages ? { ok: true, remaining: plan.dailyMessages - used } : { ok: false, reason: "daily_limit" };
}

/** Consumes one free message (no-op on paid plans). */
export async function consumeMessage(user: User, now = new Date()) {
  if (activePlan(user, now).id !== "free") return;
  await db
    .update(schema.users)
    .set({ freeMessagesLeft: sql`greatest(${schema.users.freeMessagesLeft} - 1, 0)` })
    .where(eq(schema.users.id, user.id));
}

/** Extends (or starts) a paid plan by `days`. Renewals stack on the current expiry. */
export async function grantPlan(userId: string, plan: Exclude<PlanId, "free">, days: number) {
  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, userId));
  if (!user) throw new Error("user not found");
  const now = new Date();
  const base = user.plan === plan && user.planExpiresAt && user.planExpiresAt > now ? user.planExpiresAt : now;
  const expires = new Date(base.getTime() + days * 86400000);
  await db.update(schema.users).set({ plan, planExpiresAt: expires }).where(eq(schema.users.id, userId));
  return expires;
}
