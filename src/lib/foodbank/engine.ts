// ---------------------------------------------------------------------------
// Diet-chart generator: builds weekly / monthly Indian meal plans from the food
// bank that hit the client's energy & protein targets while rotating dishes.
// Pure functions — used by API routes (server) and the editor (client).
// ---------------------------------------------------------------------------

import { EXCHANGE_UNITS } from "../exchange-data";
import {
  DietPreference,
  DietType,
  FOOD_GROUP_ORDER,
  GlycemicStatus,
  IncomeGroup,
  MEAL_TIMES,
  MealTime,
  MenuPlan,
} from "../types";
import {
  addInto,
  avoidsCondition,
  dietAllows,
  hasAllergen,
  isNonVeg,
  scaled,
  snapUnits,
  zeroNutrients,
} from "./bank";
import { INGREDIENT_MAP } from "./bank";
import { conditionsOf, isGlycemicConcern } from "../glycemic";
import type { Allergen, Cuisine, Dish, DishRole, DishTag, Nutrients } from "./types";

// ---- chart data model -----------------------------------------------------

/** An alternative the client may have instead of the main dish ("or …"). */
export interface PlanAlt {
  dishId: string;
  units: number;
}

/** Up to 2 alternatives → at most 3 choices per dish. */
export const MAX_ALTS = 2;

export interface PlanItem {
  uid: string;
  dishId: string;
  units: number;
  locked?: boolean;
  note?: string;
  by?: "auto" | "coach" | "client";
  /** Options: "have this OR …". Day totals count the main dish only. */
  alts?: PlanAlt[];
}

export type DayMeals = Record<MealTime, PlanItem[]>;

/** Non-food items on the calendar. */
export type EventKind = "exercise" | "supplement" | "water" | "note";
export type Intensity = "light" | "moderate" | "vigorous";

export interface ChartEvent {
  uid: string;
  kind: EventKind;
  title: string;
  time: string; // "HH:MM"
  minutes: number;
  /** Shared by every copy of a recurring event. */
  series?: string;
  intensity?: Intensity; // exercise
  kcal?: number; // exercise: estimated energy burned (informational only)
  dose?: string; // supplement
  timing?: string; // supplement: with food, empty stomach …
  ml?: number; // water
  text?: string; // note / extra instructions
}

export interface ChartDay {
  day: number; // 0-based index in the chart
  date: string; // ISO yyyy-mm-dd
  meals: DayMeals;
  note?: string;
  /** Exercise, supplements, water and notes scheduled on this day. */
  events?: ChartEvent[];
  /** Per-day meal times that differ from the chart-wide `mealTimes`. */
  times?: Partial<Record<MealTime, string>>;
}

export interface ChartPrefs {
  days: number; // 7 | 14 | 28
  startDate: string;
  cuisines: Cuisine[]; // preferred (empty = all)
  nonVegDays: number[]; // 0 = Mon … 6 = Sun
  excludeDishes: string[];
  excludeIngredients: string[];
  focusTags: DishTag[]; // soft boost
  avoidTags: DishTag[]; // hard exclude
  /** Dishes the nutritionist picked for this client — strongly preferred (still rotated). */
  preferDishes?: string[];
  includeEarlyMorning: boolean;
  includeBedtime: boolean;
  seed: number;
}

export interface ChartTargets {
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
  fibre: number;
  slotShare: Record<MealTime, number>;
}

export interface ChartProfile {
  /** Primary condition. */
  dietType: DietType;
  /** All selected conditions (defaults to [dietType]). */
  conditions?: DietType[];
  dietPreference: DietPreference;
  allergens: Allergen[];
  incomeGroup: IncomeGroup;
  /** Insulin resistance / prediabetes flag on top of dietType. */
  glycemicStatus?: GlycemicStatus;
}

/** All conditions that shape food choice (selected conditions + glycaemic flag). */
export function profileConditions(profile: ChartProfile): DietType[] {
  const base = profile.conditions?.length ? profile.conditions : [profile.dietType];
  return conditionsOf(base, profile.glycemicStatus);
}

/** The client has this condition (any of the selected ones). */
function has(profile: ChartProfile, c: DietType): boolean {
  return profile.dietType === c || !!profile.conditions?.includes(c);
}

function avoidsAny(d: Dish, profile: ChartProfile): boolean {
  return profileConditions(profile).some((c) => avoidsCondition(d, c));
}

function goodForAny(d: Dish, profile: ChartProfile): boolean {
  return profileConditions(profile).some((c) => d.goodFor?.includes(c));
}

/** Blood-sugar-aware planning: low GI, carbs paired with protein/fibre. */
function glycemic(profile: ChartProfile): boolean {
  return has(profile, "weight-loss") || isGlycemicConcern(profileConditions(profile), profile.glycemicStatus);
}

/** Insulin resistance / prediabetes / diabetes specifically (not plain weight loss). */
function insulinFocus(profile: ChartProfile): boolean {
  return (
    has(profile, "diabetes") ||
    has(profile, "insulin-resistance") ||
    (!!profile.glycemicStatus && profile.glycemicStatus !== "none")
  );
}

export const MEAL_TIME_DEFAULTS: Record<MealTime, string> = {
  earlyMorning: "06:30",
  breakfast: "08:30",
  midMorning: "11:00",
  lunch: "13:30",
  eveningSnack: "17:00",
  dinner: "20:00",
  bedtime: "22:00",
};

export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// ---- utilities --------------------------------------------------------------

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let uidCounter = 0;
export function newUid(): string {
  uidCounter = (uidCounter + 1) % 1e6;
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}${uidCounter.toString(36)}`;
}

export function emptyMeals(): DayMeals {
  return Object.fromEntries(MEAL_TIMES.map((m) => [m, [] as PlanItem[]])) as unknown as DayMeals;
}

export function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** 0 = Monday … 6 = Sunday */
export function weekdayOf(iso: string): number {
  const d = new Date(`${iso}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  return (d + 6) % 7;
}

export function nextMonday(from = new Date()): string {
  const d = new Date(Date.UTC(from.getFullYear(), from.getMonth(), from.getDate()));
  const wd = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() + (wd === 0 ? 0 : 7 - wd));
  return d.toISOString().slice(0, 10);
}

// ---- defaults ---------------------------------------------------------------

const DEFAULT_SHARE: Record<MealTime, number> = {
  earlyMorning: 0.04,
  breakfast: 0.22,
  midMorning: 0.08,
  lunch: 0.29,
  eveningSnack: 0.1,
  dinner: 0.22,
  bedtime: 0.05,
};

