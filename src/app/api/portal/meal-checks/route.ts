import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { guardClient, jsonError, safeJsonParse } from "@/lib/api";
import type { ChartDay } from "@/lib/foodbank/engine";
import { MEAL_TIMES, type MealTime } from "@/lib/types";

// POST /api/portal/meal-checks -> the client ticks a whole meal as eaten
// body: { chartId, day, meal, done } where meal is a MealTime key ("breakfast")
// and done=false clears the tick.
export async function POST(req: Request) {
  try {
    const client = await guardClient();
    const body = (await req.json()) as Record<string, unknown>;
    const chart = await prisma.dietChart.findUnique({ where: { id: String(body.chartId ?? "") } });
    if (!chart || chart.clientId !== client.id || !chart.shared) {
      return NextResponse.json({ error: "Chart not found." }, { status: 404 });
    }
    const dayIdx = Number(body.day);
    const meal = String(body.meal ?? "") as MealTime;
    if (!MEAL_TIMES.includes(meal)) return NextResponse.json({ error: "Invalid meal." }, { status: 400 });
    const day = Number.isInteger(dayIdx) ? safeJsonParse<ChartDay[]>(chart.days, []).find((d) => d.day === dayIdx) : undefined;
    if (!day) return NextResponse.json({ error: "Invalid day." }, { status: 400 });
    if (!day.meals?.[meal]?.length) return NextResponse.json({ error: "This meal is empty on that day." }, { status: 400 });
    if (typeof body.done !== "boolean") return NextResponse.json({ error: "Invalid value." }, { status: 400 });

    if (!body.done) {
      await prisma.mealCheck.deleteMany({ where: { chartId: chart.id, day: dayIdx, meal } });
      return NextResponse.json({ ok: true, done: false });
    }
    try {
      await prisma.mealCheck.upsert({
        where: { chartId_day_meal: { chartId: chart.id, day: dayIdx, meal } },
        create: { chartId: chart.id, day: dayIdx, meal },
        update: {},
      });
    } catch (e) {
      // Two ticks racing on the same meal: the other request already saved it.
      if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) throw e;
    }
    return NextResponse.json({ ok: true, done: true });
  } catch (e) {
    return jsonError(e, "Could not save your tick");
  }
}
