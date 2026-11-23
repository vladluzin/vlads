import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { and, eq } from "drizzle-orm";
import { DateTime } from "luxon";
import { z } from "zod";
import {
  GRAHA_NAMES,
  SIGNS,
  VARGAS,
  ashtakoota,
  chandraBalaFavorable,
  describeChart,
  describeVarga,
  findIngresses,
  findStations,
  formatDms,
  houseFrom,
  panchanga,
  sadeSatiPhase,
  taraBala,
  transitContacts,
  transitSnapshot,
  type Chart,
  type DashaPeriod,
  type Graha,
  type Varga,
} from "../astro";
import { db, schema } from "../db";
import { searchKnowledge } from "../knowledge";
import { chartOf, getProfile, listProfiles, type BirthProfile } from "../profiles";

export interface ToolContext {
  userId: string;
  profile: BirthProfile;
  chart: Chart;
  /** Zone used to interpret dates the model passes ("2026-03-01" = local noon there). */
  timeZone: string;
  /** Collects tool calls for the message audit log. */
  log: { name: string; input: unknown }[];
}

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD");
const name = (b: string) => GRAHA_NAMES[b as Graha]?.en ?? b;

function localNoon(dateStr: string | undefined, tz: string): Date {
  const base = dateStr ? DateTime.fromISO(dateStr, { zone: tz }) : DateTime.now().setZone(tz);
  return base.set({ hour: 12, minute: 0, second: 0, millisecond: 0 }).toJSDate();
}

const fmt = (d: Date, tz: string) => DateTime.fromJSDate(d, { zone: tz }).toFormat("yyyy-MM-dd HH:mm");

export function transitReport(chart: Chart, at: Date, tz: string, lat: number, lon: number): string {
  const snap = transitSnapshot(chart, at);
  const L: string[] = [`TRANSITS for ${fmt(at, tz)} (${tz}), sidereal`];
  for (const t of snap) {
    L.push(
      `- ${name(t.body)}: ${SIGNS[t.sign].en} ${formatDms(t.degree)}${t.retrograde && t.body !== "rahu" && t.body !== "ketu" ? " R" : ""}, ${t.nakshatra.name}-${t.nakshatra.pada} | house ${t.houseFromAscendant} from lagna, ${t.houseFromMoon} from natal Moon`,
    );
  }
  const saturn = snap.find((s) => s.body === "saturn")!;
  const phase = sadeSatiPhase(chart.planets.moon.sign, saturn.sign);
  L.push(`Sade Sati: ${phase ? `yes, ${phase} phase` : "no"}`);
  const moon = snap.find((s) => s.body === "moon")!;
  const tb = taraBala(chart.planets.moon.nakshatra.index, moon.nakshatra.index);
  L.push(`Moon today: tara ${tb.tara} (${tb.favorable ? "favorable" : "unfavorable"}), chandra bala ${chandraBalaFavorable(moon.houseFromMoon) ? "favorable" : "unfavorable"} (house ${moon.houseFromMoon} from natal Moon)`);
  const contacts = transitContacts(chart, at, 3);
  if (contacts.length) {
    L.push("Close contacts (≤3°): " + contacts.map((c) => `${name(c.transiting)} ${c.kind} natal ${name(c.natal)} (${c.orb.toFixed(1)}°)`).join("; "));
  }
  const weekday = DateTime.fromJSDate(at, { zone: tz }).weekday;
  const p = panchanga(at, lat, lon, weekday);
  L.push(`Panchanga: ${p.vara}, tithi ${p.tithi.name} (${p.tithi.paksha} paksha), nakshatra ${p.nakshatra.name}, yoga ${p.yoga.name}, karana ${p.karana}`);
  return L.join("\n");
}

export function transitEventsReport(chart: Chart, from: Date, to: Date, planets: Graha[], tz: string): string {
  const { ayanamsa, node } = chart.settings;
  const events: { at: Date; text: string }[] = [];
  for (const p of planets) {
    for (const ing of findIngresses(p, from, to, ayanamsa, node)) {
      events.push({
        at: ing.at,
        text: `${name(p)} enters ${SIGNS[ing.toSign].en}${ing.retrograde && p !== "rahu" && p !== "ketu" ? " (retrograde)" : ""} — house ${houseFrom(chart.ascendant.sign, ing.toSign)} from lagna, ${houseFrom(chart.planets.moon.sign, ing.toSign)} from Moon`,
      });
    }
    for (const st of findStations(p, from, to, ayanamsa)) {
      events.push({ at: st.at, text: `${name(p)} stations ${st.kind} at ${SIGNS[Math.floor(st.lon / 30)].en} ${formatDms(st.lon % 30)}` });
    }
  }
  events.sort((a, b) => a.at.getTime() - b.at.getTime());
  if (!events.length) return "No ingresses or stations for these planets in the range.";
  return events.map((e) => `${fmt(e.at, tz)}: ${e.text}`).join("\n");
}

