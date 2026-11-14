"use client";

import { useEffect, useMemo, useState } from "react";
import DishDetail from "@/components/foodbank/DishDetail";
import { Chip, DietMark, MacroLine, Modal } from "@/components/foodbank/ui";
import { formatPortion, INGREDIENT_MAP, scaled, suitsCondition } from "@/lib/foodbank/bank";
import { useDishes, type CustomDishRow } from "@/lib/foodbank/client";
import { INGREDIENTS } from "@/lib/foodbank/ingredients";
import { CUISINE_SHORT, ROLE_LABELS, tagLabel, type Cuisine, type Dish, type DishRole, type DishTag } from "@/lib/foodbank/types";
import { DIET_TYPE_LABELS, FOOD_GROUP_LABELS, type DietType, type FoodGroup } from "@/lib/types";
import CustomDishEditor from "./CustomDishEditor";
import { RecipeContext } from "@/components/foodbank/RecipeEditor";
import { useRecipeBank } from "@/components/foodbank/useRecipeBank";

const DIETS = [
  { value: "veg", label: "Vegetarian" },
  { value: "egg", label: "Contains egg" },
  { value: "nonveg", label: "Non-veg" },
  { value: "vegan", label: "Vegan" },
  { value: "jain", label: "Jain" },
] as const;

const TAGS: { value: DishTag; label: string }[] = [
  { value: "ir-friendly", label: "Insulin-friendly" },
  { value: "high-protein", label: "High protein" },
  { value: "high-fibre", label: "High fibre" },
  { value: "low-gi", label: "Low GI" },
  { value: "millet", label: "Millet" },
  { value: "low-cal", label: "Low calorie" },
  { value: "iron-rich", label: "Iron-rich" },
  { value: "calcium-rich", label: "Calcium-rich" },
  { value: "probiotic", label: "Probiotic" },
  { value: "traditional", label: "Traditional" },
  { value: "modern", label: "Modern" },
  { value: "quick", label: "Quick" },
  { value: "budget", label: "Budget" },
  { value: "fasting", label: "Fasting" },
];

// Default browsing order: main meals first, drinks and condiments last.
const ROLE_ORDER: DishRole[] = ["breakfast", "one-pot", "dal", "protein", "sabzi", "staple", "salad", "raita", "soup", "snack", "fruit", "sweet", "beverage", "nuts", "side"];

const CONDITIONS: DietType[] = ["insulin-resistance", "diabetes", "pcos", "weight-loss", "weight-gain", "hypertension", "pregnancy", "high-protein", "renal"];

