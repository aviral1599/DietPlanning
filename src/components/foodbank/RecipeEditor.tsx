"use client";

import { createContext, useContext, useMemo, useState } from "react";
import { computeDish, dishToData, INGREDIENT_MAP } from "@/lib/foodbank/bank";
import { cookedNote } from "@/lib/foodbank/cooked";
import {
  ALLERGEN_LABELS,
  GROCERY_CATEGORY,
  NUTRIENT_KEYS,
  NUTRIENT_META,
  type Allergen,
  type AnimalSource,
  type CustomDishData,
  type CustomIngredientData,
  type Dish,
  type Ingredient,
  type IngredientGroup,
} from "@/lib/foodbank/types";
import { FOOD_GROUP_LABELS, type FoodGroup } from "@/lib/types";
import { Chip } from "./ui";

// ---------------------------------------------------------------------------
// What a screen lets the coach do with an edited recipe. Provided by the
// diet chart (all three options) and the food bank (save as new / replace).
// ---------------------------------------------------------------------------

export interface RecipeActions {
  /** Built-in + this coach's own ingredients, for the "add ingredient" search. */
  ingredients: Ingredient[];
  addIngredient: (data: Omit<CustomIngredientData, "kind">) => Promise<Ingredient>;
  saveNew: (base: Dish, data: CustomDishData) => Promise<string>;
  replace: (base: Dish, data: CustomDishData) => Promise<void>;
  /** Only inside a client's chart: a version used every time in this chart. */
  forClient?: (base: Dish, data: CustomDishData) => Promise<string>;
  restore?: (dish: Dish) => Promise<void>;
}

export const RecipeContext = createContext<RecipeActions | null>(null);
export const useRecipeActions = () => useContext(RecipeContext);

const fmt = (v: number) => (Math.round(v * 10) / 10).toString();
const fmt2 = (v: number) => (Math.round(v * 100) / 100).toString();

/**
 * Ingredients table for a dish. With recipe actions available it can switch
 * to edit mode: change grams, remove, add (from the list or brand-new), see
 * nutrition update live, then save the result.
 */
