import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { guard, isNextResponse } from "@/lib/api";

// GET /api/settings -> coach profile (without exposing the raw key)
export async function GET() {
  try {
    const coachId = await guard();
    const coach = await prisma.coach.findUnique({ where: { id: coachId } });
    if (!coach) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({
      name: coach.name,
      email: coach.email,
      clinicName: coach.clinicName,
      hasApiKey: !!coach.anthropicKey,
    });
  } catch (e) {
    if (isNextResponse(e)) return e;
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

// PUT /api/settings -> update name, clinicName, and/or anthropicKey
export async function PUT(req: Request) {
  try {
    const coachId = await guard();
    const body = await req.json();
    const data: Record<string, string | null> = {};
    if (typeof body.name === "string" && body.name.trim())
      data.name = body.name.trim();
    if (typeof body.clinicName === "string")
      data.clinicName = body.clinicName.trim() || "Master Mind Body Global";
    if (typeof body.anthropicKey === "string") {
      // Empty string clears the key.
      data.anthropicKey = body.anthropicKey.trim() || null;
    }
    const coach = await prisma.coach.update({ where: { id: coachId }, data });
    return NextResponse.json({
      name: coach.name,
      clinicName: coach.clinicName,
      hasApiKey: !!coach.anthropicKey,
    });
  } catch (e) {
    if (isNextResponse(e)) return e;
    return NextResponse.json({ error: "Failed to save settings" }, { status: 500 });
  }
}
