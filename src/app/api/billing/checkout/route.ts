import { z } from "zod";
import { createCheckout } from "@/lib/billing/stripe";
import { error, isResponse, json, parseBody, requireUser } from "@/lib/http";

export async function POST(req: Request) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  const body = await parseBody(req, z.object({ plan: z.enum(["plus", "pro"]) }));
  if (isResponse(body)) return body;
  try {
    const base = process.env.APP_URL ?? new URL(req.url).origin;
    return json({ url: await createCheckout(user, body.plan, base) });
  } catch (e) {
    console.error("checkout", e);
    return error("billing_unavailable", 503, "Payments are not configured yet.");
  }
}
