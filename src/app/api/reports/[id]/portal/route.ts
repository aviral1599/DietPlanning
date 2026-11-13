import { NextResponse } from "next/server";
import { randomInt } from "node:crypto";
import { prisma } from "@/lib/db";
import { guard, jsonError } from "@/lib/api";
import { hashPassword } from "@/lib/auth";
import { ensureClientForReport } from "@/lib/foodbank/server";

type Params = { params: Promise<{ id: string }> };

// Unambiguous characters (no 0/O, 1/l/I) so clients can type it from a message.
const ALPHABET = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function generatePassword(len = 10) {
  let s = "";
  for (let i = 0; i < len; i++) s += ALPHABET[randomInt(ALPHABET.length)];
  return s;
}

async function ownedReport(coachId: string, id: string) {
  const r = await prisma.report.findUnique({ where: { id } });
  return r && r.coachId === coachId ? r : null;
}

function status(client: { id: string; email: string | null; portalEnabled: boolean; lastLoginAt: Date | null; passwordHash: string | null } | null) {
  return client
    ? {
        clientId: client.id,
        email: client.email,
        enabled: client.portalEnabled,
        hasPassword: !!client.passwordHash,
        lastLoginAt: client.lastLoginAt?.toISOString() ?? null,
      }
    : { clientId: null, email: null, enabled: false, hasPassword: false, lastLoginAt: null };
}

// GET -> current portal access status for this report's client
export async function GET(_req: Request, { params }: Params) {
  try {
    const coachId = await guard();
    const { id } = await params;
    const report = await ownedReport(coachId, id);
    if (!report) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const client = report.clientId ? await prisma.client.findUnique({ where: { id: report.clientId } }) : null;
    const pending = client
      ? await prisma.changeRequest.count({ where: { clientId: client.id, status: "pending" } })
      : 0;
    return NextResponse.json({ portal: status(client), pending });
  } catch (e) {
    return jsonError(e);
  }
}

// POST -> enable access / update email / reset password
// body: { email: string, resetPassword?: boolean, password?: string }
export async function POST(req: Request, { params }: Params) {
  try {
    const coachId = await guard();
    const { id } = await params;
    const report = await ownedReport(coachId, id);
    if (!report) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const body = (await req.json()) as { email?: string; resetPassword?: boolean; password?: string };

    const email = String(body.email ?? "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Enter a valid email address for the client." }, { status: 400 });
    }
    const client = await ensureClientForReport(report);
    const clash = await prisma.client.findUnique({ where: { email } });
    if (clash && clash.id !== client.id) {
      return NextResponse.json({ error: "That email is already used by another client." }, { status: 409 });
    }

    let newPassword: string | null = null;
    if (body.password && body.password.length >= 8) newPassword = body.password;
    else if (body.resetPassword || !client.passwordHash) newPassword = generatePassword();

    const updated = await prisma.client.update({
      where: { id: client.id },
      data: {
        email,
        portalEnabled: true,
        ...(newPassword ? { passwordHash: await hashPassword(newPassword) } : {}),
      },
    });
    // Link any charts for this report to the client.
    await prisma.dietChart.updateMany({ where: { reportId: report.id, clientId: null }, data: { clientId: updated.id } });

    // The plain password is returned ONCE so the coach can share it.
    return NextResponse.json({ portal: status(updated), password: newPassword });
  } catch (e) {
    return jsonError(e, "Could not update portal access");
  }
}

// DELETE -> revoke portal access (keeps the client and their history)
export async function DELETE(_req: Request, { params }: Params) {
  try {
    const coachId = await guard();
    const { id } = await params;
    const report = await ownedReport(coachId, id);
    if (!report) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (!report.clientId) return NextResponse.json({ portal: status(null) });
    const updated = await prisma.client.update({ where: { id: report.clientId }, data: { portalEnabled: false } });
    return NextResponse.json({ portal: status(updated) });
  } catch (e) {
    return jsonError(e, "Could not revoke access");
  }
}