const SHARE_BOUNDS: Record<MealTime, [number, number]> = {
  earlyMorning: [0.02, 0.07],
  breakfast: [0.18, 0.28],
  midMorning: [0.04, 0.12],
  lunch: [0.25, 0.34],
  eveningSnack: [0.07, 0.14],
  dinner: [0.18, 0.28],
  bedtime: [0.03, 0.08],
};

export function defaultPrefs(profile: ChartProfile, days = 7): ChartPrefs {
  const ir = insulinFocus(profile);
  const h = (c: DietType) => has(profile, c);
  // Union of each condition's focus tags (max 4 so the planner keeps variety).
  const focusSet = new Set<DishTag>();
  if (ir) ["ir-friendly", "high-fibre", "millet"].forEach((t) => focusSet.add(t as DishTag));
  else if (h("diabetes") || h("pcos")) ["millet", "high-fibre"].forEach((t) => focusSet.add(t as DishTag));
  if (h("weight-loss")) ["high-fibre", "high-protein"].forEach((t) => focusSet.add(t as DishTag));
  if (h("high-protein") || h("weight-gain")) focusSet.add("high-protein");
  if (h("pregnancy") || h("lactation")) ["iron-rich", "calcium-rich"].forEach((t) => focusSet.add(t as DishTag));
  const focus = [...focusSet].slice(0, 4);
  const avoid: DishTag[] = ir || (["diabetes", "pcos", "weight-loss", "hypertension"] as DietType[]).some(h) ? ["fried"] : [];
  return {
    days,
    startDate: nextMonday(),
    cuisines: [],
    nonVegDays: profile.dietPreference === "non-vegetarian" ? [2, 4, 5, 6] : [],
    excludeDishes: [],
    excludeIngredients: [],
    focusTags: focus,
    avoidTags: avoid,
    includeEarlyMorning: true,
    includeBedtime: true,
    seed: Math.floor(Math.random() * 1e9),
  };
}

/** Per-meal energy shares from the report's distributive menu (blended with defaults). */
export function buildTargets(
  results: { energy: number; protein: { grams: number }; fat: { grams: number }; cho: { grams: number } },
  menuPlan: MenuPlan | null | undefined,
  prefs: Pick<ChartPrefs, "includeEarlyMorning" | "includeBedtime">
): ChartTargets {
  const share = { ...DEFAULT_SHARE };
  const dist = menuPlan?.distributive;
  if (dist) {
    const kcal: Record<MealTime, number> = Object.fromEntries(MEAL_TIMES.map((m) => [m, 0])) as Record<MealTime, number>;
    for (const g of FOOD_GROUP_ORDER) {
      for (const m of MEAL_TIMES) kcal[m] += (dist[g]?.[m] ?? 0) * EXCHANGE_UNITS[g].energy;
    }
    const total = MEAL_TIMES.reduce((s, m) => s + kcal[m], 0);
    if (total > 0) {
      for (const m of MEAL_TIMES) {
        const blended = 0.5 * (kcal[m] / total) + 0.5 * DEFAULT_SHARE[m];
        const [lo, hi] = SHARE_BOUNDS[m];
        share[m] = Math.min(hi, Math.max(lo, blended));
      }
    }
  }
  if (!prefs.includeEarlyMorning) share.earlyMorning = 0;
  if (!prefs.includeBedtime) share.bedtime = 0;
  const sum = MEAL_TIMES.reduce((s, m) => s + share[m], 0);
  for (const m of MEAL_TIMES) share[m] = share[m] / sum;

  return {
    kcal: Math.round(results.energy),
    protein: Math.round(results.protein.grams),
    fat: Math.round(results.fat.grams),
    carbs: Math.round(results.cho.grams),
    fibre: Math.round(Math.max(25, (results.energy / 1000) * 14)),
    slotShare: share,
  };
}

// ---- totals -----------------------------------------------------------------

export type DishIndex = Record<string, Dish>;

export function mealTotals(items: PlanItem[], index: DishIndex): Nutrients {
  const t = zeroNutrients();
  for (const it of items) {
    const d = index[it.dishId];
    if (d) addInto(t, d.perUnit, it.units);
  }
  return t;
}

export function dayTotals(day: ChartDay, index: DishIndex): Nutrients {
  const t = zeroNutrients();
  for (const m of MEAL_TIMES) addInto(t, mealTotals(day.meals[m] ?? [], index));
  return t;
}

export function chartSummary(days: ChartDay[], index: DishIndex) {
  const avg = zeroNutrients();
  const ids = new Set<string>();
  let items = 0;
  for (const d of days) {
    addInto(avg, dayTotals(d, index), 1 / Math.max(1, days.length));
    for (const m of MEAL_TIMES) for (const it of d.meals[m] ?? []) {
      ids.add(it.dishId);
      items++;
    }
  }
  return { avg, uniqueDishes: ids.size, totalItems: items };
}

// ---- generator ----------------------------------------------------------------

interface Ctx {
  profile: ChartProfile;
  prefs: ChartPrefs;
  targets: ChartTargets;
  index: DishIndex;
  pool: Dish[];
  uses: Map<string, number[]>; // dishId -> day indices
  rng: () => number;
  excludedIngredients: Set<string>;
  preferred: Set<string>;
  dayMains?: Set<string>; // main ingredients already on today's plate
}

const NON_MAIN = new Set(["water", "salt", "oil", "ghee", "spices", "sugar", "lemon", "onion", "tomato"]);

/** The ingredient that defines a dish (largest non-trivial component). */
function mainIngredient(d: Dish): string | null {
  let best: string | null = null;
  let grams = 0;
  for (const [k, g] of Object.entries(d.ingredients)) {
    if (NON_MAIN.has(k)) continue;
    if (g > grams) {
      grams = g;
      best = k;
    }
  }
  return best;
}

/** Items below this energy per unit are never portion-scaled (drinks, chutneys). */
const MIN_SCALABLE_KCAL = 25;

const SAME_DAY_OK = new Set<DishRole>(["staple", "raita", "salad", "beverage", "side"]);

/** Max portion the auto-planner will use (nuts stay at a sensible handful). */
function autoMax(d: Dish): number {
  return d.role === "nuts" ? d.unit.default : d.unit.max;
}

const FREQ_GAP: Record<string, number> = { daily: 0, regular: 3, weekly: 6, occasional: 10 };
const FREQ_CAP_7D: Record<string, number> = { daily: 14, regular: 3, weekly: 1, occasional: 1 };

function profileAllows(d: Dish, ctx: Ctx): boolean {
  const { profile, prefs } = ctx;
  if (!dietAllows(d, profile.dietPreference)) return false;
  if (hasAllergen(d, profile.allergens)) return false;
  if (avoidsAny(d, profile)) return false;
  if (prefs.excludeDishes.includes(d.id)) return false;
  // An explicitly chosen dish overrides the "avoid" tags (not allergies or diet).
  if (!ctx.preferred.has(d.id) && prefs.avoidTags.some((t) => d.allTags.includes(t))) return false;
  if (ctx.excludedIngredients.size && Object.keys(d.ingredients).some((k) => ctx.excludedIngredients.has(k))) return false;
  return true;
}

