import { endSession } from "@/lib/auth/session";
import { json } from "@/lib/http";

export async function POST() {
  await endSession();
  return json({ ok: true });
}
