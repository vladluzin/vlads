import { SIGN_LORDS, houseFrom, naturalRelationship, type SevenGraha } from "./constants";
import type { Chart } from "./chart";

/**
 * Ashtakoota (Guna Milan) compatibility, 36 points, computed from both Moons.
 * Convention: `a` is the groom/first partner, `b` the bride/second partner. Several kootas are
 * directional in the classical texts; for same-sex couples or when roles are not given the
 * score is computed both ways and the higher one reported by `ashtakoota`.
 */

export interface KootaScore {
  koota: string;
  score: number;
  max: number;
  detail: string;
}

// Varna rank by Moon sign: 3 Brahmin (water), 2 Kshatriya (fire), 1 Vaishya (earth), 0 Shudra (air).
const VARNA_BY_SIGN = [2, 1, 0, 3, 2, 1, 0, 3, 2, 1, 0, 3];

type VashyaGroup = "quadruped" | "human" | "water" | "wild" | "insect";
function vashyaGroup(sign: number, degree: number): VashyaGroup {
  switch (sign) {
    case 0:
    case 1:
      return "quadruped";
    case 2:
    case 5:
    case 6:
    case 10:
      return "human";
    case 3:
    case 11:
      return "water";
    case 4:
      return "wild";
    case 7:
      return "insect";
    case 8:
      return degree < 15 ? "human" : "quadruped";
    case 9:
      return degree < 15 ? "quadruped" : "water";
    default:
      return "human";
  }
}
const VASHYA_TABLE: Record<VashyaGroup, Record<VashyaGroup, number>> = {
  quadruped: { quadruped: 2, human: 1, water: 1, wild: 0.5, insect: 1 },
  human: { quadruped: 1, human: 2, water: 0.5, wild: 0, insect: 1 },
  water: { quadruped: 1, human: 0.5, water: 2, wild: 1, insect: 1 },
  wild: { quadruped: 0.5, human: 0, water: 1, wild: 2, insect: 0 },
  insect: { quadruped: 1, human: 1, water: 1, wild: 0, insect: 2 },
};

const YONI = [
  "horse", "elephant", "sheep", "serpent", "serpent", "dog", "cat", "sheep", "cat", "rat", "rat", "cow",
  "buffalo", "tiger", "buffalo", "tiger", "deer", "deer", "dog", "monkey", "mongoose", "monkey", "lion",
  "horse", "lion", "cow", "elephant",
];
const YONI_ENEMIES: [string, string][] = [
  ["horse", "buffalo"], ["elephant", "lion"], ["sheep", "monkey"], ["serpent", "mongoose"],
  ["dog", "deer"], ["cat", "rat"], ["cow", "tiger"],
];

const GANA = [
  "deva", "manushya", "rakshasa", "manushya", "deva", "manushya", "deva", "deva", "rakshasa",
  "rakshasa", "manushya", "manushya", "deva", "rakshasa", "deva", "rakshasa", "deva", "rakshasa",
  "rakshasa", "manushya", "manushya", "deva", "rakshasa", "rakshasa", "manushya", "manushya", "deva",
] as const;

const NADI = ["adi", "madhya", "antya", "antya", "madhya", "adi"] as const;
const nadiOf = (nak: number) => NADI[nak % 6];

interface MoonPoint {
  sign: number;
  degree: number;
  nakshatra: number;
}

