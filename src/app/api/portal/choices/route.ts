import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { guardClient, jsonError, safeJsonParse } from "@/lib/api";
import type { ChartDay } from "@/lib/foodbank/engine";
import { MEAL_TIMES } from "@/lib/types";

// POST /api/portal/choices -> the client ticks which option they had
// body: { chartId, day, uid, choice } — choice 0 = main dish, 1.. = alternative,
// null = clear the tick.
export async function POST(req: Request) {
  try {
    const client = await guardClient();
    const body = (await req.json()) as Record<string, unknown>;
    const chart = await prisma.dietChart.findUnique({ where: { id: String(body.chartId ?? "") } });
    if (!chart || chart.clientId !== client.id || !chart.shared) {
      return NextResponse.json({ error: "Chart not found." }, { status: 404 });
    }
    const dayIdx = Number(body.day);
    const uid = String(body.uid ?? "");
    const day = safeJsonParse<ChartDay[]>(chart.days, []).find((d) => d.day === dayIdx);
    const item = day && MEAL_TIMES.flatMap((m) => day.meals[m] ?? []).find((it) => it.uid === uid);
    if (!item || !item.alts?.length) return NextResponse.json({ error: "This dish has no options." }, { status: 400 });

    const where = { chartId_day_uid: { chartId: chart.id, day: dayIdx, uid } };
    if (body.choice === null) {
      await prisma.mealChoice.deleteMany({ where: { chartId: chart.id, day: dayIdx, uid } });
      return NextResponse.json({ ok: true, choice: null });
    }
    const choice = Number(body.choice);
    if (!Number.isInteger(choice) || choice < 0 || choice > item.alts.length) {
      return NextResponse.json({ error: "Invalid option." }, { status: 400 });
    }
    await prisma.mealChoice.upsert({ where, create: { chartId: chart.id, day: dayIdx, uid, choice }, update: { choice } });
    return NextResponse.json({ ok: true, choice });
  } catch (e) {
    return jsonError(e, "Could not save your choice");
  }
}
