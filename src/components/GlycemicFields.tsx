"use client";

import { useId } from "react";
import { Chip } from "@/components/foodbank/ui";
import { interpretLabs, type LabTone } from "@/lib/glycemic";
import { GLYCEMIC_STATUS_LABELS, type DietType, type GlycemicLabs, type GlycemicStatus } from "@/lib/types";

const STATUS_HELP: Record<GlycemicStatus, string> = {
  none: "No known blood-sugar issue, or not tested.",
  "insulin-resistance": "High fasting insulin / HOMA-IR, acanthosis, central obesity or PCOS with normal glucose.",
  prediabetes: "HbA1c 5.7–6.4 %, fasting glucose 100–125 or 2-h glucose 140–199 mg/dL.",
};

const LAB_FIELDS: { key: keyof GlycemicLabs; label: string; unit: string; step: string; placeholder: string }[] = [
  { key: "hba1c", label: "HbA1c", unit: "%", step: "0.1", placeholder: "e.g. 5.9" },
  { key: "fastingGlucose", label: "Fasting glucose", unit: "mg/dL", step: "1", placeholder: "e.g. 108" },
  { key: "postprandialGlucose", label: "2-h glucose (PP)", unit: "mg/dL", step: "1", placeholder: "e.g. 150" },
  { key: "fastingInsulin", label: "Fasting insulin", unit: "µIU/mL", step: "0.1", placeholder: "e.g. 14" },
];

const TONE_CLASS: Record<LabTone, string> = {
  ok: "border-emerald-200 bg-emerald-50 text-emerald-800",
  warn: "border-amber-200 bg-amber-50 text-amber-800",
  high: "border-red-200 bg-red-50 text-red-700",
};

/**
 * Blood-sugar status (insulin resistance / prediabetes) with optional lab
 * values. Interprets the labs live and offers to apply what they suggest.
 */
export default function GlycemicFields({
  dietType,
  status,
  labs,
  onStatus,
  onLabs,
  onSetDiabetes,
}: {
  dietType: DietType;
  status: GlycemicStatus;
  labs: GlycemicLabs;
  onStatus: (s: GlycemicStatus) => void;
  onLabs: (l: GlycemicLabs) => void;
  onSetDiabetes?: () => void;
}) {
  const id = useId();
  const interp = interpretLabs(labs);
  const isDiabetes = dietType === "diabetes";
  const suggestion =
    interp.suggested && interp.suggested !== "diabetes" && interp.suggested !== "none" && interp.suggested !== status && !isDiabetes
      ? interp.suggested
      : null;

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div id={`${id}-label`} className="text-sm font-semibold text-slate-800">
          Insulin resistance / prediabetes
        </div>
        <span className="text-xs text-slate-500">Shapes food choices on top of the main condition</span>
      </div>

      {isDiabetes ? (
        <p className="mt-2 text-xs text-slate-500">Covered by the Diabetes condition — blood-sugar-friendly planning is already on.</p>
      ) : (
        <>
          <div role="radiogroup" aria-labelledby={`${id}-label`} className="mt-3 flex flex-wrap gap-2">
            {(Object.keys(GLYCEMIC_STATUS_LABELS) as GlycemicStatus[]).map((s) => (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={status === s}
                onClick={() => onStatus(s)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                  status === s
                    ? s === "none"
                      ? "border-slate-700 bg-slate-700 text-white"
                      : "border-amber-500 bg-amber-500 text-white"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-400"
                }`}
              >
                {GLYCEMIC_STATUS_LABELS[s]}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-slate-500">{STATUS_HELP[status]}</p>
          {dietType === "insulin-resistance" && status === "none" && (
            <p className="mt-1 text-xs text-amber-700">The main condition is insulin resistance, so this will be saved as “Insulin resistance”.</p>
          )}
        </>
      )}

      <details className="group mt-3" open={Object.values(labs).some((v) => v != null)}>
        <summary className="cursor-pointer select-none text-xs font-semibold text-brand-700 hover:text-brand-800">
          Lab values (optional)
        </summary>
        <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {LAB_FIELDS.map((f) => (
            <div key={f.key}>
              <label htmlFor={`${id}-${f.key}`} className="mb-1 block text-[11px] font-medium text-slate-600">
                {f.label} <span className="text-slate-400">({f.unit})</span>
              </label>
              <input
                id={`${id}-${f.key}`}
                type="number"
                inputMode="decimal"
                min={0}
                step={f.step}
                className="input"
                placeholder={f.placeholder}
                value={labs[f.key] ?? ""}
                onChange={(e) => onLabs({ ...labs, [f.key]: e.target.value === "" ? null : Number(e.target.value) })}
              />
            </div>
          ))}
        </div>
      </details>

      {interp.findings.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5" aria-live="polite">
          {interp.findings.map((f) => (
            <span key={f.key} className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${TONE_CLASS[f.tone]}`}>
              {f.label} {f.value} · {f.band}
            </span>
          ))}
        </div>
      )}

      {suggestion && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-700">
          <span>
            Labs point to <strong>{GLYCEMIC_STATUS_LABELS[suggestion].toLowerCase()}</strong>.
          </span>
          <Chip size="sm" tone="amber" onClick={() => onStatus(suggestion)}>
            Set as {GLYCEMIC_STATUS_LABELS[suggestion]}
          </Chip>
        </div>
      )}
      {interp.suggested === "diabetes" && !isDiabetes && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
          <span>These values are in the <strong>diabetes range</strong>. Confirm with a physician; consider the Diabetes condition.</span>
          {onSetDiabetes && (
            <Chip size="sm" tone="red" onClick={onSetDiabetes}>
              Switch condition to Diabetes
            </Chip>
          )}
        </div>
      )}
    </div>
  );
}
