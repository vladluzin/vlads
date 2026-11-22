// Reference tables for sidereal (Vedic / Jyotish) astrology.
// Indices: signs 0 = Aries … 11 = Pisces; nakshatras 0 = Ashwini … 26 = Revati.

export const GRAHAS = [
  "sun",
  "moon",
  "mars",
  "mercury",
  "jupiter",
  "venus",
  "saturn",
  "rahu",
  "ketu",
] as const;
export type Graha = (typeof GRAHAS)[number];

export const OUTER_PLANETS = ["uranus", "neptune", "pluto"] as const;
export type OuterPlanet = (typeof OUTER_PLANETS)[number];
export type Body = Graha | OuterPlanet;

/** The seven visible grahas used for karakas, dignities and friendships. */
export const SEVEN_GRAHAS = ["sun", "moon", "mars", "mercury", "jupiter", "venus", "saturn"] as const;
export type SevenGraha = (typeof SEVEN_GRAHAS)[number];

export const GRAHA_NAMES: Record<Body, { en: string; ru: string; sa: string; abbr: string }> = {
  sun: { en: "Sun", ru: "Солнце", sa: "Surya", abbr: "Su" },
  moon: { en: "Moon", ru: "Луна", sa: "Chandra", abbr: "Mo" },
  mars: { en: "Mars", ru: "Марс", sa: "Mangala", abbr: "Ma" },
  mercury: { en: "Mercury", ru: "Меркурий", sa: "Budha", abbr: "Me" },
  jupiter: { en: "Jupiter", ru: "Юпитер", sa: "Guru", abbr: "Ju" },
  venus: { en: "Venus", ru: "Венера", sa: "Shukra", abbr: "Ve" },
  saturn: { en: "Saturn", ru: "Сатурн", sa: "Shani", abbr: "Sa" },
  rahu: { en: "Rahu", ru: "Раху", sa: "Rahu", abbr: "Ra" },
  ketu: { en: "Ketu", ru: "Кету", sa: "Ketu", abbr: "Ke" },
  uranus: { en: "Uranus", ru: "Уран", sa: "Uranus", abbr: "Ur" },
  neptune: { en: "Neptune", ru: "Нептун", sa: "Neptune", abbr: "Ne" },
  pluto: { en: "Pluto", ru: "Плутон", sa: "Pluto", abbr: "Pl" },
};

export const SIGNS = [
  { en: "Aries", ru: "Овен", sa: "Mesha" },
  { en: "Taurus", ru: "Телец", sa: "Vrishabha" },
  { en: "Gemini", ru: "Близнецы", sa: "Mithuna" },
  { en: "Cancer", ru: "Рак", sa: "Karka" },
  { en: "Leo", ru: "Лев", sa: "Simha" },
  { en: "Virgo", ru: "Дева", sa: "Kanya" },
  { en: "Libra", ru: "Весы", sa: "Tula" },
  { en: "Scorpio", ru: "Скорпион", sa: "Vrishchika" },
  { en: "Sagittarius", ru: "Стрелец", sa: "Dhanu" },
  { en: "Capricorn", ru: "Козерог", sa: "Makara" },
  { en: "Aquarius", ru: "Водолей", sa: "Kumbha" },
  { en: "Pisces", ru: "Рыбы", sa: "Meena" },
] as const;

export const SIGN_LORDS: SevenGraha[] = [
  "mars",
  "venus",
  "mercury",
  "moon",
  "sun",
  "mercury",
  "venus",
  "mars",
  "jupiter",
  "saturn",
  "saturn",
  "jupiter",
];

export type Modality = "movable" | "fixed" | "dual";
export const signModality = (sign: number): Modality =>
  (["movable", "fixed", "dual"] as const)[sign % 3];
export type Element = "fire" | "earth" | "air" | "water";
export const signElement = (sign: number): Element =>
  (["fire", "earth", "air", "water"] as const)[sign % 4];
/** Odd signs in the 1-based sense (Aries, Gemini, …) are index 0, 2, 4 … */
export const isOddSign = (sign: number) => sign % 2 === 0;

export const NAKSHATRA_SPAN = 360 / 27; // 13°20'
export const PADA_SPAN = NAKSHATRA_SPAN / 4; // 3°20'

