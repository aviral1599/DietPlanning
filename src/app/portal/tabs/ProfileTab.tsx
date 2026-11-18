"use client";

import { conditionsLabel, subjectConditions } from "@/lib/conditions";
import type { PortalData } from "@/lib/foodbank/portal";
import { interpretLabs } from "@/lib/glycemic";
import { Button } from "../ui/button";

/** Profile: assessment, goals, do's and don'ts (not restyled yet), and Sign out. */
export default function ProfileTab({ data, onSignOut }: { data: PortalData; onSignOut: () => void }) {
  return (
    <div className="space-y-4">
      <ProfileView data={data} />
      <Button variant="outline" className="h-10 w-full rounded-xl bg-white text-[14px] shadow-none" onClick={onSignOut}>
        Sign out
      </Button>
    </div>
  );
}

function ProfileView({ data }: { data: PortalData }) {
  const s = data.subject;
  const r = data.results;
  const a = data.analysis;
  const labFindings = s ? interpretLabs(s.labs ?? {}).findings : [];
  if (!s || !r) {
    return <div className="card p-6 text-center text-sm text-slate-500">Your assessment will appear here once your nutritionist completes it.</div>;
  }
  const stat = (label: string, value: string, sub?: string) => (
    <div className="rounded-xl bg-slate-50 p-3">
      <div className="text-[11px] uppercase tracking-wide text-slate-400">{label}</div>
      <div className="text-lg font-bold text-slate-900">{value}</div>
      {sub && <div className="text-xs text-slate-500">{sub}</div>}
    </div>
  );
  const list = (title: string, items: string[] | undefined, tone: string) =>
    items && items.length > 0 ? (
      <div className="card p-4">
        <div className={`mb-2 text-sm font-semibold ${tone}`}>{title}</div>
        <ul className="space-y-1.5 text-sm text-slate-700">
          {items.map((x, i) => (
            <li key={i} className="flex gap-2"><span className="text-slate-300">•</span>{x}</li>
          ))}
        </ul>
      </div>
    ) : null;

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <h2 className="text-lg font-bold text-slate-900">{s.clientName}</h2>
        <p className="text-sm text-slate-500">
          {s.age} years · {s.sex} · {s.heightCm} cm · {s.weightKg} kg · {conditionsLabel(subjectConditions(s), s.glycemicStatus)} · <span className="capitalize">{s.dietPreference}</span>
        </p>
        {labFindings.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {labFindings.map((f) => (
              <span
                key={f.key}
                className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${
                  f.tone === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : f.tone === "warn" ? "border-amber-200 bg-amber-50 text-amber-800" : "border-red-200 bg-red-50 text-red-700"
                }`}
              >
                {f.label} {f.value} · {f.band}
              </span>
            ))}
          </div>
        )}
        {/* Phone layout at every width: the portal is a single phone-width column now. */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          {stat("BMI", r.bmi.toFixed(1), r.bmiCategory)}
          {stat("Ideal weight", `${r.ibw} kg`, r.weightStatusLabel)}
          {stat("Daily energy", `${Math.round(r.energy)} kcal`)}
          {stat("Daily protein", `${Math.round(r.protein.grams)} g`)}
        </div>
        {data.reportDate && <p className="mt-3 text-[11px] text-slate-400">Assessment updated {new Date(data.reportDate).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}</p>}
      </div>
      {list("Your goals", a?.dietaryGoals, "text-brand-700")}
      <div className="grid gap-4">
        {list("Do’s ✓", a?.dos, "text-brand-700")}
        {list("Don’ts ✗", a?.donts, "text-red-600")}
        {list("Foods to include", a?.foodsToInclude, "text-brand-700")}
        {list("Foods to limit / avoid", a?.foodsToExclude, "text-amber-700")}
      </div>
    </div>
  );
}