/** Hard eligibility of a dish for a given meal on a given day. */
function eligible(
  d: Dish,
  meal: MealTime,
  day: number,
  ctx: Ctx,
  dayDishIds: Set<string>,
  opts: { nonVeg: "require" | "forbid" | "allow"; strict: boolean }
): boolean {
  if (!d.slots.includes(meal)) return false;
  if (!profileAllows(d, ctx)) return false;
  if (opts.nonVeg === "forbid" && isNonVeg(d)) return false;
  if (opts.nonVeg === "require" && !isNonVeg(d)) return false;
  const freq = d.freq ?? "regular";
  // Only staples, curd, salads, drinks and chutneys may appear twice in a day.
  if (dayDishIds.has(d.id) && !(freq === "daily" && SAME_DAY_OK.has(d.role))) return false;
  if (opts.strict) {
    const used = ctx.uses.get(d.id) ?? [];
    const inWindow = used.filter((u) => Math.abs(u - day) < 7 && u !== day).length;
    if (inWindow >= FREQ_CAP_7D[freq]) return false;
    if (freq === "occasional" && used.some((u) => Math.abs(u - day) < FREQ_GAP.occasional && u !== day)) return false;
  }
  return true;
}

function score(d: Dish, day: number, ctx: Ctx, anchor: Dish | null, meal: MealTime): number {
  const { profile, prefs } = ctx;
  let s = 0;
  const freq = d.freq ?? "regular";
  const used = ctx.uses.get(d.id) ?? [];
  const gap = FREQ_GAP[freq];
  const nearest = used.reduce((m, u) => (u === day ? m : Math.min(m, Math.abs(u - day))), Infinity);
  if (gap > 0 && nearest < gap) s -= 45 * ((gap - nearest + 1) / gap);
  if (freq === "daily" && nearest === 0) s -= 4;
  s -= (freq === "daily" ? 1.2 : 2.5) * used.length;

  s += { daily: 3, regular: 2, weekly: 0, occasional: -6 }[freq] ?? 0;

  if (goodForAny(d, profile)) s += 8;
  if (glycemic(profile)) {
    if (d.gi === "high") s -= 12;
    if (d.gi === "low") s += 3;
    if (d.allTags.includes("heavy")) s -= 8;
  }
  if (insulinFocus(profile)) {
    // Insulin resistance / prediabetes: steer carbohydrate-carrying dishes to
    // insulin-friendly choices and start the day with protein.
    const carbCarrier = d.role === "staple" || d.role === "breakfast" || d.role === "one-pot" || d.role === "snack" || d.role === "fruit";
    if (d.allTags.includes("ir-friendly")) s += 4;
    else if (carbCarrier) s -= 8;
    if (meal === "breakfast" && d.allTags.includes("high-protein")) s += 4;
  }
  if (has(profile, "hypertension")) {
    const na = d.perUnit.sodium * d.unit.default;
    if (na > 500) s -= 6;
  }
  if (has(profile, "weight-gain") && d.perUnit.kcal * d.unit.default > 300) s += 4;
  if (has(profile, "renal")) {
    if (d.allTags.includes("high-protein")) s -= 12;
    if (d.perUnit.kcal > 0 && d.perUnit.protein / d.perUnit.kcal > 0.05) s -= 8;
    if (d.role === "staple" && d.stapleKind === "rice") s += 6;
  }

  // Variety within the day: avoid repeating the same main ingredient.
  const main = mainIngredient(d);
  if (main && ctx.dayMains?.has(main) && d.freq !== "daily") s -= 16;

  for (const t of prefs.focusTags) if (d.allTags.includes(t)) s += 5;
  if (ctx.preferred.has(d.id)) s += 22;

  if (prefs.cuisines.length) {
    s += prefs.cuisines.includes(d.cuisine) ? 10 : d.cuisine === "pan-indian" ? 3 : -7;
  }
  if (anchor) {
    if (d.cuisine === anchor.cuisine) s += 4;
    if (d.role === "staple") {
      if (anchor.staplePref && d.stapleKind === anchor.staplePref) s += 12;
      if (!anchor.staplePref && anchor.cuisine === "south" && d.stapleKind === "rice") s += 8;
      if (!anchor.staplePref && (anchor.cuisine === "north" || anchor.cuisine === "west") && d.stapleKind === "roti") s += 5;
    }
  }
  if (d.role === "staple" && meal === "dinner" && glycemic(profile) && d.stapleKind === "roti") s += 4;

  if (profile.incomeGroup === "low") s -= (d.cost - 1) * 6;
  else if (profile.incomeGroup === "middle" && d.cost === 3) s -= 4;

  s += ctx.rng() * 7;
  return s;
}

function pickDish(
  roles: DishRole[],
  meal: MealTime,
  day: number,
  ctx: Ctx,
  dayDishIds: Set<string>,
  anchor: Dish | null,
  nonVeg: "require" | "forbid" | "allow",
  extraFilter?: (d: Dish) => boolean
): Dish | null {
  for (const strict of [true, false]) {
    let best: Dish | null = null;
    let bestScore = -Infinity;
    for (const d of ctx.pool) {
      if (!roles.includes(d.role)) continue;
      if (extraFilter && !extraFilter(d)) continue;
      if (!eligible(d, meal, day, ctx, dayDishIds, { nonVeg, strict })) continue;
      const sc = score(d, day, ctx, anchor, meal);
      if (sc > bestScore) {
        bestScore = sc;
        best = d;
      }
    }
    if (best) return best;
  }
  return null;
}

function addItem(items: PlanItem[], d: Dish, ctx: Ctx, day: number, dayDishIds: Set<string>, units?: number) {
  items.push({ uid: newUid(), dishId: d.id, units: units ?? d.unit.default, by: "auto" });
  dayDishIds.add(d.id);
  const main = mainIngredient(d);
  if (main) ctx.dayMains?.add(main);
  const arr = ctx.uses.get(d.id) ?? [];
  arr.push(day);
  ctx.uses.set(d.id, arr);
}

function rolesFilled(items: PlanItem[], index: DishIndex): Set<DishRole> {
  const s = new Set<DishRole>();
  for (const it of items) {
    const d = index[it.dishId];
    if (!d) continue;
    s.add(d.role);
    d.fills?.forEach((r) => s.add(r));
  }
  return s;
}

