import * as A from "astronomy-engine";
import { norm360, type Body } from "./constants";

/**
 * Positions are computed with astronomy-engine (VSOP87 / ELP-based, ~1 arcminute or better
 * for the classical planets) and converted to the sidereal zodiac with the Lahiri
 * (Chitrapaksha) ayanamsa.
 *
 * Sidereal frame: the fixed-star zodiac does not precess, so a longitude measured on the
 * J2000 mean ecliptic differs from the sidereal longitude by a constant (the ayanamsa at
 * J2000). Quantities defined on the mean equinox of date (mean node, ascendant) use the
 * time-dependent ayanamsa instead. Both routes agree to arcseconds.
 */

const J2000 = 2451545.0;

/** IAU 2006 general precession in longitude, arcseconds, T in Julian centuries TT from J2000. */
function precessionLongitudeArcsec(T: number): number {
  return 5028.796195 * T + 1.1054348 * T * T + 0.00007964 * T ** 3 - 0.000023857 * T ** 4;
}

export type Ayanamsa = "lahiri" | "raman" | "krishnamurti";

/**
 * Mean ayanamsa values at their reference epochs (Swiss Ephemeris definitions, mean values,
 * i.e. without nutation).
 */
const AYANAMSA_DEF: Record<Ayanamsa, { jd: number; value: number }> = {
  lahiri: { jd: 2435553.5, value: 23.250182778 - 0.004658035 },
  raman: { jd: J2000, value: 22.410791 },
  krishnamurti: { jd: J2000, value: 23.757592 },
};

/** Mean ayanamsa (degrees) at Julian centuries T from J2000. */
export function ayanamsa(T: number, kind: Ayanamsa = "lahiri"): number {
  const def = AYANAMSA_DEF[kind];
  const T0 = (def.jd - J2000) / 36525;
  return def.value + (precessionLongitudeArcsec(T) - precessionLongitudeArcsec(T0)) / 3600;
}

const ECL_J2000 = A.Rotation_EQJ_ECL();

function eclipticJ2000Longitude(eqj: A.Vector): { lon: number; lat: number } {
  const v = A.RotateVector(ECL_J2000, eqj);
  const lon = norm360((Math.atan2(v.y, v.x) * 180) / Math.PI);
  const lat = (Math.atan2(v.z, Math.hypot(v.x, v.y)) * 180) / Math.PI;
  return { lon, lat };
}

const AE_BODY: Record<Exclude<Body, "rahu" | "ketu">, A.Body> = {
  sun: A.Body.Sun,
  moon: A.Body.Moon,
  mars: A.Body.Mars,
  mercury: A.Body.Mercury,
  jupiter: A.Body.Jupiter,
  venus: A.Body.Venus,
  saturn: A.Body.Saturn,
  uranus: A.Body.Uranus,
  neptune: A.Body.Neptune,
  pluto: A.Body.Pluto,
};

/** Julian Day (UT) of a JS Date. */
export const julianDayUT = (date: Date) => date.getTime() / 86400000 + 2440587.5;

function centuriesTT(date: Date): number {
  const t = A.MakeTime(date);
  return t.tt / 36525; // astronomy-engine `tt` is days since J2000 TT
}

export type NodeType = "mean" | "true";

/** Mean lunar ascending node, tropical, mean equinox of date (Meeus 47.7). */
function meanNodeTropical(T: number): number {
  return norm360(125.0445479 - 1934.1362891 * T + 0.0020754 * T * T + T ** 3 / 467441 - T ** 4 / 60616000);
}

/**
 * True (osculating) node, sidereal: the line where the Moon's instantaneous orbital plane
 * (from its geocentric position and velocity) crosses the J2000 ecliptic. This is the same
 * definition Swiss Ephemeris uses for its "true node".
 */
function trueNodeSidereal(date: Date, ayan: Ayanamsa): number {
  const s = A.GeoMoonState(date);
  const r = A.RotateVector(ECL_J2000, new A.Vector(s.x, s.y, s.z, s.t));
  const v = A.RotateVector(ECL_J2000, new A.Vector(s.vx, s.vy, s.vz, s.t));
  // Orbital angular momentum h = r × v; ascending node direction = ẑ × h.
  const hx = r.y * v.z - r.z * v.y;
  const hy = r.z * v.x - r.x * v.z;
  const lon = norm360((Math.atan2(hx, -hy) * 180) / Math.PI);
  return norm360(lon - ayanamsa(0, ayan));
}