function dashaList(periods: DashaPeriod[], from: Date, to: Date, level: number, path: string[] = []): string[] {
  const out: string[] = [];
  for (const p of periods) {
    if (p.end <= from || p.start >= to) continue;
    const label = [...path, name(p.lord)].join(" / ");
    if (level === 1 || !p.sub) out.push(`${label}: ${p.start.toISOString().slice(0, 10)} → ${p.end.toISOString().slice(0, 10)}`);
    else out.push(...dashaList(p.sub, from, to, level - 1, [...path, name(p.lord)]));
  }
  return out;
}

export function buildTools(ctx: ToolContext) {
  const logged = <T>(toolName: string, fn: (input: T) => Promise<string> | string) => async (input: T) => {
    ctx.log.push({ name: toolName, input });
    try {
      return await fn(input);
    } catch (e) {
      return `Tool error: ${e instanceof Error ? e.message : String(e)}`;
    }
  };

  return [
    betaZodTool({
      name: "get_transits",
      description:
        "Planetary transits for one date relative to the person's natal chart: each graha's sidereal sign, degree, nakshatra and house from lagna and from natal Moon, Sade Sati status, tara/chandra bala of the Moon, close contacts of slow planets to natal points, and the panchanga. Use for 'today', a specific day, or any date-based question.",
      inputSchema: z.object({
        date: isoDate.optional().describe("Local date YYYY-MM-DD; defaults to today in the person's time zone"),
      }),
      run: logged("get_transits", ({ date }: { date?: string }) =>
        transitReport(ctx.chart, localNoon(date, ctx.timeZone), ctx.timeZone, ctx.profile.latitude, ctx.profile.longitude),
      ),
    }),
    betaZodTool({
      name: "find_transit_events",
      description:
        "Sign ingresses and retrograde/direct stations of chosen planets between two dates (max 3 years), with the house each ingress activates from lagna and from natal Moon. Use for 'when will…', 'what's coming this year', Saturn/Jupiter/Rahu cycles.",
      inputSchema: z.object({
        from: isoDate,
        to: isoDate,
        planets: z
          .array(z.enum(["sun", "mars", "mercury", "jupiter", "venus", "saturn", "rahu", "ketu"]))
          .min(1)
          .default(["jupiter", "saturn", "rahu", "mars"]),
      }),
      run: logged("find_transit_events", ({ from, to, planets }: { from: string; to: string; planets: Graha[] }) => {
        const a = localNoon(from, ctx.timeZone);
        const b = localNoon(to, ctx.timeZone);
        if (b <= a) return "'to' must be after 'from'.";
        if (b.getTime() - a.getTime() > 3 * 366 * 86400000) return "Range too long; use at most 3 years.";
        return transitEventsReport(ctx.chart, a, b, planets, ctx.timeZone);
      }),
    }),
    betaZodTool({
      name: "get_dasha_periods",
      description:
        "Vimshottari dasha periods overlapping a date range at the chosen depth (1 = mahadasha, 2 = antardasha, 3 = pratyantardasha). Use for timing questions beyond the current period shown in context.",
      inputSchema: z.object({ from: isoDate, to: isoDate, level: z.number().int().min(1).max(3).default(2) }),
      run: logged("get_dasha_periods", ({ from, to, level }: { from: string; to: string; level: number }) => {
        const rows = dashaList(ctx.chart.dashas, localNoon(from, ctx.timeZone), localNoon(to, ctx.timeZone), level);
        return rows.slice(0, 80).join("\n") || "No periods in range.";
      }),
    }),
    betaZodTool({
      name: "get_divisional_chart",
      description:
        "Positions of the nine grahas in a divisional chart (varga) with houses from the varga lagna. D9 for marriage and planetary strength, D10 career, D7 children, D2 wealth, D4 property, D12 parents, D24 education, D30 misfortunes, D60 past karma.",
      inputSchema: z.object({ varga: z.enum(VARGAS as [Varga, ...Varga[]]) }),
      run: logged("get_divisional_chart", ({ varga }: { varga: Varga }) => describeVarga(ctx.chart, varga)),
    }),
    betaZodTool({
      name: "list_people",
      description: "Lists the other people whose birth charts this person has saved (partner, child, friend…), with ids.",
      inputSchema: z.object({}),
      run: logged("list_people", async () => {
        const all = (await listProfiles(ctx.userId)).filter((p) => p.id !== ctx.profile.id);
        if (!all.length) return "No other charts saved. The person can add one in the app (Charts → Add person).";
        return all.map((p) => `- id ${p.id}: ${p.name} (${p.relation}), born ${p.birthDate}${p.birthTime ? " " + p.birthTime : ", time unknown"}, ${p.placeLabel}`).join("\n");
      }),
    }),
    betaZodTool({
      name: "get_person_chart",
      description: "Full natal chart of a saved person (id from list_people).",
      inputSchema: z.object({ person_id: z.string().uuid() }),
      run: logged("get_person_chart", async ({ person_id }: { person_id: string }) => {
        const p = await getProfile(ctx.userId, person_id);
        if (!p) return "No such saved person.";
        const { chart, label } = chartOf(p);
        return `Chart of ${p.name} (${p.relation})\n` + describeChart(chart, { birthLabel: label });
      }),
    }),
    betaZodTool({
      name: "check_compatibility",
      description:
        "Ashtakoota (guna milan, 36 points) between the person and a saved person, with each koota, Mangal dosha for both, and key relationship factors (7th house, Venus, D9). Use for relationship and compatibility questions.",
      inputSchema: z.object({ person_id: z.string().uuid() }),
      run: logged("check_compatibility", async ({ person_id }: { person_id: string }) => {
        const other = await getProfile(ctx.userId, person_id);
        if (!other) return "No such saved person.";
        const b = chartOf(other).chart;
        const me = (ctx.profile.gender ?? "").toLowerCase();
        const them = (other.gender ?? "").toLowerCase();
        // Classical kootas are directional (groom → bride). Without a male/female pair,
        // compute both directions and report the more favorable one.
        const r =
          me === "male" && them === "female"
            ? ashtakoota(ctx.chart, b, true)
            : me === "female" && them === "male"
              ? ashtakoota(b, ctx.chart, true)
              : ashtakoota(ctx.chart, b, false);
        const L = [`Ashtakoota with ${other.name}: ${r.total}/36 (${r.verdict})`];
        for (const k of r.kootas) L.push(`- ${k.koota}: ${k.score}/${k.max} (${k.detail})`);
        L.push(`Mangal dosha — person: ${r.mangal.a.present ? "present (" + r.mangal.a.from.join(", ") + ")" : "absent"}; ${other.name}: ${r.mangal.b.present ? "present (" + r.mangal.b.from.join(", ") + ")" : "absent"}`);
        const seventh = (c: Chart) => {
          const h = c.houses[6];
          return `7th ${SIGNS[h.sign].en}, lord ${name(h.lord)} in H${h.lordHouse}; Venus ${SIGNS[c.planets.venus.sign].en} H${c.planets.venus.house} (${c.planets.venus.dignity ?? "-"}); D9 lagna ${SIGNS[c.ascendant.vargas.D9].en}; DK ${name(c.karakas.DK)}`;
        };
        L.push(`Person: ${seventh(ctx.chart)}`);
        L.push(`${other.name}: ${seventh(b)}`);
        L.push(`Moons: ${SIGNS[ctx.chart.planets.moon.sign].en}/${ctx.chart.planets.moon.nakshatra.name} vs ${SIGNS[b.planets.moon.sign].en}/${b.planets.moon.nakshatra.name}`);
        return L.join("\n");
      }),
    }),
    betaZodTool({
      name: "search_library",
      description: "Searches our curated Jyotish reference library (classical rules, nakshatra and house notes, remedies). Use when you need a rule you are unsure of.",
      inputSchema: z.object({ query: z.string().min(2).max(200) }),
      run: logged("search_library", async ({ query }: { query: string }) => {
        const hits = await searchKnowledge(query);
        if (!hits.length) return "Nothing relevant in the library.";
        return hits.map((h) => `## ${h.title}${h.heading ? " — " + h.heading : ""}\n${h.content}`).join("\n\n");
      }),
    }),
    betaZodTool({
      name: "remember_fact",
      description:
        "Saves one durable fact about the person for future conversations (e.g. 'works as a nurse, considering a move to Berlin'). One short sentence, in English. Not for chart data or moods.",
      inputSchema: z.object({ fact: z.string().min(3).max(300) }),
      run: logged("remember_fact", async ({ fact }: { fact: string }) => {
        const existing = await db.select().from(schema.memories).where(eq(schema.memories.userId, ctx.userId));
        if (existing.length >= 60) return "Memory is full; ask the person which older facts to drop.";
        await db.insert(schema.memories).values({ userId: ctx.userId, fact });
        return "Saved.";
      }),
    }),
    betaZodTool({
      name: "forget_fact",
      description: "Deletes a remembered fact by its id (ids are shown in 'WHAT YOU KNOW ABOUT THEM'). Use when the person asks you to forget something or a fact is outdated.",
      inputSchema: z.object({ fact_id: z.number().int() }),
      run: logged("forget_fact", async ({ fact_id }: { fact_id: number }) => {
        await db.delete(schema.memories).where(and(eq(schema.memories.userId, ctx.userId), eq(schema.memories.id, fact_id)));
        return "Forgotten.";
      }),
    }),
  ];
}
