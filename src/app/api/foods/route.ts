import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { guard, isNextResponse } from "@/lib/api";

// GET /api/foods?group=CEREALS&q=rice  -> exchange items for the menu builder
export async function GET(req: Request) {
  try {
    await guard();
    const { searchParams } = new URL(req.url);
    const group = searchParams.get("group") ?? undefined;
    const q = searchParams.get("q")?.trim();

    const items = await prisma.foodExchange.findMany({
      where: {
        ...(group ? { group } : {}),
        ...(q ? { name: { contains: q } } : {}),
      },
      orderBy: [{ group: "asc" }, { name: "asc" }],
    });
    return NextResponse.json({ items });
  } catch (e) {
    if (isNextResponse(e)) return e;
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
