import {
  COMBUSTION_ORB,
  EXALTATION,
  GRAHAS,
  MOOLATRIKONA,
  NAKSHATRAS,
  NAKSHATRA_SPAN,
  NODE_EXALTATION,
  OUTER_PLANETS,
  PADA_SPAN,
  SEVEN_GRAHAS,
  SIGN_LORDS,
  SPECIAL_ASPECTS,
  KARAKA_NAMES,
  degInSign,
  houseFrom,
  naturalRelationship,
  norm360,
  signOf,
  type Body,
  type Graha,
  type SevenGraha,
} from "./constants";
import { angleDiff, angles, bodyPosition, type Ayanamsa, type NodeType } from "./ephemeris";
import { VARGAS, isVargottama, vargaSign, type Varga } from "./vargas";
import { vimshottari, type DashaPeriod } from "./dasha";

export interface ChartSettings {
  ayanamsa: Ayanamsa;
  node: NodeType;
  /** 7 karakas (Parashara, Sun–Saturn) or 8 (Jaimini, including Rahu). */
  karakaScheme: 7 | 8;
}

export const DEFAULT_SETTINGS: ChartSettings = { ayanamsa: "lahiri", node: "true", karakaScheme: 7 };

export interface ChartInput {
  utc: Date;
  latitude: number;
  longitude: number;
  /** False when the birth time is unknown: ascendant and houses are then unreliable. */
  timeKnown: boolean;
}

export type Dignity =
  | "exalted"
  | "moolatrikona"
  | "own"
  | "friend"
  | "neutral"
  | "enemy"
  | "debilitated";

export interface NakshatraPosition {
  index: number;
  name: string;
  pada: number;
  lord: Graha;
}

export interface PlanetInfo {
  body: Body;
  lon: number;
  sign: number;
  degree: number;
  speed: number;
  retrograde: boolean;
  nakshatra: NakshatraPosition;
  /** Whole-sign house from the ascendant. */
  house: number;
  /** House counted from the natal Moon (Chandra lagna). */
  houseFromMoon: number;
  dignity: Dignity | null;
  combust: boolean;
  vargottama: boolean;
  karaka: string | null;
  /** Houses (1-12, from the ascendant) this planet aspects by graha drishti. */
  aspectsHouses: number[];
  vargas: Record<Varga, number>;
}

export interface HouseInfo {
  house: number;
  sign: number;
  lord: SevenGraha;
  /** House where the lord sits. */
  lordHouse: number;
  occupants: Body[];
  aspectedBy: Graha[];
}

export interface Chart {
  input: ChartInput;
  settings: ChartSettings;
  ascendant: { lon: number; sign: number; degree: number; nakshatra: NakshatraPosition; vargas: Record<Varga, number> };
  midheaven: number;
  planets: Record<Body, PlanetInfo>;
  houses: HouseInfo[];
  /** Karaka code -> planet. */
  karakas: Record<string, Body>;
  dashas: DashaPeriod[];
}

export function nakshatraOf(lon: number): NakshatraPosition {
  const l = norm360(lon);
  const index = Math.floor(l / NAKSHATRA_SPAN);
  const pada = Math.floor((l - index * NAKSHATRA_SPAN) / PADA_SPAN) + 1;
  return { index, name: NAKSHATRAS[index].en, pada, lord: NAKSHATRAS[index].lord };
}

export function dignityOf(body: Body, lon: number): Dignity | null {
  const sign = signOf(lon);
  const deg = degInSign(lon);
  if (body === "rahu" || body === "ketu") {
    const ex = NODE_EXALTATION[body];
    if (sign === ex) return "exalted";
    if (sign === (ex + 6) % 12) return "debilitated";
    return null;
  }
  if (!(SEVEN_GRAHAS as readonly string[]).includes(body)) return null;
  const g = body as SevenGraha;
  if (EXALTATION[g].sign === sign) return "exalted";
  if ((EXALTATION[g].sign + 6) % 12 === sign) return "debilitated";
  const mt = MOOLATRIKONA[g];
  if (mt.sign === sign && deg >= mt.from && deg < mt.to) return "moolatrikona";
  const lord = SIGN_LORDS[sign];
  if (lord === g) return "own";
  return naturalRelationship(g, lord);
}