// Order in which dishes absorb the energy gap for each meal.
const FLEX: Record<MealTime, DishRole[]> = {
  earlyMorning: ["nuts", "beverage"],
  breakfast: ["breakfast", "staple", "protein"],
  midMorning: ["fruit", "beverage", "snack"],
  lunch: ["staple", "one-pot", "dal", "protein"],
  eveningSnack: ["snack", "nuts", "fruit", "beverage", "breakfast"],
  dinner: ["staple", "one-pot", "dal", "protein"],
  bedtime: ["beverage"],
};

function scaleMeal(items: PlanItem[], meal: MealTime, target: number, index: DishIndex) {
  let k = mealTotals(items, index).kcal;
  for (const role of FLEX[meal]) {
    if (Math.abs(target - k) <= target * 0.06) break;
    for (const it of items) {
      const d = index[it.dishId];
      if (!d || it.locked || d.role !== role || d.perUnit.kcal < MIN_SCALABLE_KCAL) continue;
      const desired = it.units + (target - k) / d.perUnit.kcal;
      const u = Math.min(autoMax(d), snapUnits(d, desired));
      k += (u - it.units) * d.perUnit.kcal;
      it.units = u;
      if (Math.abs(target - k) <= target * 0.06) break;
    }
  }
}

function buildMeal(
  meal: MealTime,
  day: number,
  ctx: Ctx,
  items: PlanItem[],
  dayDishIds: Set<string>,
  plan: { proteinMeal: MealTime | null; onePotMeal: MealTime | null; nonVegToday: boolean }
) {
  const { index, targets } = ctx;
  const target = targets.kcal * targets.slotShare[meal];
  if (target <= 0) return;
  const filled = () => rolesFilled(items, index);
  const nonVegMode = (wantNonVeg: boolean): "require" | "forbid" | "allow" =>
    ctx.profile.dietPreference !== "non-vegetarian" ? "allow" : wantNonVeg ? "require" : "forbid";

  const add = (roles: DishRole[], anchor: Dish | null, nv: "require" | "forbid" | "allow" = nonVegMode(false), f?: (d: Dish) => boolean) => {
    const d = pickDish(roles, meal, day, ctx, dayDishIds, anchor, nv, f);
    if (d) {
      addItem(items, d, ctx, day, dayDishIds);
      for (const c of d.companions ?? []) {
        const cd = index[c];
        if (cd && profileAllows(cd, ctx) && !dayDishIds.has(c)) addItem(items, cd, ctx, day, dayDishIds);
      }
    }
    return d;
  };
  const anchorOf = () => {
    for (const it of items) {
      const d = index[it.dishId];
      if (d && ["dal", "protein", "one-pot", "breakfast"].includes(d.role)) return d;
    }
    return null;
  };

  switch (meal) {
    case "earlyMorning": {
      if (!filled().has("beverage")) add(["beverage"], null);
      if (!filled().has("nuts") && target >= 70) add(["nuts"], null);
      break;
    }
    case "breakfast": {
      if (!filled().has("breakfast")) add(["breakfast"], null, nonVegMode(false));
      break;
    }
    case "midMorning": {
      if (!filled().has("fruit") && !filled().has("beverage")) {
        if (ctx.rng() < 0.72) add(["fruit"], null);
        else add(["beverage", "snack"], null);
      }
      // A very light pick (e.g. amla) shouldn't leave the slot half-empty.
      if (mealTotals(items, index).kcal < target * 0.5) add(["fruit", "beverage", "snack"], null);
      break;
    }
    case "lunch":
    case "dinner": {
      const f = filled();
      const isProteinMeal = plan.proteinMeal === meal;
      // Renal: a single dal / protein serving a day (at lunch); dinner stays cereal + veg.
      if (has(ctx.profile, "renal") && meal === "dinner") {
        if (!f.has("staple")) add(["staple"], null);
        if (!filled().has("sabzi")) add(["sabzi"], null);
        if (!filled().has("salad") && !filled().has("soup")) add(["salad"], null);
        break;
      }
      if (!f.has("staple") && !f.has("dal") && !f.has("protein")) {
        if (plan.onePotMeal === meal) {
          add(["one-pot"], null, nonVegMode(isProteinMeal && plan.nonVegToday));
        } else if (isProteinMeal) {
          add(["protein"], null, nonVegMode(plan.nonVegToday));
        } else {
          add(["dal"], null);
        }
      }
      const anchor = anchorOf();
      if (!filled().has("staple")) add(["staple"], anchor);
      if (!filled().has("dal") && !filled().has("protein")) add(["dal"], anchor);
      if (!filled().has("sabzi")) add(["sabzi"], anchor);
      if (meal === "lunch") {
        if (!filled().has("salad")) add(["salad"], anchor);
        if (!filled().has("raita")) add(["raita"], anchor);
      } else {
        const light = glycemic(ctx.profile);
        if (!filled().has("salad") && !filled().has("soup")) {
          if (light && ctx.rng() < 0.35) add(["soup"], anchor);
          else if (ctx.rng() < 0.55) add(["salad"], anchor);
        }
      }
      break;
    }
    case "eveningSnack": {
      const f = filled();
      if (!f.has("snack") && !f.has("nuts")) add(["snack", "nuts"], null);
      if (!filled().has("beverage") && ctx.rng() < 0.55) add(["beverage"], null);
      break;
    }
    case "bedtime": {
      if (!filled().has("beverage")) add(["beverage"], null);
      break;
    }
  }
  scaleMeal(items, meal, target, index);
}

/**
 * Remove an item — but if it's the only thing in its meal, replace it with a
 * same-role alternative that passes `filter` instead, so no meal disappears.
 */
function dropOrReplace(
  day: ChartDay,
  meal: MealTime,
  it: PlanItem,
  ctx: Ctx,
  dayDishIds: Set<string>,
  filter: (d: Dish) => boolean
): boolean {
  const items = day.meals[meal];
  if (items.length > 1) {
    day.meals[meal] = items.filter((x) => x.uid !== it.uid);
    return true;
  }
  const cur = ctx.index[it.dishId];
  if (!cur) return false;
  const nv = ctx.profile.dietPreference === "non-vegetarian" ? "forbid" : "allow";
  const alt = pickDish([cur.role, ...(cur.role === "nuts" ? (["fruit", "snack"] as DishRole[]) : [])], meal, day.day, ctx, dayDishIds, null, nv,
    (d) => d.id !== cur.id && filter(d));
  if (!alt) return false;
  it.dishId = alt.id;
  it.units = alt.unit.default;
  dayDishIds.add(alt.id);
  return true;
}

