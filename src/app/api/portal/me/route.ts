import { NextResponse } from "next/server";
import { guardClient, jsonError } from "@/lib/api";
import { loadPortalData } from "@/lib/foodbank/portal";

// GET /api/portal/me -> the signed-in client's profile, plan and requests
export async function GET() {
  try {
    const client = await guardClient();
    const data = await loadPortalData(client.id);
    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(data);
  } catch (e) {
    return jsonError(e);
  }
}
