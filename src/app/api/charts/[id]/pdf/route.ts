import { NextResponse } from "next/server";
import { guard, jsonError } from "@/lib/api";
import { ownedChart } from "@/lib/foodbank/server";
import { renderChartPdf } from "@/lib/pdf/renderChart";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const coachId = await guard();
    const { id } = await params;
    if (!(await ownedChart(coachId, id))) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const pdf = await renderChartPdf(id);
    if (!pdf) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return new NextResponse(new Uint8Array(pdf.buffer), {
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${pdf.filename}"` },
    });
  } catch (e) {
    return jsonError(e, "Failed to generate PDF");
  }
}