/** Day-level balancing: protein top-up and energy fine-tuning. */
function balanceDay(day: ChartDay, ctx: Ctx, dayDishIds: Set<string>) {
  const { index, targets } = ctx;
  const tot = () => dayTotals(day, index);

  // 1) Protein: grow dal / protein portions, then add a protein-rich item.
  for (let pass = 0; pass < 6; pass++) {
    const t = tot();
    if (t.protein >= targets.protein * 0.93) break;
    let improved = false;
    for (const meal of ["lunch", "dinner", "breakfast"] as MealTime[]) {
      for (const it of day.meals[meal]) {
        const d = index[it.dishId];
        if (!d || it.locked || !["dal", "protein"].includes(d.role)) continue;
        const next = snapUnits(d, it.units + d.unit.step);
        if (next > it.units) {
          it.units = next;
          improved = true;
          break;
        }
      }
      if (improved) break;
    }
    if (!improved) {
      // add a high-protein item to breakfast or evening snack
      for (const meal of ["eveningSnack", "breakfast", "midMorning"] as MealTime[]) {
        if (day.meals[meal].length >= 3) continue;
        const d = pickDish(
          ["protein", "snack", "salad", "raita", "beverage"],
          meal,
          day.day,
          ctx,
          dayDishIds,
          null,
          ctx.profile.dietPreference === "non-vegetarian" ? "forbid" : "allow",
          (x) => x.allTags.includes("high-protein") || x.perUnit.protein * x.unit.default >= 6
        );
        if (d) {
          addItem(day.meals[meal], d, ctx, day.day, dayDishIds);
          improved = true;
          break;
        }
      }
    }
    if (!improved) break;
    // keep energy roughly constant by trimming staples a little
    const over = tot().kcal - targets.kcal * 1.03;
    if (over > 0) trimEnergy(day, ctx, over);
  }

  // 2) Protein ceiling (strict for renal): step protein-dense portions down,
  //    drop protein extras, then refill energy from staples.
  // Renal: protein is a hard ceiling. Otherwise a natural Indian diet may sit
  // above the minimum; only cap genuine outliers (> 20 % of energy).
  const renal = has(ctx.profile, "renal");
  const ceiling = renal
    ? targets.protein * 1.1
    : Math.max(targets.protein * 1.35, (targets.kcal * 0.2) / 4);
  const exhausted = new Set<string>();
  for (let pass = 0; pass < 30 && tot().protein > ceiling; pass++) {
    let best: { meal: MealTime; it: PlanItem; density: number } | null = null;
    for (const meal of MEAL_TIMES) {
      for (const it of day.meals[meal]) {
        const d = index[it.dishId];
        if (!d || it.locked || d.perUnit.kcal <= 0 || exhausted.has(it.uid)) continue;
        const density = d.perUnit.protein / d.perUnit.kcal; // g protein per kcal
        if (density < 0.035) continue;
        if (!best || density > best.density) best = { meal, it, density };
      }
    }
    if (!best) break;
    const d = index[best.it.dishId];
    const next = snapUnits(d, best.it.units - d.unit.step);
    const removable =
      ["snack", "salad", "raita", "nuts", "soup"].includes(d.role) ||
      (["beverage", "protein"].includes(d.role) && !["lunch", "dinner"].includes(best.meal));
    if (next < best.it.units) best.it.units = next;
    else if (
      !removable ||
      !dropOrReplace(day, best.meal, best.it, ctx, dayDishIds, (x) => x.perUnit.kcal > 0 && x.perUnit.protein / x.perUnit.kcal < 0.03)
    ) {
      exhausted.add(best.it.uid);
    }
  }

  // 3) Fat: trade fat-dense extras (nuts, coconut / peanut chutneys) for
  //    staple carbohydrate; the energy step below refills from staples.
  const fatCap = targets.fat * 1.15;
  const fatDone = new Set<string>();
  for (let pass = 0; pass < 12 && tot().fat > fatCap; pass++) {
    let best: { meal: MealTime; it: PlanItem; fatShare: number } | null = null;
    for (const meal of MEAL_TIMES) {
      for (const it of day.meals[meal]) {
        const d = index[it.dishId];
        if (!d || it.locked || fatDone.has(it.uid) || !["nuts", "side", "snack"].includes(d.role) || d.perUnit.kcal <= 0) continue;
        const fatShare = (d.perUnit.fat * 9) / d.perUnit.kcal;
        if (fatShare < 0.45) continue;
        if (!best || fatShare > best.fatShare) best = { meal, it, fatShare };
      }
    }
    if (!best) break;
    const d = index[best.it.dishId];
    const next = snapUnits(d, best.it.units - d.unit.step);
    if (next < best.it.units) best.it.units = next;
    else if (!dropOrReplace(day, best.meal, best.it, ctx, dayDishIds, (x) => x.perUnit.kcal > 0 && (x.perUnit.fat * 9) / x.perUnit.kcal < 0.3)) {
      fatDone.add(best.it.uid);
    }
  }

  // 4) Energy: add or trim to land within ±5 %.
  for (let pass = 0; pass < 3; pass++) {
    const t = tot();
    if (t.kcal < targets.kcal * 0.96) growEnergy(day, ctx, targets.kcal - t.kcal, dayDishIds);
    else if (t.kcal > targets.kcal * 1.04) trimEnergy(day, ctx, t.kcal - targets.kcal, 0.9);
    else break;
  }
}

function adjustRole(day: ChartDay, ctx: Ctx, meals: MealTime[], roles: DishRole[], dir: 1 | -1, budget: number): number {
  const { index } = ctx;
  let moved = 0;
  for (const meal of meals) {
    for (const it of day.meals[meal]) {
      const d = index[it.dishId];
      if (!d || it.locked || !roles.includes(d.role) || d.perUnit.kcal < MIN_SCALABLE_KCAL) continue;
      while (moved < budget) {
        const next = Math.min(autoMax(d), snapUnits(d, it.units + dir * d.unit.step));
        if (next === it.units) break;
        const delta = Math.abs(next - it.units) * d.perUnit.kcal;
        if (moved + delta > budget + d.perUnit.kcal * d.unit.step * 0.5) break;
        it.units = next;
        moved += delta;
      }
      if (moved >= budget) return moved;
    }
  }
  return moved;
}

