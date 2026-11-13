import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { guard, isNextResponse } from "@/lib/api";
import { buildFullReport, toSubjectInfo } from "@/lib/report";

// GET /api/reports  -> list reports for the current coach
export async function GET() {
  try {
    const coachId = await guard();
    const reports = await prisma.report.findMany({
      where: { coachId },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        clientName: true,
        age: true,
        sex: true,
        dietType: true,
        dietPreference: true,
        glycemicStatus: true,
        status: true,
        results: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return NextResponse.json({ reports });
  } catch (e) {
    if (isNextResponse(e)) return e;
    console.error(e);
    return NextResponse.json({ error: "Failed to list reports" }, { status: 500 });
  }
}

// POST /api/reports  -> create a new computed report
export async function POST(req: Request) {
  try {
    const coachId = await guard();
    const body = await req.json();
    const subject = toSubjectInfo(body);

    if (!subject.clientName || !subject.age || !subject.heightCm || !subject.weightKg) {
      return NextResponse.json(
        { error: "Name, age, height and weight are required." },
        { status: 400 }
      );
    }

    const full = buildFullReport(subject, {
      settings: body.settings ?? undefined,
    });

    const report = await prisma.report.create({
      data: {
        coachId,
        clientName: subject.clientName,
        age: subject.age,
        sex: subject.sex,
        heightCm: subject.heightCm,
        weightKg: subject.weightKg,
        activityLevel: subject.activityLevel,
        incomeGroup: subject.incomeGroup,
        allergies: subject.allergies,
        dietType: subject.dietType,
        dietPreference: subject.dietPreference,
        objective: subject.objective,
        glycemicStatus: subject.glycemicStatus,
        labs: JSON.stringify(subject.labs),
        settings: JSON.stringify(full.settings),
        results: JSON.stringify(full.results),
        menuPlan: JSON.stringify(full.menuPlan),
        analysis: JSON.stringify(full.analysis),
        status: "draft",
      },
    });

    return NextResponse.json({ id: report.id });
  } catch (e) {
    if (isNextResponse(e)) return e;
    console.error(e);
    return NextResponse.json({ error: "Failed to create report" }, { status: 500 });
  }
}
