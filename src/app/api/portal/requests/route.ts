import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { guardClient, jsonError, safeJsonParse } from "@/lib/api";
import { BUILTIN_DISHES, customToDish, snapUnits } from "@/lib/foodbank/bank";
import type { ChartDay, PlanItem } from "@/lib/foodbank/engine";
import { newUid } from "@/lib/foodbank/engine";
import { MEAL_TIMES, type MealTime } from "@/lib/types";

const ACTIONS = ["swap", "remove", "add", "portion"] as const;
const MAX_PENDING = 30;

// POST /api/portal/requests -> client asks for a change to their shared chart
// body: { chartId, day, meal, action, scope, targetUid?, toDishId?, units?, note? }
export async function POST(req: Request) {
  try {
    const client = await guardClient();
    const body = (await req.json()) as Record<string, unknown>;

    const chart = await prisma.dietChart.findUnique({ where: { id: String(body.chartId ?? "") } });
    if (!chart || chart.clientId !== client.id || !chart.shared) {
      return NextResponse.json({ error: "Chart not found." }, { status: 404 });
    }
    const action = String(body.action) as (typeof ACTIONS)[number];
    if (!ACTIONS.includes(action)) return NextResponse.json({ error: "Invalid action." }, { status: 400 });
    const meal = String(body.meal) as MealTime;
    if (!MEAL_TIMES.includes(meal)) return NextResponse.json({ error: "Invalid meal." }, { status: 400 });
    const dayIdx = Number(body.day);
    const days = safeJsonParse<ChartDay[]>(chart.days, []);
    const day = days.find((d) => d.day === dayIdx);
    if (!day) return NextResponse.json({ error: "Invalid day." }, { status: 400 });

    const pending = await prisma.changeRequest.count({ where: { clientId: client.id, status: "pending" } });
    if (pending >= MAX_PENDING) {
      return NextResponse.json({ error: "You have many pending requests. Please wait for your nutritionist to review them." }, { status: 429 });
    }

    // Resolve dishes (built-in + this coach's custom dishes only).
    const custom = (await prisma.customDish.findMany({ where: { coachId: chart.coachId } }))
      .map(customToDish)
      .filter((d): d is NonNullable<typeof d> => !!d);
    const index = Object.fromEntries([...BUILTIN_DISHES, ...custom].map((d) => [d.id, d]));

    let fromItem: PlanItem | null = null;
    const targetUid = body.targetUid ? String(body.targetUid) : null;
    if (action !== "add") {
      fromItem = day.meals[meal]?.find((i) => i.uid === targetUid) ?? null;
      if (!fromItem) return NextResponse.json({ error: "That dish is no longer in your plan." }, { status: 409 });
    }

    let toItem: PlanItem | null = null;
    if (action === "swap" || action === "add") {
      const dish = index[String(body.toDishId ?? "")];
      if (!dish) return NextResponse.json({ error: "Choose a dish from the food bank." }, { status: 400 });
      if (!dish.slots.includes(meal)) return NextResponse.json({ error: "That dish isn't suitable for this meal." }, { status: 400 });
      toItem = { uid: newUid(), dishId: dish.id, units: snapUnits(dish, Number(body.units) || dish.unit.default), by: "client" };
    } else if (action === "portion") {
      const dish = index[fromItem!.dishId];
      if (!dish) return NextResponse.json({ error: "Unknown dish." }, { status: 400 });
      const units = snapUnits(dish, Number(body.units));
      if (units === fromItem!.units) return NextResponse.json({ error: "Portion is unchanged." }, { status: 400 });
      toItem = { ...fromItem!, units };
    }

    const created = await prisma.changeRequest.create({
      data: {
        chartId: chart.id,
        clientId: client.id,
        coachId: chart.coachId,
        day: dayIdx,
        meal,
        action,
        scope: body.scope === "all" && (action === "swap" || action === "remove") ? "all" : "this",
        targetUid,
        fromItem: fromItem ? JSON.stringify(fromItem) : null,
        toItem: toItem ? JSON.stringify(toItem) : null,
        note: String(body.note ?? "").slice(0, 500),
      },
    });
    return NextResponse.json({ id: created.id });
  } catch (e) {
    return jsonError(e, "Could not send request");
  }
}
