"use client";

import { useMemo, useState } from "react";
import { formatPortion, INGREDIENT_MAP, scaled } from "@/lib/foodbank/bank";
import { CUISINE_SHORT, ROLE_LABELS, type Cuisine, type Dish, type DishRole, type DishTag } from "@/lib/foodbank/types";
import type { MealTime } from "@/lib/types";
import { Chip, DietMark, MacroLine } from "./ui";
import DishDetail from "./DishDetail";

const TAG_FILTERS: { value: DishTag; label: string }[] = [
  { value: "ir-friendly", label: "Insulin-friendly" },
  { value: "anti-inflammatory", label: "Anti-inflammatory" },
  { value: "high-protein", label: "High protein" },
  { value: "high-fibre", label: "High fibre" },
  { value: "low-gi", label: "Low GI" },
  { value: "millet", label: "Millet" },
  { value: "low-cal", label: "Low calorie" },
  { value: "iron-rich", label: "Iron-rich" },
  { value: "calcium-rich", label: "Calcium-rich" },
  { value: "quick", label: "Quick" },
  { value: "traditional", label: "Traditional" },
  { value: "modern", label: "Modern" },
  { value: "no-cook", label: "No-cook" },
  { value: "budget", label: "Budget" },
];

export interface PickerProps {
  dishes: Dish[];
  meal?: MealTime;
  roles?: DishRole[];
  /** Energy left to fill in the meal; used to rank and pre-size portions. */
  remainingKcal?: number;
  onPick: (dish: Dish, units: number) => void;
  actionLabel?: string;
  /** dish ids to visually flag as already in the meal */
  inMeal?: string[];
  initialQuery?: string;
  maxHeight?: string;
  /** In a chart: a dish saved from the recipe editor is added here. */
  onUseNew?: (newId: string, units: number) => void;
}

export function sizeFor(dish: Dish, remaining?: number) {
  if (!remaining || remaining <= 0 || dish.perUnit.kcal <= 0) return dish.unit.default;
  // Size the portion to the remaining energy, but never beyond 2× the usual serving.
  const snapped = Math.round(remaining / dish.perUnit.kcal / dish.unit.step) * dish.unit.step;
  return Math.min(dish.unit.max, dish.unit.default * 2, Math.max(dish.unit.min, snapped));
}