export default function FoodBankBrowser() {
  const [customRows, setCustomRows] = useState<CustomDishRow[]>([]);
  const [tab, setTab] = useState<"dishes" | "ingredients">("dishes");
  const [q, setQ] = useState("");
  const [roles, setRoles] = useState<DishRole[]>([]);
  const [cuisines, setCuisines] = useState<Cuisine[]>([]);
  const [diets, setDiets] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [conditions, setConditions] = useState<DietType[]>([]);
  const [onlyCustom, setOnlyCustom] = useState(false);
  const [open, setOpen] = useState<Dish | null>(null);
  const [editing, setEditing] = useState<{ base?: Dish; id?: string } | null>(null);
  const [limit, setLimit] = useState(60);

  const load = () =>
    fetch("/api/foodbank/dishes")
      .then((r) => r.json())
      .then((d) => setCustomRows(d.dishes ?? []));
  useEffect(() => {
    load();
  }, []);

  const { all, custom, ingredients: customIngredients } = useDishes(customRows);
  const recipeActions = useRecipeBank({ customIngredients, setCustomRows });
  const myDishCount = custom.filter((d) => !d.hidden).length;

  const results = useMemo(() => {
    const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    const list = all.filter((d) => {
      if (onlyCustom && !d.custom) return false;
      if (roles.length && !roles.includes(d.role)) return false;
      if (cuisines.length && !cuisines.includes(d.cuisine)) return false;
      if (diets.length) {
        const ok = diets.some((x) =>
          x === "veg" ? d.diet.vegetarian : x === "egg" ? d.diet.eggetarian && !d.diet.vegetarian : x === "nonveg" ? !d.diet.eggetarian : x === "vegan" ? d.diet.vegan : d.diet.jain
        );
        if (!ok) return false;
      }
      for (const t of tags) if (!d.allTags.includes(t as DishTag)) return false;
      for (const c of conditions) if (!suitsCondition(d, c)) return false;
      if (terms.length) {
        const hay = `${d.name} ${d.local ?? ""} ${d.region ?? ""} ${Object.keys(d.ingredients).map((k) => INGREDIENT_MAP[k]?.name ?? k).join(" ")}`.toLowerCase();
        if (!terms.every((t) => hay.includes(t))) return false;
      }
      return true;
    });
    return list.sort(
      (a, b) =>
        Number(!!b.custom) - Number(!!a.custom) ||
        ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role) ||
        a.name.localeCompare(b.name)
    );
  }, [all, q, roles, cuisines, diets, tags, conditions, onlyCustom]);

  const toggle = <T,>(arr: T[], v: T, set: (x: T[]) => void) => set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const activeFilters = roles.length + cuisines.length + diets.length + tags.length + conditions.length + (onlyCustom ? 1 : 0);

  const removeCustom = async (d: Dish) => {
    if (!confirm(`Delete custom dish “${d.name}”? Charts that use it will show it as missing.`)) return;
    await fetch(`/api/foodbank/dishes/${d.id}`, { method: "DELETE" });
    setOpen(null);
    load();
  };

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Food Bank</h1>
          <p className="text-sm text-slate-500">
            {all.length} dishes ({myDishCount} custom) · {INGREDIENTS.length + customIngredients.length} ingredients · nutrition computed from IFCT 2017 (ICMR-NIN)
          </p>
        </div>
        <button className="btn-primary" onClick={() => setEditing({})}>
          + New dish
        </button>
      </div>

      <div className="mb-4 flex gap-2">
        <Chip tone="slate" active={tab === "dishes"} onClick={() => setTab("dishes")}>Dishes</Chip>
        <Chip tone="slate" active={tab === "ingredients"} onClick={() => setTab("ingredients")}>Ingredients</Chip>
      </div>

      {tab === "ingredients" ? (
        <IngredientsTable />
      ) : (
        <>
          <div className="card mb-4 space-y-3 p-4">
            <input className="input" placeholder="Search dishes or ingredients — e.g. ragi, paneer, Kerala, sprouts" value={q} onChange={(e) => { setQ(e.target.value); setLimit(60); }} />
            <FilterRow label="Category">
              {(Object.keys(ROLE_LABELS) as DishRole[]).map((r) => (
                <Chip key={r} size="sm" tone="brand" active={roles.includes(r)} onClick={() => toggle(roles, r, setRoles)}>{ROLE_LABELS[r]}</Chip>
              ))}
            </FilterRow>
            <FilterRow label="Cuisine">
              {(Object.keys(CUISINE_SHORT) as Cuisine[]).map((c) => (
                <Chip key={c} size="sm" tone="blue" active={cuisines.includes(c)} onClick={() => toggle(cuisines, c, setCuisines)}>{CUISINE_SHORT[c]}</Chip>
              ))}
            </FilterRow>
            <FilterRow label="Diet">
              {DIETS.map((d) => (
                <Chip key={d.value} size="sm" tone="slate" active={diets.includes(d.value)} onClick={() => toggle(diets, d.value as string, setDiets)}>{d.label}</Chip>
              ))}
              <Chip size="sm" tone="blue" active={onlyCustom} onClick={() => setOnlyCustom(!onlyCustom)}>My custom dishes</Chip>
            </FilterRow>
            <FilterRow label="Nutrition">
              {TAGS.map((t) => (
                <Chip key={t.value} size="sm" tone="amber" active={tags.includes(t.value)} onClick={() => toggle(tags, t.value as string, setTags)}>{t.label}</Chip>
              ))}
            </FilterRow>
            <FilterRow label="Good for">
              {CONDITIONS.map((c) => (
                <Chip key={c} size="sm" tone="brand" active={conditions.includes(c)} onClick={() => toggle(conditions, c, setConditions)}>{DIET_TYPE_LABELS[c]}</Chip>
              ))}
            </FilterRow>
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>{results.length} dishes</span>
              {activeFilters > 0 && (
                <button className="hover:text-slate-800" onClick={() => { setRoles([]); setCuisines([]); setDiets([]); setTags([]); setConditions([]); setOnlyCustom(false); }}>
                  Clear {activeFilters} filter{activeFilters > 1 ? "s" : ""}
                </button>
              )}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {results.slice(0, limit).map((d) => {
              const n = scaled(d.perUnit, d.unit.default);
              return (
                <button key={d.id} onClick={() => setOpen(d)} className="card flex flex-col p-3 text-left transition hover:border-brand-300 hover:shadow">
                  <div className="flex items-start gap-2">
                    <span className="mt-1"><DietMark dish={d} /></span>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold leading-snug text-slate-900">{d.name}</div>
                      <div className="truncate text-xs text-slate-400">
                        {ROLE_LABELS[d.role]} · {CUISINE_SHORT[d.cuisine]}{d.region ? ` · ${d.region}` : ""}
                      </div>
                    </div>
                    {d.custom && <span className="rounded bg-blue-50 px-1.5 text-[10px] font-medium text-blue-700">custom</span>}
                  </div>
                  <div className="mt-2 text-xs text-slate-500">{formatPortion(d, d.unit.default)}{d.unit.note ? ` · ${d.unit.note}` : ""}</div>
                  <div className="mt-0.5 text-xs"><MacroLine kcal={n.kcal} protein={n.protein} carbs={n.carbs} fat={n.fat} /></div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {d.allTags.filter((t) => ["ir-friendly", "high-protein", "high-fibre", "millet", "iron-rich", "calcium-rich", "low-cal", "fried", "probiotic"].includes(t)).slice(0, 4).map((t) => (
                      <span key={t} className={`rounded-full px-2 py-0.5 text-[10px] ${t === "ir-friendly" ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-600"}`}>{tagLabel(t)}</span>
                    ))}
                    {d.gi === "low" && <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] text-brand-700">low GI</span>}
                  </div>
                </button>
              );
            })}
          </div>
          {results.length > limit && (
            <div className="mt-4 text-center">
              <button className="btn-secondary" onClick={() => setLimit(limit + 60)}>Show more ({results.length - limit} more)</button>
            </div>
          )}
        </>
      )}

      <Modal
        open={!!open}
        onClose={() => setOpen(null)}
        title={open?.name}
        wide
        footer={
          open && (
            <div className="flex flex-wrap justify-end gap-2">
              {open.custom ? (
                <>
                  <button className="btn-ghost text-red-600" onClick={() => removeCustom(open)}>Delete</button>
                  <button className="btn-primary" onClick={() => { setEditing({ base: open, id: open.id }); setOpen(null); }}>Edit dish</button>
                </>
              ) : (
                <button className="btn-secondary" onClick={() => { setEditing({ base: open }); setOpen(null); }}>Duplicate & customise</button>
              )}
            </div>
          )
        }
      >
        {open && (
          <RecipeContext.Provider
            value={{
              ...recipeActions,
              // Close the dialog after saving so the list shows the result.
              saveNew: async (b, d) => {
                const id = await recipeActions.saveNew(b, d);
                setOpen(null);
                return id;
              },
              replace: async (b, d) => {
                await recipeActions.replace(b, d);
                setOpen(null);
              },
              restore: async (d) => {
                await recipeActions.restore?.(d);
                setOpen(null);
              },
            }}
          >
            <DishDetail dish={open} />
          </RecipeContext.Provider>
        )}
      </Modal>

      {editing && (
        <CustomDishEditor
          base={editing.base}
          editId={editing.id}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 sm:flex-row sm:items-start">
      <div className="w-24 shrink-0 pt-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</div>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function IngredientsTable() {
  const [q, setQ] = useState("");
  const [group, setGroup] = useState<string>("");
  const rows = INGREDIENTS.filter(
    (i) => (!group || i.group === group) && (!q || `${i.name} ${i.source}`.toLowerCase().includes(q.toLowerCase()))
  );
  const groups = Array.from(new Set(INGREDIENTS.map((i) => i.group)));
  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap gap-2 border-b border-slate-100 p-3">
        <input className="input max-w-xs" placeholder="Search ingredient" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input w-auto" value={group} onChange={(e) => setGroup(e.target.value)} aria-label="Food group">
          <option value="">All groups</option>
          {groups.map((g) => (
            <option key={g} value={g}>
              {g === "OTHER" ? "Condiments & other" : FOOD_GROUP_LABELS[g as FoodGroup]}
            </option>
          ))}
        </select>
        <span className="self-center text-xs text-slate-400">Per 100 g edible portion (100 ml for liquids)</span>
      </div>
      <div className="max-h-[70vh] overflow-auto">
        <table className="w-full min-w-[900px] text-xs">
          <thead className="sticky top-0 bg-slate-50">
            <tr>
              {["Ingredient", "kcal", "Protein", "Fat", "Carbs", "Fibre", "Ca mg", "Fe mg", "Na mg", "K mg", "Vit C", "Source"].map((h) => (
                <th key={h} className="px-3 py-2 text-left font-semibold text-slate-600">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((i) => (
              <tr key={i.key} className="border-t border-slate-100">
                <td className="px-3 py-1.5 font-medium text-slate-800">{i.name}</td>
                <td className="px-3 py-1.5 tabular-nums">{Math.round(i.per100.kcal)}</td>
                <td className="px-3 py-1.5 tabular-nums">{i.per100.protein.toFixed(1)}</td>
                <td className="px-3 py-1.5 tabular-nums">{i.per100.fat.toFixed(1)}</td>
                <td className="px-3 py-1.5 tabular-nums">{i.per100.carbs.toFixed(1)}</td>
                <td className="px-3 py-1.5 tabular-nums">{i.per100.fibre.toFixed(1)}</td>
                <td className="px-3 py-1.5 tabular-nums">{Math.round(i.per100.calcium)}</td>
                <td className="px-3 py-1.5 tabular-nums">{i.per100.iron.toFixed(1)}</td>
                <td className="px-3 py-1.5 tabular-nums">{Math.round(i.per100.sodium)}</td>
                <td className="px-3 py-1.5 tabular-nums">{Math.round(i.per100.potassium)}</td>
                <td className="px-3 py-1.5 tabular-nums">{Math.round(i.per100.vitaminC)}</td>
                <td className="px-3 py-1.5 text-slate-400">{i.source}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
