import type { DietPreference, DietType, FoodGroup } from "../types";
import { DISHES } from "./dishes";
import { INGREDIENTS } from "./ingredients";
import { EXCHANGE_UNITS } from "../exchange-data";

/** One vegetable (A/B) exchange = 100 g raw vegetable. */
const VEG_EXCHANGE_GRAMS = 100;
import {
  Allergen,
  CustomDishData,
  CustomIngredientData,
  GROCERY_CATEGORY,
  Dish,
  DishDef,
  DishTag,
  GI,
  GI_VALUE,
  Ingredient,
  NUTRIENT_KEYS,
  Nutrients,
} from "./types";

// ---------------------------------------------------------------------------
// Ingredient lookup
// ---------------------------------------------------------------------------

export const INGREDIENT_MAP: Record<string, Ingredient> = Object.fromEntries(
  INGREDIENTS.map((i) => [i.key, i])
);

export const zeroNutrients = (): Nutrients => ({
  kcal: 0,
  protein: 0,
  fat: 0,
  carbs: 0,
  fibre: 0,
  calcium: 0,
  iron: 0,
  sodium: 0,
  potassium: 0,
  vitaminC: 0,
  folate: 0,
});

export function addInto(target: Nutrients, src: Nutrients, factor = 1): Nutrients {
  for (const k of NUTRIENT_KEYS) target[k] += (src[k] ?? 0) * factor;
  return target;
}

export function scaled(n: Nutrients, factor: number): Nutrients {
  return addInto(zeroNutrients(), n, factor);
}

