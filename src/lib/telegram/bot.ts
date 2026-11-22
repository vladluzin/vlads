import { Bot, InlineKeyboard, type Context } from "grammy";
import { and, eq, gt } from "drizzle-orm";
import { db, schema } from "../db";
import { AgentError, afterTurn, runTurn } from "../agent/run";
import { PLANS, grantPlan, FREE_MESSAGES } from "../billing/plans";
import { searchPlaces, placeLabel, type Place } from "../geo/geocode";
import { createProfile, primaryProfile, chartOf } from "../profiles";
import { activeDasha, GRAHA_NAMES, SIGNS } from "../astro";
import { BRAND } from "../brand";
import { markdownToTelegramHtml, splitMessage } from "./format";

type State = typeof schema.telegramState.$inferSelect;
type Draft = { name?: string; birthDate?: string; birthTime?: string | null; places?: Place[]; place?: Place };

const T = {
  en: {
    welcome: (n: string) => `Hi${n ? ", " + n : ""}! I'm ${BRAND.assistantName}, a Vedic astrologer. I'll calculate your birth chart and then you can ask me anything about it — personality, relationships, career, timing.\n\nWhat's your name?`,
    askDate: "Your date of birth? (e.g. 1990-05-21 or 21.05.1990)",
    badDate: "I couldn't read that date. Please use YYYY-MM-DD or DD.MM.YYYY.",
    askTime: "Time of birth, as exact as you know (HH:MM, 24h)? If you don't know it, tap the button.",
    unknownTime: "I don't know",
    badTime: "Please send the time as HH:MM, e.g. 07:45 or 19:20.",
    askPlace: "City of birth?",
    pickPlace: "Which one?",
    noPlace: "I couldn't find that place. Try the city name in English, maybe with the country.",
    askGender: "Gender (used for some compatibility rules)?",
    male: "Male", female: "Female", skip: "Skip",
    ready: "Your chart is ready ✨ Ask me anything — for example: “What does my chart say about my career?” or “What should I watch this week?”\n\n/chart — key placements · /new — new conversation · /plans — plans · /web — open the web app",
    busy: "One moment — I'm still answering your previous message.",
    free: `You've used your free messages. Choose a plan to keep talking: /plans`,
    daily: "You've reached today's message limit. It resets at midnight UTC.",
    newChat: "Starting a fresh conversation. What's on your mind?",
    linked: "Your Telegram is now connected to your web account ✓",
    linkFailed: "This link has expired. Create a new one in the web app settings.",
    paid: (p: string, until: string) => `Thank you! ${p} is active until ${until}.`,
    plans: "Choose a plan (paid with Telegram Stars, 30 days):",
    web: "Open the web app:",
  },
  ru: {
    welcome: (n: string) => `Здравствуйте${n ? ", " + n : ""}! Я ${BRAND.assistantName}, ведический астролог. Я рассчитаю вашу натальную карту, а дальше можно спрашивать о чём угодно: характер, отношения, работа, сроки.\n\nКак вас зовут?`,
    askDate: "Дата рождения? (например 21.05.1990 или 1990-05-21)",
    badDate: "Не получилось разобрать дату. Напишите в формате ДД.ММ.ГГГГ.",
    askTime: "Время рождения, как можно точнее (ЧЧ:ММ)? Если не знаете — нажмите кнопку.",
    unknownTime: "Не знаю",
    badTime: "Напишите время в формате ЧЧ:ММ, например 07:45 или 19:20.",
    askPlace: "Город рождения?",
    pickPlace: "Какой из них?",
    noPlace: "Не нашёл такое место. Попробуйте написать город иначе, можно со страной.",
    askGender: "Пол (нужен для некоторых правил совместимости)?",
    male: "Мужской", female: "Женский", skip: "Пропустить",
    ready: "Карта готова ✨ Спрашивайте — например: «Что карта говорит о моей карьере?» или «На что обратить внимание на этой неделе?»\n\n/chart — главное в карте · /new — новый разговор · /plans — тарифы · /web — веб-версия",
    busy: "Секунду — ещё отвечаю на предыдущее сообщение.",
    free: "Бесплатные сообщения закончились. Выберите тариф: /plans",
    daily: "Дневной лимит сообщений исчерпан. Он обновится в полночь по UTC.",
    newChat: "Начинаем новый разговор. Что вас интересует?",
    linked: "Telegram подключён к вашему веб-аккаунту ✓",
    linkFailed: "Ссылка устарела. Создайте новую в настройках веб-версии.",
    paid: (p: string, until: string) => `Спасибо! Тариф ${p} активен до ${until}.`,
    plans: "Выберите тариф (оплата Telegram Stars, 30 дней):",
    web: "Веб-версия:",
  },
};
const tr = (lang?: string) => (lang?.startsWith("ru") ? T.ru : T.en);

