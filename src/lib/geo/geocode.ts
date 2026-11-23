import { z } from "zod";
import { timeZoneFor } from "./time";

export interface Place {
  name: string;
  country: string | null;
  admin: string | null;
  latitude: number;
  longitude: number;
  timeZone: string;
}

const OpenMeteoResult = z.object({
  results: z
    .array(
      z.object({
        name: z.string(),
        latitude: z.number(),
        longitude: z.number(),
        country: z.string().optional(),
        admin1: z.string().optional(),
        timezone: z.string().optional(),
      }),
    )
    .optional(),
});

/**
 * City search via the Open-Meteo geocoding API (GeoNames data, no key required).
 * Swap for another provider by replacing this function; the rest of the app only uses `Place`.
 */
export async function searchPlaces(query: string, language = "en", count = 6): Promise<Place[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const url = new URL(process.env.GEOCODER_URL ?? "https://geocoding-api.open-meteo.com/v1/search");
  url.searchParams.set("name", q);
  url.searchParams.set("count", String(count));
  url.searchParams.set("language", language);
  url.searchParams.set("format", "json");
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`Geocoder error ${res.status}`);
  const data = OpenMeteoResult.parse(await res.json());
  return (data.results ?? []).map((r) => ({
    name: r.name,
    country: r.country ?? null,
    admin: r.admin1 ?? null,
    latitude: r.latitude,
    longitude: r.longitude,
    timeZone: r.timezone ?? timeZoneFor(r.latitude, r.longitude),
  }));
}

export const placeLabel = (p: Pick<Place, "name" | "admin" | "country">) =>
  [...new Set([p.name, p.admin, p.country].filter(Boolean))].join(", ");
