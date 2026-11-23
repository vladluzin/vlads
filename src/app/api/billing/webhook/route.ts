import { handleStripeEvent, stripe } from "@/lib/billing/stripe";
import { error, json } from "@/lib/http";

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const sig = req.headers.get("stripe-signature");
  if (!secret || !sig) return error("not_configured", 400);
  const raw = await req.text();
  let event;
  try {
    event = stripe().webhooks.constructEvent(raw, sig, secret);
  } catch {
    return error("bad_signature", 400);
  }
  await handleStripeEvent(event);
  return json({ received: true });
}