function growEnergy(day: ChartDay, ctx: Ctx, gap: number, dayDishIds: Set<string>) {
  const close = () => left <= ctx.targets.kcal * 0.03;
  let left = gap - adjustRole(day, ctx, ["lunch", "dinner", "breakfast"], ["staple", "one-pot", "breakfast"], 1, gap);
  if (close()) return;
  left -= adjustRole(day, ctx, ["eveningSnack", "midMorning", "earlyMorning", "bedtime"], ["snack", "fruit", "nuts", "beverage"], 1, left);
  if (close()) return;
  // Add energy-dense extras, cycling through meals until the gap closes.
  const plan: [MealTime, DishRole[]][] = [
    ["eveningSnack", ["nuts", "snack"]],
    ["midMorning", ["fruit", "nuts"]],
    ["breakfast", ["beverage", "fruit", "raita"]],
    ["bedtime", ["beverage"]],
    ["lunch", ["sweet", "raita", "nuts"]], // "nuts" with a lunch slot = after-lunch picks like date + Brazil nut
    ["earlyMorning", ["nuts", "fruit"]],
    ["dinner", ["raita", "salad"]],
  ];
  const nv = ctx.profile.dietPreference === "non-vegetarian" ? "forbid" : "allow";
  for (let round = 0; round < 2 && !close(); round++) {
    for (const [meal, roles] of plan) {
      if (close()) break;
      if (ctx.targets.slotShare[meal] <= 0) continue;
      const renal = has(ctx.profile, "renal");
      const fatHigh = dayTotals(day, ctx.index).fat > ctx.targets.fat * 1.05;
      const d = pickDish(roles, meal, day.day, ctx, dayDishIds, null, nv, (x) =>
        x.perUnit.kcal * x.unit.default >= 60 &&
        (!renal || x.perUnit.protein / Math.max(1, x.perUnit.kcal) < 0.03) &&
        (!fatHigh || (x.perUnit.fat * 9) / Math.max(1, x.perUnit.kcal) < 0.35));
      if (!d) continue;
      const units = snapUnits(d, Math.min(d.unit.max, left / Math.max(1, d.perUnit.kcal)));
      addItem(day.meals[meal], d, ctx, day.day, dayDishIds, Math.max(d.unit.default, units));
      left -= d.perUnit.kcal * Math.max(d.unit.default, units);
    }
  }
}

/**
 * Step dal / protein portions back down (largest first) while protein stays at
 * or above `proteinFloor` × target. Low-energy plans need this: the protein
 * top-up can push dal to 2–3 katoris once staples are already at their minimum.
 */
function trimProteinPortions(day: ChartDay, ctx: Ctx, budget: number, proteinFloor: number): number {
  const { index, targets } = ctx;
  let moved = 0;
  let protein = dayTotals(day, index).protein;
  for (let guard = 0; guard < 20 && moved < budget; guard++) {
    let best: { it: PlanItem; d: Dish; kcal: number } | null = null;
    for (const meal of ["lunch", "dinner", "breakfast"] as MealTime[]) {
      for (const it of day.meals[meal]) {
        const d = index[it.dishId];
        if (!d || it.locked || !["dal", "protein", "one-pot"].includes(d.role) || it.units <= d.unit.default) continue;
        const kcal = d.perUnit.kcal * it.units;
        if (!best || kcal > best.kcal) best = { it, d, kcal };
      }
    }
    if (!best) break;
    const next = Math.max(best.d.unit.default, snapUnits(best.d, best.it.units - best.d.unit.step));
    if (next >= best.it.units) break;
    const dp = (best.it.units - next) * best.d.perUnit.protein;
    if (protein - dp < targets.protein * proteinFloor) break;
    moved += (best.it.units - next) * best.d.perUnit.kcal;
    protein -= dp;
    best.it.units = next;
  }
  return moved;
}

function trimEnergy(day: ChartDay, ctx: Ctx, excess: number, proteinFloor = 0.93) {
  let left = excess - adjustRole(day, ctx, ["dinner", "lunch", "breakfast"], ["staple", "one-pot", "breakfast"], -1, excess);
  if (left <= ctx.targets.kcal * 0.03) return;
  left -= adjustRole(day, ctx, ["eveningSnack", "midMorning", "earlyMorning", "bedtime"], ["snack", "nuts", "fruit", "beverage"], -1, left);
  if (left <= ctx.targets.kcal * 0.03) return;
  left -= trimProteinPortions(day, ctx, left, proteinFloor);
  if (left <= ctx.targets.kcal * 0.03) return;
  left -= adjustRole(day, ctx, ["dinner", "lunch"], ["sabzi", "salad"], -1, left);
  if (left <= ctx.targets.kcal * 0.03) return;
  // drop optional extras, most energy-dense first
  const optional: { meal: MealTime; it: PlanItem; kcal: number }[] = [];
  for (const meal of ["earlyMorning", "eveningSnack", "bedtime", "lunch", "dinner"] as MealTime[]) {
    for (const it of day.meals[meal]) {
      const d = ctx.index[it.dishId];
      if (!d || it.locked) continue;
      if ((meal === "earlyMorning" && d.role === "nuts") || (meal === "eveningSnack" && d.role === "beverage") ||
          (meal === "bedtime") || d.role === "raita" || d.role === "side" || d.role === "sweet") {
        optional.push({ meal, it, kcal: d.perUnit.kcal * it.units });
      }
    }
  }
  optional.sort((a, b) => b.kcal - a.kcal);
  for (const o of optional) {
    if (left <= ctx.targets.kcal * 0.03) break;
    day.meals[o.meal] = day.meals[o.meal].filter((x) => x.uid !== o.it.uid);
    left -= o.kcal;
  }
}

// ---- alternatives ("have this OR that") -------------------------------------

/** Meals where the generator offers an alternative for each dish. */
export const ALT_MEALS: MealTime[] = ["earlyMorning", "midMorning", "eveningSnack", "bedtime"];

/**
 * Portion of `d` that gives about the same energy as the main dish
 * (`mainKcal`), or null when it can't get close. Near-zero drinks (green tea,
 * lemon water) pair with other light drinks at their usual serving.
 */
export function matchedUnits(d: Dish, mainKcal: number): number | null {
  if (mainKcal < 20) return d.perUnit.kcal * d.unit.default <= 40 ? d.unit.default : null;
  if (d.perUnit.kcal <= 0) return null;
  const u = snapUnits(d, mainKcal / d.perUnit.kcal);
  return Math.abs(d.perUnit.kcal * u - mainKcal) <= Math.max(25, mainKcal * 0.3) ? u : null;
}

function addAlternatives(day: ChartDay, ctx: Ctx, dayDishIds: Set<string>) {
  const nv = ctx.profile.dietPreference === "non-vegetarian" ? "forbid" : "allow";
  for (const meal of ALT_MEALS) {
    for (const it of day.meals[meal] ?? []) {
      if (it.alts?.length) continue;
      const d = ctx.index[it.dishId];
      if (!d) continue;
      const mainKcal = d.perUnit.kcal * it.units;
      const alt = pickDish([d.role], meal, day.day, ctx, dayDishIds, null, nv, (x) => x.id !== d.id && matchedUnits(x, mainKcal) != null);
      if (!alt) continue;
      it.alts = [{ dishId: alt.id, units: matchedUnits(alt, mainKcal) as number }];
      dayDishIds.add(alt.id);
      const arr = ctx.uses.get(alt.id) ?? [];
      arr.push(day.day);
      ctx.uses.set(alt.id, arr);
    }
  }
}

