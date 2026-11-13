import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { guardClient, jsonError } from "@/lib/api";
import { renderChartPdf } from "@/lib/pdf/renderChart";

export const runtime = "nodejs";

// GET /api/portal/chart/pdf -> the client's currently shared chart as a PDF
export async function GET() {
  try {
    const client = await guardClient();
    const chart = await prisma.dietChart.findFirst({
      where: { clientId: client.id, shared: true },
      orderBy: { updatedAt: "desc" },
      select: { id: true },
    });
    if (!chart) return NextResponse.json({ error: "No shared plan yet." }, { status: 404 });
    const pdf = await renderChartPdf(chart.id);
    if (!pdf) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return new NextResponse(new Uint8Array(pdf.buffer), {
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${pdf.filename}"` },
    });
  } catch (e) {
    return jsonError(e, "Failed to generate PDF");
  }
}
