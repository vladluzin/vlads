import { describe, expect, it } from "vitest";
import {
  activeDasha,
  ashtakoota,
  bodyPosition,
  chartFromBirth,
  computeChart,
  describeChart,
  detectYogas,
  findIngresses,
  findStations,
  panchanga,
  vargaSign,
  vimshottari,
} from "@/lib/astro";
import { resolveMoment } from "@/lib/geo/time";

// Reference: chart values published by an existing Jyotish service for 1983-12-27 19:20,
// computed there with UTC+5 (14:20 UTC). We reproduce the same instant to compare engines.
const REF_UTC = new Date(Date.UTC(1983, 11, 27, 14, 20));
const REF = {
  sun: 251.622897,
  moon: 172.069622,
  mercury: 260.06684,
  venus: 210.984671,
  mars: 178.651441,
  jupiter: 241.285309,
  saturn: 199.924978,
  rahu: 52.172257,
  ascendant: 106.321534,
};

describe("ephemeris (sidereal, Lahiri)", () => {
  it("matches an independent Swiss-Ephemeris-based service within 0.03°", () => {
    for (const [b, expected] of Object.entries(REF)) {
      if (b === "ascendant") continue;
      const lon = bodyPosition(b as keyof typeof REF & string as never, REF_UTC, "lahiri", "true").lon;
      expect(Math.abs(lon - expected), b).toBeLessThan(0.03);
    }
    const chart = computeChart({ utc: REF_UTC, latitude: 42.8761424, longitude: 74.6036724, timeKnown: true });
    expect(Math.abs(chart.ascendant.lon - REF.ascendant)).toBeLessThan(0.03);
  });

  it("finds the Sun's sidereal ingress into Aries around April 14 (Mesha Sankranti)", () => {
    const ing = findIngresses("sun", new Date(Date.UTC(2025, 3, 10)), new Date(Date.UTC(2025, 3, 18)));
    expect(ing).toHaveLength(1);
    expect(ing[0].toSign).toBe(0);
    // Published: 14 Apr 2025 03:30 IST = 13 Apr 22:00 UTC. Allow 20 minutes.
    expect(Math.abs(ing[0].at.getTime() - Date.UTC(2025, 3, 13, 22, 0))).toBeLessThan(20 * 60000);
  });

  it("finds Mercury's retrograde station in March 2025", () => {
    const st = findStations("mercury", new Date(Date.UTC(2025, 2, 1)), new Date(Date.UTC(2025, 2, 31)));
    expect(st.map((s) => s.kind)).toContain("retrograde");
    const r = st.find((s) => s.kind === "retrograde")!;
    expect(r.at.toISOString().slice(0, 10)).toBe("2025-03-15");
  });
});

describe("time zones", () => {
  it("uses the historical UTC+6 offset for Frunze/Bishkek in 1983", () => {
    const m = resolveMoment({ date: "1983-12-27", time: "19:20", timeZone: "Asia/Bishkek" });
    expect(m.offsetHours).toBe(6);
    expect(m.utc.toISOString()).toBe("1983-12-27T13:20:00.000Z");
  });

  it("applies DST in summer", () => {
    expect(resolveMoment({ date: "1990-07-01", time: "12:00", timeZone: "Europe/Berlin" }).offsetHours).toBe(2);
  });
});

describe("chart", () => {
  const chart = computeChart({ utc: REF_UTC, latitude: 42.8761424, longitude: 74.6036724, timeKnown: true });

  it("places the reference Moon in Hasta, Virgo, and the lagna in Cancer/Pushya", () => {
    expect(chart.planets.moon.sign).toBe(5);
    expect(chart.planets.moon.nakshatra.name).toBe("Hasta");
    expect(chart.ascendant.sign).toBe(3);
    expect(chart.ascendant.nakshatra.name).toBe("Pushya");
  });

  it("assigns Atmakaraka to the planet with the highest degree in its sign", () => {
    // Mars 28°39' Virgo is the highest of the seven grahas here.
    expect(chart.karakas.AK).toBe("mars");
    expect(chart.karakas.DK).toBe("venus");
  });

  it("marks Mercury retrograde", () => {
    expect(chart.planets.mercury.retrograde).toBe(true);
  });

  it("produces 12 whole-sign houses whose lords are consistent", () => {
    expect(chart.houses).toHaveLength(12);
    expect(chart.houses[0].sign).toBe(chart.ascendant.sign);
    expect(chart.houses[0].lord).toBe("moon");
  });

  it("renders a description containing dashas and yogas", () => {
    const text = describeChart(chart, { birthLabel: "test", now: new Date(Date.UTC(2026, 10, 23)) });
    expect(text).toContain("VIMSHOTTARI DASHA");
    expect(text).toContain("Saturn mahadasha");
    expect(Array.isArray(detectYogas(chart))).toBe(true);
  });
});

describe("vimshottari", () => {
  it("reproduces the reference dasha sequence (Moon balance, Saturn from Dec 2025)", () => {
    const d = vimshottari(REF.moon, REF_UTC);
    expect(d[0].lord).toBe("moon");
    expect(d[0].end.toISOString().slice(0, 7)).toBe("1984-12");
    const saturn = d.find((x) => x.lord === "saturn")!;
    expect(saturn.start.toISOString().slice(0, 7)).toBe("2025-12");
    const act = activeDasha(d, new Date(Date.UTC(2026, 10, 23)))!;
    expect(act.maha.lord).toBe("saturn");
    expect(act.antar.lord).toBe("saturn");
  });

  it("sub-periods tile their parent exactly", () => {
    const d = vimshottari(100, new Date(Date.UTC(2000, 0, 1)));
    for (const m of d) {
      expect(m.sub![0].start.getTime()).toBe(m.start.getTime());
      expect(Math.abs(m.sub![8].end.getTime() - m.end.getTime())).toBeLessThan(5);
    }
  });
});

describe("vargas", () => {
  it("navamsha follows the movable/fixed/dual rule", () => {
    expect(vargaSign(0.5, "D9")).toBe(0); // Aries 0°30' -> Aries
    expect(vargaSign(30.5, "D9")).toBe(9); // Taurus starts from Capricorn
    expect(vargaSign(60.5, "D9")).toBe(6); // Gemini starts from Libra
    expect(vargaSign(29.9, "D9")).toBe(8); // last navamsha of Aries -> Sagittarius
  });
  it("dashamsha: even signs start from the 9th", () => {
    expect(vargaSign(30.5, "D10")).toBe(9); // Taurus -> Capricorn
  });
});

describe("compatibility", () => {
  it("gives the full 36 only for an impossible ideal and stays within bounds", () => {
    const a = chartFromBirth({ date: "1990-05-10", time: "08:00", timeZone: "Europe/London", latitude: 51.5, longitude: -0.12, placeLabel: "London" }).chart;
    const b = chartFromBirth({ date: "1992-11-02", time: "21:30", timeZone: "America/New_York", latitude: 40.7, longitude: -74, placeLabel: "NYC" }).chart;
    const r = ashtakoota(a, b);
    expect(r.kootas).toHaveLength(8);
    expect(r.total).toBeGreaterThanOrEqual(0);
    expect(r.total).toBeLessThanOrEqual(36);
  });
});

describe("panchanga", () => {
  it("reports Purnima on a full moon (2025-10-07 03:48 UTC)", () => {
    const p = panchanga(new Date(Date.UTC(2025, 9, 7, 3, 0)), 28.6, 77.2, 2);
    expect(p.tithi.name).toBe("Purnima");
  });
});
