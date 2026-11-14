import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { guard, jsonError } from "@/lib/api";
import { BUILTIN_DISHES, registerCustomIngredients } from "@/lib/foodbank/bank";
import { rewriteDishInCharts } from "@/lib/foodbank/server";
import { validateCustomDish, validateCustomIngredient } from "@/lib/foodbank/validate";

// GET /api/foodbank/dishes -> the coach's custom rows (dishes, client versions, ingredients)
export async function GET() {
  try {
    const coachId = await guard();
    const rows = await prisma.customDish.findMany({ where: { coachId }, orderBy: { createdAt: "desc" } });
    return NextResponse.json({ dishes: rows.map((r) => ({ id: r.id, coachId: r.coachId, data: r.data })) });
  } catch (e) {
    return jsonError(e);
  }
}

// POST /api/foodbank/dishes -> create a custom dish, a client-specific version,
// a replacement for a built-in dish, or (kind: "ingredient") a coach ingredient.
export async function POST(req: Request) {
  try {
    const coachId = await guard();
    const body = await req.json();
    const rows = await prisma.customDish.findMany({ where: { coachId } });

    if (body.kind === "ingredient") {
      const ing = validateCustomIngredient(body);
      if (!ing.ok) return NextResponse.json({ error: ing.error }, { status: 400 });
      const row = await prisma.customDish.create({ data: { coachId, data: JSON.stringify(ing.data) } });
      return NextResponse.json({ dish: { id: row.id, coachId, data: row.data } });
    }

    registerCustomIngredients(rows); // so recipes may use the coach's own ingredients
    const result = validateCustomDish(body);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    const data = result.data;

    const knownDish = (id: string) => BUILTIN_DISHES.some((d) => d.id === id) || rows.some((r) => r.id === id);
    if (data.chartId) {
      const chart = await prisma.dietChart.findUnique({ where: { id: data.chartId }, select: { coachId: true } });
      if (!chart || chart.coachId !== coachId) return NextResponse.json({ error: "Chart not found." }, { status: 404 });
    }
    if (data.variantOf && !knownDish(data.variantOf)) return NextResponse.json({ error: "Original dish not found." }, { status: 400 });
    const replacesBuiltin = !!data.replaces && BUILTIN_DISHES.some((d) => d.id === data.replaces);
    if (data.replaces && !replacesBuiltin) return NextResponse.json({ error: "Only food bank dishes can be replaced this way." }, { status: 400 });

    const row = await prisma.customDish.create({ data: { coachId, data: JSON.stringify(data) } });
    const chartsUpdated = replacesBuiltin ? await rewriteDishInCharts(coachId, data.replaces as string, row.id) : 0;
    return NextResponse.json({ dish: { id: row.id, coachId, data: row.data }, chartsUpdated });
  } catch (e) {
    return jsonError(e, "Could not save dish");
  }
}
