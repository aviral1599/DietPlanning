import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { guard, jsonError } from "@/lib/api";
import { generateChart, MEAL_TIME_DEFAULTS, type ChartPrefs } from "@/lib/foodbank/engine";
import { chartsWithChoices, loadDishPool, newPrefsFor, reportContext, targetsFor, toChartDTO } from "@/lib/foodbank/server";

type Params = { params: Promise<{ id: string }> };

async function ownedReport(coachId: string, id: string) {
  const r = await prisma.report.findUnique({ where: { id } });
  return r && r.coachId === coachId ? r : null;
}

// GET /api/reports/[id]/charts -> charts for this report (newest first)
export async function GET(_req: Request, { params }: Params) {
  try {
    const coachId = await guard();
    const { id } = await params;
    if (!(await ownedReport(coachId, id))) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const rows = await prisma.dietChart.findMany({ where: { reportId: id }, orderBy: { createdAt: "desc" } });
    return NextResponse.json({ charts: await chartsWithChoices(rows) });
  } catch (e) {
    return jsonError(e);
  }
}

// POST /api/reports/[id]/charts -> generate a new chart
export async function POST(req: Request, { params }: Params) {
  try {
    const coachId = await guard();
    const { id } = await params;
    const report = await ownedReport(coachId, id);
    if (!report) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const body = (await req.json().catch(() => ({}))) as { prefs?: Partial<ChartPrefs>; title?: string };

    const days = Math.min(28, Math.max(1, Number(body.prefs?.days ?? 7)));
    const prefs = newPrefsFor(report, { ...(body.prefs ?? {}), days });
    const targets = targetsFor(report, prefs);
    const { profile } = reportContext(report);
    const pool = await loadDishPool(coachId);
    const chartDays = generateChart(profile, prefs, targets, pool);

    const row = await prisma.dietChart.create({
      data: {
        coachId,
        reportId: report.id,
        clientId: report.clientId,
        title: body.title?.trim() || (days >= 28 ? "Monthly Diet Chart" : days >= 14 ? "2-Week Diet Chart" : "Weekly Diet Chart"),
        startDate: prefs.startDate,
        days: JSON.stringify(chartDays),
        prefs: JSON.stringify(prefs),
        targets: JSON.stringify(targets),
        mealTimes: JSON.stringify(MEAL_TIME_DEFAULTS),
      },
    });
    return NextResponse.json({ chart: toChartDTO(row) });
  } catch (e) {
    return jsonError(e, "Could not generate chart");
  }
}
