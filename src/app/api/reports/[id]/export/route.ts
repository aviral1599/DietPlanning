import { glycemicSummary } from "@/lib/glycemic";
import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/db";
import { guard, isNextResponse, safeJsonParse } from "@/lib/api";
import { toSubjectInfo } from "@/lib/report";
import {
  Analysis,
  CalcResults,
  DIET_TYPE_LABELS,
  DietType,
  FOOD_GROUP_LABELS,
  FOOD_GROUP_ORDER,
  MEAL_TIMES,
  MEAL_TIME_LABELS,
  MenuPlan,
} from "@/lib/types";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const coachId = await guard();
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const format = searchParams.get("format") === "csv" ? "csv" : "excel";

    const report = await prisma.report.findUnique({ where: { id } });
    if (!report || report.coachId !== coachId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const subject = toSubjectInfo(report);
    const results = safeJsonParse<CalcResults>(report.results, {} as CalcResults);
    const menuPlan = safeJsonParse<MenuPlan>(report.menuPlan, {} as MenuPlan);
    const analysis = safeJsonParse<Analysis>(report.analysis, {
      dietaryGoals: [],
      dos: [],
      donts: [],
      foodsToInclude: [],
      foodsToExclude: [],
      generatedBy: "builtin",
    });

    const safeName = subject.clientName.replace(/[^a-z0-9]+/gi, "_");

    if (format === "csv") {
      const csv = buildCsv(subject, results, menuPlan);
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="DietPlan_${safeName}.csv"`,
        },
      });
    }

    const wb = new ExcelJS.Workbook();
    wb.creator = "NutriPlan";

    // --- Assessment sheet ---
    const a = wb.addWorksheet("Assessment");
    a.columns = [{ width: 28 }, { width: 24 }];
    const push = (k: string, v: string | number) => a.addRow([k, v]);
    a.addRow(["SUBJECT INFORMATION"]).font = { bold: true };
    push("Name", subject.clientName);
    push("Age", subject.age);
    push("Sex", subject.sex);
    push("Height (cm)", subject.heightCm);
    push("Weight (kg)", subject.weightKg);
    push("Activity", subject.activityLevel);
    push("Income group", subject.incomeGroup);
    push("Diet preference", subject.dietPreference);
    push("Condition / goal", DIET_TYPE_LABELS[subject.dietType as DietType]);
    push("Blood sugar status / labs", glycemicSummary(subject) || "Normal / not tested");
    push("Allergies", subject.allergies || "None");
    push("Objective", subject.objective || "—");
    a.addRow([]);
    a.addRow(["CALCULATIONS"]).font = { bold: true };
    push("IBW (kg)", results.ibw);
    push("BMI", results.bmi);
    push("BMI category", results.bmiCategory);
    push("BMR (kcal)", results.bmr);
    push("Physical activity (kcal)", results.pa);
    push("SDA (kcal)", results.sda);
    push("TEE (kcal)", results.tee);
    push("Target energy (kcal)", results.energySource === "manual" ? `${results.energy} (set by coach)` : results.energy);
    push("Protein (g)", results.protein.grams);
    push("Fat (g)", results.fat.grams);
    push("Carbohydrate (g)", results.cho.grams);
    a.addRow([]);
    a.addRow(["RDA COMPARISON", "RDA", "MRDA", "Difference"]).font = {
      bold: true,
    };
    results.rdaComparison.forEach((r) =>
      a.addRow([`${r.nutrient} (${r.unit})`, r.rda, r.mrda, r.difference])
    );

    // --- Comprehensive sheet ---
    const c = wb.addWorksheet("Comprehensive Menu");
    c.addRow(["Food Group", "Exchanges", "Energy", "Protein", "Fat", "CHO"]).font =
      { bold: true };
    (menuPlan.comprehensive ?? []).forEach((r) =>
      c.addRow([
        FOOD_GROUP_LABELS[r.group],
        r.exchanges,
        r.energy,
        r.protein,
        r.fat,
        r.cho,
      ])
    );
    c.addRow([
      "TOTAL",
      "",
      menuPlan.totals?.energy,
      menuPlan.totals?.protein,
      menuPlan.totals?.fat,
      menuPlan.totals?.cho,
    ]).font = { bold: true };
    c.columns.forEach((col) => (col.width = 16));

    // --- Distributive sheet ---
    const d = wb.addWorksheet("Distributive Menu");
    d.addRow([
      "Food Group",
      ...MEAL_TIMES.map((m) => MEAL_TIME_LABELS[m]),
      "Total",
    ]).font = { bold: true };
    FOOD_GROUP_ORDER.forEach((g) => {
      const cells = MEAL_TIMES.map((m) => menuPlan.distributive?.[g]?.[m] ?? 0);
      const total = cells.reduce((sm, x) => sm + x, 0);
      d.addRow([FOOD_GROUP_LABELS[g], ...cells, total]);
    });
    d.columns.forEach((col) => (col.width = 13));

    // --- Descriptive sheet ---
    const de = wb.addWorksheet("Descriptive Menu");
    de.addRow([
      "Meal",
      "Recipe",
      "Ingredients",
      "Energy",
      "Protein",
      "Fat",
      "CHO",
    ]).font = { bold: true };
    (menuPlan.descriptive ?? []).forEach((it) =>
      de.addRow([
        MEAL_TIME_LABELS[it.mealTime],
        it.recipe,
        it.ingredients,
        it.energy,
        it.protein,
        it.fat,
        it.cho,
      ])
    );
    de.columns = [
      { width: 16 },
      { width: 32 },
      { width: 32 },
      { width: 10 },
      { width: 10 },
      { width: 10 },
      { width: 10 },
    ];

    // --- Analysis sheet ---
    const an = wb.addWorksheet("Analysis");
    an.columns = [{ width: 90 }];
    const block = (title: string, items: string[]) => {
      an.addRow([title]).font = { bold: true };
      items.forEach((i) => an.addRow([`• ${i}`]));
      an.addRow([]);
    };
    block("Dietary Goals", analysis.dietaryGoals);
    block("Do's", analysis.dos);
    block("Don'ts", analysis.donts);
    block("Foods to Include", analysis.foodsToInclude);
    block("Foods to Exclude", analysis.foodsToExclude);
    if (analysis.aiNarrative) block("Clinical Narrative", [analysis.aiNarrative]);

    const buffer = await wb.xlsx.writeBuffer();
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="DietPlan_${safeName}.xlsx"`,
      },
    });
  } catch (e) {
    if (isNextResponse(e)) return e;
    console.error("export error", e);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}

