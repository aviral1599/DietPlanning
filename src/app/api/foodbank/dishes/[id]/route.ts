import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { guard, jsonError } from "@/lib/api";
import { registerCustomIngredients } from "@/lib/foodbank/bank";
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
    const existing = await owned(coachId, id);
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const body = await req.json();
    const prev = JSON.parse(existing.data) as Record<string, unknown>;

    // "Restore original": show the built-in dish again; charts keep this version.
    if (body.restoreOriginal) {
      if (!prev.replaces) return NextResponse.json({ error: "This dish doesn't replace a food bank dish." }, { status: 400 });
      const row = await prisma.customDish.update({ where: { id }, data: { data: JSON.stringify({ ...prev, replaceActive: false }) } });
      return NextResponse.json({ dish: { id: row.id, coachId, data: row.data } });
    }

    registerCustomIngredients(await prisma.customDish.findMany({ where: { coachId } }));
    // Editing keeps what this row is (client version / replacement) unless the body says otherwise.
    const result = validateCustomDish({
      variantOf: prev.variantOf,
      chartId: prev.chartId,
      replaces: prev.replaces,
      replaceActive: prev.replaceActive,
      ...body,
    });
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
