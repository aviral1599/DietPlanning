import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { guard, jsonError, safeJsonParse } from "@/lib/api";
import { generateChart, regenerateDay, type ChartDay, type ChartPrefs } from "@/lib/foodbank/engine";
import { loadDishPool, ownedChart, reportContext, targetsFor, toChartDTO } from "@/lib/foodbank/server";

type Params = { params: Promise<{ id: string }> };

// POST /api/charts/[id]/regenerate
// body: { day?: number, prefs?: Partial<ChartPrefs> }
//  - with `day`: rebuild that single day (locked dishes kept)
//  - without:    rebuild the whole chart with a fresh seed (locked dishes kept)
export async function POST(req: Request, { params }: Params) {
  try {
    const coachId = await guard();
    const { id } = await params;
    const chart = await ownedChart(coachId, id);
    if (!chart) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const report = await prisma.report.findUnique({ where: { id: chart.reportId } });
    if (!report) return NextResponse.json({ error: "Report missing" }, { status: 404 });

    const body = (await req.json().catch(() => ({}))) as { day?: number; prefs?: Partial<ChartPrefs> };
    const oldPrefs = safeJsonParse<ChartPrefs>(chart.prefs, {} as ChartPrefs);
    const prefs: ChartPrefs = {
      ...oldPrefs,
      ...(body.prefs ?? {}),
      seed: body.prefs?.seed ?? Math.floor(Math.random() * 1e9),
    };
    prefs.days = Math.min(28, Math.max(1, Number(prefs.days) || 7));

    const { profile } = reportContext(report);
    const targets = targetsFor(report, prefs);
    const pool = await loadDishPool(coachId);
    const current = safeJsonParse<ChartDay[]>(chart.days, []);

    let days: ChartDay[];
    if (typeof body.day === "number") {
      const rebuilt = regenerateDay(current, body.day, profile, prefs, targets, pool);
      days = current.map((d) => (d.day === body.day ? rebuilt : d));
    } else {
      days = generateChart(profile, prefs, targets, pool, prefs.startDate === oldPrefs.startDate ? current : undefined);
    }

    const updated = await prisma.dietChart.update({
      where: { id },
      data: {
        days: JSON.stringify(days),
        prefs: JSON.stringify(prefs),
        targets: JSON.stringify(targets),
        startDate: prefs.startDate,
        version: { increment: 1 },
        updatedBy: "coach",
      },
    });
    return NextResponse.json({ chart: toChartDTO(updated) });
  } catch (e) {
    return jsonError(e, "Could not regenerate");
  }
}
