import { redirect } from "next/navigation";
import { getCurrentClient } from "@/lib/auth";
import PortalLoginForm from "./PortalLoginForm";

export const dynamic = "force-dynamic";

export default async function PortalLoginPage() {
  if (await getCurrentClient()) redirect("/portal");
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-brand-50 to-white p-5">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-600 text-xl font-bold text-white">N</div>
          <h1 className="text-2xl font-bold text-slate-900">My Diet Plan</h1>
          <p className="mt-1 text-sm text-slate-500">Sign in with the details your nutritionist shared with you.</p>
        </div>
        <PortalLoginForm />
        <p className="mt-6 text-center text-xs text-slate-400">
          Are you a nutritionist? <a href="/login" className="text-brand-700 hover:underline">Coach sign in</a>
        </p>
      </div>
    </div>
  );
}
