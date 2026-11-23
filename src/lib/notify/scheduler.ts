import { eq } from "drizzle-orm";
import { DateTime } from "luxon";
import { GRAHA_NAMES, HOUSE_MEANINGS, SIGNS, findIngresses, houseFrom, upcomingDashaChanges, type Graha } from "../astro";
import { db, schema } from "../db";
import { activePlan } from "../billing/plans";
import { generateForecast } from "../agent/forecast";
import { chartOf, primaryProfile } from "../profiles";
import { sendTelegram } from "../telegram/bot";
import { sendEmail } from "./email";
import { BRAND } from "../brand";

type User = typeof schema.users.$inferSelect;
type Prefs = typeof schema.notificationPrefs.$inferSelect;

async function deliver(user: User, prefs: Prefs, subject: string, markdown: string) {
  if (prefs.channel === "telegram" && user.telegramId) return sendTelegram(user.telegramId, markdown);
  if (user.email) return sendEmail({ to: user.email, subject, markdown });
  if (user.telegramId) return sendTelegram(user.telegramId, markdown);
}

/** Records a one-off alert; returns false if it was already sent. */
async function claimAlert(userId: string, key: string): Promise<boolean> {
  const rows = await db.insert(schema.sentAlerts).values({ userId, key }).onConflictDoNothing().returning();
  return rows.length > 0;
}

const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th"}`;

const SLOW: Graha[] = ["saturn", "jupiter", "rahu", "ketu"];

export interface TickReport {
  users: number;
  daily: number;
  weekly: number;
  dasha: number;
  transit: number;
  errors: number;
}

/**
 * Hourly job. For each user whose local time has reached their delivery hour, sends the
 * daily/weekly forecast (once per day/week) and any due dasha-change or major-ingress alerts.
 * Idempotent: safe to run more often than hourly or to re-run after a failure.
 */
export async function runTick(now = new Date()): Promise<TickReport> {
  const report: TickReport = { users: 0, daily: 0, weekly: 0, dasha: 0, transit: 0, errors: 0 };
  const rows = await db
    .select({ user: schema.users, prefs: schema.notificationPrefs })
    .from(schema.notificationPrefs)
    .innerJoin(schema.users, eq(schema.users.id, schema.notificationPrefs.userId));

  for (const { user, prefs } of rows) {
    const local = DateTime.fromJSDate(now, { zone: prefs.timeZone });
    if (local.hour < prefs.deliveryHour) continue;
    const today = local.toISODate()!;
    const profile = await primaryProfile(user.id);
    if (!profile) continue;
    report.users++;
    const plan = activePlan(user, now);
    const ru = user.locale === "ru";
    try {
      const isMonday = local.weekday === 1;
      if (prefs.weeklyForecast && plan.weeklyForecast && isMonday && prefs.lastWeeklyOn !== today) {
        // Mark first so a failure doesn't cause repeated sends within the day.
        await db.update(schema.notificationPrefs).set({ lastWeeklyOn: today, lastDailyOn: today }).where(eq(schema.notificationPrefs.userId, user.id));
        const text = await generateForecast(user, profile, "weekly", undefined, now);
        if (text) {
          await deliver(user, prefs, ru ? `${BRAND.name}: прогноз на неделю` : `${BRAND.name}: your week ahead`, text);
          report.weekly++;
        }
      } else if (prefs.dailyForecast && plan.dailyForecast && prefs.lastDailyOn !== today) {
        await db.update(schema.notificationPrefs).set({ lastDailyOn: today }).where(eq(schema.notificationPrefs.userId, user.id));
        const text = await generateForecast(user, profile, "daily", undefined, now);
        if (text) {
          await deliver(user, prefs, ru ? `${BRAND.name}: прогноз на сегодня` : `${BRAND.name}: your day`, text);
          report.daily++;
        }
      }

      const { chart } = chartOf(profile);
      const horizon = new Date(now.getTime() + 3 * 86400000);

      if (prefs.dashaAlerts && plan.alerts) {
        for (const c of upcomingDashaChanges(chart.dashas, now, horizon).filter((c) => c.level !== "pratyantar")) {
          if (!(await claimAlert(user.id, `dasha:${c.level}:${c.lord}:${c.start.toISOString().slice(0, 10)}`))) continue;
          const maha = chart.dashas.find((m) => m.start <= c.start && c.start < m.end)!;
          const period = c.level === "maha" ? maha : maha.sub!.find((a) => a.start.getTime() === c.start.getTime())!;
          const text = await generateForecast(user, profile, "dashaChange", { dasha: { level: c.level === "maha" ? "mahadasha" : "antardasha", lord: c.lord, parent: c.parent, period } }, now);
          if (text) {
            await deliver(user, prefs, ru ? `${BRAND.name}: начинается новый период` : `${BRAND.name}: a new period begins`, text);
            report.dasha++;
          }
        }
      }

      if (prefs.transitAlerts && plan.alerts) {
        for (const body of SLOW) {
          for (const ing of findIngresses(body, now, horizon, chart.settings.ayanamsa, chart.settings.node)) {
            if (!(await claimAlert(user.id, `ingress:${body}:${ing.toSign}:${ing.at.toISOString().slice(0, 10)}`))) continue;
            const fromMoon = houseFrom(chart.planets.moon.sign, ing.toSign);
            const fromLagna = houseFrom(chart.ascendant.sign, ing.toSign);
            const when = DateTime.fromJSDate(ing.at, { zone: prefs.timeZone }).toFormat("yyyy-MM-dd HH:mm");
            const g = ru ? GRAHA_NAMES[body].ru : GRAHA_NAMES[body].en;
            const s = ru ? SIGNS[ing.toSign].ru : SIGNS[ing.toSign].en;
            const area = HOUSE_MEANINGS[(chart.input.timeKnown ? fromLagna : fromMoon) - 1][ru ? "ru" : "en"];
            const text = ru
              ? `**${g} переходит в знак ${s}** (${when}).\n\nДля вас это ${fromMoon}-й дом от Луны${chart.input.timeKnown ? ` и ${fromLagna}-й от асцендента` : ""}: на первый план выходит тема «${area}». Спросите меня, что это значит лично для вас.`
              : `**${g} enters ${s}** (${when}).\n\nFor you that's the ${ordinal(fromMoon)} house from the Moon${chart.input.timeKnown ? ` and the ${ordinal(fromLagna)} from the ascendant` : ""}, bringing ${area} into focus. Ask me what it means for you specifically.`;
            await deliver(user, prefs, `${BRAND.name}: ${g} → ${s}`, text);
            report.transit++;
          }
        }
      }
    } catch (e) {
      report.errors++;
      console.error(`tick failed for ${user.id}`, e);
    }
  }
  return report;
}