function isCombust(body: Body, lon: number, retro: boolean, sunLon: number): boolean {
  const orb = COMBUSTION_ORB[body as Graha];
  if (!orb) return false;
  return Math.abs(angleDiff(sunLon, lon)) <= (retro ? orb.retro : orb.direct);
}

function aspectedHouses(body: Body, house: number): number[] {
  if (!(GRAHAS as readonly string[]).includes(body) || body === "rahu" || body === "ketu") return [];
  const offsets = [7, ...(SPECIAL_ASPECTS[body as Graha] ?? [])];
  return offsets.map((o) => ((house - 1 + o - 1) % 12) + 1).sort((a, b) => a - b);
}

function computeKarakas(planets: Record<Body, PlanetInfo>, scheme: 7 | 8): Record<string, Body> {
  const candidates: { body: Body; deg: number }[] = SEVEN_GRAHAS.map((g) => ({ body: g, deg: planets[g].degree }));
  // In the 8-karaka scheme Rahu is counted backwards from the end of its sign.
  if (scheme === 8) candidates.push({ body: "rahu", deg: 30 - planets.rahu.degree });
  candidates.sort((a, b) => b.deg - a.deg);
  const codes = scheme === 8 ? ["AK", "AmK", "BK", "MK", "PiK", "PK", "GK", "DK"] : KARAKA_NAMES.map((k) => k.code);
  const out: Record<string, Body> = {};
  candidates.forEach((c, i) => (out[codes[i]] = c.body));
  return out;
}

const allVargas = (lon: number) =>
  Object.fromEntries(VARGAS.map((v) => [v, vargaSign(lon, v)])) as Record<Varga, number>;

export function computeChart(input: ChartInput, settings: ChartSettings = DEFAULT_SETTINGS): Chart {
  const bodies: Body[] = [...GRAHAS, ...OUTER_PLANETS];
  const raw = Object.fromEntries(
    bodies.map((b) => [b, bodyPosition(b, input.utc, settings.ayanamsa, settings.node)]),
  ) as Record<Body, ReturnType<typeof bodyPosition>>;
  const ang = angles(input.utc, input.latitude, input.longitude, settings.ayanamsa);
  const ascSign = signOf(ang.ascendant);
  const moonSign = signOf(raw.moon.lon);

  const planets = {} as Record<Body, PlanetInfo>;
  for (const b of bodies) {
    const { lon, speed } = raw[b];
    const sign = signOf(lon);
    // Nodes always move retrograde on average; report them as such.
    const retrograde = b === "rahu" || b === "ketu" ? true : speed < 0;
    const house = houseFrom(ascSign, sign);
    planets[b] = {
      body: b,
      lon,
      sign,
      degree: degInSign(lon),
      speed,
      retrograde,
      nakshatra: nakshatraOf(lon),
      house,
      houseFromMoon: houseFrom(moonSign, sign),
      dignity: dignityOf(b, lon),
      combust: b !== "sun" && isCombust(b, lon, retrograde, raw.sun.lon),
      vargottama: isVargottama(lon),
      karaka: null,
      aspectsHouses: aspectedHouses(b, house),
      vargas: allVargas(lon),
    };
  }

  const karakas = computeKarakas(planets, settings.karakaScheme);
  for (const [code, b] of Object.entries(karakas)) planets[b].karaka = code;

  const houses: HouseInfo[] = Array.from({ length: 12 }, (_, i) => {
    const sign = (ascSign + i) % 12;
    const lord = SIGN_LORDS[sign];
    return {
      house: i + 1,
      sign,
      lord,
      lordHouse: planets[lord].house,
      occupants: bodies.filter((b) => planets[b].house === i + 1),
      aspectedBy: GRAHAS.filter((g) => planets[g].aspectsHouses.includes(i + 1)),
    };
  });

  return {
    input,
    settings,
    ascendant: {
      lon: ang.ascendant,
      sign: ascSign,
      degree: degInSign(ang.ascendant),
      nakshatra: nakshatraOf(ang.ascendant),
      vargas: allVargas(ang.ascendant),
    },
    midheaven: ang.midheaven,
    planets,
    houses,
    karakas,
    dashas: vimshottari(raw.moon.lon, input.utc, 3),
  };
}
