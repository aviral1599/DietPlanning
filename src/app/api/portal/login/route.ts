import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createClientSession, verifyPassword } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
    }
    const client = await prisma.client.findUnique({ where: { email } });
    const ok = !!client?.passwordHash && (await verifyPassword(password, client.passwordHash));
    if (!client || !ok) {
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }
    if (!client.portalEnabled) {
      return NextResponse.json({ error: "Your portal access is paused. Please contact your nutritionist." }, { status: 403 });
    }
    await prisma.client.update({ where: { id: client.id }, data: { lastLoginAt: new Date() } });
    await createClientSession({ clientId: client.id, coachId: client.coachId, email, name: client.name });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("portal login", e);
    return NextResponse.json({ error: "Login failed." }, { status: 500 });
  }
}
