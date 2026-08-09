import { redirect } from "next/navigation";
import { getCurrentCoach } from "@/lib/auth";
import SettingsForm from "./SettingsForm";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const coach = await getCurrentCoach();
  if (!coach) redirect("/login");

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-1 text-2xl font-bold text-slate-900">Settings</h1>
      <p className="mb-6 text-sm text-slate-500">
        Manage your profile and AI analysis.
      </p>
      <SettingsForm
        initial={{
          name: coach.name,
          email: coach.email,
          clinicName: coach.clinicName,
          hasApiKey: !!coach.anthropicKey,
        }}
      />
    </div>
  );
}
