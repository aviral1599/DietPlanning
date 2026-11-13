import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { guard, jsonError } from "@/lib/api";
import type { ChartDay } from "@/lib/foodbank/engine";
import { ensureClientForReport, ownedChart, toChartDTO } from "@/lib/foodbank/server";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const coachId = await guard();
    const { id } = await params;
    const chart = await ownedChart(coachId, id);
    if (!chart) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ chart: toChartDTO(chart) });
  } catch (e) {
    return jsonError(e);
  }
}

// PUT /api/charts/[id] -> save edits (days, title, notes, meal times, sharing)
export async function PUT(req: Request, { params }: Params) {
  try {
    const coachId = await guard();
    const { id } = await params;
    const chart = await ownedChart(coachId, id);
    if (!chart) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const body = (await req.json()) as {
      days?: ChartDay[];
      title?: string;
      notes?: string;
      mealTimes?: Record<string, string>;
      shared?: boolean;
      baseVersion?: number;
    };

    // Optimistic concurrency: refuse to overwrite a newer version (e.g. an
    // approved client request landed while this editor was open).
    if (body.days && typeof body.baseVersion === "number" && body.baseVersion < chart.version) {
      return NextResponse.json(
        { error: "This chart was updated elsewhere. Reload to see the latest version.", chart: toChartDTO(chart) },
        { status: 409 }
      );
    }

    let clientId = chart.clientId;
    if (body.shared && !clientId) {
      const report = await prisma.report.findUnique({ where: { id: chart.reportId } });
      if (report) clientId = (await ensureClientForReport(report)).id;
    }

    const updated = await prisma.dietChart.update({
      where: { id },
      data: {
        ...(body.days ? { days: JSON.stringify(body.days), version: { increment: 1 }, updatedBy: "coach" } : {}),
        ...(typeof body.title === "string" ? { title: body.title.slice(0, 120) } : {}),
        ...(typeof body.notes === "string" ? { notes: body.notes.slice(0, 4000) } : {}),
        ...(body.mealTimes ? { mealTimes: JSON.stringify(body.mealTimes) } : {}),
        ...(typeof body.shared === "boolean" ? { shared: body.shared, clientId } : {}),
      },
    });
    return NextResponse.json({ chart: toChartDTO(updated) });
  } catch (e) {
    return jsonError(e, "Could not save chart");
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const coachId = await guard();
    const { id } = await params;
    if (!(await ownedChart(coachId, id))) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await prisma.dietChart.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return jsonError(e, "Could not delete chart");
  }
}
