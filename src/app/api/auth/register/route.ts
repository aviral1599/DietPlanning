import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword, createSession } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const name = String(body.name ?? "").trim();
    const email = String(body.email ?? "")
      .trim()
      .toLowerCase();
    const password = String(body.password ?? "");
    const clinicName = String(body.clinicName ?? "Master Mind Body Global").trim();

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Name, email and password are required." },
        { status: 400 }
      );
    }
    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters." },
        { status: 400 }
      );
    }

    const existing = await prisma.coach.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 409 }
      );
    }

    const coach = await prisma.coach.create({
      data: {
        name,
        email,
        passwordHash: await hashPassword(password),
        clinicName: clinicName || "Master Mind Body Global",
      },
    });

    await createSession({ coachId: coach.id, email: coach.email, name: coach.name });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("register error", err);
    return NextResponse.json({ error: "Registration failed." }, { status: 500 });
  }
}
