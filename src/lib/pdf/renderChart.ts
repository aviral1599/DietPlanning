import "server-only";
import React from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { prisma } from "../db";
import { expandCustomRows } from "../foodbank/bank";
import { reportContext, toChartDTO } from "../foodbank/server";
import { ChartPdf } from "./ChartPdf";

/** Render a stored chart to a PDF buffer (coach or client route). */
export async function renderChartPdf(chartId: string) {
  const row = await prisma.dietChart.findUnique({ where: { id: chartId } });
  if (!row) return null;
  const chart = toChartDTO(row);
  const [report, coach, customRows] = await Promise.all([
    prisma.report.findUnique({ where: { id: row.reportId } }),
    prisma.coach.findUnique({ where: { id: row.coachId } }),
    prisma.customDish.findMany({ where: { coachId: row.coachId } }),
  ]);
  const { index } = expandCustomRows(customRows);
  const subject = report ? reportContext(report).subject : null;

  const element = React.createElement(ChartPdf, {
    title: chart.title,
    clinicName: coach?.clinicName ?? "NutriPlan",
    coachName: coach?.name ?? "",
    subject,
    days: chart.days,
    targets: chart.targets,
    mealTimes: chart.mealTimes,
    notes: chart.notes,
    index,
  }) as unknown as React.ReactElement<DocumentProps>;

  const buffer = await renderToBuffer(element);
  const name = `${chart.title}_${subject?.clientName ?? ""}`.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "");
  return { buffer, filename: `${name || "DietChart"}.pdf` };
}
