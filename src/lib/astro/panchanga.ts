import { NAKSHATRAS, NAKSHATRA_SPAN, norm360 } from "./constants";
import { bodyPosition, sunriseSunset } from "./ephemeris";

const TITHI_NAMES = [
  "Pratipada", "Dvitiya", "Tritiya", "Chaturthi", "Panchami", "Shashthi", "Saptami", "Ashtami",
  "Navami", "Dashami", "Ekadashi", "Dvadashi", "Trayodashi", "Chaturdashi",
];
const YOGA_NAMES = [
  "Vishkambha", "Priti", "Ayushman", "Saubhagya", "Shobhana", "Atiganda", "Sukarma", "Dhriti",
  "Shula", "Ganda", "Vriddhi", "Dhruva", "Vyaghata", "Harshana", "Vajra", "Siddhi", "Vyatipata",
  "Variyana", "Parigha", "Shiva", "Siddha", "Sadhya", "Shubha", "Shukla", "Brahma", "Indra", "Vaidhriti",
];
const KARANA_MOVABLE = ["Bava", "Balava", "Kaulava", "Taitila", "Garaja", "Vanija", "Vishti"];
const VARA = ["Sunday (Sun)", "Monday (Moon)", "Tuesday (Mars)", "Wednesday (Mercury)", "Thursday (Jupiter)", "Friday (Venus)", "Saturday (Saturn)"];

export interface Panchanga {
  tithi: { index: number; name: string; paksha: "shukla" | "krishna" };
  nakshatra: { index: number; name: string };
  yoga: { index: number; name: string };
  karana: string;
  vara: string;
  sunrise: Date | null;
  sunset: Date | null;
}

export function panchanga(at: Date, latitude: number, longitude: number, weekday: number): Panchanga {
  const sun = bodyPosition("sun", at).lon;
  const moon = bodyPosition("moon", at).lon;
  const elong = norm360(moon - sun);
  const tithiIdx = Math.floor(elong / 12); // 0..29
  const paksha = tithiIdx < 15 ? "shukla" : "krishna";
  const inPaksha = tithiIdx % 15;
  const tithiName = inPaksha === 14 ? (paksha === "shukla" ? "Purnima" : "Amavasya") : TITHI_NAMES[inPaksha];
  const nakIdx = Math.floor(moon / NAKSHATRA_SPAN);
  const yogaIdx = Math.floor(norm360(sun + moon) / NAKSHATRA_SPAN);
  const karanaIdx = Math.floor(elong / 6); // 0..59
  let karana: string;
  if (karanaIdx === 0) karana = "Kimstughna";
  else if (karanaIdx >= 57) karana = ["Shakuni", "Chatushpada", "Naga"][karanaIdx - 57];
  else karana = KARANA_MOVABLE[(karanaIdx - 1) % 7];
  const { sunrise, sunset } = sunriseSunset(at, latitude, longitude);
  return {
    tithi: { index: tithiIdx + 1, name: tithiName, paksha },
    nakshatra: { index: nakIdx, name: NAKSHATRAS[nakIdx].en },
    yoga: { index: yogaIdx, name: YOGA_NAMES[yogaIdx] },
    karana,
    vara: VARA[weekday % 7],
    sunrise,
    sunset,
  };
}
