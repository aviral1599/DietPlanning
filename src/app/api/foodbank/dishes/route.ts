import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { guard, jsonError } from "@/lib/api";
import { validateCustomDish } from "@/lib/foodbank/validate";

// GET /api/foodbank/dishes -> the coach's custom dishes (raw data)
export async function GET() {
  try {
    const coachId = await guard();
    const rows = await prisma.customDish.findMany({ where: { coachId }, orderBy: { createdAt: "desc" } });
    return NextResponse.json({ dishes: rows.map((r) => ({ id: r.id, coachId: r.coachId, data: r.data })) });
  } catch (e) {
    return jsonError(e);
  }
}

// POST /api/foodbank/dishes -> create a custom dish
export async function POST(req: Request) {
  try {
    const coachId = await guard();
    const body = await req.json();
    const result = validateCustomDish(body);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    const row = await prisma.customDish.create({ data: { coachId, data: JSON.stringify(result.data) } });
    return NextResponse.json({ dish: { id: row.id, coachId, data: row.data } });
  } catch (e) {
    return jsonError(e, "Could not save dish");
  }
}
