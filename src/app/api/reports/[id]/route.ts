import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { guard, isNextResponse, safeJsonParse } from "@/lib/api";
import { buildFullReport, toSubjectInfo } from "@/lib/report";
import type { Analysis, MenuPlan, NutritionSettings } from "@/lib/types";

async function ownedReport(coachId: string, id: string) {
  const report = await prisma.report.findUnique({ where: { id } });
  if (!report || report.coachId !== coachId) return null;
  return report;
}

// GET /api/reports/[id]
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const coachId = await guard();
    const { id } = await params;
    const report = await ownedReport(coachId, id);
    if (!report)
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ report });
  } catch (e) {
    if (isNextResponse(e)) return e;
    console.error(e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

// PUT /api/reports/[id]
// Body may contain: subject fields, `settings`, `menuPlan`, `analysis`,
// `status`, and `recompute` (boolean). Recompute re-runs the engine while
// preserving supplied menu/analysis edits when recompute=false.
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const coachId = await guard();
    const { id } = await params;
    const existing = await ownedReport(coachId, id);
    if (!existing)
      return NextResponse.json({ error: "Not found" }, { status: 404 });

    const body = await req.json();
    const recompute = body.recompute !== false; // default true

    const subject = toSubjectInfo({
      clientName: body.clientName ?? existing.clientName,
      age: body.age ?? existing.age,
      sex: body.sex ?? existing.sex,
      heightCm: body.heightCm ?? existing.heightCm,
      weightKg: body.weightKg ?? existing.weightKg,
      activityLevel: body.activityLevel ?? existing.activityLevel,
      incomeGroup: body.incomeGroup ?? existing.incomeGroup,
      allergies: body.allergies ?? existing.allergies,
      dietType: body.dietType ?? existing.dietType,
      // A request that only sends dietType (older client) replaces the list.
      conditions: body.conditions ?? (body.dietType ? [body.dietType] : existing.conditions),
      dietPreference: body.dietPreference ?? existing.dietPreference,
      objective: body.objective ?? existing.objective,
      glycemicStatus: body.glycemicStatus ?? existing.glycemicStatus,
      labs: body.labs ?? existing.labs,
    });

    const prevSettings = safeJsonParse<Partial<NutritionSettings>>(
      existing.settings,
      {}
    );
    const settingsOverride: Partial<NutritionSettings> = {
      ...prevSettings,
      ...(body.settings ?? {}),
    };

    let dataToSave: {
      settings: string;
      results: string;
      menuPlan: string;
      analysis: string;
    };

    if (recompute) {
      // Recompute assessment + (optionally) menu/analysis. If the client sent
      // explicit menuPlan/analysis, keep those; else regenerate.
      const menuOverride = body.menuPlan as MenuPlan | undefined;
      const analysisOverride = body.analysis as Analysis | undefined;
      const full = buildFullReport(subject, {
        settings: settingsOverride,
        menuPlan: menuOverride,
        analysis: analysisOverride,
      });
      dataToSave = {
        settings: JSON.stringify(full.settings),
        results: JSON.stringify(full.results),
        menuPlan: JSON.stringify(full.menuPlan),
        analysis: JSON.stringify(full.analysis),
      };
    } else {
      // Save only the provided edited pieces, preserving the rest.
      dataToSave = {
        settings: JSON.stringify(settingsOverride),
        results: existing.results,
        menuPlan: body.menuPlan
          ? JSON.stringify(body.menuPlan)
          : existing.menuPlan,
        analysis: body.analysis
          ? JSON.stringify(body.analysis)
          : existing.analysis,
      };
    }

    const updated = await prisma.report.update({
      where: { id },
      data: {
        clientName: subject.clientName,
        age: subject.age,
        sex: subject.sex,
        heightCm: subject.heightCm,
        weightKg: subject.weightKg,
        activityLevel: subject.activityLevel,
        incomeGroup: subject.incomeGroup,
        allergies: subject.allergies,
        dietType: subject.dietType,
        conditions: JSON.stringify(subject.conditions),
        dietPreference: subject.dietPreference,
        objective: subject.objective,
        glycemicStatus: subject.glycemicStatus,
        labs: JSON.stringify(subject.labs),
        status: body.status ?? existing.status,
        ...dataToSave,
      },
    });

    return NextResponse.json({ report: updated });
  } catch (e) {
    if (isNextResponse(e)) return e;
    console.error(e);
    return NextResponse.json({ error: "Failed to update report" }, { status: 500 });
  }
}

// DELETE /api/reports/[id]
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const coachId = await guard();
    const { id } = await params;
    const existing = await ownedReport(coachId, id);
    if (!existing)
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    await prisma.report.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (isNextResponse(e)) return e;
    console.error(e);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
