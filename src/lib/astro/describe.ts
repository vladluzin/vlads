import { GRAHAS, GRAHA_NAMES, HOUSE_MEANINGS, KARAKA_NAMES, NAKSHATRAS, OUTER_PLANETS, SIGNS, formatDms, type Body } from "./constants";
import type { Chart } from "./chart";
import { activeDasha, type DashaPeriod } from "./dasha";
import { detectYogas } from "./yogas";
import { VARGA_INFO, type Varga } from "./vargas";
import { mangalDosha } from "./compatibility";

const iso = (d: Date) => d.toISOString().slice(0, 10);
const sign = (i: number) => `${SIGNS[i].en} (${SIGNS[i].sa})`;
const name = (b: Body) => GRAHA_NAMES[b].en;

export interface DescribeOptions {
  /** Human-readable birth details for the header. */
  birthLabel: string;
  now?: Date;
}

/**
 * Compact, model-friendly text rendering of a natal chart. Deterministic for a given chart
 * and day, so it can sit in a cached prompt block.
 */
export function describeChart(chart: Chart, opts: DescribeOptions): string {
  const now = opts.now ?? new Date();
  const L: string[] = [];
  const { timeKnown } = chart.input;
  L.push(`NATAL CHART — sidereal zodiac, ${chart.settings.ayanamsa} ayanamsa, whole-sign houses, ${chart.settings.node} nodes`);
  L.push(`Birth: ${opts.birthLabel}`);
  if (!timeKnown) {
    L.push(
      "BIRTH TIME UNKNOWN: ascendant, houses and house lordships below are computed for local noon and are NOT reliable. Prefer the Moon (Chandra lagna) as the reference point and say so when it matters.",
    );
  }
  const a = chart.ascendant;
  L.push(`Ascendant (lagna): ${sign(a.sign)} ${formatDms(a.degree)}, nakshatra ${a.nakshatra.name} pada ${a.nakshatra.pada}; navamsha lagna ${SIGNS[a.vargas.D9].en}`);
  L.push("");
  L.push("PLANETS (sign degree | house from lagna | house from Moon | nakshatra-pada (lord) | dignity | flags)");
  for (const b of [...GRAHAS, ...OUTER_PLANETS] as Body[]) {
    const p = chart.planets[b];
    const flags = [
      p.retrograde && b !== "rahu" && b !== "ketu" ? "retrograde" : null,
      p.combust ? "combust" : null,
      p.vargottama ? "vargottama" : null,
      p.karaka ? `${p.karaka}` : null,
      `D9 ${SIGNS[p.vargas.D9].en}`,
    ].filter(Boolean);
    L.push(
      `- ${name(b)}: ${SIGNS[p.sign].en} ${formatDms(p.degree)} | H${p.house} | Moon+${p.houseFromMoon} | ${p.nakshatra.name}-${p.nakshatra.pada} (${name(p.nakshatra.lord)}) | ${p.dignity ?? "-"} | ${flags.join(", ")}`,
    );
  }
  L.push("(Uranus, Neptune, Pluto are listed for reference only; classical Jyotish uses the nine grahas.)");
  L.push("");
  L.push("HOUSES (sign, lord → lord's house, occupants, aspected by)");
  for (const h of chart.houses) {
    L.push(
      `- H${h.house} ${SIGNS[h.sign].en}: lord ${name(h.lord)} in H${h.lordHouse}; occupants ${h.occupants.filter((o) => !(OUTER_PLANETS as readonly string[]).includes(o)).map(name).join(", ") || "none"}; aspects from ${h.aspectedBy.map(name).join(", ") || "none"} — ${HOUSE_MEANINGS[h.house - 1].en}`,
    );
  }
  L.push("");
  L.push("CHARA KARAKAS: " + KARAKA_NAMES.map((k) => `${k.code}=${chart.karakas[k.code] ? name(chart.karakas[k.code]) : "?"}`).join(", "));

  const yogas = detectYogas(chart);
  L.push("");
  L.push("YOGAS DETECTED (mechanical rules; weigh strength in context):");
  for (const y of yogas) L.push(`- ${y.name}: ${y.reason}`);
  if (!yogas.length) L.push("- none of the tracked yogas");

  const md = mangalDosha(chart);
  L.push(`Mangal dosha: ${md.present ? `present (Mars from ${md.from.join(", ")})` : "absent"}`);

  L.push("");
  L.push(describeDashas(chart.dashas, now));
  return L.join("\n");
}

export function describeDashas(dashas: DashaPeriod[], now: Date): string {
  const L: string[] = [];
  const act = activeDasha(dashas, now);
  L.push("VIMSHOTTARI DASHA");
  if (act) {
    L.push(
      `Current (${iso(now)}): ${name(act.maha.lord)} mahadasha (${iso(act.maha.start)} → ${iso(act.maha.end)}) / ${name(act.antar.lord)} antardasha (${iso(act.antar.start)} → ${iso(act.antar.end)}) / ${name(act.pratyantar.lord)} pratyantardasha (until ${iso(act.pratyantar.end)})`,
    );
    const nextAntar = act.maha.sub?.find((s) => s.start > act.antar.start);
    if (nextAntar) L.push(`Next antardasha: ${name(nextAntar.lord)} from ${iso(nextAntar.start)}`);
  }
  L.push("Mahadashas: " + dashas.map((d) => `${name(d.lord)} ${iso(d.start)}–${iso(d.end)}`).join("; "));
  return L.join("\n");
}

/** Positions of all grahas in one divisional chart. */
export function describeVarga(chart: Chart, varga: Varga): string {
  const L = [`${varga} ${VARGA_INFO[varga].en} (${VARGA_INFO[varga].area})`];
  const lagna = chart.ascendant.vargas[varga];
  L.push(`Varga lagna: ${SIGNS[lagna].en}${chart.input.timeKnown ? "" : " (unreliable: birth time unknown)"}`);
  for (const g of GRAHAS) {
    const s = chart.planets[g].vargas[varga];
    L.push(`- ${name(g)}: ${SIGNS[s].en}, house ${((s - lagna + 12) % 12) + 1}`);
  }
  return L.join("\n");
}

export const nakshatraLabel = (i: number) => `${NAKSHATRAS[i].en} (lord ${name(NAKSHATRAS[i].lord)})`;
