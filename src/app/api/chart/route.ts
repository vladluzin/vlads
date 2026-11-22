import { DateTime } from "luxon";
import { activeDasha, detectYogas, mangalDosha, sadeSatiPhase, transitSnapshot, VARGAS, type Varga } from "@/lib/astro";
import { error, isResponse, json, requireUser } from "@/lib/http";
import { chartOf, getProfile, primaryProfile } from "@/lib/profiles";

/** Chart data for the chart page: positions, houses, a chosen varga, dashas, yogas, transits. */
export async function GET(req: Request) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  const url = new URL(req.url);
  const id = url.searchParams.get("profileId");
  const profile = id ? await getProfile(user.id, id) : await primaryProfile(user.id);
  if (!profile) return error("not_found", 404);
  const varga = (url.searchParams.get("varga") ?? "D1") as Varga;
  if (!VARGAS.includes(varga)) return error("invalid_varga", 400);

  const { chart, label } = chartOf(profile);
  const now = new Date();
  const act = activeDasha(chart.dashas, now);
  const transits = transitSnapshot(chart, now);
  const saturn = transits.find((t) => t.body === "saturn")!;
  return json({
    profile: { id: profile.id, name: profile.name, relation: profile.relation, timeKnown: chart.input.timeKnown },
    label,
    varga,
    ascendant: { ...chart.ascendant, vargaSign: chart.ascendant.vargas[varga] },
    planets: Object.values(chart.planets).map((p) => ({ ...p, vargaSign: p.vargas[varga] })),
    houses: chart.houses,
    karakas: chart.karakas,
    yogas: detectYogas(chart),
    mangalDosha: mangalDosha(chart),
    dasha: act && {
      maha: { lord: act.maha.lord, start: act.maha.start, end: act.maha.end },
      antar: { lord: act.antar.lord, start: act.antar.start, end: act.antar.end },
      pratyantar: { lord: act.pratyantar.lord, start: act.pratyantar.start, end: act.pratyantar.end },
    },
    mahadashas: chart.dashas.map((d) => ({
      lord: d.lord,
      start: d.start,
      end: d.end,
      antars: d.sub?.map((a) => ({ lord: a.lord, start: a.start, end: a.end })),
    })),
    transits,
    sadeSati: sadeSatiPhase(chart.planets.moon.sign, saturn.sign),
    today: DateTime.now().setZone(profile.timeZone).toISODate(),
  });
}
