import { computeAssessment, defaultSettings } from "../../src/lib/nutrition";
import { buildMenuPlan } from "../../src/lib/planner";
import { BUILTIN_DISHES, formatPortion, parseAllergies } from "../../src/lib/foodbank/bank";
import { buildTargets, dayTotals, defaultPrefs, generateChart, groceryList, profileConditions, WEEKDAYS, weekdayOf } from "../../src/lib/foodbank/engine";
import { MEAL_TIMES, MEAL_TIME_LABELS, SubjectInfo } from "../../src/lib/types";

const cases: SubjectInfo[] = [
  { clientName: "PCOS veg", age: 28, sex: "female", heightCm: 160, weightKg: 70, activityLevel: "sedentary", incomeGroup: "middle", allergies: "", dietType: "pcos", dietPreference: "vegetarian", objective: "", glycemicStatus: "none", labs: {} },
  { clientName: "Diabetic non-veg", age: 45, sex: "male", heightCm: 172, weightKg: 85, activityLevel: "moderate", incomeGroup: "middle", allergies: "", dietType: "diabetes", dietPreference: "non-vegetarian", objective: "", glycemicStatus: "none", labs: {} },
  { clientName: "Pregnancy veg", age: 30, sex: "female", heightCm: 158, weightKg: 62, activityLevel: "sedentary", incomeGroup: "high", allergies: "", dietType: "pregnancy", dietPreference: "vegetarian", objective: "", glycemicStatus: "none", labs: {} },
  { clientName: "Wt-gain egg", age: 24, sex: "male", heightCm: 178, weightKg: 58, activityLevel: "heavy", incomeGroup: "middle", allergies: "peanut", dietType: "weight-gain", dietPreference: "eggetarian", objective: "", glycemicStatus: "none", labs: {} },
  { clientName: "Wt-loss vegan", age: 35, sex: "female", heightCm: 155, weightKg: 72, activityLevel: "sedentary", incomeGroup: "high", allergies: "gluten", dietType: "weight-loss", dietPreference: "vegan", objective: "", glycemicStatus: "none", labs: {} },
  { clientName: "Jain HTN", age: 58, sex: "male", heightCm: 168, weightKg: 78, activityLevel: "sedentary", incomeGroup: "middle", allergies: "", dietType: "hypertension", dietPreference: "jain", objective: "", glycemicStatus: "none", labs: {} },
  { clientName: "Renal veg", age: 62, sex: "male", heightCm: 165, weightKg: 64, activityLevel: "sedentary", incomeGroup: "middle", allergies: "", dietType: "renal", dietPreference: "vegetarian", objective: "", glycemicStatus: "none", labs: {} },
  { clientName: "Low-income general", age: 32, sex: "female", heightCm: 152, weightKg: 50, activityLevel: "heavy", incomeGroup: "low", allergies: "", dietType: "general", dietPreference: "vegetarian", objective: "", glycemicStatus: "none", labs: {} },
  { clientName: "Prediabetes veg", age: 41, sex: "male", heightCm: 170, weightKg: 82, activityLevel: "sedentary", incomeGroup: "middle", allergies: "", dietType: "insulin-resistance", dietPreference: "vegetarian", objective: "", glycemicStatus: "prediabetes", labs: { hba1c: 6.1, fastingGlucose: 112 } },
  { clientName: "PCOS + insulin resistance non-veg", age: 27, sex: "female", heightCm: 158, weightKg: 68, activityLevel: "moderate", incomeGroup: "high", allergies: "", dietType: "pcos", dietPreference: "non-vegetarian", objective: "", glycemicStatus: "insulin-resistance", labs: { fastingGlucose: 94, fastingInsulin: 14 } },
];

const index = Object.fromEntries(BUILTIN_DISHES.map((d) => [d.id, d]));
const verbose = process.argv.includes("-v");

