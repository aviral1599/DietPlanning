"use client";

import { useMemo, useState } from "react";
import { GLYCEMIC_STATUS_LABELS, NutritionSettings, SubjectInfo, type ActivityLevel, type DietType } from "@/lib/types";
import {
  ACTIVITY_PA_FACTOR,
  activityMultiplier,
  autoGoalAdjustment,
  BMR_METHOD_LABELS,
  bmrFormula,
  computeAssessment,
  defaultSettings,
  energySuggestions,
} from "@/lib/nutrition";
import GlycemicFields from "@/components/GlycemicFields";
import ConditionPicker from "@/components/ConditionPicker";
import { primaryCondition, subjectConditions, toggleCondition } from "@/lib/conditions";
import { hasLabs, interpretLabs } from "@/lib/glycemic";
import {
  ACTIVITY_OPTIONS,
  BMR_METHOD_OPTIONS,
  DIET_PREFERENCE_OPTIONS,
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

  // Changing the client's details moves the formula settings that still sit
  // at their recommended values along with them (activity always follows).
  const changeSubject = (next: SubjectInfo) => {
    const before = defaultSettings(s);
    const after = defaultSettings(next);
    setCfg((c) => ({
      ...c,
      activityFactor: next.activityLevel !== s.activityLevel ? after.activityFactor : c.activityFactor,
      proteinPerKg: c.proteinPerKg === before.proteinPerKg ? after.proteinPerKg : c.proteinPerKg,
      fatPercent: c.fatPercent === before.fatPercent ? after.fatPercent : c.fatPercent,
    }));
    setS(next);
  };
  const upd = (k: keyof SubjectInfo, v: string | number) => changeSubject({ ...s, [k]: v } as SubjectInfo);
  const updCfg = (k: keyof NutritionSettings, v: number | string | null) =>
    setCfg((p) => ({ ...p, [k]: v }));

  const suggestions = useMemo(() => energySuggestions(subject, results), [subject, results]);
  const manual = results.energySource === "manual";
  const applyEnergy = (kcal: number | null) => onRecompute(subject, { ...settings, energyOverride: kcal });

  // Reports made before the Nov 2026 formula update used Harris–Benedict with
  // a 40 % sedentary activity factor, which over-estimates energy.
  const LEGACY_PA: Record<string, number> = { sedentary: 0.4, moderate: 0.6, heavy: 1.0 };
  const legacy = settings.bmrMethod === "harris-benedict" && settings.activityFactor === LEGACY_PA[subject.activityLevel];
  const recommended = defaultSettings(subject);
  const legacyFix: Partial<NutritionSettings> = { bmrMethod: recommended.bmrMethod, activityFactor: recommended.activityFactor };
  const legacyPreview = legacy ? computeAssessment(subject, { ...settings, ...legacyFix }) : null;

  // Live preview while editing.
  const preview = useMemo(() => {
    if (!editing || !s.heightCm || !s.weightKg || !s.age) return null;
    try {
      return computeAssessment(s, cfg);
    } catch {
      return null;
    }
  }, [editing, s, cfg]);
  const autoAdj = autoGoalAdjustment(s);

  const gStatus = subject.glycemicStatus ?? "none";
  const labInterp = interpretLabs(subject.labs ?? {});
  const diabetic = subjectConditions(subject).includes("diabetes");
  const showGlycemic = (gStatus !== "none" && !diabetic) || hasLabs(subject.labs);

  return (
    <div className="space-y-6">
      {showGlycemic && (
        <div className="card flex flex-wrap items-center gap-x-4 gap-y-2 border-amber-200 bg-amber-50/50 p-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-amber-700">Blood sugar</div>
            <div className="text-sm font-semibold text-slate-900">
              {diabetic ? "Diabetes" : GLYCEMIC_STATUS_LABELS[gStatus]}
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
          {gStatus !== "none" && !diabetic && (
            <p className="w-full text-xs text-slate-600">
              Diet charts for this client favour insulin-friendly, low-GI dishes, pair every carbohydrate with protein or fibre, and leave out sweets and juices.
            </p>
          )}
        </div>
      )}

      {legacy && legacyPreview && (
        <div className="card flex flex-wrap items-center gap-3 border-amber-300 bg-amber-50 p-4 text-sm">
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-slate-900">This plan uses the older energy formula</div>
            <p className="text-xs text-slate-600">
              Harris–Benedict with activity at {Math.round(settings.activityFactor * 100)}% of BMR gives a high target ({results.energy} kcal).
              The updated method (Mifflin–St Jeor, {Math.round(recommended.activityFactor * 100)}% for {subject.activityLevel}) gives{" "}
              <strong>{legacyPreview.energy} kcal</strong>.
            </p>
          </div>
          <button className="btn-primary text-xs" disabled={saving} onClick={() => onRecompute(subject, { ...settings, ...legacyFix })}>
            Use updated formula
          </button>
        </div>
      )}

      {/* Key stats */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Stat label="IBW" value={`${results.ibw} kg`} sub={results.ibwMethodLabel} />
        <Stat label="BMI" value={`${results.bmi}`} sub={results.bmiCategory} />
        <Stat label="BMR" value={`${results.bmr}`} sub={`kcal · ${results.bmrMethodLabel}`} />
        <Stat label="Target Energy" value={`${results.energy}`} sub={manual ? "kcal/day · set by coach" : "kcal/day"} accent />
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
              <Row k="BMR (Basal Metabolic Rate)" note={`${BMR_METHOD_LABELS[settings.bmrMethod]}: ${bmrFormula(subject.sex, settings.bmrMethod)} (wt kg, ht cm)`} v={`${results.bmr} kcal`} />
              <Row k={`+ Physical Activity (${Math.round(settings.activityFactor * 100)}% of BMR)`} note={`Activity: ${subject.activityLevel}`} v={`${results.pa} kcal`} />
              <Row k={`+ SDA / Thermic effect (${Math.round(settings.sdaFactor * 100)}%)`} note="10% of (BMR + activity)" v={`${results.sda} kcal`} />
              <Row
                k="= Total Energy Expenditure (TEE)"
                note={`= BMR × ${activityMultiplier(settings.activityFactor, settings.sdaFactor)}`}
                v={`${results.tee} kcal`}
                bold
              />
              {results.goalAdjustment !== 0 && (
                <Row
                  k={`Goal adjustment (${results.goalAdjustment > 0 ? "surplus" : "deficit"})`}
                  note={settings.goalAdjustment != null ? "set by coach" : "automatic for the condition / BMI"}
                  v={`${results.goalAdjustment > 0 ? "+" : ""}${results.goalAdjustment} kcal`}
                />
              )}
              <Row
                k="Target Energy"
                note={
                  manual
                    ? `Set by coach (formula gives ${Math.round(results.tee + results.goalAdjustment)} kcal)`
                    : results.energyFloored
                      ? "Raised to the safe minimum (1200 kcal women / 1500 kcal men)"
                      : undefined
                }
                v={`${results.energy} kcal`}
                bold
                accent
              />
            </tbody>
          </table>

          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Suggested targets</div>
              <span className="text-[11px] text-slate-400">Click to use · recalculates the plan</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((g) => {
                const active = Math.abs(g.kcal - results.energy) < 15;
                return (
                  <button
                    key={g.key}
                    type="button"
                    disabled={saving || active}
                    onClick={() => applyEnergy(g.kcal)}
                    title={g.note}
                    className={`rounded-lg border px-3 py-1.5 text-left text-xs transition ${
                      active ? "border-brand-500 bg-brand-50 text-brand-800" : "border-slate-200 bg-white text-slate-700 hover:border-brand-400"
                    }`}
                  >
                    <div className="font-semibold">{g.kcal} kcal</div>
                    <div className="text-[11px] text-slate-500">{g.label}</div>
                  </button>
                );
              })}
              <CustomEnergy current={results.energy} disabled={saving} onApply={applyEnergy} />
            </div>
            {manual && (
              <button type="button" className="mt-2 text-xs font-semibold text-brand-700 hover:underline" disabled={saving} onClick={() => applyEnergy(null)}>
                ↺ Back to formula ({Math.round(results.tee + results.goalAdjustment)} kcal)
              </button>
            )}
          </div>

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
            onClick={() => {
              if (!editing) {
                setS(subject);
                setCfg(settings);
              }
              setEditing((e) => !e);
            }}
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
              <div className="sm:col-span-3">
                <ConditionPicker
                  value={subjectConditions(s)}
                  onChange={(next) => changeSubject({ ...s, conditions: next, dietType: primaryCondition(next) })}
                />
              </div>
              <div className="sm:col-span-3">
                <GlycemicFields
                  conditions={subjectConditions(s)}
                  status={s.glycemicStatus ?? "none"}
                  labs={s.labs ?? {}}
                  onStatus={(v) => changeSubject({ ...s, glycemicStatus: v })}
                  onLabs={(v) => setS((p) => ({ ...p, labs: v }))}
                  onSetDiabetes={() => {
                    const next = toggleCondition(subjectConditions(s), "diabetes");
                    changeSubject({ ...s, conditions: next, dietType: primaryCondition(next) });
                  }}
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
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Calculation parameters</div>
                <button type="button" className="text-xs font-semibold text-brand-700 hover:underline" onClick={() => setCfg(defaultSettings(s))}>
                  ↺ Reset to recommended
                </button>
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
                <L label={`Activity (% of BMR) · ${Math.round(cfg.activityFactor * 100)}%`}>
                  <input className="input" type="number" step="0.05" min={0} max={1.5} value={cfg.activityFactor} onChange={(e) => updCfg("activityFactor", Number(e.target.value))} />
                  <Hint>
                    Recommended for {s.activityLevel}: {ACTIVITY_PA_FACTOR[s.activityLevel as ActivityLevel]} · TEE = BMR ×{" "}
                    {activityMultiplier(cfg.activityFactor, cfg.sdaFactor)}
                  </Hint>
                </L>
                <L label={`SDA / thermic effect · ${Math.round(cfg.sdaFactor * 100)}%`}>
                  <input className="input" type="number" step="0.01" min={0} max={0.2} value={cfg.sdaFactor} onChange={(e) => updCfg("sdaFactor", Number(e.target.value))} />
                  <Hint>Usually 0.10</Hint>
                </L>
                <L label="Goal adjustment (kcal)">
                  <input
                    className="input"
                    type="number"
                    step="50"
                    value={cfg.goalAdjustment ?? ""}
                    placeholder={`auto (${autoAdj > 0 ? "+" : ""}${autoAdj})`}
                    onChange={(e) => updCfg("goalAdjustment", e.target.value === "" ? null : Number(e.target.value))}
                  />
                  <Hint>Negative for loss, e.g. −300 / −500. Blank = automatic.</Hint>
                </L>
                <L label="Protein g/kg">
                  <input className="input" type="number" step="0.1" value={cfg.proteinPerKg} onChange={(e) => updCfg("proteinPerKg", Number(e.target.value))} />
                </L>
                <L label={`Fat % of energy (${Math.round(cfg.fatPercent * 100)}%)`}>
                  <input className="input" type="number" step="0.01" value={cfg.fatPercent} onChange={(e) => updCfg("fatPercent", Number(e.target.value))} />
                </L>
                <L label="Target energy (kcal)">
                  <input
                    className="input"
                    type="number"
                    step="10"
                    value={cfg.energyOverride ?? ""}
                    placeholder="auto from formula"
                    onChange={(e) => updCfg("energyOverride", e.target.value ? Number(e.target.value) : null)}
                  />
                  <Hint>Type a number to set it yourself. Blank = formula.</Hint>
                </L>
              </div>

              {preview && (
                <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-brand-200 bg-white px-4 py-3 text-sm">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Preview</span>
                  <span>BMR {preview.bmr}</span>
                  <span>TEE {preview.tee}</span>
                  {preview.goalAdjustment !== 0 && <span>Goal {preview.goalAdjustment > 0 ? "+" : ""}{preview.goalAdjustment}</span>}
                  <span className="font-bold text-brand-700">Target {preview.energy} kcal</span>
                  <span className="text-xs text-slate-500">
                    P {preview.protein.grams} g · F {preview.fat.grams} g · C {preview.cho.grams} g
                  </span>
                  {preview.energyFloored && <span className="text-xs text-amber-700">raised to the safe minimum</span>}
                </div>
              )}
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

function Row({ k, v, bold, accent, note }: { k: string; v: string; bold?: boolean; accent?: boolean; note?: string }) {
  return (
    <tr>
      <td className={`py-2 ${bold ? "font-semibold" : ""} ${accent ? "text-brand-700" : "text-slate-600"}`}>
        {k}
        {note && <div className="text-[11px] font-normal text-slate-400">{note}</div>}
      </td>
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

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="mt-1 text-[11px] text-slate-400">{children}</p>;
}

function CustomEnergy({ current, disabled, onApply }: { current: number; disabled: boolean; onApply: (kcal: number) => void }) {
  const [v, setV] = useState("");
  const n = Number(v);
  const ok = v !== "" && Number.isFinite(n) && n >= 800 && n <= 5000 && Math.round(n) !== Math.round(current);
  return (
    <form
      className="flex items-center gap-1 rounded-lg border border-dashed border-slate-300 bg-white px-2 py-1"
      onSubmit={(e) => {
        e.preventDefault();
        if (ok) onApply(Math.round(n));
      }}
    >
      <input
        type="number"
        min={800}
        max={5000}
        step={10}
        value={v}
        onChange={(e) => setV(e.target.value)}
        placeholder="Custom"
        aria-label="Custom target energy in kcal"
        className="w-20 border-0 bg-transparent p-1 text-xs focus:outline-none"
      />
      <button type="submit" disabled={disabled || !ok} className="rounded-md bg-brand-600 px-2 py-1 text-[11px] font-semibold text-white disabled:opacity-40">
        Set
      </button>
    </form>
  );
}
