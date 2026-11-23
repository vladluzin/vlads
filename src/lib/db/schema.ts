import { sql } from "drizzle-orm";
import {
  bigint,
  bigserial,
  boolean,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").unique(),
  telegramId: bigint("telegram_id", { mode: "number" }).unique(),
  name: text("name"),
  locale: text("locale").notNull().default("en"),
  plan: text("plan").$type<"free" | "plus" | "pro">().notNull().default("free"),
  planExpiresAt: timestamp("plan_expires_at", { withTimezone: true }),
  stripeCustomerId: text("stripe_customer_id"),
  freeMessagesLeft: integer("free_messages_left").notNull().default(5),
  isAdmin: boolean("is_admin").notNull().default(false),
  createdAt: createdAt(),
});

export const birthProfiles = pgTable(
  "birth_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    /** "self" for the account owner; otherwise partner, child, friend… */
    relation: text("relation").notNull().default("self"),
    name: text("name").notNull(),
    isPrimary: boolean("is_primary").notNull().default(false),
    birthDate: date("birth_date").notNull(),
    birthTime: text("birth_time"),
    timeZone: text("time_zone").notNull(),
    latitude: doublePrecision("latitude").notNull(),
    longitude: doublePrecision("longitude").notNull(),
    placeLabel: text("place_label").notNull(),
    gender: text("gender"),
    createdAt: createdAt(),
  },
  (t) => [index("birth_profiles_user_idx").on(t.userId)],
);

export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    channel: text("channel").$type<"web" | "telegram">().notNull().default("web"),
    title: text("title").notNull().default("New conversation"),
    /** Rolling summary of messages older than the verbatim window. */
    summary: text("summary"),
    summarizedCount: integer("summarized_count").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("conversations_user_idx").on(t.userId, t.updatedAt)],
);

export const messages = pgTable(
  "messages",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    conversationId: uuid("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
    role: text("role").$type<"user" | "assistant">().notNull(),
    content: text("content").notNull(),
    /** Tools the agent called while producing this message (name + input), for audit/debug. */
    toolCalls: jsonb("tool_calls").$type<{ name: string; input: unknown }[]>(),
    createdAt: createdAt(),
  },
  (t) => [index("messages_conversation_idx").on(t.conversationId, t.id)],
);

/** Long-term facts the agent chose to remember about the user (one row per fact). */
export const memories = pgTable(
  "memories",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    fact: text("fact").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("memories_user_idx").on(t.userId)],
);

export const loginCodes = pgTable(
  "login_codes",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    email: text("email").notNull(),
    codeHash: text("code_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    attempts: smallint("attempts").notNull().default(0),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("login_codes_email_idx").on(t.email, t.createdAt)],
);

/** One-time tokens that link a Telegram account to a web account. */
export const linkTokens = pgTable("link_tokens", {
  token: text("token").primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

export const notificationPrefs = pgTable("notification_prefs", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  dailyForecast: boolean("daily_forecast").notNull().default(true),
  weeklyForecast: boolean("weekly_forecast").notNull().default(true),
  dashaAlerts: boolean("dasha_alerts").notNull().default(true),
  transitAlerts: boolean("transit_alerts").notNull().default(true),
  /** Local hour (0-23) in the user's time zone at which forecasts are delivered. */
  deliveryHour: smallint("delivery_hour").notNull().default(8),
  timeZone: text("time_zone").notNull().default("UTC"),
  channel: text("channel").$type<"telegram" | "email">().notNull().default("telegram"),
  lastDailyOn: date("last_daily_on"),
  lastWeeklyOn: date("last_weekly_on"),
});

/** Deduplicates one-off alerts (dasha changes, ingresses) per user. */
export const sentAlerts = pgTable(
  "sent_alerts",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    sentAt: createdAt(),
  },
  (t) => [uniqueIndex("sent_alerts_user_key").on(t.userId, t.key)],
);

export const payments = pgTable(
  "payments",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider").$type<"stripe" | "telegram_stars">().notNull(),
    externalId: text("external_id").notNull(),
    plan: text("plan").notNull(),
    amount: integer("amount").notNull(),
    currency: text("currency").notNull(),
    status: text("status").notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("payments_provider_external").on(t.provider, t.externalId)],
);

export const usageEvents = pgTable(
  "usage_events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    kind: text("kind").notNull(),
    model: text("model").notNull(),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    cacheReadTokens: integer("cache_read_tokens").notNull().default(0),
    cacheWriteTokens: integer("cache_write_tokens").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index("usage_events_user_idx").on(t.userId, t.createdAt)],
);

export const knowledgeDocs = pgTable("knowledge_docs", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  lang: text("lang").notNull().default("en"),
  createdAt: createdAt(),
});

export const knowledgeChunks = pgTable(
  "knowledge_chunks",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    docId: uuid("doc_id").notNull().references(() => knowledgeDocs.id, { onDelete: "cascade" }),
    heading: text("heading"),
    content: text("content").notNull(),
  },
  (t) => [index("knowledge_chunks_fts").using("gin", sql`to_tsvector('simple', ${t.heading} || ' ' || ${t.content})`)],
);

/** Per-chat state of the Telegram bot: onboarding step and the active conversation. */
export const telegramState = pgTable("telegram_state", {
  telegramId: bigint("telegram_id", { mode: "number" }).primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  step: text("step").$type<"name" | "date" | "time" | "place" | "gender" | "ready">().notNull().default("name"),
  draft: jsonb("draft").$type<Record<string, unknown>>().notNull().default({}),
  conversationId: uuid("conversation_id").references(() => conversations.id, { onDelete: "set null" }),
});
