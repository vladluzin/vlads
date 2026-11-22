import { DateTime } from "luxon";
import tzlookup from "tz-lookup";

export interface BirthMoment {
  /** Local calendar date, YYYY-MM-DD. */
  date: string;
  /** Local clock time, HH:mm. Null when the birth time is unknown. */
  time: string | null;
  /** IANA time zone, e.g. "Asia/Bishkek". Historical offsets and DST come from tzdb. */
  timeZone: string;
}

export interface ResolvedMoment {
  utc: Date;
  /** UTC offset in hours that applied at that moment and place (historical, DST-aware). */
  offsetHours: number;
  timeKnown: boolean;
}

/**
 * Converts a local birth date/time to UTC using the historical rules of the IANA zone.
 * When the time is unknown, local noon is used and `timeKnown` is false so callers can
 * avoid time-sensitive conclusions (ascendant, houses, exact dasha start).
 */
export function resolveMoment(m: BirthMoment): ResolvedMoment {
  const [year, month, day] = m.date.split("-").map(Number);
  const [hour, minute] = (m.time ?? "12:00").split(":").map(Number);
  const local = DateTime.fromObject({ year, month, day, hour, minute }, { zone: m.timeZone });
  if (!local.isValid) throw new Error(`Invalid birth moment: ${local.invalidExplanation ?? "unknown"}`);
  return { utc: local.toUTC().toJSDate(), offsetHours: local.offset / 60, timeKnown: m.time !== null };
}

/** IANA zone for coordinates (offline lookup). */
export function timeZoneFor(latitude: number, longitude: number): string {
  return tzlookup(latitude, longitude);
}

/** Formats a UTC instant in a zone, e.g. for showing transit times to the user. */
export function formatInZone(date: Date, timeZone: string, fmt = "yyyy-MM-dd HH:mm"): string {
  return DateTime.fromJSDate(date, { zone: timeZone }).toFormat(fmt);
}

/** Today's local date (YYYY-MM-DD) and hour in a zone. */
export function localNow(timeZone: string, now = new Date()) {
  const dt = DateTime.fromJSDate(now, { zone: timeZone });
  return { date: dt.toISODate()!, hour: dt.hour, weekday: dt.weekday };
}
