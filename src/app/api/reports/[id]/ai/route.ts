import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { guard, isNextResponse, safeJsonParse } from "@/lib/api";
import { enhanceAnalysisWithClaude, resolveApiKey } from "@/lib/ai";
import { toSubjectInfo } from "@/lib/report";
import type { Analysis, CalcResults, MenuPlan } from "@/lib/types";

// POST /api/reports/[id]/ai  -> enhance analysis with Claude
export async function POST(
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
    const apiKey = resolveApiKey(coach?.anthropicKey);
    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "No Anthropic API key configured. Add one in Settings to enable AI analysis.",
        },
        { status: 400 }
      );
    }

    const subject = toSubjectInfo(report);
    const results = safeJsonParse<CalcResults>(report.results, {} as CalcResults);
    const menuPlan = safeJsonParse<MenuPlan>(report.menuPlan, {} as MenuPlan);
    const base = safeJsonParse<Analysis>(report.analysis, {
      dietaryGoals: [],
      dos: [],
      donts: [],
      foodsToInclude: [],
      foodsToExclude: [],
      generatedBy: "builtin",
    });

    const enhanced = await enhanceAnalysisWithClaude({
      apiKey,
      subject,
      results,
      menuPlan,
      base,
    });

    await prisma.report.update({
      where: { id },
      data: { analysis: JSON.stringify(enhanced), aiProvider: "claude" },
    });

    return NextResponse.json({ analysis: enhanced });
  } catch (e) {
    if (isNextResponse(e)) return e;
    const message =
      e instanceof Error ? e.message : "AI analysis failed. Check your API key.";
    console.error("AI error", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
