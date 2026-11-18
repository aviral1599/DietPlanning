import "server-only";
import { prisma } from "../db";
import { safeJsonParse } from "../api";
import type { Analysis, CalcResults, SubjectInfo } from "../types";
import { toSubjectInfo } from "../report";
import type { PlanItem } from "./engine";
import { ChartDTO, chartsWithChoices, loadMealChecks, profileFromSubject } from "./server";

export interface PortalRequestDTO {
  id: string;
  day: number;
  meal: string;
  action: string;
  scope: string;
  targetUid: string | null;
  fromItem: PlanItem | null;
  toItem: PlanItem | null;
  note: string;
  status: string;
  coachNote: string;
  createdAt: string;
  resolvedAt: string | null;
}

export interface PortalData {
  client: { id: string; name: string; email: string | null };
  coach: { name: string; clinicName: string };
  subject: SubjectInfo | null;
  results: CalcResults | null;
  analysis: Analysis | null;
  reportDate: string | null;
  chart: ChartDTO | null;
  customDishes: { id: string; coachId: string; data: string }[];
  requests: PortalRequestDTO[];
  profile: ReturnType<typeof profileFromSubject> | null;
}

/** Everything the client portal needs, scoped strictly to this client. */
export async function loadPortalData(clientId: string): Promise<PortalData | null> {
  const client = await prisma.client.findUnique({ where: { id: clientId }, include: { coach: true } });
  if (!client) return null;

  const chartRow = await prisma.dietChart.findFirst({
    where: { clientId, shared: true },
    orderBy: { updatedAt: "desc" },
  });
  const report = chartRow
    ? await prisma.report.findUnique({ where: { id: chartRow.reportId } })
    : await prisma.report.findFirst({ where: { clientId }, orderBy: { updatedAt: "desc" } });

  const subject = report ? toSubjectInfo(report as unknown as Record<string, unknown>) : null;
  // The coach's dishes and ingredients — but client-customised versions only
  // for this client's own chart (never another client's).
  const customRows = (await prisma.customDish.findMany({ where: { coachId: client.coachId } })).filter((r) => {
    const data = safeJsonParse<{ chartId?: string }>(r.data, {});
    return !data.chartId || data.chartId === chartRow?.id;
  });
  const requests = chartRow
    ? await prisma.changeRequest.findMany({ where: { chartId: chartRow.id, clientId }, orderBy: { createdAt: "desc" }, take: 100 })
    : [];
  // Ticked options and ticked meals ride along on the chart, like the coach's view of choices.
  const chart: ChartDTO | null = chartRow
    ? { ...(await chartsWithChoices([chartRow]))[0], checks: (await loadMealChecks([chartRow.id]))[chartRow.id] ?? {} }
    : null;

  return {
    client: { id: client.id, name: client.name, email: client.email },
    coach: { name: client.coach.name, clinicName: client.coach.clinicName },
    subject,
    results: report ? safeJsonParse<CalcResults | null>(report.results, null) : null,
    analysis: report ? safeJsonParse<Analysis | null>(report.analysis, null) : null,
    reportDate: report?.updatedAt.toISOString() ?? null,
    chart,
    customDishes: customRows.map((r) => ({ id: r.id, coachId: r.coachId, data: r.data })),
    requests: requests.map((r) => ({
      id: r.id,
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
    profile: subject ? profileFromSubject(subject) : null,
  };
}