function parseDate(s: string): string | null {
  const t = s.trim();
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  let y: number, mo: number, d: number;
  if (m) [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  else if ((m = t.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/))) [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
  else return null;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCMonth() !== mo - 1 || y < 1800 || dt > new Date()) return null;
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function parseTime(s: string): string | null {
  const m = s.trim().match(/^(\d{1,2})[:.](\d{2})$/);
  if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) return null;
  return `${m[1].padStart(2, "0")}:${m[2]}`;
}

async function ensureUser(ctx: Context): Promise<{ user: typeof schema.users.$inferSelect; state: State }> {
  const from = ctx.from!;
  let [user] = await db.select().from(schema.users).where(eq(schema.users.telegramId, from.id));
  if (!user) {
    [user] = await db
      .insert(schema.users)
      .values({ telegramId: from.id, name: from.first_name, locale: from.language_code?.startsWith("ru") ? "ru" : "en", freeMessagesLeft: FREE_MESSAGES })
      .returning();
  }
  let [state] = await db.select().from(schema.telegramState).where(eq(schema.telegramState.telegramId, from.id));
  if (!state || state.userId !== user.id) {
    const step = (await primaryProfile(user.id)) ? "ready" : "name";
    [state] = await db
      .insert(schema.telegramState)
      .values({ telegramId: from.id, userId: user.id, step })
      .onConflictDoUpdate({ target: schema.telegramState.telegramId, set: { userId: user.id, step, draft: {} } })
      .returning();
  }
  return { user, state };
}

const setState = (telegramId: number, patch: Partial<State>) =>
  db.update(schema.telegramState).set(patch).where(eq(schema.telegramState.telegramId, telegramId));

async function finishOnboarding(ctx: Context, state: State, draft: Draft, gender: string | null) {
  const p = draft.place!;
  await createProfile(state.userId, {
    name: draft.name!,
    relation: "self",
    birthDate: draft.birthDate!,
    birthTime: draft.birthTime ?? null,
    timeZone: p.timeZone,
    latitude: p.latitude,
    longitude: p.longitude,
    placeLabel: placeLabel(p),
    gender,
  });
  await setState(ctx.from!.id, { step: "ready", draft: {} });
  await ctx.reply(tr(ctx.from?.language_code).ready);
}

const inFlight = new Set<number>();

async function answer(ctx: Context, state: State, text: string) {
  const L = tr(ctx.from?.language_code);
  const id = ctx.from!.id;
  if (inFlight.has(id)) return void (await ctx.reply(L.busy));
  inFlight.add(id);
  const chatId = ctx.chat!.id;
  let msgId: number | null = null;
  let buffer = "";
  let lastEdit = 0;
  let editing: Promise<unknown> = Promise.resolve();
  const typing = setInterval(() => ctx.api.sendChatAction(chatId, "typing").catch(() => {}), 4500);
  await ctx.api.sendChatAction(chatId, "typing").catch(() => {});

  const flush = (force = false) => {
    const now = Date.now();
    if (!buffer.trim() || (!force && now - lastEdit < 1500)) return;
    lastEdit = now;
    const preview = buffer.length > 3800 ? buffer.slice(0, 3800) + "…" : buffer;
    editing = editing.then(async () => {
      if (msgId === null) msgId = (await ctx.api.sendMessage(chatId, preview)).message_id;
      else await ctx.api.editMessageText(chatId, msgId, preview).catch(() => {});
    });
  };

  try {
    const res = await runTurn({
      userId: state.userId,
      conversationId: state.conversationId,
      text,
      channel: "telegram",
      onText: (d) => {
        buffer += d;
        flush();
      },
    });
    clearInterval(typing);
    await editing;
    if (res.conversationId !== state.conversationId) await setState(id, { conversationId: res.conversationId });
    // Final render with formatting; long answers continue in follow-up messages.
    const parts = splitMessage(res.text);
    for (const [i, part] of parts.entries()) {
      const html = markdownToTelegramHtml(part);
      const send = async (body: string, parse: boolean) => {
        const opts = parse ? { parse_mode: "HTML" as const } : {};
        if (i === 0 && msgId !== null) await ctx.api.editMessageText(chatId, msgId, body, opts);
        else await ctx.api.sendMessage(chatId, body, opts);
      };
      await send(html, true).catch(() => send(part, false));
    }
    void afterTurn(res.conversationId);
  } catch (e) {
    clearInterval(typing);
    await editing.catch(() => {});
    if (e instanceof AgentError) {
      if (e.code === "free_exhausted") await ctx.reply(L.free);
      else if (e.code === "daily_limit") await ctx.reply(L.daily);
      else await ctx.reply(e.message);
    } else {
      console.error("telegram answer", e);
      await ctx.reply("Something went wrong. Please try again.");
    }
  } finally {
    inFlight.delete(id);
  }
}

