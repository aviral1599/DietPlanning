"use client";

import { useMemo, useState } from "react";
import { Chip, ChipGroup, Toggle } from "@/components/foodbank/ui";
import { INGREDIENTS } from "@/lib/foodbank/ingredients";
import { WEEKDAYS, nextMonday, type ChartPrefs } from "@/lib/foodbank/engine";
import { CUISINE_SHORT, type Cuisine, type Dish, type DishTag } from "@/lib/foodbank/types";
import type { DietPreference } from "@/lib/types";

const FOCUS: { value: DishTag; label: string }[] = [
  { value: "ir-friendly", label: "Insulin-friendly" },
  { value: "low-gi", label: "Low GI" },
  { value: "millet", label: "Millets" },
  { value: "high-fibre", label: "High fibre" },
  { value: "high-protein", label: "High protein" },
  { value: "iron-rich", label: "Iron-rich" },
  { value: "calcium-rich", label: "Calcium-rich" },
  { value: "traditional", label: "Traditional" },
  { value: "modern", label: "Modern / new" },
  { value: "quick", label: "Quick to cook" },
  { value: "budget", label: "Budget-friendly" },
  { value: "probiotic", label: "Probiotic" },
];
const AVOID: { value: DishTag; label: string }[] = [
  { value: "fried", label: "Fried" },
  { value: "heavy", label: "Heavy / rich" },
  { value: "festive", label: "Festive" },
  { value: "fasting", label: "Fasting foods" },
];

export default function ChartGenerator({
  initial,
  dietPreference,
  dishes,
  busy,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: Partial<ChartPrefs>;
  dietPreference: DietPreference;
  dishes: Dish[];
  busy?: boolean;
  submitLabel: string;
  onSubmit: (prefs: Partial<ChartPrefs>) => void;
  onCancel?: () => void;
}) {
  const [days, setDays] = useState<number>(initial?.days ?? 7);
  const [startDate, setStartDate] = useState(initial?.startDate ?? nextMonday());
  const [cuisines, setCuisines] = useState<Cuisine[]>(initial?.cuisines ?? []);
  const [nonVegDays, setNonVegDays] = useState<number[]>(initial?.nonVegDays ?? (dietPreference === "non-vegetarian" ? [2, 4, 5, 6] : []));
  const [focusTags, setFocus] = useState<DishTag[]>(initial?.focusTags ?? []);
  const [avoidTags, setAvoid] = useState<DishTag[]>(initial?.avoidTags ?? []);
  const [exIng, setExIng] = useState<string[]>(initial?.excludeIngredients ?? []);
  const [exDish, setExDish] = useState<string[]>(initial?.excludeDishes ?? []);
  const [em, setEm] = useState(initial?.includeEarlyMorning ?? true);
  const [bt, setBt] = useState(initial?.includeBedtime ?? true);
  const [search, setSearch] = useState("");

  const matches = useMemo(() => {
    const t = search.trim().toLowerCase();
    if (t.length < 2) return [];
    const ing = INGREDIENTS.filter((i) => i.name.toLowerCase().includes(t) && !exIng.includes(i.key))
      .slice(0, 6)
      .map((i) => ({ kind: "ing" as const, key: i.key, label: i.name }));
    const ds = dishes.filter((d) => d.name.toLowerCase().includes(t) && !exDish.includes(d.id))
      .slice(0, 6)
      .map((d) => ({ kind: "dish" as const, key: d.id, label: d.name }));
    return [...ing, ...ds];
  }, [search, dishes, exIng, exDish]);

  const ingName = (k: string) => INGREDIENTS.find((i) => i.key === k)?.name ?? k;
  const dishName = (k: string) => dishes.find((d) => d.id === k)?.name ?? k;

  return (
    <div className="space-y-5">
      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <div className="label">Duration</div>
          <ChipGroup
            single
            options={[
              { value: "7", label: "1 week" },
              { value: "14", label: "2 weeks" },
              { value: "28", label: "Monthly (4 weeks)" },
            ]}
            value={[String(days)]}
            onChange={(v) => setDays(Number(v[0]))}
          />
        </div>
        <div>
          <label className="label" htmlFor="startDate">Start date</label>
          <input id="startDate" type="date" className="input max-w-[200px]" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
      </div>

      <div>
        <div className="label">Preferred cuisines <span className="font-normal normal-case text-slate-400">(none = mix of everything)</span></div>
        <ChipGroup
          tone="blue"
          options={(Object.keys(CUISINE_SHORT) as Cuisine[]).map((c) => ({ value: c, label: CUISINE_SHORT[c] }))}
          value={cuisines}
          onChange={setCuisines}
        />
      </div>

      {dietPreference === "non-vegetarian" && (
        <div>
          <div className="label">Non-veg days</div>
          <div className="flex flex-wrap gap-1.5">
            {WEEKDAYS.map((w, i) => (
              <Chip key={w} tone="red" active={nonVegDays.includes(i)} onClick={() => setNonVegDays(nonVegDays.includes(i) ? nonVegDays.filter((x) => x !== i) : [...nonVegDays, i])}>
                {w}
              </Chip>
            ))}
          </div>
          <p className="mt-1 text-xs text-slate-400">Chicken / fish / mutton appear only on these days; eggs any day.</p>
        </div>
      )}

      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <div className="label">Focus on</div>
          <ChipGroup options={FOCUS} value={focusTags} onChange={setFocus} />
        </div>
        <div>
          <div className="label">Avoid</div>
          <ChipGroup tone="red" options={AVOID} value={avoidTags} onChange={setAvoid} />
        </div>
      </div>

      <div>
        <div className="label">Exclude ingredients or dishes <span className="font-normal normal-case text-slate-400">(dislikes, intolerances)</span></div>
        <div className="relative">
          <input className="input" placeholder="Type to search — e.g. brinjal, mushroom, poha" value={search} onChange={(e) => setSearch(e.target.value)} />
          {matches.length > 0 && (
            <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
              {matches.map((m) => (
                <button
                  key={`${m.kind}:${m.key}`}
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-50"
                  onClick={() => {
                    if (m.kind === "ing") setExIng([...exIng, m.key]);
                    else setExDish([...exDish, m.key]);
                    setSearch("");
                  }}
                >
                  <span>{m.label}</span>
                  <span className="text-[10px] uppercase text-slate-400">{m.kind === "ing" ? "ingredient" : "dish"}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        {(exIng.length > 0 || exDish.length > 0) && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {exIng.map((k) => (
              <Chip key={k} tone="red" onRemove={() => setExIng(exIng.filter((x) => x !== k))}>
                no {ingName(k)}
              </Chip>
            ))}
            {exDish.map((k) => (
              <Chip key={k} tone="amber" onRemove={() => setExDish(exDish.filter((x) => x !== k))}>
                no {dishName(k)}
              </Chip>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-6">
        <Toggle checked={em} onChange={setEm} label="Early-morning drink" />
        <Toggle checked={bt} onChange={setBt} label="Bedtime drink" />
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
        <button
          className="btn-primary"
          disabled={busy}
          onClick={() =>
            onSubmit({
              days,
              startDate,
              cuisines,
              nonVegDays,
              focusTags,
              avoidTags,
              excludeIngredients: exIng,
              excludeDishes: exDish,
              includeEarlyMorning: em,
              includeBedtime: bt,
            })
          }
        >
          {busy ? "Building plan…" : submitLabel}
        </button>
        {onCancel && (
          <button className="btn-ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
        )}
        <span className="text-xs text-slate-400">Diet preference, allergies and condition from the assessment are always respected.</span>
      </div>
    </div>
  );
}