function csvEscape(v: string | number): string {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function buildCsv(
  subject: ReturnType<typeof toSubjectInfo>,
  results: CalcResults,
  menuPlan: MenuPlan
): string {
  const lines: string[] = [];
  const row = (...cells: (string | number)[]) =>
    lines.push(cells.map(csvEscape).join(","));

  row("SUBJECT");
  row("Name", subject.clientName);
  row("Age", subject.age);
  row("Sex", subject.sex);
  row("Height (cm)", subject.heightCm);
  row("Weight (kg)", subject.weightKg);
  row("");
  row("CALCULATIONS");
  row("IBW (kg)", results.ibw);
  row("BMI", results.bmi);
  row("BMR", results.bmr);
  row("Target Energy (kcal)", results.energy);
  row("Protein (g)", results.protein.grams);
  row("Fat (g)", results.fat.grams);
  row("CHO (g)", results.cho.grams);
  row("");
  row("COMPREHENSIVE MENU");
  row("Food Group", "Exchanges", "Energy", "Protein", "Fat", "CHO");
  (menuPlan.comprehensive ?? []).forEach((r) =>
    row(FOOD_GROUP_LABELS[r.group], r.exchanges, r.energy, r.protein, r.fat, r.cho)
  );
  row(
    "TOTAL",
    "",
    menuPlan.totals?.energy ?? 0,
    menuPlan.totals?.protein ?? 0,
    menuPlan.totals?.fat ?? 0,
    menuPlan.totals?.cho ?? 0
  );
  row("");
  row("DISTRIBUTIVE MENU");
  row("Food Group", ...MEAL_TIMES.map((m) => MEAL_TIME_LABELS[m]), "Total");
  FOOD_GROUP_ORDER.forEach((g) => {
    const cells = MEAL_TIMES.map((m) => menuPlan.distributive?.[g]?.[m] ?? 0);
    row(FOOD_GROUP_LABELS[g], ...cells, cells.reduce((s, x) => s + x, 0));
  });

  return lines.join("\n");
}
