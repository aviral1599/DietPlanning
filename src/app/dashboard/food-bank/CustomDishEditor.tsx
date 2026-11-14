"use client";

import { useMemo, useState } from "react";
import { Chip, ChipGroup, Modal, Toggle } from "@/components/foodbank/ui";
import { computeDish, formatPortion, scaled } from "@/lib/foodbank/bank";
import { INGREDIENT_MAP } from "@/lib/foodbank/bank";
import { CUISINE_LABELS, NUTRIENT_KEYS, NUTRIENT_META, ROLE_LABELS, type Cuisine, type Dish, type DishRole, type DishTag, type Nutrients } from "@/lib/foodbank/types";
import { DIET_TYPE_LABELS, MEAL_TIMES, MEAL_TIME_LABELS, type DietType, type MealTime } from "@/lib/types";

const STYLE_TAGS: { value: DishTag; label: string }[] = [
  { value: "traditional", label: "Traditional" },
  { value: "modern", label: "Modern" },
  { value: "fusion", label: "Fusion" },
  { value: "comfort", label: "Comfort" },
  { value: "festive", label: "Festive" },
  { value: "quick", label: "Quick" },
  { value: "no-cook", label: "No-cook" },
  { value: "steamed", label: "Steamed" },
  { value: "baked", label: "Baked" },
  { value: "grilled", label: "Grilled" },
  { value: "fried", label: "Fried" },
  { value: "fermented", label: "Fermented" },
  { value: "millet", label: "Millet" },
  { value: "light", label: "Light" },
  { value: "heavy", label: "Heavy" },
  { value: "kid-friendly", label: "Kid-friendly" },
  { value: "fasting", label: "Fasting" },
];

const CONDITIONS = Object.keys(DIET_TYPE_LABELS).filter((k) => k !== "general") as DietType[];

