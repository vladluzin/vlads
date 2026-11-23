import { z } from "zod";
import { activePlan } from "@/lib/billing/plans";
import { error, isResponse, json, parseBody, requireUser } from "@/lib/http";
import { createProfile, listProfiles } from "@/lib/profiles";
import { BirthInput } from "@/lib/validation";

export async function GET() {
  const user = await requireUser();
  if (isResponse(user)) return user;
  return json({ profiles: await listProfiles(user.id) });
}

/** Adds another person's chart (partner, child…), within the plan's limit. */
export async function POST(req: Request) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  const body = await parseBody(req, z.intersection(BirthInput, z.object({ relation: z.enum(["partner", "child", "parent", "friend", "other"]) })));
  if (isResponse(body)) return body;
  const others = (await listProfiles(user.id)).filter((p) => !p.isPrimary);
  if (others.length >= activePlan(user).savedPeople) return error("limit_reached", 402, "Upgrade to save more charts.");
  const p = await createProfile(user.id, { ...body, gender: body.gender ?? null });
  return json({ profile: p }, 201);
}