export default function IngredientsSection({
  dish,
  units,
  showSources,
  onUseNew,
}: {
  dish: Dish;
  units: number;
  showSources: boolean;
  /** "Save as new dish" inside a chart also puts the new dish here. */
  onUseNew?: (newId: string) => void;
}) {
  const actions = useRecipeActions();
  const [editing, setEditing] = useState(false);
  const entries = Object.entries(dish.ingredients);
  if (!entries.length && !actions) return null;

  if (editing && actions) {
    return <RecipeEditor dish={dish} units={units} actions={actions} onClose={() => setEditing(false)} onUseNew={onUseNew} />;
  }

  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Ingredients (raw weight)
          {entries.some(([k]) => cookedNote(k, 1)) && <span className="ml-1 font-normal normal-case text-slate-400">· cooked weight shown for pulses & grains</span>}
        </div>
        {actions && (
          <button type="button" className="text-xs font-semibold text-brand-700 hover:underline" onClick={() => setEditing(true)}>
            ✎ Edit ingredients
          </button>
        )}
      </div>
      {entries.length > 0 ? (
        <table className="w-full text-xs">
          <tbody>
            {entries.map(([k, g]) => {
              const ing = INGREDIENT_MAP[k];
              return (
                <tr key={k} className="border-b border-slate-100">
                  <td className="py-1 pr-2 text-slate-700">{ing?.name ?? k}</td>
                  <td className="whitespace-nowrap py-1 pr-2 text-right tabular-nums text-slate-600">
                    {fmt(g * units)} {ing?.liquid ? "ml" : "g"}
                    {cookedNote(k, g * units) && <div className="text-[10px] font-normal text-slate-400">{cookedNote(k, g * units)}</div>}
                  </td>
                  {showSources && <td className="hidden py-1 text-right text-[10px] text-slate-400 sm:table-cell">{ing?.source}</td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : (
        <p className="text-xs text-slate-400">No ingredient list — nutrition was entered manually.</p>
      )}
      {actions?.restore && dish.replaces && dish.replaceActive && (
        <button type="button" className="mt-2 text-xs font-semibold text-slate-600 hover:underline" onClick={() => actions.restore?.(dish)}>
          ↺ Restore the original food bank recipe
        </button>
      )}
    </div>
  );
}

function RecipeEditor({
  dish,
  units,
  actions,
  onClose,
  onUseNew,
}: {
  dish: Dish;
  units: number;
  actions: RecipeActions;
  onClose: () => void;
  onUseNew?: (newId: string) => void;
}) {
  // Quantities are edited for the portion shown (e.g. 2 rotis) and stored per unit.
  // `orig`/`qty0` remember the starting value so untouched rows keep their exact amount.
  const [rows, setRows] = useState<{ key: string; qty: string; qty0?: string; orig?: number }[]>(
    Object.entries(dish.ingredients).map(([key, g]) => ({ key, qty: fmt2(g * units), qty0: fmt2(g * units), orig: g }))
  );
  const [q, setQ] = useState("");
  const [newIng, setNewIng] = useState(false);
  const [name, setName] = useState(dish.name);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const perUnit = useMemo(() => {
    const out: Record<string, number> = {};
    for (const r of rows) {
      if (r.orig != null && r.qty === r.qty0) {
        out[r.key] = r.orig;
        continue;
      }
      const v = Number(r.qty);
      if (Number.isFinite(v) && v > 0) out[r.key] = Math.round((v / units) * 1000) / 1000;
    }
    return out;
  }, [rows, units]);

  const changed = rows.length !== Object.keys(dish.ingredients).length || rows.some((r) => r.orig == null || r.qty !== r.qty0);
  const incomplete = rows.some((r) => !(Number(r.qty) > 0));
  const preview = useMemo(() => {
    try {
      return computeDish({ ...dish, ingredients: perUnit });
    } catch {
      return null;
    }
  }, [dish, perUnit]);
  const before = dish.perUnit;
  const after = preview?.perUnit;

  const matches = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return [];
    return actions.ingredients.filter((i) => i.name.toLowerCase().includes(t) && !rows.some((r) => r.key === i.key)).slice(0, 8);
  }, [q, actions.ingredients, rows]);

  const data = (): CustomDishData => ({ ...dishToData(dish), name: name.trim() || dish.name, ingredients: perUnit });

  const run = async (label: string, fn: () => Promise<void>) => {
    setError(null);
    if (!name.trim()) return setError("Give the dish a name.");
    if (!Object.keys(perUnit).length) return setError("Add at least one ingredient.");
    setBusy(label);
    try {
      await fn();
      onClose();
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "Could not save.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="rounded-lg border border-brand-200 bg-white p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-xs font-semibold uppercase tracking-wide text-brand-700">Edit ingredients · for {units} {units <= 1 ? dish.unit.label : dish.unit.plural}</div>
        <button type="button" className="text-xs text-slate-400 hover:text-slate-700" onClick={onClose}>
          Cancel
        </button>
      </div>

      <table className="w-full text-xs">
        <tbody>
          {rows.map((r, i) => {
            const ing = INGREDIENT_MAP[r.key];
            return (
              <tr key={r.key} className="border-b border-slate-100">
                <td className="py-1 pr-2 text-slate-700">
                  {ing?.name ?? r.key}
                  {cookedNote(r.key, Number(r.qty)) && (
                    <div className="text-[10px] text-slate-400">raw weight · {cookedNote(r.key, Number(r.qty))}</div>
                  )}
                </td>
                <td className="w-28 py-1 pr-1">
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={0}
                      step="any"
                      inputMode="decimal"
                      aria-label={`Quantity of ${ing?.name ?? r.key}`}
                      className={`input w-20 px-2 py-1 text-right text-xs ${Number(r.qty) > 0 ? "" : "border-amber-400"}`}
                      value={r.qty}
                      onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, qty: e.target.value } : x)))}
                    />
                    <span className="text-slate-400">{ing?.liquid ? "ml" : "g"}</span>
                  </div>
                </td>
                <td className="w-6 py-1 text-right">
                  <button
                    type="button"
                    className="text-base leading-none text-slate-300 hover:text-red-600"
                    aria-label={`Remove ${ing?.name ?? r.key}`}
                    onClick={() => setRows(rows.filter((_, j) => j !== i))}
                  >
                    ×
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="relative mt-2">
        <input className="input py-1.5 text-xs" placeholder="Add an ingredient — search e.g. paneer, flax, ghee" value={q} onChange={(e) => setQ(e.target.value)} />
        {matches.length > 0 && (
          <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
            {matches.map((m) => (
              <li key={m.key}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-3 py-1.5 text-left text-xs hover:bg-slate-50"
                  onClick={() => {
                    setRows([...rows, { key: m.key, qty: "" }]);
                    setQ("");
                  }}
                >
                  <span>{m.name}</span>
                  <span className="text-[10px] text-slate-400">{m.source === "Added by coach" ? "my ingredient" : `${Math.round(m.per100.kcal)} kcal/100 g`}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {!newIng ? (
        <button type="button" className="mt-1.5 text-xs font-semibold text-brand-700 hover:underline" onClick={() => setNewIng(true)}>
          ＋ Not in the list? Add a new ingredient
        </button>
      ) : (
        <NewIngredientForm
          initialName={q}
          onCancel={() => setNewIng(false)}
          onSave={async (d) => {
            const ing = await actions.addIngredient(d);
            setRows((r) => [...r, { key: ing.key, qty: "" }]);
            setNewIng(false);
            setQ("");
          }}
        />
      )}

      {after && (
        <div className="mt-3 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">
          <span className="font-semibold text-slate-800">
            {Math.round(after.kcal * units)} kcal · P {fmt(after.protein * units)} g · C {fmt(after.carbs * units)} g · F {fmt(after.fat * units)} g
          </span>
          {changed && (
            <span className="text-slate-400">
              {" "}(was {Math.round(before.kcal * units)} kcal · P {fmt(before.protein * units)} g)
            </span>
          )}
        </div>
      )}

      {changed && (
        <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
          <label className="block text-[11px] font-medium text-slate-600" htmlFor={`rn-${dish.id}`}>
            Dish name
          </label>
          <input id={`rn-${dish.id}`} className="input py-1.5 text-sm" value={name} onChange={(e) => setName(e.target.value)} />
          {incomplete && <p className="text-xs text-amber-700">Enter a quantity for every ingredient (or remove it).</p>}
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex flex-col gap-1.5">
            {actions.forClient && (
              <button
                type="button"
                className="btn-primary justify-start py-1.5 text-left text-xs"
                disabled={!!busy || incomplete}
                onClick={() => run("client", async () => void (await actions.forClient!(dish, data())))}
              >
                {busy === "client" ? "Saving…" : "Customised for this client"}
                <span className="block text-[10px] font-normal opacity-80">Used every time this dish appears in this client’s chart</span>
              </button>
            )}
            <button
              type="button"
              className="btn-secondary justify-start py-1.5 text-left text-xs"
              disabled={!!busy || incomplete}
              onClick={() =>
                run("new", async () => {
                  const id = await actions.saveNew(dish, data());
                  onUseNew?.(id);
                })
              }
            >
              {busy === "new" ? "Saving…" : "Save as a new dish"}
              <span className="block text-[10px] font-normal text-slate-500">
                Added to your food bank{onUseNew ? " and used here" : ""}; the original stays
              </span>
            </button>
            <button
              type="button"
              className="btn-secondary justify-start py-1.5 text-left text-xs"
              disabled={!!busy || incomplete}
              onClick={() => {
                const msg = dish.custom
                  ? `Update “${dish.name}”? Every chart that uses it will show the new recipe.`
                  : `Replace “${dish.name}” with your version? It replaces the dish in your food bank, new charts and all your clients’ existing charts. You can restore the original from the Food Bank later.`;
                if (confirm(msg)) run("replace", () => actions.replace(dish, data()));
              }}
            >
              {busy === "replace" ? "Saving…" : "Replace this dish"}
              <span className="block text-[10px] font-normal text-slate-500">In your food bank and all your clients’ charts</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Brand-new ingredient (saved to the coach's own ingredient list)
// ---------------------------------------------------------------------------

const GROUPS = Object.keys(GROCERY_CATEGORY) as IngredientGroup[];
const groupLabel = (g: IngredientGroup) => (g === "OTHER" ? "Other (spices, condiments, drinks…)" : FOOD_GROUP_LABELS[g as FoodGroup]);
const FOOD_TYPES: { value: "" | AnimalSource; label: string }[] = [
  { value: "", label: "Plant-based" },
  { value: "dairy", label: "Dairy" },
  { value: "egg", label: "Egg" },
  { value: "meat", label: "Meat / poultry" },
  { value: "fish", label: "Fish / seafood" },
  { value: "honey", label: "Honey" },
];
const MAIN_NUTRIENTS = ["kcal", "protein", "carbs", "fat", "fibre"] as const;

function NewIngredientForm({
  initialName,
  onSave,
  onCancel,
}: {
  initialName: string;
  onSave: (d: Omit<CustomIngredientData, "kind">) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initialName);
  const [group, setGroup] = useState<IngredientGroup>("OTHER");
  const [vals, setVals] = useState<Record<string, string>>({});
  const [animal, setAnimal] = useState<"" | AnimalSource>("");
  const [allergens, setAllergens] = useState<Allergen[]>([]);
  const [root, setRoot] = useState(false);
  const [liquid, setLiquid] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (!name.trim()) return setError("Name is required.");
    const per100 = Object.fromEntries(NUTRIENT_KEYS.map((k) => [k, Number(vals[k]) || 0])) as unknown as CustomIngredientData["per100"];
    if (!per100.kcal && !per100.protein && !per100.carbs && !per100.fat) return setError("Enter the nutrition per 100 g.");
    setBusy(true);
    try {
      await onSave({ name: name.trim(), group, per100, animal: animal || undefined, allergens, root, liquid });
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "Could not save the ingredient.");
    } finally {
      setBusy(false);
    }
  };

  const numInput = (k: (typeof NUTRIENT_KEYS)[number]) => (
    <label key={k} className="block">
      <span className="text-[10px] text-slate-500">
        {NUTRIENT_META[k].label} ({NUTRIENT_META[k].unit})
      </span>
      <input
        type="number"
        min={0}
        step="any"
        inputMode="decimal"
        className="input px-2 py-1 text-xs"
        value={vals[k] ?? ""}
        onChange={(e) => setVals({ ...vals, [k]: e.target.value })}
      />
    </label>
  );

  return (
    <div className="mt-2 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="text-xs font-semibold text-slate-700">New ingredient · saved to your ingredient list</div>
      <input className="input py-1.5 text-xs" placeholder="Name, e.g. Whey protein (unflavoured)" value={name} onChange={(e) => setName(e.target.value)} aria-label="Ingredient name" />
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="text-[10px] text-slate-500">Food group</span>
          <select className="input px-2 py-1 text-xs" value={group} onChange={(e) => setGroup(e.target.value as IngredientGroup)}>
            {GROUPS.map((g) => (
              <option key={g} value={g}>
                {groupLabel(g)}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-[10px] text-slate-500">Food type</span>
          <select className="input px-2 py-1 text-xs" value={animal} onChange={(e) => setAnimal(e.target.value as "" | AnimalSource)}>
            {FOOD_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Per 100 {liquid ? "ml" : "g"}</div>
        <div className="mt-1 grid grid-cols-3 gap-2 sm:grid-cols-5">{MAIN_NUTRIENTS.map(numInput)}</div>
        <details className="mt-1">
          <summary className="cursor-pointer text-[11px] text-slate-500">Minerals & vitamins (optional)</summary>
          <div className="mt-1 grid grid-cols-3 gap-2">
            {NUTRIENT_KEYS.filter((k) => !(MAIN_NUTRIENTS as readonly string[]).includes(k)).map(numInput)}
          </div>
        </details>
      </div>
      <div>
        <div className="text-[10px] text-slate-500">Contains allergens</div>
        <div className="mt-1 flex flex-wrap gap-1">
          {(Object.keys(ALLERGEN_LABELS) as Allergen[]).map((a) => (
            <Chip key={a} size="sm" tone="red" active={allergens.includes(a)} onClick={() => setAllergens(allergens.includes(a) ? allergens.filter((x) => x !== a) : [...allergens, a])}>
              {ALLERGEN_LABELS[a]}
            </Chip>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap gap-4 text-xs text-slate-600">
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={root} onChange={(e) => setRoot(e.target.checked)} /> Grows underground (not Jain)
        </label>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={liquid} onChange={(e) => setLiquid(e.target.checked)} /> Liquid (measured in ml)
        </label>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-ghost px-3 py-1 text-xs" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className="btn-primary px-3 py-1 text-xs" disabled={busy} onClick={submit}>
          {busy ? "Saving…" : "Save ingredient"}
        </button>
      </div>
    </div>
  );
}
