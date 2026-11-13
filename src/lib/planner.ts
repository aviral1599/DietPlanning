import { EXCHANGE_UNITS } from "./exchange-data";
import {
  CalcResults,
  ComprehensiveRow,
  DescriptiveItem,
  DistributiveMenu,
  FoodGroup,
  FOOD_GROUP_ORDER,
  MealTime,
  MEAL_TIMES,
  MenuPlan,
  SubjectInfo,
} from "./types";
import { round } from "./nutrition";
import { isGlycemicConcern } from "./glycemic";

const half = (n: number) => Math.max(0, Math.round(n * 2) / 2);

// ---------------------------------------------------------------------------
// Exchange allocation: turn macro targets into a count of exchanges per group.
// Follows the standard sequence used in Indian diet planning: fix vegetables,
// fruit, milk and pulses; fill carbohydrate with cereals; fill fat with oils.
// ---------------------------------------------------------------------------

export function allocateExchanges(
  results: CalcResults,
  subject: SubjectInfo
): Record<FoodGroup, number> {
  const energy = results.energy;
  const targetP = results.protein.grams;
  const targetF = results.fat.grams;
  const targetC = results.cho.grams;
  const diet = subject.dietType;
  const pref = subject.dietPreference;
  const U = EXCHANGE_UNITS;

  const isDiabetic =
    diet === "weight-loss" || isGlycemicConcern(diet, subject.glycemicStatus);

  const alloc: Record<FoodGroup, number> = {
    CEREALS: 0,
    PULSES: 0,
    MILK: 0,
    MEAT: 0,
    VEG_A: 0,
    VEG_B: 0,
    VEG_C: 0,
    FRUITS: 0,
    SUGARS: 0,
    FATS: 0,
    NUTS: 0,
  };

  // 1. Vegetables (fixed for micronutrients).
  alloc.VEG_A = 1;
  alloc.VEG_B = 2;
  alloc.VEG_C = isDiabetic ? 0.5 : 1;

  // 2. Fruits — scaled with energy, capped for diabetic/PCOS.
  let fruits = energy < 1500 ? 1 : energy < 2200 ? 2 : 3;
  if (isDiabetic) fruits = Math.min(fruits, 1);
  alloc.FRUITS = fruits;

  // 3. Nuts & oilseeds.
  alloc.NUTS = 1;

  // 4. Milk — 2 for adults; 3 for pregnancy/lactation; 0 for vegan.
  if (pref === "vegan") alloc.MILK = 0;
  else if (diet === "pregnancy" || diet === "lactation") alloc.MILK = 3;
  else alloc.MILK = 2;

  // 5. Meat / egg — by preference.
  if (pref === "non-vegetarian") alloc.MEAT = 2;
  else if (pref === "eggetarian") alloc.MEAT = 1;
  else alloc.MEAT = 0;

  // 6. Pulses — protein workhorse. Higher for veg/vegan to compensate.
  const basePulses =
    pref === "vegan" ? 3 : pref === "vegetarian" || pref === "jain" ? 2 : 1.5;
  alloc.PULSES = basePulses;

  // 7. Sugars — small allowance; none for diabetic/weight-loss/PCOS.
  alloc.SUGARS = isDiabetic ? 0 : subject.incomeGroup === "low" ? 2 : 1;

  // --- Protein balancing: adjust pulses to approach protein target ---------
  const proteinFromFixed = (a: Record<FoodGroup, number>) =>
    FOOD_GROUP_ORDER.filter((g) => g !== "PULSES" && g !== "CEREALS").reduce(
      (s, g) => s + a[g] * U[g].protein,
      0
    );

  // Cereals contribute protein too; estimate cereals first from CHO, then loop.
  for (let pass = 0; pass < 3; pass++) {
    // Estimate CHO already covered by non-cereal groups.
    const choNonCereal = FOOD_GROUP_ORDER.filter((g) => g !== "CEREALS").reduce(
      (s, g) => s + alloc[g] * U[g].cho,
      0
    );
    const remainingCho = Math.max(0, targetC - choNonCereal);
    alloc.CEREALS = half(remainingCho / U.CEREALS.cho);

    // Now protein: pulses fill the gap after all other groups (incl cereals).
    const pFixed =
      proteinFromFixed(alloc) + alloc.CEREALS * U.CEREALS.protein;
    const proteinGap = targetP - pFixed;
    alloc.PULSES = Math.min(
      pref === "vegan" ? 5 : 4,
      Math.max(basePulses * 0.5, half(proteinGap / U.PULSES.protein))
    );
  }

  // --- Fat balancing: fill remaining fat with visible fat exchanges --------
  const fatFromOthers = FOOD_GROUP_ORDER.filter((g) => g !== "FATS").reduce(
    (s, g) => s + alloc[g] * U[g].fat,
    0
  );
  alloc.FATS = half(Math.max(0, (targetF - fatFromOthers) / U.FATS.fat));

  // Round remaining groups to sensible halves.
  for (const g of FOOD_GROUP_ORDER) alloc[g] = half(alloc[g]);

  return alloc;
}

