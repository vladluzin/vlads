export * from "./constants";
export * from "./ephemeris";
export * from "./chart";
export * from "./vargas";
export * from "./dasha";
export * from "./yogas";
export * from "./transits";
export * from "./panchanga";
export * from "./compatibility";
export * from "./describe";

import { resolveMoment } from "../geo/time";
import { computeChart, DEFAULT_SETTINGS, type Chart, type ChartSettings } from "./chart";

export interface BirthData {
  date: string;
  time: string | null;
  timeZone: string;
  latitude: number;
  longitude: number;
  placeLabel: string;
}

/** Birth data (local time + place) → computed chart and a readable birth label. */
export function chartFromBirth(b: BirthData, settings: ChartSettings = DEFAULT_SETTINGS): { chart: Chart; label: string } {
  const m = resolveMoment({ date: b.date, time: b.time, timeZone: b.timeZone });
  const chart = computeChart({ utc: m.utc, latitude: b.latitude, longitude: b.longitude, timeKnown: m.timeKnown }, settings);
  const off = m.offsetHours >= 0 ? `+${m.offsetHours}` : `${m.offsetHours}`;
  const coords = `${Math.abs(b.latitude).toFixed(2)}${b.latitude >= 0 ? "N" : "S"} ${Math.abs(b.longitude).toFixed(2)}${b.longitude >= 0 ? "E" : "W"}`;
  const label = `${b.date} ${b.time ?? "time unknown"} local (UTC${off}, ${b.timeZone}), ${b.placeLabel}, ${coords}`;
  return { chart, label };
}
