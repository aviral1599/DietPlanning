import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import Link from "next/link";
import AuthForm from "./AuthForm";

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect("/dashboard");

  return (
    <div className="flex min-h-screen">
      {/* Left brand panel */}
      <div className="relative hidden w-1/2 flex-col justify-between bg-brand-700 p-12 text-white lg:flex">
        <div>
          <div className="text-sm font-semibold uppercase tracking-widest text-brand-200">
            Master Mind Body Global
          </div>
          <h1 className="mt-6 text-4xl font-bold leading-tight">
            NutriPlan
            <span className="mt-2 block text-xl font-normal text-brand-100">
              Clinical diet planning, from assessment to downloadable report.
            </span>
          </h1>
        </div>
        <ul className="space-y-3 text-brand-50">
          <li className="flex gap-3">
            <span className="text-brand-300">✓</span> IBW, BMI, BMR & energy
            calculations done for you
          </li>
          <li className="flex gap-3">
            <span className="text-brand-300">✓</span> Exchange-based menus from a
            built-in Indian food database
          </li>
          <li className="flex gap-3">
            <span className="text-brand-300">✓</span> AI-assisted goals, do&apos;s
            &amp; don&apos;ts, and food guidance
          </li>
          <li className="flex gap-3">
            <span className="text-brand-300">✓</span> PDF &amp; Excel reports, with
            full client history
          </li>
        </ul>
        <div className="text-xs text-brand-200">
          For qualified health coaches &amp; dietitians.
        </div>
      </div>

      {/* Right auth form */}
      <div className="flex w-full items-center justify-center p-6 lg:w-1/2">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <div className="text-xs font-semibold uppercase tracking-widest text-brand-600">
              Master Mind Body Global
            </div>
            <h1 className="mt-1 text-3xl font-bold text-slate-900">NutriPlan</h1>
          </div>
          <AuthForm />
          <div className="mt-8 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-center text-sm text-slate-600">
            Are you a client?{" "}
            <Link href="/portal/login" className="font-semibold text-brand-700 hover:underline">
              Sign in to your diet portal →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
