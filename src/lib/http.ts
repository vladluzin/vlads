import { NextResponse } from "next/server";
import type { ZodType } from "zod";
import { currentUser, type User } from "./auth/session";

export const json = (data: unknown, status = 200) => NextResponse.json(data, { status });
export const error = (code: string, status: number, message?: string) => NextResponse.json({ error: code, message }, { status });

/** Resolves the signed-in user or returns a 401 response. */
export async function requireUser(): Promise<User | NextResponse> {
  const user = await currentUser();
  return user ?? error("unauthorized", 401);
}

export async function parseBody<T>(req: Request, schema: ZodType<T>): Promise<T | NextResponse> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return error("invalid_json", 400);
  }
  const r = schema.safeParse(raw);
  return r.success ? r.data : error("invalid_input", 400, r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
}

export const isResponse = (x: unknown): x is NextResponse => x instanceof NextResponse;