// ---------------------------------------------------------------------------
// Comprehensive menu = per-group totals.
// ---------------------------------------------------------------------------

export function buildComprehensive(alloc: Record<FoodGroup, number>): {
  rows: ComprehensiveRow[];
  totals: MenuPlan["totals"];
} {
  const U = EXCHANGE_UNITS;
  const rows: ComprehensiveRow[] = FOOD_GROUP_ORDER.map((group) => {
    const ex = alloc[group];
    return {
      group,
      exchanges: ex,
      energy: round(ex * U[group].energy),
      protein: round(ex * U[group].protein),
      fat: round(ex * U[group].fat),
      cho: round(ex * U[group].cho),
    };
  });
  const totals = rows.reduce(
    (t, r) => ({
      energy: round(t.energy + r.energy),
      protein: round(t.protein + r.protein),
      fat: round(t.fat + r.fat),
      cho: round(t.cho + r.cho),
    }),
    { energy: 0, protein: 0, fat: 0, cho: 0 }
  );
  return { rows, totals };
}

// ---------------------------------------------------------------------------
// Distributive menu = spread each group's exchanges across meal times.
// ---------------------------------------------------------------------------

// Relative weights of each meal time for each food group.
const DISTRIBUTION: Record<FoodGroup, Partial<Record<MealTime, number>>> = {
  CEREALS: { breakfast: 1, lunch: 1.2, eveningSnack: 0.5, dinner: 1 },
  PULSES: { lunch: 1, dinner: 1 },
  MILK: { earlyMorning: 0.5, breakfast: 1, bedtime: 1 },
  MEAT: { lunch: 1, dinner: 1 },
  VEG_A: { lunch: 1, dinner: 1 },
  VEG_B: { lunch: 1, dinner: 1 },
  VEG_C: { lunch: 1 },
  FRUITS: { midMorning: 1, eveningSnack: 1 },
  SUGARS: { earlyMorning: 1, eveningSnack: 1 },
  FATS: { breakfast: 0.5, lunch: 1, dinner: 1 },
  NUTS: { earlyMorning: 0.5, eveningSnack: 1 },
};

export function buildDistributive(
  alloc: Record<FoodGroup, number>
): DistributiveMenu {
  const menu = {} as DistributiveMenu;
  for (const group of FOOD_GROUP_ORDER) {
    const row = {} as Record<MealTime, number>;
    for (const m of MEAL_TIMES) row[m] = 0;

    const weights = DISTRIBUTION[group];
    const total = alloc[group];
    const wSum = Object.values(weights).reduce((s, w) => s + (w ?? 0), 0);

    if (total > 0 && wSum > 0) {
      const meals = Object.keys(weights) as MealTime[];
      let assigned = 0;
      meals.forEach((m, i) => {
        if (i === meals.length - 1) {
          row[m] = half(total - assigned);
        } else {
          const share = half((total * (weights[m] ?? 0)) / wSum);
          row[m] = share;
          assigned += share;
        }
      });
      // Guard against negative rounding remainder.
      for (const m of meals) if (row[m] < 0) row[m] = 0;
    }
    menu[group] = row;
  }
  return menu;
}