export function roundNutrients(n: Nutrients): Nutrients {
  const out = zeroNutrients();
  for (const k of NUTRIENT_KEYS) {
    const v = n[k];
    out[k] = k === "kcal" || k === "sodium" || k === "potassium" || k === "calcium" || k === "folate"
      ? Math.round(v)
      : Math.round(v * 10) / 10;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Exchanges: how many exchanges of its food group an ingredient amount is.
// Mirrors the definitions in the Food Exchange List.
// ---------------------------------------------------------------------------

function exchangesFor(ing: Ingredient, grams: number): number {
  // Driven by the same per-exchange values the planner uses (EXCHANGE_UNITS), so dish
  // exchanges can never drift from the clinic's Food Exchange List.
  const p = ing.per100;
  const f = grams / 100;
  const u = EXCHANGE_UNITS;
  switch (ing.group) {
    case "CEREALS":
      return (p.carbs * f) / u.CEREALS.cho;
    case "PULSES":
    case "MEAT":
      return (p.protein * f) / u[ing.group].protein;
    case "MILK":
      return (p.protein * f) / u.MILK.protein;
    case "VEG_A":
    case "VEG_B":
      return grams / VEG_EXCHANGE_GRAMS; // vegetable exchange = 100 g raw
    case "VEG_C":
    case "FRUITS":
      return (p.carbs * f) / u[ing.group].cho;
    case "SUGARS":
      return (p.carbs * f) / u.SUGARS.cho;
    case "FATS":
    case "NUTS":
      return (p.fat * f) / u[ing.group].fat;
    default:
      return 0;
  }
}

// ---------------------------------------------------------------------------
// Dish computation
// ---------------------------------------------------------------------------

const DEFAULT_GI_LOW_ROLES = new Set(["protein", "sabzi", "salad", "raita", "dal", "soup", "nuts", "side"]);
const ADDED_SUGARS = new Set(["sugar", "jaggery", "honey"]);
/** Roles that carry a whole meal's carbohydrate get a higher glycaemic-load allowance. */
const MEAL_CARB_ROLES = new Set(["staple", "breakfast", "one-pot"]);

export function computeDish(
  def: DishDef,
  opts?: { custom?: boolean; ownerId?: string | null; manualPerUnit?: Partial<Nutrients> | null }
): Dish {
  const perUnit = zeroNutrients();
  const exchanges: Partial<Record<FoodGroup, number>> = {};
  const allergens = new Set<Allergen>();
  const animals = new Set<string>();
  let hasRootOrFungus = false;
  let cost: 1 | 2 | 3 = 1;
  let addedSugar = 0;

  for (const [key, grams] of Object.entries(def.ingredients ?? {})) {
    const ing = INGREDIENT_MAP[key];
    if (!ing || !grams) continue;
    addInto(perUnit, ing.per100, grams / 100);
    if (ing.group !== "OTHER") {
      const ex = exchangesFor(ing, grams);
      exchanges[ing.group] = (exchanges[ing.group] ?? 0) + ex;
    }
    ing.allergens?.forEach((a) => allergens.add(a));
    if (ing.animal) animals.add(ing.animal);
    if (ing.root || key === "mushroom") hasRootOrFungus = true;
    if (grams >= 10 && ing.cost > cost) cost = ing.cost;
    if (ADDED_SUGARS.has(key)) addedSugar += grams;
  }

  const manual = opts?.manualPerUnit ?? def.manualPerUnit;
  if (manual) {
    for (const k of NUTRIENT_KEYS) {
      const v = manual[k];
      if (typeof v === "number" && !Number.isNaN(v)) perUnit[k] = v;
    }
  }

  for (const g of Object.keys(exchanges) as FoodGroup[]) {
    exchanges[g] = Math.round((exchanges[g] ?? 0) * 100) / 100;
  }

  const vegetarian = !animals.has("egg") && !animals.has("meat") && !animals.has("fish");
  const eggetarian = !animals.has("meat") && !animals.has("fish");
  const vegan = vegetarian && !animals.has("dairy") && !animals.has("honey");
  const jain = vegetarian && !animals.has("honey") && !hasRootOrFungus;

  // Auto tags are judged on the default portion.
  const portion = scaled(perUnit, def.unit.default);
  const autoTags: DishTag[] = [];
  const proteinShare = portion.kcal > 0 ? (portion.protein * 4) / portion.kcal : 0;
  if (portion.protein >= 12 || (proteinShare >= 0.22 && portion.protein >= 7)) autoTags.push("high-protein");
  if (portion.fibre >= 6) autoTags.push("high-fibre");
  if (portion.iron >= 3.5) autoTags.push("iron-rich");
  if (portion.calcium >= 250) autoTags.push("calcium-rich");
  if (portion.kcal > 0 && portion.kcal <= 90 && def.role !== "beverage" && def.role !== "side") autoTags.push("low-cal");
  if (cost === 1 && portion.kcal >= 100) autoTags.push("budget");

  // ---- Glycaemic profile (insulin resistance / prediabetes / diabetes) ----
  const gi: GI = def.gi ?? (DEFAULT_GI_LOW_ROLES.has(def.role) ? "low" : "medium");
  const glPerUnit = Math.round(((GI_VALUE[gi] * perUnit.carbs) / 100) * 10) / 10;
  const gl = glPerUnit * def.unit.default;
  if (gi === "low" && portion.carbs >= 5) autoTags.push("low-gi");

  // Contraindications for diabetes carry over to insulin resistance.
  const avoidFor = new Set(def.avoidFor ?? []);
  if (avoidFor.has("diabetes")) avoidFor.add("insulin-resistance");
  const goodFor = new Set(def.goodFor ?? []);
  const style = new Set(def.tags ?? []);
  const lowCarb = portion.carbs < 5;
  const irFriendly =
    !avoidFor.has("insulin-resistance") &&
    (goodFor.has("insulin-resistance") ||
      (!style.has("fried") &&
        !style.has("heavy") &&
        def.role !== "sweet" &&
        def.role !== "side" &&
        gi !== "high" &&
        addedSugar * def.unit.default <= 2 &&
        gl <= (MEAL_CARB_ROLES.has(def.role) ? 22 : 12) &&
        // carbohydrate quality: low GI, fibre-rich, protein-rich, or barely any carbs
        (gi === "low" || portion.fibre >= 4 || proteinShare >= 0.2 || lowCarb) &&
        // and buffered by protein / fibre (or a small carb load)
        (portion.carbs <= 8 || portion.fibre >= 3 || portion.protein >= 7)));
  if (irFriendly) {
    autoTags.push("ir-friendly");
    if (goodFor.has("diabetes") || goodFor.has("pcos")) goodFor.add("insulin-resistance");
  }

  const allTags = Array.from(new Set([...(def.tags ?? []), ...autoTags]));

  return {
    ...def,
    avoidFor: avoidFor.size ? Array.from(avoidFor) : undefined,
    goodFor: goodFor.size ? Array.from(goodFor) : undefined,
    glPerUnit,
    gi,
    freq: def.freq ?? "regular",
    perUnit,
    exchanges,
    allergens: Array.from(allergens),
    diet: { vegetarian, eggetarian, vegan, jain },
    autoTags,
    allTags,
    cost,
    custom: opts?.custom,
    ownerId: opts?.ownerId ?? null,
  };
}

export const BUILTIN_DISHES: Dish[] = DISHES.map((d) => computeDish(d));

const BUILTIN_MAP: Record<string, Dish> = Object.fromEntries(BUILTIN_DISHES.map((d) => [d.id, d]));

/** Build a lookup combining built-in dishes with a coach's custom dishes. */
export function buildDishIndex(custom: Dish[] = []): Record<string, Dish> {
  if (custom.length === 0) return BUILTIN_MAP;
  return { ...BUILTIN_MAP, ...Object.fromEntries(custom.map((d) => [d.id, d])) };
}

export type CustomRow = { id: string; coachId: string; data: string };

/** Key under which a coach-added ingredient is stored in dish recipes. */
export const customIngredientKey = (rowId: string) => `x_${rowId}`;

const isIngredientRow = (data: unknown): data is CustomIngredientData =>
  !!data && typeof data === "object" && (data as { kind?: string }).kind === "ingredient";

/**
 * Make a coach's own ingredients known to the nutrition calculator. Keys are
 * unique per row, so registering several coaches' ingredients never clashes.
 */
export function registerCustomIngredients(rows: CustomRow[]): Ingredient[] {
  const out: Ingredient[] = [];
  for (const row of rows) {
    let data: unknown;
    try {
      data = JSON.parse(row.data);
    } catch {
      continue;
    }
    if (!isIngredientRow(data)) continue;
    const ing: Ingredient = {
      key: customIngredientKey(row.id),
      name: data.name,
      group: data.group,
      source: "Added by coach",
      per100: { ...zeroNutrients(), ...data.per100 },
      category: GROCERY_CATEGORY[data.group] ?? "Others",
      cost: 1,
      allergens: data.allergens?.length ? data.allergens : undefined,
      animal: data.animal,
      root: data.root || undefined,
      liquid: data.liquid || undefined,
    };
    INGREDIENT_MAP[ing.key] = ing;
    out.push(ing);
  }
  return out;
}

/** Convert a DB custom dish row into a computed Dish (null for ingredient rows). */
export function customToDish(row: CustomRow): Dish | null {
  try {
    const data = JSON.parse(row.data) as CustomDishData | CustomIngredientData;
    if (isIngredientRow(data)) return null;
    const dish = computeDish(
      { ...data, id: row.id, ingredients: data.ingredients ?? {} },
      { custom: true, ownerId: row.coachId, manualPerUnit: data.manualPerUnit ?? null }
    );
    if (data.variantOf) {
      dish.hidden = true;
      dish.variantOf = data.variantOf;
      dish.chartId = data.chartId;
    }
    if (data.replaces) {
      dish.replaces = data.replaces;
      dish.replaceActive = data.replaceActive !== false;
    }
    return dish;
  } catch {
    return null;
  }
}

/**
 * A coach's custom rows → everything the app needs:
 *  • pool  — dishes offered in the food bank, pickers and the generator
 *            (client-specific versions hidden; replaced built-ins swapped out)
 *  • index — every dish by id, so existing charts always resolve
 */
export function expandCustomRows(rows: CustomRow[]) {
  const ingredients = registerCustomIngredients(rows);
  const custom = rows.map(customToDish).filter((d): d is Dish => !!d);
  const replaced = new Set(custom.filter((d) => d.replaces && d.replaceActive).map((d) => d.replaces as string));
  const pool = [...custom.filter((d) => !d.hidden), ...BUILTIN_DISHES.filter((d) => !replaced.has(d.id))];
  const index: Record<string, Dish> = { ...BUILTIN_MAP, ...Object.fromEntries(custom.map((d) => [d.id, d])) };
  return { custom, pool, index, ingredients, replaced };
}

/**
 * Dishes for one chart: the coach's pool, with this chart's client-customised
 * versions standing in for their originals.
 */
export function chartPool(food: { pool: Dish[]; custom: Dish[] }, chartId: string): Dish[] {
  const variants = food.custom.filter((d) => d.hidden && d.chartId === chartId);
  const replacedBy = new Set(variants.map((v) => v.variantOf));
  return [...variants, ...food.pool.filter((d) => !replacedBy.has(d.id))];
}

/** Recipe fields of a dish, ready to save as a custom dish. */
export function dishToData(d: Dish): CustomDishData {
  return {
    name: d.name,
    local: d.local,
    cuisine: d.cuisine,
    region: d.region,
    role: d.role,
    fills: d.fills,
    slots: d.slots,
    unit: d.unit,
    ingredients: { ...d.ingredients },
    tags: d.tags,
    gi: d.gi,
    freq: d.freq,
    avoidFor: d.avoidFor,
    goodFor: d.goodFor,
    companions: d.companions,
    stapleKind: d.stapleKind,
    staplePref: d.staplePref,
    method: d.method,
    prepMins: d.prepMins,
    manualPerUnit: d.manualPerUnit,
  };
}

// ---------------------------------------------------------------------------
// Suitability
// ---------------------------------------------------------------------------

export function dietAllows(dish: Dish, pref: DietPreference): boolean {
  switch (pref) {
    case "vegan":
      return dish.diet.vegan;
    case "jain":
      return dish.diet.jain;
    case "vegetarian":
      return dish.diet.vegetarian;
    case "eggetarian":
      return dish.diet.eggetarian;
    default:
      return true;
  }
}

export function isNonVeg(dish: Dish): boolean {
  return !dish.diet.eggetarian; // contains meat or fish
}

export function hasAllergen(dish: Dish, allergens: Allergen[]): boolean {
  return allergens.some((a) => dish.allergens.includes(a));
}

export function avoidsCondition(dish: Dish, diet: DietType): boolean {
  return !!dish.avoidFor?.includes(diet);
}

/** Parse free-text allergies ("lactose intolerant, peanuts") into tags. */
export function parseAllergies(text: string): Allergen[] {
  const t = (text || "").toLowerCase();
  if (!t.trim() || /^(none|nil|no|na|n\/a|-)$/.test(t.trim())) return [];
  const out = new Set<Allergen>();
  const has = (...words: string[]) => words.some((w) => t.includes(w));
  if (has("gluten", "wheat", "celiac", "coeliac")) out.add("gluten");
  if (has("dairy", "milk", "lactose", "casein", "paneer", "curd")) out.add("dairy");
  if (has("egg")) out.add("egg");
  if (has("seafood")) {
    out.add("fish");
    out.add("shellfish");
  }
  if (has("fish")) out.add("fish");
  if (has("shellfish", "prawn", "shrimp", "crab", "lobster")) out.add("shellfish");
  if (has("peanut", "groundnut")) out.add("peanut");
  if (has("tree nut", "tree-nut", "almond", "cashew", "walnut", "pista", "nuts")) out.add("tree-nuts");
  if (has("soy", "soya", "tofu")) out.add("soy");
  if (has("sesame", "til")) out.add("sesame");
  return Array.from(out);
}

// ---------------------------------------------------------------------------
// Portions
// ---------------------------------------------------------------------------

export function snapUnits(dish: Dish, units: number): number {
  const { step, min, max } = dish.unit;
  const snapped = Math.round(units / step) * step;
  return Math.min(max, Math.max(min, Math.round(snapped * 100) / 100));
}

export function formatPortion(dish: Dish, units: number): string {
  const u = Math.round(units * 100) / 100;
  const label = u <= 1 ? dish.unit.label : dish.unit.plural;
  const num = Number.isInteger(u) ? String(u) : u === 0.5 ? "½" : u === 1.5 ? "1½" : u === 2.5 ? "2½" : String(u);
  return `${num} ${label}`;
}

export function itemNutrients(dish: Dish | undefined, units: number): Nutrients {
  if (!dish) return zeroNutrients();
  return scaled(dish.perUnit, units);
}

/**
 * Is this dish a good fit for a condition? Combines explicit tags with the
 * dish's computed nutrition; contraindicated dishes never qualify.
 */
export function suitsCondition(d: Dish, c: DietType): boolean {
  if (d.avoidFor?.includes(c)) return false;
  if (d.goodFor?.includes(c)) return true;
  const n = scaled(d.perUnit, d.unit.default);
  const tags = d.allTags;
  switch (c) {
    case "insulin-resistance":
      return tags.includes("ir-friendly");
    case "diabetes":
    case "pcos":
      return d.gi === "low" && !tags.includes("fried") && !tags.includes("heavy") && (tags.includes("high-fibre") || tags.includes("high-protein") || tags.includes("millet"));
    case "weight-loss":
      return !tags.includes("fried") && !tags.includes("heavy") && (tags.includes("low-cal") || tags.includes("high-fibre") || tags.includes("high-protein"));
    case "weight-gain":
      return n.kcal >= 300 || tags.includes("high-protein");
    case "high-protein":
      return tags.includes("high-protein");
    case "hypertension":
      return n.sodium < 300 && !tags.includes("fried");
    case "pregnancy":
    case "lactation":
      return tags.includes("iron-rich") || tags.includes("calcium-rich") || n.folate >= 60;
    case "renal":
      return !tags.includes("high-protein") && n.potassium < 350 && n.sodium < 400;
    default:
      return true;
  }
}
