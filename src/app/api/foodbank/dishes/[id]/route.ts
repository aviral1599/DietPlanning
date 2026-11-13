import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { guard, jsonError } from "@/lib/api";
import { validateCustomDish } from "@/lib/foodbank/validate";

type Params = { params: Promise<{ id: string }> };

async function owned(coachId: string, id: string) {
  const row = await prisma.customDish.findUnique({ where: { id } });
  return row && row.coachId === coachId ? row : null;
}

export async function PUT(req: Request, { params }: Params) {
  try {
    const coachId = await guard();
    const { id } = await params;
    if (!(await owned(coachId, id))) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const result = validateCustomDish(await req.json());
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    const row = await prisma.customDish.update({ where: { id }, data: { data: JSON.stringify(result.data) } });
    return NextResponse.json({ dish: { id: row.id, coachId, data: row.data } });
  } catch (e) {
    return jsonError(e, "Could not update dish");
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const coachId = await guard();
    const { id } = await params;
    if (!(await owned(coachId, id))) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await prisma.customDish.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return jsonError(e, "Could not delete dish");
  }
}
