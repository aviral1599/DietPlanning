import { notFound, redirect } from "next/navigation";
import { getCurrentCoach } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { safeJsonParse } from "@/lib/api";
import { toSubjectInfo } from "@/lib/report";
import type {
  Analysis,
  CalcResults,
  MenuPlan,
  NutritionSettings,
} from "@/lib/types";
import ReportWorkspace, { LoadedReport } from "./ReportWorkspace";

export const dynamic = "force-dynamic";

export default async function ReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const coach = await getCurrentCoach();
  if (!coach) redirect("/login");
  const { id } = await params;
  const { tab } = await searchParams;
  const initialTab = (["assessment", "analysis", "menu", "chart", "portal"] as const).find((t) => t === tab);

  const report = await prisma.report.findUnique({ where: { id } });
  if (!report || report.coachId !== coach.id) notFound();

  const loaded: LoadedReport = {
    id: report.id,
    status: report.status,
    aiProvider: report.aiProvider,
    subject: toSubjectInfo(report),
    settings: safeJsonParse<NutritionSettings>(report.settings, {} as NutritionSettings),
    results: safeJsonParse<CalcResults>(report.results, {} as CalcResults),
    menuPlan: safeJsonParse<MenuPlan>(report.menuPlan, {} as MenuPlan),
    analysis: safeJsonParse<Analysis>(report.analysis, {
      dietaryGoals: [],
      dos: [],
      donts: [],
      foodsToInclude: [],
      foodsToExclude: [],
      generatedBy: "builtin",
    }),
    clinicName: coach.clinicName,
    coachName: coach.name,
    updatedAt: report.updatedAt.toISOString(),
  };

  return <ReportWorkspace initial={loaded} hasApiKey={!!coach.anthropicKey} initialTab={initialTab} />;
}
