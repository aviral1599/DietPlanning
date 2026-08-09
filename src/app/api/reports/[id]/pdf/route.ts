import { NextResponse } from "next/server";
import React from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { prisma } from "@/lib/db";
import { guard, isNextResponse, safeJsonParse } from "@/lib/api";
import { toSubjectInfo } from "@/lib/report";
import { ReportPdf } from "@/lib/pdf/ReportPdf";
import type { Analysis, CalcResults, MenuPlan } from "@/lib/types";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const coachId = await guard();
    const { id } = await params;
    const report = await prisma.report.findUnique({ where: { id } });
    if (!report || report.coachId !== coachId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const coach = await prisma.coach.findUnique({ where: { id: coachId } });

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

    const element = React.createElement(ReportPdf, {
      subject,
      results,
      menuPlan,
      analysis,
      clinicName: coach?.clinicName ?? "Master Mind Body Global",
      coachName: coach?.name ?? "",
      date: new Date().toLocaleDateString("en-GB"),
    }) as unknown as React.ReactElement<DocumentProps>;

    const buffer = await renderToBuffer(element);

    const filename = `DietPlan_${subject.clientName.replace(/[^a-z0-9]+/gi, "_")}.pdf`;
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
      },
    });
  } catch (e) {
    if (isNextResponse(e)) return e;
    console.error("pdf error", e);
    return NextResponse.json({ error: "Failed to generate PDF" }, { status: 500 });
  }
}