export const NAKSHATRAS = [
  { en: "Ashwini", ru: "Ашвини", lord: "ketu", deity: "Ashwini Kumaras" },
  { en: "Bharani", ru: "Бхарани", lord: "venus", deity: "Yama" },
  { en: "Krittika", ru: "Криттика", lord: "sun", deity: "Agni" },
  { en: "Rohini", ru: "Рохини", lord: "moon", deity: "Brahma" },
  { en: "Mrigashira", ru: "Мригашира", lord: "mars", deity: "Soma" },
  { en: "Ardra", ru: "Ардра", lord: "rahu", deity: "Rudra" },
  { en: "Punarvasu", ru: "Пунарвасу", lord: "jupiter", deity: "Aditi" },
  { en: "Pushya", ru: "Пушья", lord: "saturn", deity: "Brihaspati" },
  { en: "Ashlesha", ru: "Ашлеша", lord: "mercury", deity: "Nagas" },
  { en: "Magha", ru: "Магха", lord: "ketu", deity: "Pitris" },
  { en: "Purva Phalguni", ru: "Пурва Пхалгуни", lord: "venus", deity: "Bhaga" },
  { en: "Uttara Phalguni", ru: "Уттара Пхалгуни", lord: "sun", deity: "Aryaman" },
  { en: "Hasta", ru: "Хаста", lord: "moon", deity: "Savitar" },
  { en: "Chitra", ru: "Читра", lord: "mars", deity: "Tvashtar" },
  { en: "Swati", ru: "Свати", lord: "rahu", deity: "Vayu" },
  { en: "Vishakha", ru: "Вишакха", lord: "jupiter", deity: "Indra-Agni" },
  { en: "Anuradha", ru: "Анурадха", lord: "saturn", deity: "Mitra" },
  { en: "Jyeshtha", ru: "Джьештха", lord: "mercury", deity: "Indra" },
  { en: "Mula", ru: "Мула", lord: "ketu", deity: "Nirriti" },
  { en: "Purva Ashadha", ru: "Пурва Ашадха", lord: "venus", deity: "Apas" },
  { en: "Uttara Ashadha", ru: "Уттара Ашадха", lord: "sun", deity: "Vishvadevas" },
  { en: "Shravana", ru: "Шравана", lord: "moon", deity: "Vishnu" },
  { en: "Dhanishta", ru: "Дхаништха", lord: "mars", deity: "Vasus" },
  { en: "Shatabhisha", ru: "Шатабхиша", lord: "rahu", deity: "Varuna" },
  { en: "Purva Bhadrapada", ru: "Пурва Бхадрапада", lord: "jupiter", deity: "Aja Ekapada" },
  { en: "Uttara Bhadrapada", ru: "Уттара Бхадрапада", lord: "saturn", deity: "Ahir Budhnya" },
  { en: "Revati", ru: "Ревати", lord: "mercury", deity: "Pushan" },
] as const satisfies ReadonlyArray<{ en: string; ru: string; lord: Graha; deity: string }>;

/** Vimshottari mahadasha order and length in years (total 120). */
export const VIMSHOTTARI: ReadonlyArray<{ lord: Graha; years: number }> = [
  { lord: "ketu", years: 7 },
  { lord: "venus", years: 20 },
  { lord: "sun", years: 6 },
  { lord: "moon", years: 10 },
  { lord: "mars", years: 7 },
  { lord: "rahu", years: 18 },
  { lord: "jupiter", years: 16 },
  { lord: "saturn", years: 19 },
  { lord: "mercury", years: 17 },
];

/** Exaltation sign and degree of deepest exaltation. Debilitation is the opposite point. */
export const EXALTATION: Record<SevenGraha, { sign: number; degree: number }> = {
  sun: { sign: 0, degree: 10 },
  moon: { sign: 1, degree: 3 },
  mars: { sign: 9, degree: 28 },
  mercury: { sign: 5, degree: 15 },
  jupiter: { sign: 3, degree: 5 },
  venus: { sign: 11, degree: 27 },
  saturn: { sign: 6, degree: 20 },
};

/** Common (Parashari) convention for the nodes; other schools differ. */
export const NODE_EXALTATION: Record<"rahu" | "ketu", number> = { rahu: 1, ketu: 7 };

export const MOOLATRIKONA: Record<SevenGraha, { sign: number; from: number; to: number }> = {
  sun: { sign: 4, from: 0, to: 20 },
  moon: { sign: 1, from: 3, to: 30 },
  mars: { sign: 0, from: 0, to: 12 },
  mercury: { sign: 5, from: 15, to: 20 },
  jupiter: { sign: 8, from: 0, to: 10 },
  venus: { sign: 6, from: 0, to: 15 },
  saturn: { sign: 10, from: 0, to: 20 },
};

