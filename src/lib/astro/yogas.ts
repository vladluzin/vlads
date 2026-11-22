import { DUSTHANAS, KENDRAS, SIGN_LORDS, TRIKONAS, houseFrom, type Body, type SevenGraha } from "./constants";
import type { Chart } from "./chart";

export interface Yoga {
  key: string;
  name: string;
  /** Planets that form the yoga. */
  planets: Body[];
  /** Short, factual description of why it is present (for the agent to interpret). */
  reason: string;
  /** Broad tone, used for ordering; interpretation is left to the agent. */
  nature: "benefic" | "challenging" | "mixed";
}

const MAHAPURUSHA: Partial<Record<SevenGraha, string>> = {
  mars: "Ruchaka",
  mercury: "Bhadra",
  jupiter: "Hamsa",
  venus: "Malavya",
  saturn: "Shasha",
};

const lordOfHouse = (chart: Chart, house: number): SevenGraha => chart.houses[house - 1].lord;

/**
 * A curated set of classical yogas with unambiguous rules. Each detection is mechanical;
 * the strength and meaning in context are for interpretation.
 */
export function detectYogas(chart: Chart): Yoga[] {
  const p = chart.planets;
  const yogas: Yoga[] = [];
  const sameSign = (a: Body, b: Body) => p[a].sign === p[b].sign;

  // Pancha Mahapurusha: Mars/Mercury/Jupiter/Venus/Saturn in own or exaltation sign in a kendra.
  for (const [g, name] of Object.entries(MAHAPURUSHA) as [SevenGraha, string][]) {
    const info = p[g];
    if (KENDRAS.includes(info.house) && (info.dignity === "own" || info.dignity === "exalted" || info.dignity === "moolatrikona")) {
      yogas.push({
        key: `mahapurusha_${g}`,
        name: `${name} yoga (Pancha Mahapurusha)`,
        planets: [g],
        reason: `${g} is ${info.dignity} in house ${info.house} (a kendra)`,
        nature: "benefic",
      });
    }
  }

  // Gajakesari: Jupiter in a kendra from the Moon.
  const jupFromMoon = houseFrom(p.moon.sign, p.jupiter.sign);
  if (KENDRAS.includes(jupFromMoon)) {
    yogas.push({
      key: "gajakesari",
      name: "Gajakesari yoga",
      planets: ["jupiter", "moon"],
      reason: `Jupiter is in house ${jupFromMoon} from the Moon`,
      nature: "benefic",
    });
  }

  if (sameSign("sun", "mercury")) {
    yogas.push({
      key: "budhaditya",
      name: "Budhaditya yoga",
      planets: ["sun", "mercury"],
      reason: `Sun and Mercury together in house ${p.sun.house}${p.mercury.combust ? " (Mercury is combust)" : ""}`,
      nature: p.mercury.combust ? "mixed" : "benefic",
    });
  }

  if (sameSign("moon", "mars")) {
    yogas.push({
      key: "chandra_mangala",
      name: "Chandra-Mangala yoga",
      planets: ["moon", "mars"],
      reason: `Moon and Mars together in house ${p.moon.house}`,
      nature: "mixed",
    });
  }

  // Kemadruma: no planet (Sun and nodes excluded) in the 2nd or 12th from the Moon, nor with it.
  const flankers: SevenGraha[] = ["mars", "mercury", "jupiter", "venus", "saturn"];
  const hasSupport = flankers.some((g) => [1, 2, 12].includes(houseFrom(p.moon.sign, p[g].sign)));
  if (!hasSupport) {
    yogas.push({
      key: "kemadruma",
      name: "Kemadruma yoga",
      planets: ["moon"],
      reason: "No planet other than the Sun or nodes in the 2nd, 12th or same sign as the Moon",
      nature: "challenging",
    });
  }

  // Parivartana: two planets in each other's signs.
  for (let i = 0; i < 7; i++) {
    for (let j = i + 1; j < 7; j++) {
      const a = (["sun", "moon", "mars", "mercury", "jupiter", "venus", "saturn"] as SevenGraha[])[i];
      const b = (["sun", "moon", "mars", "mercury", "jupiter", "venus", "saturn"] as SevenGraha[])[j];
      if (SIGN_LORDS[p[a].sign] === b && SIGN_LORDS[p[b].sign] === a) {
        const hs = [p[a].house, p[b].house];
        const dusthana = hs.some((h) => DUSTHANAS.includes(h));
        yogas.push({
          key: `parivartana_${a}_${b}`,
          name: "Parivartana (sign exchange) yoga",
          planets: [a, b],
          reason: `${a} and ${b} exchange signs between houses ${hs[0]} and ${hs[1]}`,
          nature: dusthana ? "mixed" : "benefic",
        });
      }
    }
  }

  if (chart.input.timeKnown) {
    // Raja yoga: lords of a kendra and a trikona (different planets) conjunct.
    const kendraLords = new Set(KENDRAS.map((h) => lordOfHouse(chart, h)));
    const trikonaLords = new Set(TRIKONAS.filter((h) => h !== 1).map((h) => lordOfHouse(chart, h)));
    const seen = new Set<string>();
    for (const k of kendraLords) {
      for (const t of trikonaLords) {
        if (k === t) continue;
        const id = [k, t].sort().join("_");
        if (seen.has(id) || !sameSign(k, t)) continue;
        seen.add(id);
        yogas.push({
          key: `raja_${id}`,
          name: "Raja yoga (kendra + trikona lords)",
          planets: [k, t],
          reason: `${k} (kendra lord) and ${t} (trikona lord) together in house ${p[k].house}`,
          nature: "benefic",
        });
      }
    }
    // A single planet ruling both a kendra and a trikona (yogakaraka).
    for (const g of ["mars", "venus", "saturn"] as SevenGraha[]) {
      const ruled = chart.houses.filter((h) => h.lord === g).map((h) => h.house);
      if (ruled.some((h) => [4, 7, 10].includes(h)) && ruled.some((h) => [5, 9].includes(h))) {
        yogas.push({
          key: `yogakaraka_${g}`,
          name: "Yogakaraka planet",
          planets: [g],
          reason: `${g} rules houses ${ruled.join(" and ")} (a kendra and a trikona)`,
          nature: "benefic",
        });
      }
    }
    // Viparita Raja yoga: lord of 6, 8 or 12 placed in 6, 8 or 12.
    for (const h of DUSTHANAS) {
      const lord = lordOfHouse(chart, h);
      if (DUSTHANAS.includes(p[lord].house) && p[lord].house !== h) {
        const names: Record<number, string> = { 6: "Harsha", 8: "Sarala", 12: "Vimala" };
        yogas.push({
          key: `viparita_${h}`,
          name: `Viparita Raja yoga (${names[h]})`,
          planets: [lord],
          reason: `lord of house ${h} (${lord}) sits in house ${p[lord].house}`,
          nature: "mixed",
        });
      }
    }
    // Dhana yoga: lords of 2 or 11 with lords of 1, 5 or 9.
    const wealth = new Set([lordOfHouse(chart, 2), lordOfHouse(chart, 11)]);
    const fortune = new Set([1, 5, 9].map((h) => lordOfHouse(chart, h)));
    const seenD = new Set<string>();
    for (const w of wealth) {
      for (const f of fortune) {
        if (w === f || !sameSign(w, f)) continue;
        const id = [w, f].sort().join("_");
        if (seenD.has(id)) continue;
        seenD.add(id);
        yogas.push({
          key: `dhana_${id}`,
          name: "Dhana yoga",
          planets: [w, f],
          reason: `${w} (wealth lord) with ${f} (lagna/trikona lord) in house ${p[w].house}`,
          nature: "benefic",
        });
      }
    }
  }

  // Neecha Bhanga (one common rule): debilitated planet whose dispositor is in a kendra from
  // the ascendant or the Moon.
  for (const g of ["sun", "moon", "mars", "mercury", "jupiter", "venus", "saturn"] as SevenGraha[]) {
    if (p[g].dignity !== "debilitated") continue;
    const dispositor = SIGN_LORDS[p[g].sign];
    const fromLagna = p[dispositor].house;
    const fromMoon = houseFrom(p.moon.sign, p[dispositor].sign);
    if ((chart.input.timeKnown && KENDRAS.includes(fromLagna)) || KENDRAS.includes(fromMoon)) {
      yogas.push({
        key: `neecha_bhanga_${g}`,
        name: "Neecha Bhanga (cancelled debilitation)",
        planets: [g, dispositor],
        reason: `${g} is debilitated but its dispositor ${dispositor} is in a kendra`,
        nature: "mixed",
      });
    }
  }

  return yogas;
}
