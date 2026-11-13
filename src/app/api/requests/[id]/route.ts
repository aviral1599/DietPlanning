import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { guard, jsonError, safeJsonParse } from "@/lib/api";
import { applyChange, type ChangeAction, type ChangeScope } from "@/lib/foodbank/changes";
import type { ChartDay, PlanItem } from "@/lib/foodbank/engine";
import type { MealTime } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };

// POST /api/requests/[id]  body: { decision: "approve" | "reject", coachNote?: string }
export async function POST(req: Request, { params }: Params) {
  try {
    const coachId = await guard();
    const { id } = await params;
    const body = (await req.json()) as { decision?: string; coachNote?: string };
    const request = await prisma.changeRequest.findUnique({ where: { id } });
    if (!request || request.coachId !== coachId) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (request.status !== "pending") return NextResponse.json({ error: "Already resolved." }, { status: 409 });
    const coachNote = String(body.coachNote ?? "").slice(0, 1000);

    if (body.decision === "reject") {
      await prisma.changeRequest.update({
        where: { id },
        data: { status: "rejected", coachNote, resolvedAt: new Date() },
      });
      return NextResponse.json({ ok: true, status: "rejected" });
    }
    if (body.decision !== "approve") return NextResponse.json({ error: "Invalid decision." }, { status: 400 });

    const chart = await prisma.dietChart.findUnique({ where: { id: request.chartId } });
    if (!chart) return NextResponse.json({ error: "Chart no longer exists." }, { status: 404 });

    const result = applyChange(safeJsonParse<ChartDay[]>(chart.days, []), {
      day: request.day,
      meal: request.meal as MealTime,
      action: request.action as ChangeAction,
      scope: request.scope as ChangeScope,
      targetUid: request.targetUid,
      fromItem: safeJsonParse<PlanItem | null>(request.fromItem, null),
      toItem: safeJsonParse<PlanItem | null>(request.toItem, null),
    });
    if (result.conflict) return NextResponse.json({ error: result.conflict }, { status: 409 });

    // Apply + resolve atomically so the chart and request never disagree.
    const [updatedChart] = await prisma.$transaction([
      prisma.dietChart.update({
        where: { id: chart.id },
        data: { days: JSON.stringify(result.days), version: { increment: 1 }, updatedBy: "client-request" },
      }),
      prisma.changeRequest.update({
        where: { id },
        data: { status: "approved", coachNote, resolvedAt: new Date() },
      }),
    ]);
    return NextResponse.json({ ok: true, status: "approved", applied: result.applied, version: updatedChart.version });
  } catch (e) {
    return jsonError(e, "Could not resolve request");
  }
}
