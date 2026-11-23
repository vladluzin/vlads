import { DateTime } from "luxon";
import { GRAHA_NAMES, NAKSHATRAS, bodyPosition, nakshatraOf, taraBala, type DashaPeriod, type Graha } from "../astro";
import { schema } from "../db";
import type { BirthProfile } from "../profiles";
import { AGENT_MODEL, BATCH_EFFORT, anthropic, fallbackParams } from "./client";
import { buildContext } from "./context";
import { FORECAST_INSTRUCTIONS } from "./prompt";
import { transitEventsReport, transitReport } from "./tools";
import { recordUsage } from "./run";

export type ForecastKind = keyof typeof FORECAST_INSTRUCTIONS;

const LANG: Record<string, string> = { en: "English", ru: "Russian" };

function weeklyMoonTable(natalMoonNak: number, start: DateTime): string {
  const rows: string[] = ["Moon by day (local noon): date — nakshatra — tara from natal Moon"];
  for (let i = 0; i < 7; i++) {
    const day = start.plus({ days: i }).set({ hour: 12, minute: 0 });
    const nak = nakshatraOf(bodyPosition("moon", day.toJSDate()).lon);
    const tb = taraBala(natalMoonNak, nak.index);
    rows.push(`${day.toFormat("ccc yyyy-MM-dd")} — ${NAKSHATRAS[nak.index].en} — ${tb.tara} (${tb.favorable ? "favorable" : "unfavorable"})`);
  }
  return rows.join("\n");
}

/**
 * Generates a personal forecast with the same persona and chart context as chat, plus the
 * period's computed transit data. No tools: everything needed is precomputed.
 */
export async function generateForecast(
  user: typeof schema.users.$inferSelect,
  profile: BirthProfile,
  kind: ForecastKind,
  extra?: { dasha?: { level: string; lord: Graha; parent: Graha[]; period: DashaPeriod } },
  now = new Date(),
): Promise<string | null> {
  const ctx = await buildContext(user, profile, null, now);
  const local = DateTime.fromJSDate(now, { zone: ctx.timeZone }).startOf("day");
  const data: string[] = [];
  if (kind === "daily") {
    data.push(transitReport(ctx.chart, local.set({ hour: 12 }).toJSDate(), ctx.timeZone, profile.latitude, profile.longitude));
  } else if (kind === "weekly") {
    data.push(transitReport(ctx.chart, local.set({ hour: 12 }).toJSDate(), ctx.timeZone, profile.latitude, profile.longitude));
    data.push("EVENTS THIS WEEK:\n" + transitEventsReport(ctx.chart, local.toJSDate(), local.plus({ days: 7 }).toJSDate(), ["sun", "mercury", "venus", "mars", "jupiter", "saturn", "rahu"], ctx.timeZone));
    data.push(weeklyMoonTable(ctx.chart.planets.moon.nakshatra.index, local));
  } else if (kind === "dashaChange" && extra?.dasha) {
    const d = extra.dasha;
    data.push(
      `NEW PERIOD: ${d.level} of ${GRAHA_NAMES[d.lord].en}${d.parent.length ? ` within ${d.parent.map((p) => GRAHA_NAMES[p].en).join(" / ")}` : ""}, from ${d.period.start.toISOString().slice(0, 10)} to ${d.period.end.toISOString().slice(0, 10)}.`,
    );
  }

  const msg = await anthropic().beta.messages.create({
    model: AGENT_MODEL,
    max_tokens: 16000,
    output_config: { effort: BATCH_EFFORT },
    system: ctx.system,
    messages: [
      {
        role: "user",
        content: `${data.join("\n\n")}\n\n${FORECAST_INSTRUCTIONS[kind]} Write in ${LANG[user.locale] ?? "English"}. Address them as ${profile.name}.`,
      },
    ],
    ...fallbackParams,
  });
  await recordUsage(user.id, `forecast:${kind}`, {
    input: msg.usage.input_tokens ?? 0,
    output: msg.usage.output_tokens ?? 0,
    cacheRead: msg.usage.cache_read_input_tokens ?? 0,
    cacheWrite: msg.usage.cache_creation_input_tokens ?? 0,
  });
  if (msg.stop_reason === "refusal") return null;
  const text = msg.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("").trim();
  return text || null;
}