export interface BodyPosition {
  /** Sidereal longitude, degrees [0, 360). */
  lon: number;
  /** Ecliptic latitude, degrees (0 for nodes). */
  lat: number;
  /** Daily motion in longitude, degrees/day (negative = retrograde). */
  speed: number;
}

function siderealLongitudeAt(body: Body, date: Date, ayan: Ayanamsa, node: NodeType): { lon: number; lat: number } {
  if (body === "rahu" || body === "ketu") {
    const T = centuriesTT(date);
    const rahu = node === "true" ? trueNodeSidereal(date, ayan) : norm360(meanNodeTropical(T) - ayanamsa(T, ayan));
    return { lon: body === "rahu" ? rahu : norm360(rahu + 180), lat: 0 };
  }
  const vec = body === "moon" ? A.GeoMoon(date) : A.GeoVector(AE_BODY[body], date, true);
  const { lon, lat } = eclipticJ2000Longitude(vec);
  return { lon: norm360(lon - ayanamsa(0, ayan)), lat };
}

/** Signed smallest difference b - a in degrees, in (-180, 180]. */
export function angleDiff(a: number, b: number): number {
  let d = norm360(b - a);
  if (d > 180) d -= 360;
  return d;
}

export function bodyPosition(body: Body, date: Date, ayan: Ayanamsa = "lahiri", node: NodeType = "mean"): BodyPosition {
  const now = siderealLongitudeAt(body, date, ayan, node);
  const h = body === "moon" ? 1 / 24 : 0.5; // days
  const before = siderealLongitudeAt(body, new Date(date.getTime() - h * 86400000), ayan, node);
  const after = siderealLongitudeAt(body, new Date(date.getTime() + h * 86400000), ayan, node);
  const speed = angleDiff(before.lon, after.lon) / (2 * h);
  return { lon: now.lon, lat: now.lat, speed };
}

/** Greenwich mean sidereal time in degrees (IAU 1982), from UT. */
function gmstDegrees(date: Date): number {
  const jd = julianDayUT(date);
  const T = (jd - J2000) / 36525;
  return norm360(280.46061837 + 360.98564736629 * (jd - J2000) + 0.000387933 * T * T - (T ** 3) / 38710000);
}

/** Mean obliquity of the ecliptic (IAU 2006), degrees. */
function meanObliquity(T: number): number {
  const sec = 84381.406 - 46.836769 * T - 0.0001831 * T * T + 0.0020034 * T ** 3;
  return sec / 3600;
}

export interface Angles {
  /** Sidereal ascendant (lagna) longitude. */
  ascendant: number;
  /** Sidereal midheaven (MC) longitude. */
  midheaven: number;
  /** Local mean sidereal time, degrees (RAMC). */
  ramc: number;
}

/** Ascendant and MC for geographic latitude/longitude (east positive). */
export function angles(date: Date, latitude: number, longitude: number, ayan: Ayanamsa = "lahiri"): Angles {
  const T = centuriesTT(date);
  const ramc = norm360(gmstDegrees(date) + longitude);
  const eps = (meanObliquity(T) * Math.PI) / 180;
  const r = (ramc * Math.PI) / 180;
  const phi = (latitude * Math.PI) / 180;
  const ascTrop = norm360(
    (Math.atan2(Math.cos(r), -(Math.sin(r) * Math.cos(eps) + Math.tan(phi) * Math.sin(eps))) * 180) / Math.PI,
  );
  const mcTrop = norm360((Math.atan2(Math.sin(r), Math.cos(r) * Math.cos(eps)) * 180) / Math.PI);
  const ay = ayanamsa(T, ayan);
  return { ascendant: norm360(ascTrop - ay), midheaven: norm360(mcTrop - ay), ramc };
}

/** Sunrise/sunset (UTC) at a location for the civil day containing `date`. */
export function sunriseSunset(date: Date, latitude: number, longitude: number) {
  const observer = new A.Observer(latitude, longitude, 0);
  const startOfDay = new Date(date.getTime() - 12 * 3600 * 1000);
  const rise = A.SearchRiseSet(A.Body.Sun, observer, +1, startOfDay, 2);
  const set = A.SearchRiseSet(A.Body.Sun, observer, -1, startOfDay, 2);
  return { sunrise: rise?.date ?? null, sunset: set?.date ?? null };
}
