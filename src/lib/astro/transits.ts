import { GRAHAS, NAKSHATRA_SPAN, houseFrom, norm360, signOf, type Graha } from "./constants";
import { angleDiff, bodyPosition, type Ayanamsa, type NodeType } from "./ephemeris";
import { nakshatraOf, type Chart, type NakshatraPosition } from "./chart";

const DAY = 86400000;

export interface TransitPlanet {
  body: Graha;
  lon: number;
  sign: number;
  degree: number;
  retrograde: boolean;
  nakshatra: NakshatraPosition;
  houseFromAscendant: number;
  houseFromMoon: number;
}

export function transitSnapshot(chart: Chart, at: Date): TransitPlanet[] {
  const { ayanamsa, node } = chart.settings;
  return GRAHAS.map((g) => {
    const pos = bodyPosition(g, at, ayanamsa, node);
    const sign = signOf(pos.lon);
    return {
      body: g,
      lon: pos.lon,
      sign,
      degree: pos.lon % 30,
      retrograde: g === "rahu" || g === "ketu" ? true : pos.speed < 0,
      nakshatra: nakshatraOf(pos.lon),
      houseFromAscendant: houseFrom(chart.ascendant.sign, sign),
      houseFromMoon: houseFrom(chart.planets.moon.sign, sign),
    };
  });
}

export interface Ingress {
  body: Graha;
  at: Date;
  fromSign: number;
  toSign: number;
  retrograde: boolean;
}

/** Finds sign changes of `body` between two dates (daily scan + bisection to ~1 minute). */
export function findIngresses(
  body: Graha,
  from: Date,
  to: Date,
  ayan: Ayanamsa = "lahiri",
  node: NodeType = "true",
): Ingress[] {
  const step = body === "moon" ? DAY / 4 : DAY;
  const signAt = (t: number) => signOf(bodyPosition(body, new Date(t), ayan, node).lon);
  const out: Ingress[] = [];
  let t = from.getTime();
  let s = signAt(t);
  while (t < to.getTime()) {
    const next = Math.min(t + step, to.getTime());
    const s2 = signAt(next);
    if (s2 !== s) {
      let lo = t;
      let hi = next;
      while (hi - lo > 60000) {
        const mid = (lo + hi) / 2;
        if (signAt(mid) === s) lo = mid;
        else hi = mid;
      }
      const pos = bodyPosition(body, new Date(hi), ayan, node);
      out.push({ body, at: new Date(hi), fromSign: s, toSign: s2, retrograde: body === "rahu" || body === "ketu" || pos.speed < 0 });
    }
    t = next;
    s = s2;
  }
  return out;
}

/** Retrograde/direct stations of a planet between two dates. */
export function findStations(body: Graha, from: Date, to: Date, ayan: Ayanamsa = "lahiri") {
  if (body === "sun" || body === "moon" || body === "rahu" || body === "ketu") return [];
  const speedAt = (t: number) => bodyPosition(body, new Date(t), ayan).speed;
  const out: { body: Graha; at: Date; kind: "retrograde" | "direct"; lon: number }[] = [];
  let t = from.getTime();
  let v = speedAt(t);
  while (t < to.getTime()) {
    const next = Math.min(t + DAY, to.getTime());
    const v2 = speedAt(next);
    if (Math.sign(v2) !== Math.sign(v) && v2 !== 0) {
      let lo = t;
      let hi = next;
      while (hi - lo > 15 * 60000) {
        const mid = (lo + hi) / 2;
        if (Math.sign(speedAt(mid)) === Math.sign(v)) lo = mid;
        else hi = mid;
      }
      out.push({ body, at: new Date(hi), kind: v2 < 0 ? "retrograde" : "direct", lon: bodyPosition(body, new Date(hi), ayan).lon });
    }
    t = next;
    v = v2;
  }
  return out;
}

export type SadeSatiPhase = "rising" | "peak" | "setting" | null;

/** Sade Sati: Saturn transiting the 12th, 1st or 2nd sign from the natal Moon. */
export function sadeSatiPhase(natalMoonSign: number, saturnSign: number): SadeSatiPhase {
  const h = houseFrom(natalMoonSign, saturnSign);
  return h === 12 ? "rising" : h === 1 ? "peak" : h === 2 ? "setting" : null;
}

export interface TransitHit {
  transiting: Graha;
  natal: string;
  orb: number;
  kind: "conjunction" | "opposition";
}

/** Close conjunctions/oppositions of transiting slow planets to natal points. */
export function transitContacts(chart: Chart, at: Date, maxOrb = 3): TransitHit[] {
  const snap = transitSnapshot(chart, at);
  const natalPoints: [string, number][] = [
    ...GRAHAS.map((g) => [g, chart.planets[g].lon] as [string, number]),
    ...(chart.input.timeKnown ? ([["ascendant", chart.ascendant.lon]] as [string, number][]) : []),
  ];
  const slow: Graha[] = ["jupiter", "saturn", "rahu", "ketu", "mars"];
  const hits: TransitHit[] = [];
  for (const t of snap.filter((s) => slow.includes(s.body))) {
    for (const [name, lon] of natalPoints) {
      const d = Math.abs(angleDiff(t.lon, lon));
      if (d <= maxOrb) hits.push({ transiting: t.body, natal: name, orb: d, kind: "conjunction" });
      else if (Math.abs(180 - d) <= maxOrb) hits.push({ transiting: t.body, natal: name, orb: Math.abs(180 - d), kind: "opposition" });
    }
  }
  return hits.sort((a, b) => a.orb - b.orb);
}

/** Tara bala: auspiciousness of the transiting Moon's nakshatra counted from the natal one. */
export function taraBala(natalNakshatra: number, transitNakshatra: number) {
  const names = ["Janma", "Sampat", "Vipat", "Kshema", "Pratyari", "Sadhaka", "Vadha", "Mitra", "Parama Mitra"];
  const n = ((transitNakshatra - natalNakshatra + 27) % 27) % 9;
  return { tara: names[n], favorable: ![0, 2, 4, 6].includes(n) };
}

/** Chandra bala: favorable houses of the transiting Moon from the natal Moon. */
export const chandraBalaFavorable = (house: number) => [1, 3, 6, 7, 10, 11].includes(house);

export const moonNakshatraIndex = (lon: number) => Math.floor(norm360(lon) / NAKSHATRA_SPAN);