/** Naisargika (natural) relationships. */
export const NATURAL_FRIENDS: Record<SevenGraha, { friends: SevenGraha[]; enemies: SevenGraha[] }> = {
  sun: { friends: ["moon", "mars", "jupiter"], enemies: ["venus", "saturn"] },
  moon: { friends: ["sun", "mercury"], enemies: [] },
  mars: { friends: ["sun", "moon", "jupiter"], enemies: ["mercury"] },
  mercury: { friends: ["sun", "venus"], enemies: ["moon"] },
  jupiter: { friends: ["sun", "moon", "mars"], enemies: ["mercury", "venus"] },
  venus: { friends: ["mercury", "saturn"], enemies: ["sun", "moon"] },
  saturn: { friends: ["mercury", "venus"], enemies: ["sun", "moon", "mars"] },
};

export type Relationship = "friend" | "neutral" | "enemy";
export function naturalRelationship(of: SevenGraha, toward: SevenGraha): Relationship {
  const r = NATURAL_FRIENDS[of];
  if (r.friends.includes(toward)) return "friend";
  if (r.enemies.includes(toward)) return "enemy";
  return "neutral";
}

/** Combustion orbs in degrees from the Sun (retrograde orb where it differs). */
export const COMBUSTION_ORB: Partial<Record<Graha, { direct: number; retro: number }>> = {
  moon: { direct: 12, retro: 12 },
  mars: { direct: 17, retro: 17 },
  mercury: { direct: 14, retro: 12 },
  jupiter: { direct: 11, retro: 11 },
  venus: { direct: 10, retro: 8 },
  saturn: { direct: 15, retro: 15 },
};

/** Special (graha drishti) aspects, counted as houses from the planet; all grahas aspect the 7th. */
export const SPECIAL_ASPECTS: Partial<Record<Graha, number[]>> = {
  mars: [4, 8],
  jupiter: [5, 9],
  saturn: [3, 10],
};

export const KARAKA_NAMES = [
  { code: "AK", en: "Atmakaraka (self, soul)", ru: "Атмакарака (душа, «я»)" },
  { code: "AmK", en: "Amatyakaraka (career, counsel)", ru: "Аматьякарака (карьера, советник)" },
  { code: "BK", en: "Bhratrikaraka (siblings, courage)", ru: "Бхратрикарака (братья/сёстры, смелость)" },
  { code: "MK", en: "Matrikaraka (mother, home)", ru: "Матрикарака (мать, дом)" },
  { code: "PK", en: "Putrakaraka (children, creativity)", ru: "Путракарака (дети, творчество)" },
  { code: "GK", en: "Gnatikaraka (rivals, obstacles)", ru: "Гнатикарака (соперники, препятствия)" },
  { code: "DK", en: "Darakaraka (spouse, partners)", ru: "Даракарака (супруг, партнёры)" },
] as const;

export const HOUSE_MEANINGS: { en: string; ru: string }[] = [
  { en: "self, body, temperament", ru: "личность, тело, темперамент" },
  { en: "wealth, family, speech", ru: "финансы, семья, речь" },
  { en: "courage, siblings, initiative", ru: "смелость, братья/сёстры, инициатива" },
  { en: "home, mother, inner peace", ru: "дом, мать, внутренний покой" },
  { en: "creativity, children, intellect", ru: "творчество, дети, интеллект" },
  { en: "work, health, conflicts", ru: "работа, здоровье, конфликты" },
  { en: "partnership, marriage", ru: "партнёрство, брак" },
  { en: "transformation, crises, hidden matters", ru: "трансформация, кризисы, скрытое" },
  { en: "dharma, teachers, luck", ru: "дхарма, учителя, удача" },
  { en: "career, status, public life", ru: "карьера, статус, общественная жизнь" },
  { en: "gains, friends, aspirations", ru: "доходы, друзья, стремления" },
  { en: "loss, solitude, liberation, foreign lands", ru: "потери, уединение, освобождение, заграница" },
];

export const KENDRAS = [1, 4, 7, 10];
export const TRIKONAS = [1, 5, 9];
export const DUSTHANAS = [6, 8, 12];

export const norm360 = (x: number) => ((x % 360) + 360) % 360;
export const signOf = (lon: number) => Math.floor(norm360(lon) / 30);
export const degInSign = (lon: number) => norm360(lon) % 30;
/** House number (1-12) of `sign` counted from `fromSign` (whole-sign). */
export const houseFrom = (fromSign: number, sign: number) => ((sign - fromSign + 12) % 12) + 1;

export function formatDms(deg: number): string {
  const total = Math.round(deg * 3600);
  const d = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${d}°${String(m).padStart(2, "0")}'${String(s).padStart(2, "0")}"`;
}
