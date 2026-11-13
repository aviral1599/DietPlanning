import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { guardClient, jsonError } from "@/lib/api";

// DELETE /api/portal/requests/[id] -> client withdraws a pending request
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const client = await guardClient();
    const { id } = await params;
    const r = await prisma.changeRequest.findUnique({ where: { id } });
    if (!r || r.clientId !== client.id) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (r.status !== "pending") return NextResponse.json({ error: "Already reviewed." }, { status: 409 });
    await prisma.changeRequest.update({ where: { id }, data: { status: "cancelled", resolvedAt: new Date() } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return jsonError(e, "Could not cancel");
  }
}