export default function CustomDishEditor({
  base,
  editId,
  onClose,
  onSaved,
}: {
  base?: Dish;
  editId?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(base ? (editId ? base.name : `${base.name} (custom)`) : "");
  const [local, setLocal] = useState(base?.local ?? "");
  const [role, setRole] = useState<DishRole>(base?.role ?? "sabzi");
  const [cuisine, setCuisine] = useState<Cuisine>(base?.cuisine ?? "pan-indian");
  const [region, setRegion] = useState(base?.region ?? "");
  const [slots, setSlots] = useState<MealTime[]>(base?.slots ?? ["lunch", "dinner"]);
  const [unit, setUnit] = useState(base?.unit ?? { label: "katori", plural: "katoris", default: 1, step: 0.5, min: 0.5, max: 2.5, note: "" });
  const [ingredients, setIngredients] = useState<Record<string, number>>(base?.ingredients ?? {});
  const [tags, setTags] = useState<DishTag[]>(base?.tags ?? []);
  const [gi, setGi] = useState<string>(base?.gi ?? "");
  const [freq, setFreq] = useState<string>(base?.freq ?? "regular");
  const [goodFor, setGoodFor] = useState<DietType[]>(base?.goodFor ?? []);
  const [avoidFor, setAvoidFor] = useState<DietType[]>(base?.avoidFor ?? []);
  const [method, setMethod] = useState(base?.method ?? "");
  const [manual, setManual] = useState(false);
  const [manualVals, setManualVals] = useState<Partial<Record<keyof Nutrients, string>>>({});
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const matches = useMemo(() => {
    const t = search.trim().toLowerCase();
    if (!t) return [];
    // Built-in ingredients plus the coach's own (registered in INGREDIENT_MAP).
    return Object.values(INGREDIENT_MAP).filter((i) => i.name.toLowerCase().includes(t) && !(i.key in ingredients)).slice(0, 8);
  }, [search, ingredients]);

  const manualPerUnit = useMemo(() => {
    if (!manual) return null;
    const o: Partial<Nutrients> = {};
    for (const k of NUTRIENT_KEYS) if (manualVals[k] !== undefined && manualVals[k] !== "") o[k] = Number(manualVals[k]);
    return Object.keys(o).length ? o : null;
  }, [manual, manualVals]);

  const preview = useMemo(
    () =>
      computeDish(
        { id: "preview", name: name || "Preview", cuisine, role, slots, unit, ingredients, tags },
        { manualPerUnit }
      ),
    [name, cuisine, role, slots, unit, ingredients, tags, manualPerUnit]
  );
  const portion = scaled(preview.perUnit, unit.default);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(editId ? `/api/foodbank/dishes/${editId}` : "/api/foodbank/dishes", {
        method: editId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name, local, role, cuisine, region, slots, unit, ingredients, tags,
          gi: gi || undefined, freq, goodFor, avoidFor, method, manualPerUnit,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={editId ? "Edit custom dish" : "New custom dish"}
      wide
      footer={
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-red-600">{error}</span>
          <div className="flex gap-2">
            <button className="btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn-primary" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save dish"}</button>
          </div>
        </div>
      }
    >
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="dn">Dish name</label>
              <input id="dn" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ragi Mudde" />
            </div>
            <div>
              <label className="label" htmlFor="dl">Local name (optional)</label>
              <input id="dl" className="input" value={local} onChange={(e) => setLocal(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="dr">Category</label>
              <select id="dr" className="input" value={role} onChange={(e) => setRole(e.target.value as DishRole)}>
                {(Object.keys(ROLE_LABELS) as DishRole[]).map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="dc">Cuisine</label>
              <select id="dc" className="input" value={cuisine} onChange={(e) => setCuisine(e.target.value as Cuisine)}>
                {(Object.keys(CUISINE_LABELS) as Cuisine[]).map((c) => <option key={c} value={c}>{CUISINE_LABELS[c]}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label" htmlFor="dreg">Region (optional)</label>
            <input id="dreg" className="input" value={region} onChange={(e) => setRegion(e.target.value)} placeholder="e.g. Karnataka" />
          </div>
          <div>
            <div className="label">Suitable meal times</div>
            <ChipGroup options={MEAL_TIMES.map((m) => ({ value: m, label: MEAL_TIME_LABELS[m] }))} value={slots} onChange={setSlots} />
          </div>

          <div>
            <div className="label">Portion unit</div>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              <input className="input col-span-1 sm:col-span-2" value={unit.label} onChange={(e) => setUnit({ ...unit, label: e.target.value })} placeholder="katori" aria-label="Unit (singular)" />
              <input className="input col-span-2 sm:col-span-2" value={unit.plural} onChange={(e) => setUnit({ ...unit, plural: e.target.value })} placeholder="katoris" aria-label="Unit (plural)" />
              <input className="input sm:col-span-2" value={unit.note ?? ""} onChange={(e) => setUnit({ ...unit, note: e.target.value })} placeholder="≈150 g cooked" aria-label="Unit note" />
              {(["default", "step", "min", "max"] as const).map((k) => (
                <label key={k} className="text-[10px] uppercase text-slate-400">
                  {k}
                  <input type="number" step="0.5" min="0" className="input mt-0.5 py-1" value={unit[k]} onChange={(e) => setUnit({ ...unit, [k]: Number(e.target.value) })} />
                </label>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <div className="label mb-0">Ingredients per 1 {unit.label || "unit"} (raw weight)</div>
              <Toggle checked={manual} onChange={setManual} label={<span className="text-xs">Enter nutrition manually</span>} />
            </div>
            {!manual && (
              <>
                <div className="relative">
                  <input className="input" placeholder="Add ingredient — search e.g. moong, ghee, spinach" value={search} onChange={(e) => setSearch(e.target.value)} />
                  {matches.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
                      {matches.map((i) => (
                        <button key={i.key} className="flex w-full justify-between px-3 py-2 text-left text-sm hover:bg-slate-50" onClick={() => { setIngredients({ ...ingredients, [i.key]: 10 }); setSearch(""); }}>
                          <span>{i.name}</span>
                          <span className="text-[10px] text-slate-400">{Math.round(i.per100.kcal)} kcal/100 g</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <ul className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-200">
                  {Object.entries(ingredients).map(([k, g]) => {
                    const ing = INGREDIENT_MAP[k];
                    return (
                      <li key={k} className="flex items-center gap-2 px-3 py-1.5 text-sm">
                        <span className="flex-1 text-slate-700">{ing?.name ?? k}</span>
                        <input type="number" min="0" step="1" className="input w-20 py-1 text-right" value={g} onChange={(e) => setIngredients({ ...ingredients, [k]: Number(e.target.value) })} aria-label={`${ing?.name} grams`} />
                        <span className="w-6 text-xs text-slate-400">{ing?.liquid ? "ml" : "g"}</span>
                        <button className="text-slate-300 hover:text-red-600" onClick={() => { const n = { ...ingredients }; delete n[k]; setIngredients(n); }} aria-label={`Remove ${ing?.name}`}>×</button>
                      </li>
                    );
                  })}
                  {Object.keys(ingredients).length === 0 && <li className="px-3 py-4 text-center text-xs text-slate-400">No ingredients yet</li>}
                </ul>
              </>
            )}
            {manual && (
              <div className="grid grid-cols-3 gap-2">
                {NUTRIENT_KEYS.map((k) => (
                  <label key={k} className="text-[10px] uppercase text-slate-400">
                    {NUTRIENT_META[k].label} ({NUTRIENT_META[k].unit})
                    <input type="number" min="0" step="0.1" className="input mt-0.5 py-1" value={manualVals[k] ?? ""} onChange={(e) => setManualVals({ ...manualVals, [k]: e.target.value })} />
                  </label>
                ))}
                <p className="col-span-3 text-[11px] text-slate-400">Values per 1 {unit.label || "unit"} — e.g. from a product label.</p>
              </div>
            )}
          </div>

          <div>
            <div className="label">Tags</div>
            <ChipGroup tone="amber" options={STYLE_TAGS} value={tags} onChange={setTags} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="gi">Glycaemic index</label>
              <select id="gi" className="input" value={gi} onChange={(e) => setGi(e.target.value)}>
                <option value="">Auto</option><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
              </select>
            </div>
            <div>
              <label className="label" htmlFor="fq">How often in plans</label>
              <select id="fq" className="input" value={freq} onChange={(e) => setFreq(e.target.value)}>
                <option value="daily">Daily staple</option><option value="regular">Regular (2–3×/week)</option><option value="weekly">Weekly</option><option value="occasional">Occasional treat</option>
              </select>
            </div>
          </div>
          <div>
            <div className="label">Especially good for</div>
            <ChipGroup options={CONDITIONS.map((c) => ({ value: c, label: DIET_TYPE_LABELS[c] }))} value={goodFor} onChange={setGoodFor} />
          </div>
          <div>
            <div className="label">Avoid for</div>
            <ChipGroup tone="red" options={CONDITIONS.map((c) => ({ value: c, label: DIET_TYPE_LABELS[c] }))} value={avoidFor} onChange={setAvoidFor} />
          </div>
          <div>
            <label className="label" htmlFor="mt">Method</label>
            <textarea id="mt" className="input min-h-[70px]" value={method} onChange={(e) => setMethod(e.target.value)} placeholder="Short cooking instructions for the client" />
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="sticky top-0 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Live nutrition — {formatPortion(preview, unit.default)}</div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {NUTRIENT_KEYS.map((k) => (
                <div key={k} className="rounded-lg bg-white px-2.5 py-1.5">
                  <div className="text-[10px] uppercase text-slate-400">{NUTRIENT_META[k].label}</div>
                  <div className="text-sm font-semibold tabular-nums text-slate-800">
                    {k === "kcal" || NUTRIENT_META[k].unit !== "g" ? Math.round(portion[k]) : portion[k].toFixed(1)}
                    <span className="ml-0.5 text-[10px] font-normal text-slate-400">{NUTRIENT_META[k].unit}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-1">
              {preview.diet.vegetarian ? <Chip size="sm" tone="brand">Vegetarian</Chip> : <Chip size="sm" tone="red">Non-veg / egg</Chip>}
              {preview.diet.vegan && <Chip size="sm" tone="brand">Vegan</Chip>}
              {preview.diet.jain && <Chip size="sm" tone="brand">Jain</Chip>}
              {preview.autoTags.map((t) => <Chip key={t} size="sm" tone="amber">{t.replace(/-/g, " ")}</Chip>)}
              {preview.allergens.map((a) => <Chip key={a} size="sm" tone="red">{a}</Chip>)}
            </div>
            <p className="mt-3 text-[11px] text-slate-400">Diet suitability, allergens and nutrition tags are derived automatically from the ingredients.</p>
          </div>
        </div>
      </div>
    </Modal>
  );
}