function buildDay(dayIdx: number, date: string, ctx: Ctx, existing?: DayMeals): ChartDay {
  const meals = emptyMeals();
  const dayDishIds = new Set<string>();
  ctx.dayMains = new Set();
  // keep locked items
  if (existing) {
    for (const m of MEAL_TIMES) {
      for (const it of existing[m] ?? []) {
        if (it.locked && ctx.index[it.dishId]) {
          meals[m].push({ ...it });
          dayDishIds.add(it.dishId);
          const main = mainIngredient(ctx.index[it.dishId]);
          if (main) ctx.dayMains.add(main);
          const arr = ctx.uses.get(it.dishId) ?? [];
          arr.push(dayIdx);
          ctx.uses.set(it.dishId, arr);
        }
      }
    }
  }

  const pref = ctx.profile.dietPreference;
  const wd = weekdayOf(date);
  const nonVegToday = pref === "non-vegetarian" && ctx.prefs.nonVegDays.includes(wd);
  let proteinMeal: MealTime | null = null;
  if (nonVegToday) proteinMeal = dayIdx % 2 === 0 ? "dinner" : "lunch";
  else if ([1, 3, 5].includes(wd)) proteinMeal = "dinner";
  else if ((["high-protein", "weight-gain", "pcos"] as DietType[]).some((c) => has(ctx.profile, c)) && wd === 6) proteinMeal = "lunch";

  let onePotMeal: MealTime | null = null;
  const r = ctx.rng();
  if (r < 0.24) onePotMeal = "lunch";
  else if (r < 0.42) onePotMeal = "dinner";
  if (onePotMeal === proteinMeal && !nonVegToday) onePotMeal = null;

  const day: ChartDay = { day: dayIdx, date, meals };
  for (const m of MEAL_TIMES) {
    buildMeal(m, dayIdx, ctx, meals[m], dayDishIds, { proteinMeal, onePotMeal, nonVegToday });
  }
  balanceDay(day, ctx, dayDishIds);
  addAlternatives(day, ctx, dayDishIds);
  return day;
}

function makeCtx(
  profile: ChartProfile,
  prefs: ChartPrefs,
  targets: ChartTargets,
  dishes: Dish[],
  seedOffset = 0
): Ctx {
  const index: DishIndex = Object.fromEntries(dishes.map((d) => [d.id, d]));
  return {
    profile,
    prefs,
    targets,
    index,
    pool: dishes,
    uses: new Map(),
    rng: mulberry32((prefs.seed || 1) + seedOffset),
    excludedIngredients: new Set(prefs.excludeIngredients),
    preferred: new Set(prefs.preferDishes ?? []),
  };
}

/**
 * Generate a full chart. Locked items in `existing` are kept in place.
 */
export function generateChart(
  profile: ChartProfile,
  prefs: ChartPrefs,
  targets: ChartTargets,
  dishes: Dish[],
  existing?: ChartDay[]
): ChartDay[] {
  const ctx = makeCtx(profile, prefs, targets, dishes);
  const out: ChartDay[] = [];
  for (let i = 0; i < prefs.days; i++) {
    const date = addDays(prefs.startDate, i);
    out.push(buildDay(i, date, ctx, existing?.[i]?.meals));
  }
  return out;
}

/** Regenerate a single day, keeping the rest of the chart (and its locks). */
export function regenerateDay(
  days: ChartDay[],
  dayIdx: number,
  profile: ChartProfile,
  prefs: ChartPrefs,
  targets: ChartTargets,
  dishes: Dish[]
): ChartDay {
  const ctx = makeCtx(profile, prefs, targets, dishes, Math.floor(Math.random() * 1e6));
  for (const d of days) {
    if (d.day === dayIdx) continue;
    for (const m of MEAL_TIMES) for (const it of d.meals[m] ?? []) {
      const arr = ctx.uses.get(it.dishId) ?? [];
      arr.push(d.day);
      ctx.uses.set(it.dishId, arr);
    }
  }
  const cur = days.find((d) => d.day === dayIdx);
  return buildDay(dayIdx, cur?.date ?? addDays(prefs.startDate, dayIdx), ctx, cur?.meals);
}

// ---- suggestions (swap / add) ------------------------------------------------

export interface Suggestion {
  dishId: string;
  units: number;
  kcal: number;
  protein: number;
  reason: string;
}

/**
 * Ranked alternatives for an item: same role, fits the meal & profile,
 * portion chosen to match the original energy.
 */
export function suggestSwaps(
  days: ChartDay[],
  dayIdx: number,
  meal: MealTime,
  uid: string,
  profile: ChartProfile,
  prefs: ChartPrefs,
  dishes: Dish[],
  limit = 8,
  fullIndex?: DishIndex
): Suggestion[] {
  const index: DishIndex = { ...(fullIndex ?? {}), ...Object.fromEntries(dishes.map((d) => [d.id, d])) };
  const day = days.find((d) => d.day === dayIdx);
  const item = day?.meals[meal]?.find((i) => i.uid === uid);
  const orig = item ? index[item.dishId] : undefined;
  if (!day || !item || !orig) return [];
  const origN = scaled(orig.perUnit, item.units);
  const roles = new Set<DishRole>([orig.role, ...(orig.fills ?? [])]);
  const ctx = makeCtx(profile, { ...prefs, avoidTags: [] }, { kcal: 0, protein: 0, fat: 0, carbs: 0, fibre: 0, slotShare: DEFAULT_SHARE }, dishes, dayIdx + 7);
  for (const d of days) for (const m of MEAL_TIMES) for (const it of d.meals[m] ?? []) {
    const arr = ctx.uses.get(it.dishId) ?? [];
    arr.push(d.day);
    ctx.uses.set(it.dishId, arr);
  }
  const dayIds = new Set(MEAL_TIMES.flatMap((m) => day.meals[m].map((i) => i.dishId)));
  const out: (Suggestion & { s: number })[] = [];
  for (const d of dishes) {
    if (d.id === orig.id || !d.slots.includes(meal) || !roles.has(d.role)) continue;
    if (!profileAllows(d, ctx) || dayIds.has(d.id)) continue;
    if (profile.dietPreference === "non-vegetarian" && isNonVeg(d) !== isNonVeg(orig) && orig.role === "protein") {
      // keep veg↔non-veg consistent with the day's plan, but allow if original was veg
      if (!isNonVeg(orig)) continue;
    }
    const units = d.perUnit.kcal > 0 ? snapUnits(d, origN.kcal / d.perUnit.kcal) : d.unit.default;
    const n = scaled(d.perUnit, units);
    let s = 30 - Math.abs(n.kcal - origN.kcal) / 12 - Math.abs(n.protein - origN.protein) / 1.5;
    const used = ctx.uses.get(d.id) ?? [];
    const near = used.reduce((m, u) => Math.min(m, Math.abs(u - dayIdx)), Infinity);
    if (near < 3) s -= 8;
    if (goodForAny(d, profile)) s += 5;
    if (insulinFocus(profile) && d.allTags.includes("ir-friendly")) s += 3;
    if (d.cuisine === orig.cuisine) s += 2;
    const reason =
      n.protein > origN.protein + 3 ? "more protein" :
      n.kcal < origN.kcal - 40 ? "lighter" :
      Math.abs(n.kcal - origN.kcal) < 40 ? "similar energy" : d.cuisine === orig.cuisine ? "same cuisine" : "variety";
    out.push({ dishId: d.id, units, kcal: Math.round(n.kcal), protein: Math.round(n.protein * 10) / 10, reason, s });
  }
  return out.sort((a, b) => b.s - a.s).slice(0, limit).map(({ s: _s, ...rest }) => rest);
}

