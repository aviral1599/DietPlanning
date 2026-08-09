import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { prisma } from "./db";

const COOKIE_NAME = "nutriplan_session";
const MAX_AGE = 60 * 60 * 24 * 14; // 14 days

function secret(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) {
    throw new Error("AUTH_SECRET is missing or too short. Set it in .env");
  }
  return new TextEncoder().encode(s);
}

export interface SessionPayload {
  coachId: string;
  email: string;
  name: string;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createSession(payload: SessionPayload): Promise<void> {
  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());

  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: MAX_AGE,
    path: "/",
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return {
      coachId: String(payload.coachId),
      email: String(payload.email),
      name: String(payload.name),
    };
  } catch {
    return null;
  }
}

/** Returns the full Coach record for the current session, or null. */
export async function getCurrentCoach() {
  const session = await getSession();
  if (!session) return null;
  return prisma.coach.findUnique({ where: { id: session.coachId } });
}

/** Throws (for use in API routes) if no session. */
export async function requireCoachId(): Promise<string> {
  const session = await getSession();
  if (!session) throw new Error("UNAUTHORIZED");
  return session.coachId;
}
