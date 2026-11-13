import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { guard, jsonError, safeJsonParse } from "@/lib/api";
import type { PlanItem } from "@/lib/foodbank/engine";

// GET /api/requests?status=pending|resolved -> client change requests for this coach
export async function GET(req: Request) {
  try {
    const coachId = await guard();
    const status = new URL(req.url).searchParams.get("status") ?? "pending";
    const rows = await prisma.changeRequest.findMany({
      where: {
        coachId,
        status: status === "pending" ? "pending" : { in: ["approved", "rejected", "cancelled"] },
      },
      orderBy: { createdAt: status === "pending" ? "asc" : "desc" },
      take: 200,
      include: {
        client: { select: { id: true, name: true } },
        chart: { select: { id: true, title: true, reportId: true, startDate: true } },
      },
    });
    return NextResponse.json({
      requests: rows.map((r) => ({
        id: r.id,
        chartId: r.chartId,
        chartTitle: r.chart.title,
        reportId: r.chart.reportId,
        startDate: r.chart.startDate,
        clientId: r.client.id,
        clientName: r.client.name,
        day: r.day,
        meal: r.meal,
        action: r.action,
        scope: r.scope,
        targetUid: r.targetUid,
        fromItem: safeJsonParse<PlanItem | null>(r.fromItem, null),
        toItem: safeJsonParse<PlanItem | null>(r.toItem, null),
        note: r.note,
        status: r.status,
        coachNote: r.coachNote,
        createdAt: r.createdAt.toISOString(),
        resolvedAt: r.resolvedAt?.toISOString() ?? null,
      })),
    });
  } catch (e) {
    return jsonError(e);
  }
}
