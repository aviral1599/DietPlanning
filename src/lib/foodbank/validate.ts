import { MEAL_TIMES, MealTime } from "../types";
import { INGREDIENT_MAP } from "./bank";
import {
  ALLERGEN_LABELS,
  CUISINE_LABELS,
  CustomDishData,
  CustomIngredientData,
  DishRole,
  GROCERY_CATEGORY,
  ROLE_LABELS,
  NUTRIENT_KEYS,
  type Allergen,
  type AnimalSource,
  type IngredientGroup,
} from "./types";

type Result = { ok: true; data: CustomDishData } | { ok: false; error: string };
type IngResult = { ok: true; data: CustomIngredientData } | { ok: false; error: string };

const ANIMALS: AnimalSource[] = ["dairy", "egg", "meat", "fish", "honey"];

/** Validate a coach-added ingredient (nutrition per 100 g). */
export function validateCustomIngredient(body: Record<string, unknown>): IngResult {
  const name = String(body.name ?? "").trim().slice(0, 80);
  if (!name) return { ok: false, error: "Ingredient name is required." };
  const group = String(body.group ?? "OTHER") as IngredientGroup;
  if (!(group in GROCERY_CATEGORY)) return { ok: false, error: "Choose a food group." };
  const raw = (body.per100 ?? {}) as Record<string, unknown>;
  const per100 = Object.fromEntries(NUTRIENT_KEYS.map((k) => [k, Math.max(0, num(raw[k], 0))])) as unknown as CustomIngredientData["per100"];
  if (per100.kcal > 900) return { ok: false, error: "Energy per 100 g can't exceed 900 kcal." };
  if (per100.protein + per100.fat + per100.carbs + per100.fibre > 100) {
    return { ok: false, error: "Protein + fat + carbs + fibre can't exceed 100 g per 100 g." };
  }
  if (per100.kcal === 0 && per100.protein + per100.fat + per100.carbs > 0) {
    per100.kcal = Math.round((4 * per100.protein + 9 * per100.fat + 4 * per100.carbs + 2 * per100.fibre) * 10) / 10;
  }
  const animal = ANIMALS.includes(body.animal as AnimalSource) ? (body.animal as AnimalSource) : undefined;
  const allergens = (Array.isArray(body.allergens) ? body.allergens : []).filter((a): a is Allergen => String(a) in ALLERGEN_LABELS);
  return {
    ok: true,
    data: { kind: "ingredient", name, group, per100, animal, allergens, root: !!body.root, liquid: !!body.liquid },
  };
}

const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : Number(v) || d);

/** Validate & normalise a custom dish payload from the editor. */
export function validateCustomDish(body: Record<string, unknown>): Result {
  const name = String(body.name ?? "").trim();
  if (!name) return { ok: false, error: "Dish name is required." };
  const role = String(body.role ?? "") as DishRole;
  if (!(role in ROLE_LABELS)) return { ok: false, error: "Choose a category." };
  const cuisine = String(body.cuisine ?? "pan-indian");
  if (!(cuisine in CUISINE_LABELS)) return { ok: false, error: "Unknown cuisine." };
  const slots = (Array.isArray(body.slots) ? body.slots : []).filter((s): s is MealTime =>
    MEAL_TIMES.includes(s as MealTime)
  );
  if (!slots.length) return { ok: false, error: "Pick at least one meal time." };

  const u = (body.unit ?? {}) as Record<string, unknown>;
  const unit = {
    label: String(u.label ?? "serving").trim() || "serving",
    plural: String(u.plural ?? u.label ?? "servings").trim() || "servings",
    default: num(u.default, 1),
    step: num(u.step, 0.5),
    min: num(u.min, 0.5),
    max: num(u.max, 2),
    note: u.note ? String(u.note) : undefined,
  };
  if (unit.step <= 0 || unit.min <= 0 || unit.min > unit.default || unit.default > unit.max) {
    return { ok: false, error: "Portion settings must satisfy 0 < min ≤ default ≤ max." };
  }

  const ingredients: Record<string, number> = {};
  for (const [k, v] of Object.entries((body.ingredients ?? {}) as Record<string, unknown>)) {
    const g = num(v, 0);
    if (!INGREDIENT_MAP[k]) return { ok: false, error: `Unknown ingredient: ${k}` };
    if (g > 0) ingredients[k] = Math.round(g * 10) / 10;
  }

  let manualPerUnit: CustomDishData["manualPerUnit"] = null;
  if (body.manualPerUnit && typeof body.manualPerUnit === "object") {
    manualPerUnit = {};
    for (const k of NUTRIENT_KEYS) {
      const v = (body.manualPerUnit as Record<string, unknown>)[k];
      if (v !== undefined && v !== "" && v !== null) manualPerUnit[k] = num(v, 0);
    }
    if (!Object.keys(manualPerUnit).length) manualPerUnit = null;
  }
  if (!Object.keys(ingredients).length && !manualPerUnit) {
    return { ok: false, error: "Add ingredients, or enter nutrition values manually." };
  }

  const arr = (v: unknown) => (Array.isArray(v) ? v.map(String).filter(Boolean) : []);
  return {
    ok: true,
    data: {
      name,
      local: body.local ? String(body.local).trim() : undefined,
      cuisine: cuisine as CustomDishData["cuisine"],
      region: body.region ? String(body.region).trim() : undefined,
      role,
      fills: arr(body.fills) as DishRole[],
      slots,
      unit,
      ingredients,
      tags: arr(body.tags) as CustomDishData["tags"],
      gi: (["low", "medium", "high"].includes(String(body.gi)) ? body.gi : undefined) as CustomDishData["gi"],
      freq: (["daily", "regular", "weekly", "occasional"].includes(String(body.freq)) ? body.freq : "regular") as CustomDishData["freq"],
      avoidFor: arr(body.avoidFor) as CustomDishData["avoidFor"],
      goodFor: arr(body.goodFor) as CustomDishData["goodFor"],
      method: body.method ? String(body.method).slice(0, 1000) : undefined,
      companions: arr(body.companions),
      stapleKind: (["rice", "roti"].includes(String(body.stapleKind)) ? body.stapleKind : undefined) as CustomDishData["stapleKind"],
      staplePref: (["rice", "roti"].includes(String(body.staplePref)) ? body.staplePref : undefined) as CustomDishData["staplePref"],
      prepMins: body.prepMins ? num(body.prepMins, 0) || undefined : undefined,
      manualPerUnit,
      variantOf: body.variantOf ? String(body.variantOf) : undefined,
      chartId: body.chartId ? String(body.chartId) : undefined,
      replaces: body.replaces ? String(body.replaces) : undefined,
      replaceActive: body.replaces ? body.replaceActive !== false : undefined,
    },
  };
}
