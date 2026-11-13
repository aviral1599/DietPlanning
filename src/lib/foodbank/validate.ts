import { MEAL_TIMES, MealTime } from "../types";
import { INGREDIENT_MAP } from "./bank";
import { CUISINE_LABELS, CustomDishData, DishRole, ROLE_LABELS, NUTRIENT_KEYS } from "./types";

type Result = { ok: true; data: CustomDishData } | { ok: false; error: string };

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
      manualPerUnit,
    },
  };
}