// ---- food suggestions (pre-chart food selection) -----------------------------

const TAG_REASON: Partial<Record<DishTag, string>> = {
  "ir-friendly": "Insulin-friendly",
  "low-gi": "Low GI",
  millet: "Millet",
  "high-fibre": "High fibre",
  "high-protein": "High protein",
  "iron-rich": "Iron-rich",
  "calcium-rich": "Calcium-rich",
  probiotic: "Probiotic",
  "low-cal": "Low calorie",
  traditional: "Traditional",
  quick: "Quick to cook",
  budget: "Budget-friendly",
};

export interface FoodRelevance {
  score: number;
  reasons: string[];
  cautions: string[];
}

/**
 * How well a dish suits this client, with plain-language reasons — used to
 * suggest foods before a chart is generated. Mirrors the planner's scoring.
 */
export function foodRelevance(d: Dish, profile: ChartProfile, prefs: Partial<ChartPrefs>, conditionLabel: (c: DietType) => string): FoodRelevance {
  let s = 0;
  const reasons: string[] = [];
  const cautions: string[] = [];
  const good = (d.goodFor ?? []).filter((c) => has(profile, c));
  if (good.length) {
    s += 8;
    reasons.push(`Good for ${good.map(conditionLabel).join(", ")}`);
  }
  if (insulinFocus(profile)) {
    const carbCarrier = ["staple", "breakfast", "one-pot", "snack", "fruit"].includes(d.role);
    if (d.allTags.includes("ir-friendly")) s += 4;
    else if (carbCarrier) {
      s -= 6;
      cautions.push("Carb-heavy for insulin resistance");
    }
  }
  if (glycemic(profile)) {
    if (d.gi === "high") {
      s -= 12;
      cautions.push("High GI");
    } else if (d.gi === "low") s += 3;
    if (d.allTags.includes("heavy")) {
      s -= 8;
      cautions.push("Heavy");
    }
  }
  if (has(profile, "hypertension") && d.perUnit.sodium * d.unit.default > 500) {
    s -= 6;
    cautions.push("High sodium");
  }
  if (has(profile, "renal") && d.allTags.includes("high-protein")) {
    s -= 12;
    cautions.push("High protein (renal)");
  }
  if (has(profile, "weight-loss") && d.perUnit.kcal * d.unit.default > 400) {
    s -= 4;
    cautions.push("Energy-dense");
  }
  if (d.allTags.includes("fried")) {
    s -= 6;
    cautions.push("Fried");
  }
  const focus = new Set(prefs.focusTags ?? []);
  for (const t of d.allTags) {
    if (focus.has(t)) s += 5;
    const label = TAG_REASON[t];
    if (label && (focus.has(t) || (t === "low-gi" && glycemic(profile)) || (t === "ir-friendly" && insulinFocus(profile)))) {
      if (!reasons.includes(label)) reasons.push(label);
    }
  }
  if (prefs.cuisines?.length) s += prefs.cuisines.includes(d.cuisine) ? 5 : d.cuisine === "pan-indian" ? 1 : -3;
  if (d.freq === "occasional") s -= 2;
  if (profile.incomeGroup === "low") s -= (d.cost - 1) * 3;
  return { score: s, reasons: reasons.slice(0, 3), cautions: cautions.slice(0, 2) };
}

/** Can this profile eat this dish? (used to filter the food-bank picker) */
export function dishFitsProfile(d: Dish, profile: ChartProfile, prefs?: Partial<ChartPrefs>): boolean {
  if (!dietAllows(d, profile.dietPreference)) return false;
  if (hasAllergen(d, profile.allergens)) return false;
  if (avoidsAny(d, profile)) return false;
  if (prefs?.excludeDishes?.includes(d.id)) return false;
  if (prefs?.excludeIngredients?.length && Object.keys(d.ingredients).some((k) => prefs.excludeIngredients!.includes(k))) return false;
  return true;
}

// ---- grocery list -----------------------------------------------------------

export interface GroceryLine {
  key: string;
  name: string;
  category: string;
  grams: number;
  display: string;
}

export function groceryList(days: ChartDay[], index: DishIndex): Record<string, GroceryLine[]> {
  const totals = new Map<string, number>();
  // Alternatives are included so the client can buy for whichever option they pick.
  for (const d of days) for (const m of MEAL_TIMES) for (const it of d.meals[m] ?? []) {
    for (const choice of [{ dishId: it.dishId, units: it.units }, ...(it.alts ?? [])]) {
      const dish = index[choice.dishId];
      if (!dish) continue;
      for (const [k, g] of Object.entries(dish.ingredients)) totals.set(k, (totals.get(k) ?? 0) + g * choice.units);
    }
  }
  const out: Record<string, GroceryLine[]> = {};
  for (const [key, grams] of totals) {
    const ing = INGREDIENT_MAP[key];
    // Skip water/salt and trace tempering amounts (pantry items, not shopping).
    if (!ing || key === "water" || key === "salt" || grams < 3) continue;
    const display = ing.piece
      ? `${Math.ceil(grams / ing.piece.grams)} ${Math.ceil(grams / ing.piece.grams) === 1 ? ing.piece.singular : ing.piece.plural}`
      : ing.liquid
        ? grams >= 1000 ? `${(grams / 1000).toFixed(1)} L` : `${Math.round(grams / 10) * 10} ml`
        : grams >= 1000 ? `${(grams / 1000).toFixed(2)} kg` : grams >= 20 ? `${Math.round(grams / 10) * 10} g` : `${Math.round(grams)} g`;
    (out[ing.category] ??= []).push({ key, name: ing.name, category: ing.category, grams, display });
  }
  for (const c of Object.keys(out)) out[c].sort((a, b) => b.grams - a.grams);
  return out;
}