function kootas(a: MoonPoint, b: MoonPoint): KootaScore[] {
  const out: KootaScore[] = [];

  const va = VARNA_BY_SIGN[a.sign];
  const vb = VARNA_BY_SIGN[b.sign];
  out.push({ koota: "Varna", max: 1, score: va >= vb ? 1 : 0, detail: `varna rank ${va} vs ${vb}` });

  const ga = vashyaGroup(a.sign, a.degree);
  const gb = vashyaGroup(b.sign, b.degree);
  out.push({ koota: "Vashya", max: 2, score: VASHYA_TABLE[ga][gb], detail: `${ga} / ${gb}` });

  const tara = (from: number, to: number) => ((to - from + 27) % 27) % 9;
  const badTara = (n: number) => [2, 4, 6].includes(n); // Vipat, Pratyari, Vadha (0-based)
  const t1 = tara(b.nakshatra, a.nakshatra);
  const t2 = tara(a.nakshatra, b.nakshatra);
  out.push({
    koota: "Tara",
    max: 3,
    score: (badTara(t1) ? 0 : 1.5) + (badTara(t2) ? 0 : 1.5),
    detail: `tara ${t1 + 1} and ${t2 + 1}`,
  });

  const ya = YONI[a.nakshatra];
  const yb = YONI[b.nakshatra];
  const enemies = YONI_ENEMIES.some(([x, y]) => (x === ya && y === yb) || (x === yb && y === ya));
  out.push({
    koota: "Yoni",
    max: 4,
    score: ya === yb ? 4 : enemies ? 0 : 2,
    detail: `${ya} / ${yb}${enemies ? " (sworn enemies)" : ""} — simplified scale: same 4, enemies 0, otherwise 2`,
  });

  const la = SIGN_LORDS[a.sign];
  const lb = SIGN_LORDS[b.sign];
  let maitri: number;
  if (la === lb) maitri = 5;
  else {
    const r1 = naturalRelationship(la as SevenGraha, lb as SevenGraha);
    const r2 = naturalRelationship(lb as SevenGraha, la as SevenGraha);
    const key = [r1, r2].sort().join("+");
    maitri =
      { "friend+friend": 5, "friend+neutral": 4, "neutral+neutral": 3, "enemy+friend": 1, "enemy+neutral": 0.5, "enemy+enemy": 0 }[key] ?? 0;
  }
  out.push({ koota: "Graha Maitri", max: 5, score: maitri, detail: `${la} / ${lb}` });

  const gna = GANA[a.nakshatra];
  const gnb = GANA[b.nakshatra];
  let gana = 0;
  if (gna === gnb) gana = 6;
  else if (gna === "deva" && gnb === "manushya") gana = 6;
  else if (gna === "manushya" && gnb === "deva") gana = 5;
  else if (gna === "deva" && gnb === "rakshasa") gana = 1;
  out.push({ koota: "Gana", max: 6, score: gana, detail: `${gna} / ${gnb}` });

  const dist = houseFrom(b.sign, a.sign);
  const badBhakoot = [2, 12, 5, 9, 6, 8].includes(dist);
  out.push({ koota: "Bhakoot", max: 7, score: badBhakoot ? 0 : 7, detail: `signs ${dist}/${((14 - dist) % 12) || 12} apart` });

  const na = nadiOf(a.nakshatra);
  const nb = nadiOf(b.nakshatra);
  out.push({ koota: "Nadi", max: 8, score: na === nb ? 0 : 8, detail: `${na} / ${nb}${na === nb ? " (Nadi dosha)" : ""}` });

  return out;
}

const moonPoint = (c: Chart): MoonPoint => ({
  sign: c.planets.moon.sign,
  degree: c.planets.moon.degree,
  nakshatra: c.planets.moon.nakshatra.index,
});

/** Mangal (Kuja) dosha: Mars in houses 1, 2, 4, 7, 8 or 12 from the ascendant, Moon or Venus. */
export function mangalDosha(c: Chart) {
  const houses = [1, 2, 4, 7, 8, 12];
  const from = {
    ascendant: c.input.timeKnown ? c.planets.mars.house : null,
    moon: houseFrom(c.planets.moon.sign, c.planets.mars.sign),
    venus: houseFrom(c.planets.venus.sign, c.planets.mars.sign),
  };
  const present = Object.entries(from).filter(([, h]) => h !== null && houses.includes(h)).map(([k]) => k);
  return { present: present.length > 0, from: present, marsHouse: from };
}

export function ashtakoota(a: Chart, b: Chart, directional = true) {
  const forward = kootas(moonPoint(a), moonPoint(b));
  const total = (k: KootaScore[]) => k.reduce((s, x) => s + x.score, 0);
  let chosen = forward;
  if (!directional) {
    const backward = kootas(moonPoint(b), moonPoint(a));
    if (total(backward) > total(forward)) chosen = backward;
  }
  const score = total(chosen);
  return {
    kootas: chosen,
    total: score,
    max: 36,
    verdict: score >= 28 ? "excellent" : score >= 18 ? "acceptable" : "weak",
    mangal: { a: mangalDosha(a), b: mangalDosha(b) },
  };
}