// ---------------------------------------------------------------------------
// Descriptive menu = starter recipe suggestions the coach can edit.
// ---------------------------------------------------------------------------

const U = EXCHANGE_UNITS;

function nutrientsFor(group: FoodGroup, ex: number) {
  return {
    energy: round(ex * U[group].energy),
    protein: round(ex * U[group].protein),
    fat: round(ex * U[group].fat),
    cho: round(ex * U[group].cho),
  };
}

// A very small recipe knowledge base for auto-suggested descriptive rows.
const RECIPE_IDEAS: Record<
  MealTime,
  { veg: string; nonveg?: string; groups: FoodGroup[] }[]
> = {
  earlyMorning: [
    { veg: "Warm water with lemon + soaked almonds", groups: ["NUTS"] },
    { veg: "Milk / tea (no sugar)", groups: ["MILK", "SUGARS"] },
  ],
  breakfast: [
    {
      veg: "Vegetable oats / dalia with milk",
      nonveg: "Veg poha + boiled egg",
      groups: ["CEREALS", "MILK", "VEG_B", "FATS"],
    },
  ],
  midMorning: [{ veg: "Seasonal fruit", groups: ["FRUITS"] }],
  lunch: [
    {
      veg: "Roti + dal + sabzi + salad + curd",
      nonveg: "Roti + chicken/fish curry + sabzi + salad",
      groups: ["CEREALS", "PULSES", "MEAT", "VEG_A", "VEG_B", "VEG_C", "FATS"],
    },
  ],
  eveningSnack: [
    {
      veg: "Sprouts chaat / roasted chana + tea",
      groups: ["PULSES", "FRUITS", "CEREALS", "SUGARS"],
    },
  ],
  dinner: [
    {
      veg: "Roti + dal / paneer + sabzi + salad",
      nonveg: "Roti + fish/chicken + sabzi + salad",
      groups: ["CEREALS", "PULSES", "MEAT", "VEG_A", "VEG_B", "FATS"],
    },
  ],
  bedtime: [{ veg: "Warm milk (turmeric optional)", groups: ["MILK"] }],
};

export function buildDescriptive(
  distributive: DistributiveMenu,
  subject: SubjectInfo
): DescriptiveItem[] {
  const items: DescriptiveItem[] = [];
  let idx = 0;
  const nonveg =
    subject.dietPreference === "non-vegetarian" ||
    subject.dietPreference === "eggetarian";

  for (const mealTime of MEAL_TIMES) {
    const ideas = RECIPE_IDEAS[mealTime] ?? [];
    for (const idea of ideas) {
      // exchanges present at this meal for the idea's groups
      const groupsHere = idea.groups.filter(
        (g) => (distributive[g]?.[mealTime] ?? 0) > 0
      );
      if (groupsHere.length === 0) continue;

      const totalEx = groupsHere.reduce(
        (s, g) => s + (distributive[g][mealTime] ?? 0),
        0
      );
      const n = groupsHere.reduce(
        (acc, g) => {
          const nut = nutrientsFor(g, distributive[g][mealTime] ?? 0);
          return {
            energy: acc.energy + nut.energy,
            protein: acc.protein + nut.protein,
            fat: acc.fat + nut.fat,
            cho: acc.cho + nut.cho,
          };
        },
        { energy: 0, protein: 0, fat: 0, cho: 0 }
      );

      items.push({
        id: `d${idx++}`,
        mealTime,
        recipe: (nonveg && idea.nonveg) || idea.veg,
        ingredients: groupsHere
          .map((g) => `${g} × ${distributive[g][mealTime]}`)
          .join(", "),
        group: groupsHere[0],
        exchanges: round(totalEx),
        energy: round(n.energy),
        protein: round(n.protein),
        fat: round(n.fat),
        cho: round(n.cho),
      });
    }
  }
  return items;
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

export function buildMenuPlan(
  results: CalcResults,
  subject: SubjectInfo
): MenuPlan {
  const alloc = allocateExchanges(results, subject);
  const { rows, totals } = buildComprehensive(alloc);
  const distributive = buildDistributive(alloc);
  const descriptive = buildDescriptive(distributive, subject);
  return { comprehensive: rows, distributive, descriptive, totals };
}
