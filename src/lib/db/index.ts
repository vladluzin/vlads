import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// postgres.js connects lazily on the first query, so importing this module is cheap
// (and safe during `next build`). One pool per process, reused across hot reloads.
const globalForDb = globalThis as unknown as { pg?: ReturnType<typeof postgres> };
const client = (globalForDb.pg ??= postgres(process.env.DATABASE_URL ?? "postgresql://localhost:5432/astro", { max: 10 }));

export const db = drizzle({ client, schema });
export { schema };
export type DB = typeof db;
