import { and, asc, eq } from "drizzle-orm";
import { db, schema } from "./db";
import { chartFromBirth, type Chart } from "./astro";

export type BirthProfile = typeof schema.birthProfiles.$inferSelect;

export async function listProfiles(userId: string): Promise<BirthProfile[]> {
  return db
    .select()
    .from(schema.birthProfiles)
    .where(eq(schema.birthProfiles.userId, userId))
    .orderBy(asc(schema.birthProfiles.createdAt));
}

export async function primaryProfile(userId: string): Promise<BirthProfile | null> {
  const [p] = await db
    .select()
    .from(schema.birthProfiles)
    .where(and(eq(schema.birthProfiles.userId, userId), eq(schema.birthProfiles.isPrimary, true)))
    .limit(1);
  return p ?? null;
}

export async function getProfile(userId: string, profileId: string): Promise<BirthProfile | null> {
  const [p] = await db
    .select()
    .from(schema.birthProfiles)
    .where(and(eq(schema.birthProfiles.userId, userId), eq(schema.birthProfiles.id, profileId)))
    .limit(1);
  return p ?? null;
}

export function chartOf(p: BirthProfile): { chart: Chart; label: string } {
  return chartFromBirth({
    date: p.birthDate,
    time: p.birthTime,
    timeZone: p.timeZone,
    latitude: p.latitude,
    longitude: p.longitude,
    placeLabel: p.placeLabel,
  });
}

export interface NewProfile {
  name: string;
  relation: string;
  birthDate: string;
  birthTime: string | null;
  timeZone: string;
  latitude: number;
  longitude: number;
  placeLabel: string;
  gender?: string | null;
}

/** Creates a profile; the first "self" profile of a user becomes primary. */
export async function createProfile(userId: string, data: NewProfile): Promise<BirthProfile> {
  const existing = await primaryProfile(userId);
  const isPrimary = data.relation === "self" && !existing;
  const [row] = await db
    .insert(schema.birthProfiles)
    .values({ ...data, userId, isPrimary })
    .returning();
  if (isPrimary) {
    await db
      .insert(schema.notificationPrefs)
      .values({ userId, timeZone: data.timeZone })
      .onConflictDoUpdate({ target: schema.notificationPrefs.userId, set: { timeZone: data.timeZone } });
  }
  return row;
}

export async function updatePrimaryProfile(userId: string, data: NewProfile): Promise<void> {
  const p = await primaryProfile(userId);
  if (!p) {
    await createProfile(userId, { ...data, relation: "self" });
    return;
  }
  await db.update(schema.birthProfiles).set(data).where(eq(schema.birthProfiles.id, p.id));
}
