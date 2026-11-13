"use client";

import { useState } from "react";
import { GLYCEMIC_STATUS_LABELS, NutritionSettings, SubjectInfo, type DietType } from "@/lib/types";
import GlycemicFields from "@/components/GlycemicFields";
import { hasLabs, interpretLabs } from "@/lib/glycemic";
import {
  ACTIVITY_OPTIONS,
  BMR_METHOD_OPTIONS,
  DIET_PREFERENCE_OPTIONS,
  DIET_TYPE_OPTIONS,
  IBW_METHOD_OPTIONS,
  INCOME_OPTIONS,
  SEX_OPTIONS,
} from "@/lib/ui-options";
import type { LoadedReport } from "./ReportWorkspace";
import { MacroPie, RdaComparisonChart } from "./Charts";

function Stat({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className="card p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </div>
      <div
        className={`mt-1 text-2xl font-bold ${
          accent ? "text-brand-600" : "text-slate-900"
        }`}
      >
        {value}
      </div>
      {sub && <div className="text-xs text-slate-500">{sub}</div>}
    </div>
  );
}

export default function AssessmentTab({
  report,
  onRecompute,
  saving,
}: {
  report: LoadedReport;
  onRecompute: (s: SubjectInfo, settings: Partial<NutritionSettings>) => void;
  saving: boolean;
}) {
  const { results, subject, settings } = report;
  const [editing, setEditing] = useState(false);
  const [s, setS] = useState<SubjectInfo>(subject);
  const [cfg, setCfg] = useState<NutritionSettings>(settings);

  const upd = (k: keyof SubjectInfo, v: string | number) =>
    setS((p) => ({ ...p, [k]: v }));
  const updCfg = (k: keyof NutritionSettings, v: number | string | null) =>
    setCfg((p) => ({ ...p, [k]: v }));

  const gStatus = subject.glycemicStatus ?? "none";
  const labInterp = interpretLabs(subject.labs ?? {});
  const showGlycemic = (gStatus !== "none" && subject.dietType !== "diabetes") || hasLabs(subject.labs);

  return (
    <div className="space-y-6">
      {showGlycemic && (
        <div className="card flex flex-wrap items-center gap-x-4 gap-y-2 border-amber-200 bg-amber-50/50 p-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-amber-700">Blood sugar</div>
            <div className="text-sm font-semibold text-slate-900">
              {subject.dietType === "diabetes" ? "Diabetes" : GLYCEMIC_STATUS_LABELS[gStatus]}
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {labInterp.findings.map((f) => (
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
          {gStatus !== "none" && subject.dietType !== "diabetes" && (
            <p className="w-full text-xs text-slate-600">
              Diet charts for this client favour insulin-friendly, low-GI dishes, pair every carbohydrate with protein or fibre, and leave out sweets and juices.
            </p>
          )}
        </div>
      )}

      {/* Key stats */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Stat label="IBW" value={`${results.ibw} kg`} sub={results.ibwMethodLabel} />
        <Stat label="BMI" value={`${results.bmi}`} sub={results.bmiCategory} />
        <Stat label="BMR" value={`${results.bmr}`} sub={`kcal · ${results.bmrMethodLabel}`} />
        <Stat label="Target Energy" value={`${results.energy}`} sub="kcal/day" accent />
        <Stat label="Weight Status" value={`${results.weightStatus > 0 ? "+" : ""}${results.weightStatus} kg`} sub={results.weightStatusLabel} />
        <Stat label="Protein" value={`${results.protein.grams} g`} sub={`${results.protein.kcal} kcal`} />
      </div>

      {/* Energy breakdown + macros */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card p-6">
          <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-brand-700">
            Energy Requirement
          </h3>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-slate-100">
              <Row k="BMR (Basal Metabolic Rate)" v={`${results.bmr} kcal`} />
              <Row k={`+ Physical Activity (${Math.round(settings.activityFactor * 100)}% of BMR)`} v={`${results.pa} kcal`} />
              <Row k={`+ SDA / Thermic effect (${Math.round(settings.sdaFactor * 100)}%)`} v={`${results.sda} kcal`} />
              <Row k="= Total Energy Expenditure (TEE)" v={`${results.tee} kcal`} bold />
              {results.goalAdjustment !== 0 && (
                <Row
                  k={`Goal adjustment (${results.goalAdjustment > 0 ? "surplus" : "deficit"})`}
                  v={`${results.goalAdjustment > 0 ? "+" : ""}${results.goalAdjustment} kcal`}
                />
              )}
              <Row k="Target Energy" v={`${results.energy} kcal`} bold accent />
            </tbody>
          </table>

          <h3 className="mb-3 mt-6 text-sm font-bold uppercase tracking-wide text-brand-700">
            Macronutrient Distribution
          </h3>
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="th">Nutrient</th>
                <th className="th">Grams</th>
                <th className="th">kcal</th>
                <th className="th">% Energy</th>
              </tr>
            </thead>
            <tbody>
              <MacroRow name="Protein" m={results.protein} note={`${settings.proteinPerKg} g/kg ${settings.proteinBasis} wt`} />
              <MacroRow name="Fat" m={results.fat} note={`${Math.round(settings.fatPercent * 100)}% of energy`} />
              <MacroRow name="Carbohydrate" m={results.cho} note="remainder" />
            </tbody>
          </table>
          <p className="mt-2 text-xs text-slate-400">
            CHO = [Energy − (Protein × 4 + Fat × 9)] ÷ 4
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6">
          <div className="card p-6">
            <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-brand-700">
              Macro Split (by energy)
            </h3>
            <MacroPie results={results} />
          </div>
          <div className="card p-6">
            <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-brand-700">
              RDA vs Planned (MRDA)
            </h3>
            <RdaComparisonChart results={results} />
          </div>
        </div>
      </div>

      {/* RDA comparison table */}
      <div className="card p-6">
        <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-brand-700">
          Comparison Table (ICMR RDA vs Modified RDA)
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="th">Nutrient</th>
                <th className="th">RDA</th>
                <th className="th">MRDA (planned)</th>
                <th className="th">Difference</th>
              </tr>
            </thead>
            <tbody>
              {results.rdaComparison.map((r) => (
                <tr key={r.nutrient}>
                  <td className="td font-medium capitalize">
                    {r.nutrient.toLowerCase()}
                  </td>
                  <td className="td">
                    {r.rda} {r.unit}
                  </td>
                  <td className="td">
                    {r.mrda} {r.unit}
                  </td>
                  <td
                    className={`td font-medium ${
                      r.difference < 0 ? "text-red-600" : "text-brand-700"
                    }`}
                  >
                    {r.difference > 0 ? "+" : ""}
                    {r.difference} {r.unit}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit panel */}
      <div className="card p-6">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold uppercase tracking-wide text-brand-700">
            Subject Details &amp; Formula Settings
          </h3>
          <button
            className="btn-secondary text-xs"
            onClick={() => setEditing((e) => !e)}
          >
            {editing ? "Close" : "Edit & recalculate"}
          </button>
        </div>

        {editing && (
          <div className="mt-5 space-y-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <L label="Name">
                <input className="input" value={s.clientName} onChange={(e) => upd("clientName", e.target.value)} />
              </L>
              <L label="Age">
                <input className="input" type="number" value={s.age} onChange={(e) => upd("age", Number(e.target.value))} />
              </L>
              <L label="Sex">
                <Select value={s.sex} opts={SEX_OPTIONS} onChange={(v) => upd("sex", v)} />
              </L>
              <L label="Height (cm)">
                <input className="input" type="number" value={s.heightCm} onChange={(e) => upd("heightCm", Number(e.target.value))} />
              </L>
              <L label="Weight (kg)">
                <input className="input" type="number" value={s.weightKg} onChange={(e) => upd("weightKg", Number(e.target.value))} />
              </L>
              <L label="Activity">
                <Select value={s.activityLevel} opts={ACTIVITY_OPTIONS} onChange={(v) => upd("activityLevel", v)} />
              </L>
              <L label="Income group">
                <Select value={s.incomeGroup} opts={INCOME_OPTIONS} onChange={(v) => upd("incomeGroup", v)} />
              </L>
              <L label="Diet preference">
                <Select value={s.dietPreference} opts={DIET_PREFERENCE_OPTIONS} onChange={(v) => upd("dietPreference", v)} />
              </L>
              <L label="Condition / goal">
                <Select value={s.dietType} opts={DIET_TYPE_OPTIONS} onChange={(v) => upd("dietType", v)} />
              </L>
              <div className="sm:col-span-3">
                <GlycemicFields
                  dietType={s.dietType}
                  status={s.glycemicStatus ?? "none"}
                  labs={s.labs ?? {}}
                  onStatus={(v) => setS((p) => ({ ...p, glycemicStatus: v }))}
                  onLabs={(v) => setS((p) => ({ ...p, labs: v }))}
                  onSetDiabetes={() => setS((p) => ({ ...p, dietType: "diabetes" as DietType }))}
                />
              </div>
              <L label="Allergies">
                <input className="input" value={s.allergies} onChange={(e) => upd("allergies", e.target.value)} />
              </L>
              <L label="Objective / case study">
                <input className="input" value={s.objective} onChange={(e) => upd("objective", e.target.value)} />
              </L>
            </div>

            <div className="rounded-lg bg-slate-50 p-4">
              <div className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">
                Formula overrides
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <L label="BMR method">
                  <Select value={cfg.bmrMethod} opts={BMR_METHOD_OPTIONS} onChange={(v) => updCfg("bmrMethod", v)} />
                </L>
                <L label="IBW method">
                  <Select value={cfg.ibwMethod} opts={IBW_METHOD_OPTIONS} onChange={(v) => updCfg("ibwMethod", v)} />
                </L>
                <L label="Protein basis">
                  <Select
                    value={cfg.proteinBasis}
                    opts={[
                      { value: "ideal", label: "Ideal body weight" },
                      { value: "actual", label: "Actual body weight" },
                    ]}
                    onChange={(v) => updCfg("proteinBasis", v)}
                  />
                </L>
                <L label={`Activity factor (${Math.round(cfg.activityFactor * 100)}% of BMR)`}>
                  <input className="input" type="number" step="0.05" value={cfg.activityFactor} onChange={(e) => updCfg("activityFactor", Number(e.target.value))} />
                </L>
                <L label="Protein g/kg">
                  <input className="input" type="number" step="0.1" value={cfg.proteinPerKg} onChange={(e) => updCfg("proteinPerKg", Number(e.target.value))} />
                </L>
                <L label={`Fat % of energy (${Math.round(cfg.fatPercent * 100)}%)`}>
                  <input className="input" type="number" step="0.01" value={cfg.fatPercent} onChange={(e) => updCfg("fatPercent", Number(e.target.value))} />
                </L>
                <L label="Energy override (kcal, optional)">
                  <input
                    className="input"
                    type="number"
                    value={cfg.energyOverride ?? ""}
                    placeholder="auto"
                    onChange={(e) =>
                      updCfg("energyOverride", e.target.value ? Number(e.target.value) : null)
                    }
                  />
                </L>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                className="btn-primary"
                disabled={saving}
                onClick={() => onRecompute(s, cfg)}
              >
                {saving ? "Recalculating…" : "Recalculate plan"}
              </button>
            </div>
            <p className="text-xs text-slate-400">
              Recalculating regenerates the assessment and the auto-drafted menu
              &amp; analysis from the new inputs.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ k, v, bold, accent }: { k: string; v: string; bold?: boolean; accent?: boolean }) {
  return (
    <tr>
      <td className={`py-2 ${bold ? "font-semibold" : ""} ${accent ? "text-brand-700" : "text-slate-600"}`}>{k}</td>
      <td className={`py-2 text-right ${bold ? "font-bold" : ""} ${accent ? "text-brand-700" : "text-slate-800"}`}>{v}</td>
    </tr>
  );
}

function MacroRow({ name, m, note }: { name: string; m: { grams: number; kcal: number; percent: number }; note: string }) {
  return (
    <tr>
      <td className="td">
        <div className="font-medium">{name}</div>
        <div className="text-xs text-slate-400">{note}</div>
      </td>
      <td className="td">{m.grams} g</td>
      <td className="td">{m.kcal}</td>
      <td className="td">{m.percent}%</td>
    </tr>
  );
}

function L({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}

function Select({
  value,
  opts,
  onChange,
}: {
  value: string;
  opts: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
      {opts.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
