import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentCoach } from "@/lib/auth";
import { prisma } from "@/lib/db";
import LogoutButton from "./LogoutButton";
import NavLink from "./NavLink";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const coach = await getCurrentCoach();
  if (!coach) redirect("/login");
  const pending = await prisma.changeRequest.count({ where: { coachId: coach.id, status: "pending" } });

  return (
    <div className="flex min-h-screen flex-col">
      <header className="no-print sticky top-0 z-20 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-4 py-3">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-lg font-bold text-white">
                N
              </span>
              <div className="leading-tight">
                <div className="text-sm font-bold text-slate-900">NutriPlan</div>
                <div className="text-[10px] uppercase tracking-wider text-slate-400">
                  {coach.clinicName}
                </div>
              </div>
            </Link>
            <nav className="hidden items-center gap-1 md:flex">
              <NavLink href="/dashboard">Clients</NavLink>
              <NavLink href="/dashboard/new">New Plan</NavLink>
              <NavLink href="/dashboard/food-bank">Food Bank</NavLink>
              <NavLink href="/dashboard/approvals" badge={pending}>Requests</NavLink>
              <NavLink href="/dashboard/settings">Settings</NavLink>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-slate-500 md:block">
              {coach.name}
            </span>
            <LogoutButton />
          </div>
        </div>
      </header>
      {/* Mobile nav */}
      <nav className="no-print flex gap-1 overflow-x-auto border-b border-slate-200 bg-white px-3 py-2 md:hidden">
        <NavLink href="/dashboard">Clients</NavLink>
        <NavLink href="/dashboard/new">New</NavLink>
        <NavLink href="/dashboard/food-bank">Food Bank</NavLink>
        <NavLink href="/dashboard/approvals" badge={pending}>Requests</NavLink>
        <NavLink href="/dashboard/settings">Settings</NavLink>
      </nav>
      <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6">{children}</main>
      <footer className="no-print border-t border-slate-200 py-4 text-center text-xs text-slate-400">
        NutriPlan · Clinical diet planning · {coach.clinicName}
      </footer>
    </div>
  );
}
