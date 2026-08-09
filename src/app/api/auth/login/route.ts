import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyPassword, createSession } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = String(body.email ?? "")
      .trim()
      .toLowerCase();
    const password = String(body.password ?? "");

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required." },
        { status: 400 }
      );
    }

    const coach = await prisma.coach.findUnique({ where: { email } });
    if (!coach || !(await verifyPassword(password, coach.passwordHash))) {
      return NextResponse.json(
        { error: "Invalid email or password." },
        { status: 401 }
      );
    }

    await createSession({ coachId: coach.id, email: coach.email, name: coach.name });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("login error", err);
    return NextResponse.json({ error: "Login failed." }, { status: 500 });
  }
}
