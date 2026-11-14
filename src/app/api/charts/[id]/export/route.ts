import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/db";
import { guard, jsonError } from "@/lib/api";
import { expandCustomRows, formatPortion } from "@/lib/foodbank/bank";
import { dayTotals, groceryList } from "@/lib/foodbank/engine";
import { ownedChart, toChartDTO } from "@/lib/foodbank/server";
import { MEAL_TIMES, MEAL_TIME_LABELS } from "@/lib/types";

export const runtime = "nodejs";

const HEADER = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEEFDF6" } } as const;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const coachId = await guard();
    const { id } = await params;
    const row = await ownedChart(coachId, id);
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const chart = toChartDTO(row);
    const report = await prisma.report.findUnique({ where: { id: row.reportId }, select: { clientName: true } });
    const { index } = expandCustomRows(await prisma.customDish.findMany({ where: { coachId } }));

    const wb = new ExcelJS.Workbook();
    wb.creator = "NutriPlan";
    const meals = MEAL_TIMES.filter((m) => chart.days.some((d) => d.meals[m]?.length));

    for (let w = 0; w * 7 < chart.days.length; w++) {
      const week = chart.days.slice(w * 7, w * 7 + 7);
      const ws = wb.addWorksheet(`Week ${w + 1}`, { views: [{ state: "frozen", xSplit: 1, ySplit: 1 }] });
      ws.addRow(["Meal", ...week.map((d) => `Day ${d.day + 1} (${d.date})`)]);
      for (const m of meals) {
        ws.addRow([
          `${MEAL_TIME_LABELS[m]} ${chart.mealTimes[m] ?? ""}`.trim(),
          ...week.map((d) =>
            (d.meals[m] ?? [])
              .map((it) =>
                [{ dishId: it.dishId, units: it.units }, ...(it.alts ?? [])]
                  .map((c) => (index[c.dishId] ? `${index[c.dishId].name} — ${formatPortion(index[c.dishId], c.units)}` : "?"))
                  .join(" OR ")
              )
              .join("\n")
          ),
        ]);
      }
      for (const [label, key] of [["Energy (kcal)", "kcal"], ["Protein (g)", "protein"], ["Carbs (g)", "carbs"], ["Fat (g)", "fat"], ["Fibre (g)", "fibre"], ["Sodium (mg)", "sodium"]] as const) {
        ws.addRow([label, ...week.map((d) => Math.round(dayTotals(d, index)[key]))]);
      }
      ws.getColumn(1).width = 20;
      for (let c = 2; c <= week.length + 1; c++) ws.getColumn(c).width = 30;
      ws.eachRow((r, i) => {
        r.alignment = { wrapText: true, vertical: "top" };
        if (i === 1) {
          r.font = { bold: true };
          r.eachCell((cell) => (cell.fill = HEADER));
        }
      });

      const gs = wb.addWorksheet(`Grocery W${w + 1}`);
      gs.addRow(["Category", "Item", "Quantity"]).font = { bold: true };
      for (const [cat, lines] of Object.entries(groceryList(week, index))) {
        for (const l of lines) gs.addRow([cat, l.name, l.display]);
      }
      gs.getColumn(1).width = 22;
      gs.getColumn(2).width = 36;
      gs.getColumn(3).width = 14;
    }

    const ts = wb.addWorksheet("Targets");
    ts.addRow(["Nutrient", "Target / day"]).font = { bold: true };
    ts.addRow(["Energy (kcal)", chart.targets.kcal]);
    ts.addRow(["Protein (g)", chart.targets.protein]);
    ts.addRow(["Carbohydrate (g)", chart.targets.carbs]);
    ts.addRow(["Fat (g)", chart.targets.fat]);
    ts.addRow(["Fibre (g)", chart.targets.fibre]);
    ts.getColumn(1).width = 22;

    const buf = await wb.xlsx.writeBuffer();
    const name = `${chart.title}_${report?.clientName ?? ""}`.replace(/[^a-z0-9]+/gi, "_");
    return new NextResponse(new Uint8Array(buf as ArrayBuffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${name}.xlsx"`,
      },
    });
  } catch (e) {
    return jsonError(e, "Failed to export");
  }
}
