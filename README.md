# Jyoti — AI Vedic astrologer

A web app and Telegram bot where an AI astrologer (Claude) reads a person's Vedic (sidereal) birth chart, remembers them across conversations and sends personal forecasts and alerts on its own.

The product name is a placeholder: change `NEXT_PUBLIC_BRAND_NAME` / `NEXT_PUBLIC_ASSISTANT_NAME`.

## What's inside

| Area | Where | Notes |
|---|---|---|
| Astrology engine | `src/lib/astro/` | astronomy-engine (MIT) + our own Jyotish layer: Lahiri/Raman/KP ayanamsa, mean/true nodes, ascendant, whole-sign houses, nakshatra/pada, dignities, combustion, chara karakas (7/8), graha drishti, 13 vargas (D1–D60), Vimshottari to pratyantardasha, yogas, transits with ingress/station search, Sade Sati, tara/chandra bala, panchanga, Ashtakoota + Mangal dosha. Historical time zones via IANA tzdb. |
| Agent | `src/lib/agent/` | System prompt (`prompt.ts`), per-user context with the computed chart and memory (`context.ts`), 10 tools the model calls (`tools.ts`), streaming tool loop (`run.ts`), rolling conversation summaries (`summarize.ts`), forecasts (`forecast.ts`). |
| Web app | `src/app/`, `src/components/` | Next.js App Router. Email one-time-code login (httpOnly session cookie), onboarding with city search, streaming chat, chart page (South Indian chart, vargas, dashas, yogas, transits), settings, plans. English and Russian UI. |
| Telegram bot | `src/lib/telegram/` | Same agent and account system. Onboarding dialog, streamed replies, `/chart`, `/new`, `/plans` with Telegram Stars payments, linking to a web account. |
| Proactive | `src/lib/notify/scheduler.ts` | Hourly job: daily forecast (paid plans), weekly forecast on Mondays, alerts for antardasha/mahadasha changes and Saturn/Jupiter/Rahu/Ketu sign changes. Delivered via Telegram or email at the user's local hour; idempotent. |
| Billing | `src/lib/billing/` | Plans and quotas, Stripe subscriptions (web), Telegram Stars (bot). |
| Data | `src/lib/db/schema.ts` | PostgreSQL via Drizzle. Migrations in `drizzle/`. |

### How a chat turn works

1. The person's primary birth profile is turned into a full chart by the engine (`chartFromBirth`).
2. The prompt is assembled in cache-friendly order: tools → stable system prompt → this person's chart, current dasha, remembered facts and recent conversation summaries (cache breakpoint) → older-conversation summary → the last 24 messages.
3. Claude (`claude-opus-5-5`, adaptive thinking, effort `medium`) answers, calling tools when it needs computed data: `get_transits`, `find_transit_events`, `get_dasha_periods`, `get_divisional_chart`, `list_people`, `get_person_chart`, `check_compatibility`, `search_library`, `remember_fact`, `forget_fact`.
4. Text streams to the browser over SSE (or into an edited Telegram message). Server-side refusal fallbacks (`fallbacks: "default"`) are enabled.
5. The turn, tool calls and token usage are stored; summaries are refreshed in the background.

The model never invents placements: everything it states about the chart comes from the context or a tool result.

## Run locally

```bash
cp .env.example .env              # fill in ANTHROPIC_API_KEY and SESSION_SECRET
npm install
npm run db:migrate                # needs a running PostgreSQL (DATABASE_URL)
npm run knowledge:ingest          # loads knowledge/*.md into the reference library
npm run dev                       # http://localhost:3000
```

Without SMTP the login code is printed in the server log. Try the agent from the terminal: `npm run agent:try -- "What does my current dasha bring?"`. Run the scheduler once: `npx tsx scripts/tick.ts [ISO time]`.

Tests: `npm test` (engine accuracy against a reference service, historical time zones, dashas, vargas, compatibility, formatting) and `npm run typecheck`.

## Deploy

- Any Node host (Vercel, Fly, Render, a VPS) plus PostgreSQL. Set the variables from `.env.example`.
- Scheduler: call `GET /api/cron/tick` hourly with `Authorization: Bearer $CRON_SECRET`.
- Telegram: create a bot with @BotFather, then set the webhook:
  `curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook?url=$APP_URL/api/telegram/webhook&secret_token=$TELEGRAM_WEBHOOK_SECRET"`
- Stripe: create two monthly prices (Plus, Pro), set their ids, and point a webhook for `invoice.paid` to `/api/billing/webhook`.
- The geocoder (city search) uses the free Open-Meteo API; swap `searchPlaces` for a paid provider at scale.

## Extending

- **Knowledge library**: add Markdown files to `knowledge/` (`# Title`, `## Section`), run `npm run knowledge:ingest`. Search is Postgres full-text; switch to embeddings + pgvector when the library grows.
- **Interpretation method**: edit `SYSTEM_PROMPT` in `src/lib/agent/prompt.ts`. Keep per-user data out of it so it stays cached.
- **New calculations**: add an engine function, expose it as a tool in `tools.ts`.
- **Cost at scale**: forecasts are independent per user, so they can move to the Message Batches API (50% cheaper) if delivery time is flexible.

## Notes on accuracy

Positions agree with a Swiss-Ephemeris-based service to within ~16″ (the difference is the nutation convention). Ingress times agree with published panchangs to minutes. Defaults: Lahiri ayanamsa, mean nodes (matching common panchangs), 7 chara karakas, Vimshottari year of 365.25 days. All are configurable in `ChartSettings`.

Astrology output is presented as reflection, not prediction. The agent's boundaries (no death/illness/legal predictions, crisis handling, professional referral) are in the system prompt.