export function createBot(token: string) {
  const bot = new Bot(token);

  bot.command("start", async (ctx) => {
    const payload = ctx.match?.trim();
    const L = tr(ctx.from?.language_code);
    if (payload?.startsWith("link_")) {
      const [row] = await db
        .select()
        .from(schema.linkTokens)
        .where(and(eq(schema.linkTokens.token, payload.slice(5)), gt(schema.linkTokens.expiresAt, new Date())));
      if (!row) return void (await ctx.reply(L.linkFailed));
      // Move the Telegram identity to the web account (dropping a bot-only account if one exists).
      const [tgUser] = await db.select().from(schema.users).where(eq(schema.users.telegramId, ctx.from!.id));
      if (tgUser && tgUser.id !== row.userId) {
        if (!tgUser.email) await db.delete(schema.users).where(eq(schema.users.id, tgUser.id));
        else await db.update(schema.users).set({ telegramId: null }).where(eq(schema.users.id, tgUser.id));
      }
      await db.update(schema.users).set({ telegramId: ctx.from!.id }).where(eq(schema.users.id, row.userId));
      await db.delete(schema.linkTokens).where(eq(schema.linkTokens.token, row.token));
      await db.delete(schema.telegramState).where(eq(schema.telegramState.telegramId, ctx.from!.id));
      await ctx.reply(L.linked);
      const { state } = await ensureUser(ctx);
      if (state.step !== "ready") await ctx.reply(L.welcome(ctx.from!.first_name));
      return;
    }
    const { state } = await ensureUser(ctx);
    if (state.step === "ready") await ctx.reply(L.ready);
    else {
      await setState(ctx.from!.id, { step: "name", draft: {} });
      await ctx.reply(L.welcome(ctx.from!.first_name));
    }
  });

  bot.command("new", async (ctx) => {
    await ensureUser(ctx);
    await setState(ctx.from!.id, { conversationId: null });
    await ctx.reply(tr(ctx.from?.language_code).newChat);
  });

  bot.command("chart", async (ctx) => {
    const { user } = await ensureUser(ctx);
    const p = await primaryProfile(user.id);
    if (!p) return void (await ctx.reply(tr(ctx.from?.language_code).askDate));
    const { chart } = chartOf(p);
    const ru = user.locale === "ru";
    const sign = (i: number) => (ru ? SIGNS[i].ru : SIGNS[i].en);
    const g = (b: keyof typeof GRAHA_NAMES) => (ru ? GRAHA_NAMES[b].ru : GRAHA_NAMES[b].en);
    const act = activeDasha(chart.dashas, new Date());
    const lines = [
      `<b>${p.name}</b> · ${p.birthDate} ${p.birthTime ?? "?"} · ${p.placeLabel}`,
      `${ru ? "Асцендент" : "Ascendant"}: ${sign(chart.ascendant.sign)}${chart.input.timeKnown ? "" : " (?)"}`,
      `${g("moon")}: ${sign(chart.planets.moon.sign)}, ${chart.planets.moon.nakshatra.name}`,
      `${g("sun")}: ${sign(chart.planets.sun.sign)}`,
      `Atmakaraka: ${g(chart.karakas.AK as keyof typeof GRAHA_NAMES)}`,
      act ? `${ru ? "Даша" : "Dasha"}: ${g(act.maha.lord)} / ${g(act.antar.lord)} (${ru ? "до" : "until"} ${act.antar.end.toISOString().slice(0, 10)})` : "",
    ].filter(Boolean);
    await ctx.reply(lines.join("\n"), { parse_mode: "HTML" });
  });

  bot.command("web", async (ctx) => {
    const url = process.env.APP_URL;
    await ctx.reply(`${tr(ctx.from?.language_code).web} ${url ?? ""}`);
  });

  bot.command("plans", async (ctx) => {
    const kb = new InlineKeyboard();
    for (const id of ["plus", "pro"] as const) kb.text(`${PLANS[id].title} · ⭐ ${PLANS[id].stars}`, `buy:${id}`).row();
    await ctx.reply(tr(ctx.from?.language_code).plans, { reply_markup: kb });
  });

  bot.callbackQuery(/^buy:(plus|pro)$/, async (ctx) => {
    const plan = ctx.match![1] as "plus" | "pro";
    await ctx.answerCallbackQuery();
    await ctx.replyWithInvoice(`${BRAND.name} ${PLANS[plan].title}`, "30 days of access", `plan:${plan}`, "XTR", [
      { label: PLANS[plan].title, amount: PLANS[plan].stars },
    ]);
  });

  bot.on("pre_checkout_query", (ctx) => ctx.answerPreCheckoutQuery(/^plan:(plus|pro)$/.test(ctx.preCheckoutQuery.invoice_payload)));

  bot.on("message:successful_payment", async (ctx) => {
    const { user } = await ensureUser(ctx);
    const pay = ctx.message.successful_payment;
    const plan = pay.invoice_payload.slice(5) as "plus" | "pro";
    const inserted = await db
      .insert(schema.payments)
      .values({ userId: user.id, provider: "telegram_stars", externalId: pay.telegram_payment_charge_id, plan, amount: pay.total_amount, currency: pay.currency, status: "paid" })
      .onConflictDoNothing()
      .returning();
    if (!inserted.length) return;
    const until = await grantPlan(user.id, plan, 30);
    await ctx.reply(tr(ctx.from?.language_code).paid(PLANS[plan].title, until.toISOString().slice(0, 10)));
  });

  bot.callbackQuery(/^place:(\d)$/, async (ctx) => {
    const { state } = await ensureUser(ctx);
    const draft = state.draft as Draft;
    const place = draft.places?.[Number(ctx.match![1])];
    await ctx.answerCallbackQuery();
    if (state.step !== "place" || !place) return;
    await setState(ctx.from!.id, { step: "gender", draft: { ...draft, place, places: undefined } });
    const L = tr(ctx.from?.language_code);
    await ctx.reply(`${placeLabel(place)} ✓\n\n${L.askGender}`, {
      reply_markup: new InlineKeyboard().text(L.male, "gender:male").text(L.female, "gender:female").text(L.skip, "gender:skip"),
    });
  });

  bot.callbackQuery(/^gender:(male|female|skip)$/, async (ctx) => {
    const { state } = await ensureUser(ctx);
    await ctx.answerCallbackQuery();
    if (state.step !== "gender") return;
    const g = ctx.match![1];
    await finishOnboarding(ctx, state, state.draft as Draft, g === "skip" ? null : g);
  });

  bot.callbackQuery("time:unknown", async (ctx) => {
    const { state } = await ensureUser(ctx);
    await ctx.answerCallbackQuery();
    if (state.step !== "time") return;
    await setState(ctx.from!.id, { step: "place", draft: { ...(state.draft as Draft), birthTime: null } });
    await ctx.reply(tr(ctx.from?.language_code).askPlace);
  });

  bot.on("message:text", async (ctx) => {
    const { state } = await ensureUser(ctx);
    const L = tr(ctx.from?.language_code);
    const text = ctx.message.text;
    const draft = state.draft as Draft;
    switch (state.step) {
      case "name":
        await setState(ctx.from.id, { step: "date", draft: { ...draft, name: text.trim().slice(0, 80) } });
        return void (await ctx.reply(L.askDate));
      case "date": {
        const d = parseDate(text);
        if (!d) return void (await ctx.reply(L.badDate));
        await setState(ctx.from.id, { step: "time", draft: { ...draft, birthDate: d } });
        return void (await ctx.reply(L.askTime, { reply_markup: new InlineKeyboard().text(L.unknownTime, "time:unknown") }));
      }
      case "time": {
        const tm = parseTime(text);
        if (!tm) return void (await ctx.reply(L.badTime, { reply_markup: new InlineKeyboard().text(L.unknownTime, "time:unknown") }));
        await setState(ctx.from.id, { step: "place", draft: { ...draft, birthTime: tm } });
        return void (await ctx.reply(L.askPlace));
      }
      case "place": {
        const places = await searchPlaces(text, ctx.from.language_code?.slice(0, 2) ?? "en", 5).catch(() => []);
        if (!places.length) return void (await ctx.reply(L.noPlace));
        await setState(ctx.from.id, { draft: { ...draft, places } });
        const kb = new InlineKeyboard();
        places.forEach((p, i) => kb.text(placeLabel(p).slice(0, 60), `place:${i}`).row());
        return void (await ctx.reply(L.pickPlace, { reply_markup: kb }));
      }
      case "gender":
        return void (await ctx.reply(L.askGender));
      case "ready":
        return answer(ctx, state, text);
    }
  });

  bot.catch((err) => console.error("bot error", err.error));
  return bot;
}

const g = globalThis as unknown as { bot?: Bot; botReady?: Promise<void> };

/** Singleton bot instance with botInfo loaded (required before handleUpdate). */
export async function getBot(): Promise<Bot | null> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return null;
  g.bot ??= createBot(token);
  g.botReady ??= g.bot.init();
  await g.botReady;
  return g.bot;
}

/** Sends a proactive message (forecast/alert) to a Telegram user. */
export async function sendTelegram(telegramId: number, markdown: string) {
  const bot = await getBot();
  if (!bot) throw new Error("Telegram bot is not configured");
  for (const part of splitMessage(markdown)) {
    await bot.api
      .sendMessage(telegramId, markdownToTelegramHtml(part), { parse_mode: "HTML" })
      .catch(() => bot.api.sendMessage(telegramId, part));
  }
}
