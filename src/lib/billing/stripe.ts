import Stripe from "stripe";
import { eq } from "drizzle-orm";
import { db, schema } from "../db";
import { grantPlan, type PlanId } from "./plans";

let client: Stripe | null = null;
export function stripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  return (client ??= new Stripe(key));
}

/** Stripe Price ids for the monthly subscriptions, configured in the Stripe dashboard. */
export const PRICE_IDS: Record<Exclude<PlanId, "free">, string | undefined> = {
  plus: process.env.STRIPE_PRICE_PLUS,
  pro: process.env.STRIPE_PRICE_PRO,
};

export async function createCheckout(user: typeof schema.users.$inferSelect, plan: Exclude<PlanId, "free">, baseUrl: string) {
  const price = PRICE_IDS[plan];
  if (!price) throw new Error(`No Stripe price configured for ${plan}`);
  const s = stripe();
  let customer = user.stripeCustomerId;
  if (!customer) {
    const c = await s.customers.create({ email: user.email ?? undefined, metadata: { userId: user.id } });
    customer = c.id;
    await db.update(schema.users).set({ stripeCustomerId: customer }).where(eq(schema.users.id, user.id));
  }
  const session = await s.checkout.sessions.create({
    mode: "subscription",
    customer,
    line_items: [{ price, quantity: 1 }],
    client_reference_id: user.id,
    subscription_data: { metadata: { userId: user.id, plan } },
    metadata: { userId: user.id, plan },
    success_url: `${baseUrl}/chat?upgraded=1`,
    cancel_url: `${baseUrl}/pricing`,
    allow_promotion_codes: true,
  });
  return session.url!;
}

/** Applies a verified Stripe event. Idempotent per invoice via the payments table. */
export async function handleStripeEvent(event: Stripe.Event) {
  if (event.type !== "invoice.paid") return;
  const invoice = event.data.object as Stripe.Invoice;
  const meta = invoice.parent?.subscription_details?.metadata ?? {};
  const userId = meta.userId;
  const plan = meta.plan as Exclude<PlanId, "free"> | undefined;
  if (!userId || (plan !== "plus" && plan !== "pro")) return;
  const inserted = await db
    .insert(schema.payments)
    .values({ userId, provider: "stripe", externalId: invoice.id!, plan, amount: invoice.amount_paid, currency: invoice.currency, status: "paid" })
    .onConflictDoNothing()
    .returning();
  if (!inserted.length) return; // already processed
  // A monthly invoice grants 31 days; the grace day covers renewal timing.
  await grantPlan(userId, plan, 31);
}
