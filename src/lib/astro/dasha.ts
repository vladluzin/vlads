import { NAKSHATRA_SPAN, VIMSHOTTARI, norm360, type Graha } from "./constants";

/** Year length used to convert dasha years to days. 365.25 (Julian) is the common default. */
export const DASHA_YEAR_DAYS = 365.25;
const DAY_MS = 86400000;

export interface DashaPeriod {
  lord: Graha;
  start: Date;
  end: Date;
  /** Sub-periods (antardasha within mahadasha, pratyantardasha within antardasha). */
  sub?: DashaPeriod[];
}

const orderFrom = (lord: Graha) => {
  const i = VIMSHOTTARI.findIndex((d) => d.lord === lord);
  return [...VIMSHOTTARI.slice(i), ...VIMSHOTTARI.slice(0, i)];
};

/** Splits a period into the nine sub-periods proportional to Vimshottari years. */
function subdivide(lord: Graha, start: Date, end: Date): DashaPeriod[] {
  const total = end.getTime() - start.getTime();
  let t = start.getTime();
  return orderFrom(lord).map((d) => {
    const len = (total * d.years) / 120;
    const p = { lord: d.lord, start: new Date(t), end: new Date(t + len) };
    t += len;
    return p;
  });
}

/**
 * Vimshottari mahadashas from the Moon's sidereal longitude at birth, with antardashas and
 * pratyantardashas. The first mahadasha starts before birth; its elapsed part is derived
 * from how far the Moon has travelled through its nakshatra.
 */
export function vimshottari(moonLon: number, birth: Date, levels: 1 | 2 | 3 = 3): DashaPeriod[] {
  const lon = norm360(moonLon);
  const nak = Math.floor(lon / NAKSHATRA_SPAN);
  const traversed = (lon - nak * NAKSHATRA_SPAN) / NAKSHATRA_SPAN;
  const first = VIMSHOTTARI[nak % 9];
  const yearMs = DASHA_YEAR_DAYS * DAY_MS;
  let t = birth.getTime() - traversed * first.years * yearMs;
  const out: DashaPeriod[] = [];
  // Two full cycles cover any realistic lifespan.
  for (const d of [...orderFrom(first.lord), ...orderFrom(first.lord)]) {
    const start = new Date(t);
    const end = new Date(t + d.years * yearMs);
    const maha: DashaPeriod = { lord: d.lord, start, end };
    if (levels >= 2) {
      maha.sub = subdivide(d.lord, start, end);
      if (levels >= 3) for (const a of maha.sub) a.sub = subdivide(a.lord, a.start, a.end);
    }
    out.push(maha);
    t = end.getTime();
    if (t - birth.getTime() > 120 * yearMs) break;
  }
  return out;
}

export interface ActiveDasha {
  maha: DashaPeriod;
  antar: DashaPeriod;
  pratyantar: DashaPeriod;
}

const containing = (periods: DashaPeriod[] | undefined, at: Date) =>
  periods?.find((p) => p.start.getTime() <= at.getTime() && at.getTime() < p.end.getTime());

export function activeDasha(periods: DashaPeriod[], at: Date): ActiveDasha | null {
  const maha = containing(periods, at);
  const antar = containing(maha?.sub, at);
  const pratyantar = containing(antar?.sub, at);
  if (!maha || !antar || !pratyantar) return null;
  return { maha, antar, pratyantar };
}

/** Dasha boundaries (any level) falling inside [from, to), soonest first. */
export function upcomingDashaChanges(periods: DashaPeriod[], from: Date, to: Date) {
  const changes: { level: "maha" | "antar" | "pratyantar"; lord: Graha; parent: Graha[]; start: Date }[] = [];
  const inRange = (d: Date) => d.getTime() >= from.getTime() && d.getTime() < to.getTime();
  for (const m of periods) {
    if (inRange(m.start)) changes.push({ level: "maha", lord: m.lord, parent: [], start: m.start });
    for (const a of m.sub ?? []) {
      if (inRange(a.start)) changes.push({ level: "antar", lord: a.lord, parent: [m.lord], start: a.start });
      for (const p of a.sub ?? [])
        if (inRange(p.start)) changes.push({ level: "pratyantar", lord: p.lord, parent: [m.lord, a.lord], start: p.start });
    }
  }
  return changes.sort((x, y) => x.start.getTime() - y.start.getTime());
}
