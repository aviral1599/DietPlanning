// Reference tables from "Nutritive Value of Indian Foods" (NIN-ICMR, 1989 ed., 1993 reprint).
// REFERENCE ONLY — the app plans with the clinic's 11-group Food Exchange List
// (src/lib/exchange-data.ts) and ICMR-NIN 2020 RDAs (src/lib/nutrition.ts).
// See docs/nutrient-sources.md for how these compare.

/** Book Table-2 (p. 41): "The Food Exchange System" — six exchange lists. 1 cup = 200 ml. */
export const NVIF_EXCHANGE_LISTS = [
  { list: "Vegetable — green leafy", serving: "½ cup", carbs: "6", protein: "nil", fat: "invisible", kcal: "30–40" },
  { list: "Vegetable — other", serving: "½ cup", carbs: "6–10", protein: "nil", fat: "nil", kcal: "50–60" },
  { list: "Fruit", serving: "varies", carbs: "10", protein: "nil", fat: "nil", kcal: "40" },
  { list: "Cereal", serving: "25 g raw", carbs: "19–21", protein: "2–3", fat: "invisible", kcal: "85" },
  { list: "Legumes & pulses", serving: "25 g raw", carbs: "15", protein: "6", fat: "invisible", kcal: "85" },
  { list: "Milk", serving: "½ cup", carbs: "4", protein: "3.5", fat: "4.0", kcal: "65" },
  // Printed as "75" in the serving column; 7.5 g protein for 75 g meat is low, so treat with care.
  { list: "Meat", serving: "75 (as printed)", carbs: "nil", protein: "7.5", fat: "6.0", kcal: "85" },
  { list: "Fat (visible)", serving: "10 g", carbs: "nil", protein: "nil", fat: "10.0", kcal: "90" },
  { list: "Sugars", serving: "10 g", carbs: "10", protein: "nil", fat: "nil", kcal: "40" },
] as const;

/** Book Appendix-I (p. 94): Recommended Dietary Allowances for Indians, ICMR 1988/89 (adults). */
export const NVIF_RDA_1989 = {
  referenceBodyWeightKg: { man: 60, woman: 50 },
  man: {
    energyKcal: { sedentary: 2425, moderate: 2875, heavy: 3800 },
    proteinG: 60, visibleFatG: 20, calciumMg: 400, ironMg: 28,
    retinolUg: 600, betaCaroteneUg: 2400,
    thiamineMg: { sedentary: 1.2, moderate: 1.4, heavy: 1.6 },
    riboflavinMg: { sedentary: 1.4, moderate: 1.6, heavy: 1.9 },
    niacinMg: { sedentary: 16, moderate: 18, heavy: 21 },
    pyridoxineMg: 2.0, vitaminCMg: 40, folicAcidUg: 100, vitaminB12Ug: 1,
  },
  woman: {
    energyKcal: { sedentary: 1875, moderate: 2225, heavy: 2925 },
    proteinG: 50, visibleFatG: 20, calciumMg: 400, ironMg: 30,
    retinolUg: 600, betaCaroteneUg: 2400,
    thiamineMg: { sedentary: 0.9, moderate: 1.1, heavy: 1.2 },
    riboflavinMg: { sedentary: 1.1, moderate: 1.3, heavy: 1.5 },
    niacinMg: { sedentary: 12, moderate: 14, heavy: 16 },
    pyridoxineMg: 2.0, vitaminCMg: 40, folicAcidUg: 100, vitaminB12Ug: 1,
  },
  pregnancy: { extraEnergyKcal: 300, extraProteinG: 15, fatG: 30, calciumMg: 1000, ironMg: 38, folicAcidUg: 400, pyridoxineMg: 2.5 },
  lactation0to6m: { extraEnergyKcal: 550, extraProteinG: 25, fatG: 45, calciumMg: 1000, ironMg: 30, retinolUg: 950, vitaminCMg: 80, folicAcidUg: 150 },
  lactation6to12m: { extraEnergyKcal: 400, extraProteinG: 18 },
  /** Desirable daily intakes of trace elements for an adult (p. 92). */
  traceElementsAdult: { chromiumUg: 65, copperMg: 2.2, manganeseMg: 5.5, zincMg: 15.5, molybdenumUg: 500 },
} as const;
