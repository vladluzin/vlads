import { searchPlaces } from "@/lib/geo/geocode";
import { error, isResponse, json, requireUser } from "@/lib/http";

export async function GET(req: Request) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? "";
  try {
    return json({ places: await searchPlaces(q, url.searchParams.get("lang") ?? user.locale) });
  } catch (e) {
    console.error("geocoder", e);
    return error("geocoder_unavailable", 502);
  }
}