for (const s of cases) {
  const results = computeAssessment(s, defaultSettings(s));
  const menu = buildMenuPlan(results, s);
  const profile = { dietType: s.dietType, dietPreference: s.dietPreference, allergens: parseAllergies(s.allergies), incomeGroup: s.incomeGroup, glycemicStatus: s.glycemicStatus };
  const conds = profileConditions(profile);
  const prefs = { ...defaultPrefs(profile, 28), seed: 12345, startDate: "2026-11-16" };
  const targets = buildTargets(results, menu, prefs);
  const t0 = Date.now();
  const days = generateChart(profile, prefs, targets, BUILTIN_DISHES);
  const ms = Date.now() - t0;

  const tots = days.map((d) => dayTotals(d, index));
  const avg = (k: keyof (typeof tots)[0]) => tots.reduce((a, t) => a + t[k], 0) / tots.length;
  const eOk = tots.filter((t) => Math.abs(t.kcal - targets.kcal) <= targets.kcal * 0.05).length;
  const pOk = tots.filter((t) => t.protein >= targets.protein * 0.9).length;
  const worst = Math.max(...tots.map((t) => Math.abs(t.kcal - targets.kcal) / targets.kcal));

  // variety
  const counts = new Map<string, number[]>();
  days.forEach((d) => MEAL_TIMES.forEach((m) => d.meals[m].forEach((it) => counts.set(it.dishId, [...(counts.get(it.dishId) ?? []), d.day]))));
  let freqViol = 0;
  for (const [id, used] of counts) {
    const dish = index[id];
    if (dish.freq === "daily") continue;
    const cap = dish.freq === "regular" ? 3 : 1;
    for (let w = 0; w + 7 <= days.length; w++) if (used.filter((u) => u >= w && u < w + 7).length > cap) { freqViol++; break; }
  }
  // diet/allergy safety
  const unsafe = days.flatMap((d) => MEAL_TIMES.flatMap((m) => d.meals[m])).map((it) => index[it.dishId]).filter((d) =>
    (s.dietPreference === "vegetarian" && !d.diet.vegetarian) || (s.dietPreference === "vegan" && !d.diet.vegan) ||
    (s.dietPreference === "jain" && !d.diet.jain) || (s.dietPreference === "eggetarian" && !d.diet.eggetarian) ||
    d.allergens.some((a) => profile.allergens.includes(a)) || conds.some((c) => d.avoidFor?.includes(c)));
  const nonVegOffDay = s.dietPreference === "non-vegetarian"
    ? days.filter((d) => !prefs.nonVegDays.includes(weekdayOf(d.date)) && MEAL_TIMES.some((m) => d.meals[m].some((it) => !index[it.dishId].diet.eggetarian))).length : 0;

  const coreMeals = ["breakfast", "midMorning", "lunch", "eveningSnack", "dinner"] as const;
  const emptyMeals = days.reduce((n, d) => n + coreMeals.filter((m) => d.meals[m].length === 0).length, 0);
  console.log(`\n=== ${s.clientName} — target ${targets.kcal} kcal, P ${targets.protein} g, F ${targets.fat} g, C ${targets.carbs} g  (${ms} ms)`);
  console.log(`  avg/day: ${avg("kcal").toFixed(0)} kcal  P ${avg("protein").toFixed(1)}  F ${avg("fat").toFixed(1)}  C ${avg("carbs").toFixed(1)}  Fib ${avg("fibre").toFixed(1)}  Na ${avg("sodium").toFixed(0)} mg  Ca ${avg("calcium").toFixed(0)}  Fe ${avg("iron").toFixed(1)}`);
  console.log(`  energy ±5%: ${eOk}/28 days (worst ${(worst * 100).toFixed(1)}%)   protein ≥90%: ${pOk}/28   unique dishes: ${counts.size}   freq-cap violations: ${freqViol}   unsafe items: ${unsafe.length}   non-veg on off-days: ${nonVegOffDay}   EMPTY core meals: ${emptyMeals}`);
  // glycaemic quality: carbohydrate-carrying items that are insulin-friendly, high-GI items, est. GL/day
  const all = days.flatMap((d) => MEAL_TIMES.flatMap((m) => d.meals[m]));
  const carb = all.filter((it) => ["staple", "breakfast", "one-pot", "snack", "fruit"].includes(index[it.dishId].role));
  const irShare = carb.filter((it) => index[it.dishId].allTags.includes("ir-friendly")).length / Math.max(1, carb.length);
  const highGi = all.filter((it) => index[it.dishId].gi === "high").length;
  const glDay = all.reduce((a, it) => a + index[it.dishId].glPerUnit * it.units, 0) / days.length;
  console.log(`  glycaemic: insulin-friendly carb items ${(irShare * 100).toFixed(0)}%   high-GI items/month ${highGi}   est. GL/day ${glDay.toFixed(0)}`);
  if (verbose || s.clientName.startsWith("PCOS") || s.clientName.startsWith("Prediabetes")) {
    for (const d of days.slice(0, 2)) {
      const t = dayTotals(d, index);
      console.log(`  -- Day ${d.day + 1} (${WEEKDAYS[weekdayOf(d.date)]}) ${t.kcal.toFixed(0)} kcal / P ${t.protein.toFixed(0)} g`);
      for (const m of MEAL_TIMES) {
        if (!d.meals[m].length) continue;
        console.log(`     ${MEAL_TIME_LABELS[m].padEnd(14)} ${d.meals[m].map((it) => `${index[it.dishId].name} (${formatPortion(index[it.dishId], it.units)})`).join(" + ")}`);
      }
    }
  }
  if (s.clientName.startsWith("PCOS")) {
    const g = groceryList(days.slice(0, 7), index);
    console.log("  grocery wk1:", Object.entries(g).map(([c, l]) => `${c}: ${l.slice(0, 4).map((x) => `${x.name} ${x.display}`).join(", ")}`).join(" | ").slice(0, 600));
  }
}
