"use client";

import { useId } from "react";
import { CONDITION_PRIORITY, conflictsWith, toggleCondition } from "@/lib/conditions";
import { DIET_TYPE_LABELS, type DietType } from "@/lib/types";

// Display order: "none" first, then goals, then conditions.
const ORDER: DietType[] = [
  "general",
  "weight-loss",
  "weight-gain",
  "high-protein",
  "diabetes",
  "insulin-resistance",
  "pcos",
  "hypothyroid",
  "hypertension",
  "renal",
  "pregnancy",
  "lactation",
];

/**
 * Multi-select for conditions / goals. Picking a condition that can't go
 * with another (weight loss vs gain, pregnancy vs lactation, diabetes vs
 * insulin resistance) swaps it; "General / Balanced" clears the rest.
 */
export default function ConditionPicker({
  value,
  onChange,
  label = "Conditions / goals",
}: {
  value: DietType[];
  onChange: (next: DietType[]) => void;
  label?: string;
}) {
  const id = useId();
  const selected = value.length ? value : (["general"] as DietType[]);
  const primary = [...selected].sort((a, b) => CONDITION_PRIORITY.indexOf(a) - CONDITION_PRIORITY.indexOf(b))[0];

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span id={`${id}-label`} className="label mb-0">
          {label}
        </span>
        <span className="text-xs text-slate-400">Select all that apply</span>
      </div>
      <div role="group" aria-labelledby={`${id}-label`} className="mt-2 flex flex-wrap gap-2">
        {ORDER.map((c) => {
          const on = selected.includes(c);
          const swaps = !on && c !== "general" ? conflictsWith(c).filter((x) => selected.includes(x)) : [];
          return (
            <button
              key={c}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(toggleCondition(selected, c))}
              title={swaps.length ? `Replaces ${swaps.map((x) => DIET_TYPE_LABELS[x]).join(", ")}` : undefined}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                on
                  ? c === "general"
                    ? "border-slate-700 bg-slate-700 text-white"
                    : "border-brand-600 bg-brand-600 text-white"
                  : "border-slate-200 bg-white text-slate-700 hover:border-brand-400"
              }`}
            >
              {on && c !== "general" ? "✓ " : ""}
              {DIET_TYPE_LABELS[c]}
            </button>
          );
        })}
      </div>
      {selected.length > 1 && (
        <p className="mt-1.5 text-xs text-slate-500">
          Calculations combine all of them: highest protein need, lowest fat share, and no calorie deficit in pregnancy,
          lactation or kidney disease. Primary: <strong>{DIET_TYPE_LABELS[primary]}</strong>.
        </p>
      )}
    </div>
  );
}
