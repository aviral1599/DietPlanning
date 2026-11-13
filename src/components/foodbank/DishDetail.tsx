"use client";

import { DIET_TYPE_LABELS, FOOD_GROUP_LABELS, type DietType, type FoodGroup, MEAL_TIME_LABELS } from "@/lib/types";
import { formatPortion, INGREDIENT_MAP, scaled } from "@/lib/foodbank/bank";
import { ALLERGEN_LABELS, CUISINE_LABELS, glBand, NUTRIENT_KEYS, NUTRIENT_META, ROLE_LABELS, tagLabel, type Dish } from "@/lib/foodbank/types";
import { Chip, DietMark } from "./ui";

export default function DishDetail({ dish, units, showSources = true }: { dish: Dish; units?: number; showSources?: boolean }) {
  const u = units ?? dish.unit.default;
  const n = scaled(dish.perUnit, u);
  const one = dish.perUnit;
  const diet = dish.diet;

  return (
    <div className="space-y-4 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <DietMark dish={dish} size={14} />
        <span className="font-semibold text-slate-900">{dish.name}</span>
        {dish.local && <span className="text-slate-400">· {dish.local}</span>}
        {dish.custom && <Chip size="sm" tone="blue">Custom</Chip>}
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Chip size="sm">{ROLE_LABELS[dish.role]}</Chip>
        <Chip size="sm">{CUISINE_LABELS[dish.cuisine]}{dish.region ? ` · ${dish.region}` : ""}</Chip>
        {dish.gi && <Chip size="sm" tone={dish.gi === "low" ? "brand" : dish.gi === "high" ? "red" : "amber"}>GI: {dish.gi}</Chip>}
        {dish.glPerUnit > 0 && (
          <Chip
            size="sm"
            tone={glBand(dish.glPerUnit * u) === "low" ? "brand" : glBand(dish.glPerUnit * u) === "high" ? "red" : "amber"}
            title="Estimated glycaemic load of this portion (GI category × available carbohydrate). ≤10 low, 11–19 medium, ≥20 high."
          >
            GL ≈ {Math.round(dish.glPerUnit * u)} ({glBand(dish.glPerUnit * u)})
          </Chip>
        )}
        {dish.allTags.map((t) => (
          <Chip key={t} size="sm" tone={t === "ir-friendly" ? "amber" : "brand"}>{tagLabel(t)}</Chip>
        ))}
      </div>

      <div>
        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Nutrition — {formatPortion(dish, u)}
          {dish.unit.note && <span className="font-normal normal-case text-slate-400"> ({dish.unit.note}{u !== 1 ? " per unit" : ""})</span>}
        </div>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {NUTRIENT_KEYS.map((k) => (
            <div key={k} className="rounded-lg bg-slate-50 px-2.5 py-1.5">
              <div className="text-[10px] uppercase tracking-wide text-slate-400">{NUTRIENT_META[k].label}</div>
              <div className="font-semibold tabular-nums text-slate-800">
                {k === "kcal" || NUTRIENT_META[k].unit === "mg" || NUTRIENT_META[k].unit === "µg" ? Math.round(n[k]) : n[k].toFixed(1)}
                <span className="ml-0.5 text-[10px] font-normal text-slate-400">{NUTRIENT_META[k].unit}</span>
              </div>
            </div>
          ))}
        </div>
        {u !== 1 && (
          <div className="mt-1 text-[11px] text-slate-400">
            Per 1 {dish.unit.label}: {Math.round(one.kcal)} kcal · P {one.protein.toFixed(1)} g · C {one.carbs.toFixed(1)} g · F {one.fat.toFixed(1)} g
          </div>
        )}
      </div>

      {Object.keys(dish.ingredients).length > 0 && (
        <div>
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Ingredients (raw weight)</div>
          <table className="w-full text-xs">
            <tbody>
              {Object.entries(dish.ingredients).map(([k, g]) => {
                const ing = INGREDIENT_MAP[k];
                return (
                  <tr key={k} className="border-b border-slate-100">
                    <td className="py-1 pr-2 text-slate-700">{ing?.name ?? k}</td>
                    <td className="py-1 pr-2 text-right tabular-nums text-slate-600">
                      {Math.round(g * u * 10) / 10} {ing?.liquid ? "ml" : "g"}
                    </td>
                    {showSources && <td className="hidden py-1 text-right text-[10px] text-slate-400 sm:table-cell">{ing?.source}</td>}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {Object.keys(dish.exchanges).length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Exchanges:</span>
          {Object.entries(dish.exchanges)
            .filter(([, v]) => (v ?? 0) * u >= 0.1)
            .map(([g, v]) => (
              <Chip key={g} size="sm">
                {FOOD_GROUP_LABELS[g as FoodGroup]} × {(Math.round((v ?? 0) * u * 10) / 10).toString()}
              </Chip>
            ))}
        </div>
      )}

      {dish.method && (
        <div>
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">How to make</div>
          <p className="leading-relaxed text-slate-600">{dish.method}</p>
        </div>
      )}

      <div className="grid gap-2 text-xs sm:grid-cols-2">
        <div>
          <span className="font-semibold text-slate-500">Suitable for: </span>
          <span className="text-slate-600">
            {[diet.vegetarian && "Vegetarian", diet.eggetarian && !diet.vegetarian && "Eggetarian", diet.vegan && "Vegan", diet.jain && "Jain", !diet.eggetarian && "Non-veg"]
              .filter(Boolean)
              .join(", ")}
          </span>
        </div>
        <div>
          <span className="font-semibold text-slate-500">Meals: </span>
          <span className="text-slate-600">{dish.slots.map((s) => MEAL_TIME_LABELS[s]).join(", ")}</span>
        </div>
        {dish.allergens.length > 0 && (
          <div>
            <span className="font-semibold text-red-600">Contains: </span>
            <span className="text-slate-600">{dish.allergens.map((a) => ALLERGEN_LABELS[a]).join(", ")}</span>
          </div>
        )}
        {dish.goodFor && dish.goodFor.length > 0 && (
          <div>
            <span className="font-semibold text-brand-700">Good for: </span>
            <span className="text-slate-600">{dish.goodFor.map((d) => DIET_TYPE_LABELS[d as DietType]).join(", ")}</span>
          </div>
        )}
        {dish.avoidFor && dish.avoidFor.length > 0 && (
          <div>
            <span className="font-semibold text-amber-700">Avoid in: </span>
            <span className="text-slate-600">{dish.avoidFor.map((d) => DIET_TYPE_LABELS[d as DietType]).join(", ")}</span>
          </div>
        )}
      </div>
    </div>
  );
}