export default function DishPicker({
  dishes,
  meal,
  roles,
  remainingKcal,
  onPick,
  actionLabel = "Add",
  inMeal = [],
  initialQuery = "",
  maxHeight = "28rem",
  onUseNew,
}: PickerProps) {
  const [q, setQ] = useState(initialQuery);
  const [roleF, setRoleF] = useState<DishRole[]>(roles ?? []);
  const [cuisineF, setCuisineF] = useState<Cuisine[]>([]);
  const [tagF, setTagF] = useState<string[]>([]);
  const [mealOnly, setMealOnly] = useState(!!meal);
  const [open, setOpen] = useState<string | null>(null);
  const [limit, setLimit] = useState(40);

  const availableRoles = useMemo(() => {
    const s = new Set<DishRole>();
    dishes.forEach((d) => (!meal || !mealOnly || d.slots.includes(meal)) && s.add(d.role));
    return Array.from(s);
  }, [dishes, meal, mealOnly]);

  const results = useMemo(() => {
    const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    const list = dishes.filter((d) => {
      if (meal && mealOnly && !d.slots.includes(meal)) return false;
      if (roleF.length && !roleF.includes(d.role) && !(d.fills ?? []).some((r) => roleF.includes(r))) return false;
      if (cuisineF.length && !cuisineF.includes(d.cuisine)) return false;
      for (const t of tagF) {
        if (!d.allTags.includes(t as DishTag)) return false;
      }
      if (terms.length) {
        const hay = `${d.name} ${d.local ?? ""} ${d.region ?? ""} ${d.cuisine} ${ROLE_LABELS[d.role]} ${Object.keys(d.ingredients)
          .map((k) => INGREDIENT_MAP[k]?.name ?? k)
          .join(" ")}`.toLowerCase();
        if (!terms.every((t) => hay.includes(t))) return false;
      }
      return true;
    });
    if (remainingKcal && remainingKcal > 0) {
      // closest default-portion energy to the remaining gap first
      list.sort(
        (a, b) =>
          Math.abs(a.perUnit.kcal * a.unit.default - remainingKcal) - Math.abs(b.perUnit.kcal * b.unit.default - remainingKcal)
      );
    } else {
      list.sort((a, b) => a.name.localeCompare(b.name));
    }
    return list;
  }, [dishes, q, roleF, cuisineF, tagF, meal, mealOnly, remainingKcal]);

  const cuisines = Object.keys(CUISINE_SHORT) as Cuisine[];

  return (
    <div className="flex flex-col gap-2">
      <input
        className="input"
        placeholder="Search dishes or ingredients — e.g. paneer, ragi, dosa"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setLimit(40);
        }}
        autoFocus
      />
      <div className="flex flex-wrap gap-1.5">
        {availableRoles.map((r) => (
          <Chip key={r} size="sm" tone="brand" active={roleF.includes(r)} onClick={() => setRoleF(roleF.includes(r) ? roleF.filter((x) => x !== r) : [...roleF, r])}>
            {ROLE_LABELS[r]}
          </Chip>
        ))}
      </div>
      <details className="text-xs">
        <summary className="cursor-pointer select-none font-medium text-slate-500">
          More filters{cuisineF.length + tagF.length > 0 ? ` (${cuisineF.length + tagF.length})` : ""}
        </summary>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {cuisines.map((c) => (
            <Chip key={c} size="sm" tone="blue" active={cuisineF.includes(c)} onClick={() => setCuisineF(cuisineF.includes(c) ? cuisineF.filter((x) => x !== c) : [...cuisineF, c])}>
              {CUISINE_SHORT[c]}
            </Chip>
          ))}
        </div>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {TAG_FILTERS.map((t) => (
            <Chip key={t.value} size="sm" tone="amber" active={tagF.includes(t.value)} onClick={() => setTagF(tagF.includes(t.value) ? tagF.filter((x) => x !== t.value) : [...tagF, t.value])}>
              {t.label}
            </Chip>
          ))}
        </div>
        {meal && (
          <label className="mt-2 flex items-center gap-2 text-slate-600">
            <input type="checkbox" checked={mealOnly} onChange={(e) => setMealOnly(e.target.checked)} />
            Only dishes suited to this meal
          </label>
        )}
      </details>

      <div className="text-[11px] text-slate-400">
        {results.length} dish{results.length === 1 ? "" : "es"}
        {remainingKcal && remainingKcal > 0 ? ` · sorted by fit for ~${Math.round(remainingKcal)} kcal` : ""}
      </div>

      <ul className="divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200" style={{ maxHeight }}>
        {results.slice(0, limit).map((d) => {
          const units = sizeFor(d, remainingKcal);
          const n = scaled(d.perUnit, units);
          const already = inMeal.includes(d.id);
          return (
            <li key={d.id} className="px-3 py-2">
              <div className="flex items-center gap-2">
                <DietMark dish={d} />
                <button className="min-w-0 flex-1 text-left" onClick={() => setOpen(open === d.id ? null : d.id)}>
                  <div className="truncate text-sm font-medium text-slate-800">
                    {d.name}
                    {d.custom && <span className="ml-1.5 rounded bg-blue-50 px-1 text-[10px] text-blue-700">custom</span>}
                  </div>
                  <div className="truncate text-[11px] text-slate-400">
                    {formatPortion(d, units)} · <MacroLine kcal={n.kcal} protein={n.protein} /> · {CUISINE_SHORT[d.cuisine]}
                  </div>
                </button>
                <button
                  className={`btn shrink-0 px-3 py-1 text-xs ${already ? "bg-slate-100 text-slate-500" : "bg-brand-600 text-white hover:bg-brand-700"}`}
                  onClick={() => onPick(d, units)}
                  title={already ? "Already in this meal" : undefined}
                >
                  {already ? "Added" : actionLabel}
                </button>
              </div>
              {open === d.id && (
                <div className="mt-2 rounded-lg bg-slate-50 p-3">
                  <DishDetail dish={d} units={units} showSources={false} onUseNew={onUseNew ? (id) => onUseNew(id, units) : undefined} />
                </div>
              )}
            </li>
          );
        })}
        {results.length === 0 && <li className="px-3 py-8 text-center text-sm text-slate-400">No dishes match these filters.</li>}
      </ul>
      {results.length > limit && (
        <button className="btn-ghost text-xs" onClick={() => setLimit(limit + 40)}>
          Show more
        </button>
      )}
    </div>
  );
}
