"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ACTIVITY_OPTIONS,
  DIET_PREFERENCE_OPTIONS,
  INCOME_OPTIONS,
  SEX_OPTIONS,
} from "@/lib/ui-options";
import GlycemicFields from "@/components/GlycemicFields";
import ConditionPicker from "@/components/ConditionPicker";
import { primaryCondition, toggleCondition } from "@/lib/conditions";
import { computeAssessment, defaultSettings } from "@/lib/nutrition";
import type { CalcResults, DietType, GlycemicLabs, GlycemicStatus, SubjectInfo } from "@/lib/types";

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

export default function IntakeForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [heightCm, setHeightCm] = useState("");
  const [conditions, setConditions] = useState<DietType[]>(["general"]);
  const dietType = primaryCondition(conditions);
  const diabetic = conditions.includes("diabetes");
  const [glycemicStatus, setGlycemicStatus] = useState<GlycemicStatus>("none");
  const [labs, setLabs] = useState<GlycemicLabs>({});
  const [form, setForm] = useState<Record<string, unknown>>({});

  // Live estimate of the energy target as the form is filled in.
  let estimate: CalcResults | null = null;
  const subj = {
    clientName: "",
    age: Number(form.age ?? 0),
    sex: (form.sex as SubjectInfo["sex"]) ?? "male",
    heightCm: Number(heightCm || 0),
    weightKg: Number(form.weightKg ?? 0),
    activityLevel: (form.activityLevel as SubjectInfo["activityLevel"]) ?? "sedentary",
    incomeGroup: "middle",
    allergies: "",
    dietType,
    conditions,
    dietPreference: "vegetarian",
    objective: "",
    glycemicStatus: diabetic ? "none" : conditions.includes("insulin-resistance") && glycemicStatus === "none" ? "insulin-resistance" : glycemicStatus,
    labs,
  } satisfies SubjectInfo;
  if (subj.age > 0 && subj.heightCm >= 50 && subj.weightKg >= 2) {
    estimate = computeAssessment(subj, defaultSettings(subj));
  }

  function changeConditions(next: DietType[]) {
    setConditions(next);
    if (next.includes("insulin-resistance") && glycemicStatus === "none") setGlycemicStatus("insulin-resistance");
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const payload = {
      clientName: fd.get("clientName"),
      age: Number(fd.get("age")),
      sex: fd.get("sex"),
      heightCm: Number(fd.get("heightCm")),
      weightKg: Number(fd.get("weightKg")),
      activityLevel: fd.get("activityLevel"),
      incomeGroup: fd.get("incomeGroup"),
      allergies: fd.get("allergies"),
      dietType,
      conditions,
      dietPreference: fd.get("dietPreference"),
      objective: fd.get("objective"),
      glycemicStatus: diabetic ? "none" : glycemicStatus,
      labs,
    };
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not create the plan.");
        return;
      }
      router.push(`/dashboard/reports/${data.id}`);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const heightM = heightCm ? (Number(heightCm) / 100).toFixed(2) : "—";

  return (
    <form
      onSubmit={handleSubmit}
      onChange={(e) => setForm(Object.fromEntries(new FormData(e.currentTarget)))}
      className="space-y-6"
    >
      <section className="card p-6">
        <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-brand-700">
          Subject&apos;s General Information
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Name">
            <input name="clientName" className="input" required />
          </Field>
          <Field label="Age (years)">
            <input name="age" type="number" min={1} max={120} className="input" required />
          </Field>
          <Field label="Sex">
            <select name="sex" className="input" defaultValue="male">
              {SEX_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Height (cm)" hint={`= ${heightM} metres`}>
            <input
              name="heightCm"
              type="number"
              step="0.1"
              min={50}
              max={250}
              className="input"
              value={heightCm}
              onChange={(e) => setHeightCm(e.target.value)}
              required
            />
          </Field>
          <Field label="Weight (kg)">
            <input name="weightKg" type="number" step="0.1" min={2} max={400} className="input" required />
          </Field>
          <Field label="Activity level">
            <select name="activityLevel" className="input" defaultValue="sedentary">
              {ACTIVITY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Income group">
            <select name="incomeGroup" className="input" defaultValue="middle">
              {INCOME_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Type of diet (preference)">
            <select name="dietPreference" className="input" defaultValue="vegetarian">
              {DIET_PREFERENCE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="mt-5">
          <ConditionPicker value={conditions} onChange={changeConditions} />
        </div>

        <div className="mt-4">
          <GlycemicFields
            conditions={conditions}
            status={glycemicStatus}
            labs={labs}
            onStatus={setGlycemicStatus}
            onLabs={setLabs}
            onSetDiabetes={() => changeConditions(toggleCondition(conditions, "diabetes"))}
          />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Food allergies" hint="Comma-separated (e.g. peanuts, lactose)">
            <input name="allergies" className="input" placeholder="none" />
          </Field>
          <Field label="Objective / case study">
            <input
              name="objective"
              className="input"
              placeholder="e.g. Weight reduction for a 34-yr PCOS client…"
            />
          </Field>
        </div>
      </section>

      {estimate && (
        <div className="card flex flex-wrap items-center gap-x-5 gap-y-1 p-4 text-sm" aria-live="polite">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Estimate</span>
          <span>BMI {estimate.bmi} · {estimate.bmiCategory}</span>
          <span>BMR {estimate.bmr}</span>
          <span>TEE {estimate.tee}</span>
          {estimate.goalAdjustment !== 0 && (
            <span>
              Goal {estimate.goalAdjustment > 0 ? "+" : ""}
              {estimate.goalAdjustment}
            </span>
          )}
          <span className="font-bold text-brand-700">Target ≈ {estimate.energy} kcal/day</span>
          <span className="w-full text-xs text-slate-400">
            Mifflin–St Jeor BMR × activity × 1.1 (SDA), minus the goal deficit. You can change the target or any parameter on the next screen.
          </span>
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={() => router.push("/dashboard")}
          className="btn-secondary"
        >
          Cancel
        </button>
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? "Calculating…" : "Generate Plan →"}
        </button>
      </div>
    </form>
  );
}
