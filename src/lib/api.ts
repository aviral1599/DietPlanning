import { NextResponse } from "next/server";
import { getSession } from "./auth";

/** Returns coachId or throws a NextResponse (401). Use inside try/catch. */
export async function guard(): Promise<string> {
  const session = await getSession();
  if (!session) {
    throw NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return session.coachId;
}

export function isNextResponse(x: unknown): x is NextResponse {
  return x instanceof NextResponse;
}

export function safeJsonParse<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
