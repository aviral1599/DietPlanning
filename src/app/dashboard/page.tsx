import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import ClientList, { ReportRow } from "./ClientList";

export const dynamic = "force-dynamic";

export default async function DashboardHome() {
  const session = await getSession();
  if (!session) redirect("/login");

  const reports = await prisma.report.findMany({
    where: { coachId: session.coachId },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      clientName: true,
      age: true,
      sex: true,
      dietType: true,
      glycemicStatus: true,
      dietPreference: true,
      status: true,
      results: true,
      updatedAt: true,
    },
  });

  const rows: ReportRow[] = reports.map((r) => {
    let energy = 0;
    let bmi = 0;
    try {
      const res = JSON.parse(r.results);
      energy = res.energy ?? 0;
      bmi = res.bmi ?? 0;
    } catch {
      /* ignore */
    }
    return {
      id: r.id,
      clientName: r.clientName,
      age: r.age,
      sex: r.sex,
      dietType: r.dietType,
      glycemicStatus: r.glycemicStatus,
      dietPreference: r.dietPreference,
      status: r.status,
      energy,
      bmi,
      updatedAt: r.updatedAt.toISOString(),
    };
  });

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Client Reports</h1>
          <p className="text-sm text-slate-500">
            {rows.length} plan{rows.length === 1 ? "" : "s"} · all your past
            clients in one place
          </p>
        </div>
        <Link href="/dashboard/new" className="btn-primary">
          + New Diet Plan
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="card flex flex-col items-center justify-center gap-3 p-16 text-center">
          <div className="text-4xl">🥗</div>
          <h2 className="text-lg font-semibold text-slate-800">
            No client plans yet
          </h2>
          <p className="max-w-sm text-sm text-slate-500">
            Create your first diet plan. Enter the client&apos;s details and
            NutriPlan will handle the calculations, menu and report.
          </p>
          <Link href="/dashboard/new" className="btn-primary mt-2">
            Create a plan
          </Link>
        </div>
      ) : (
        <ClientList rows={rows} />
      )}
    </div>
  );
}
