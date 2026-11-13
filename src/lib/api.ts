import { NextResponse } from "next/server";
import { getClientSession, getSession } from "./auth";
import { prisma } from "./db";

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

/** Returns the signed-in, portal-enabled client or throws a 401 response. */
export async function guardClient() {
  const session = await getClientSession();
  if (!session) throw NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const client = await prisma.client.findUnique({ where: { id: session.clientId } });
  if (!client || !client.portalEnabled) {
    throw NextResponse.json({ error: "Portal access disabled" }, { status: 403 });
  }
  return client;
}

export function jsonError(e: unknown, fallback = "Request failed") {
  if (isNextResponse(e)) return e;
  console.error(e);
  return NextResponse.json({ error: fallback }, { status: 500 });
}
