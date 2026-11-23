import { runTick } from "@/lib/notify/scheduler";
import { error, json } from "@/lib/http";

export const maxDuration = 800;

/** Hourly scheduler entry point. Call with `Authorization: Bearer $CRON_SECRET` (e.g. Vercel Cron). */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return error("forbidden", 403);
  return json(await runTick());
}
