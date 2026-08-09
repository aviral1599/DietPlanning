import IntakeForm from "./IntakeForm";

export default function NewPlanPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">New Diet Plan</h1>
        <p className="text-sm text-slate-500">
          Enter the client&apos;s assessment details. NutriPlan computes IBW, BMI,
          BMR, energy &amp; macros and drafts an exchange-based menu automatically.
        </p>
      </div>
      <IntakeForm />
    </div>
  );
}
