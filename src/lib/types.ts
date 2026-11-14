// ---------------------------------------------------------------------------
// Domain types shared across the calculation engine, UI, exports and AI layer.
// ---------------------------------------------------------------------------

export type Sex = "male" | "female";

export type ActivityLevel = "sedentary" | "light" | "moderate" | "heavy";

export type BmrMethod = "harris-benedict" | "mifflin" | "icmr";

export type IbwMethod = "broca" | "devine" | "bmi22";

// Diet type / clinical condition presets that drive macro split + guidance.
export type DietType =
  | "general"
  | "weight-loss"
  | "weight-gain"
  | "diabetes"
  | "insulin-resistance"
  | "pcos"
  | "hypothyroid"
  | "hypertension"
  | "renal"
  | "pregnancy"
  | "lactation"
  | "high-protein";

export type IncomeGroup = "low" | "middle" | "high";

export type DietPreference =
  | "vegetarian"
  | "non-vegetarian"
  | "eggetarian"
  | "vegan"
  | "jain";

/**
 * Blood-sugar (glycaemic) status. Recorded alongside the main condition so a
 * client can be, e.g., PCOS + insulin resistant, or weight-loss + prediabetic.
 */
export type GlycemicStatus = "none" | "insulin-resistance" | "prediabetes";

export const GLYCEMIC_STATUS_LABELS: Record<GlycemicStatus, string> = {
  none: "Normal / not tested",
  "insulin-resistance": "Insulin resistance",
  prediabetes: "Prediabetes",
};

/** Optional lab markers (all optional). */
export interface GlycemicLabs {
  hba1c?: number | null; // %
  fastingGlucose?: number | null; // mg/dL
  postprandialGlucose?: number | null; // mg/dL, 2-h
  fastingInsulin?: number | null; // µIU/mL
}

export const DIET_TYPE_LABELS: Record<DietType, string> = {
  general: "General / Balanced",
  "weight-loss": "Weight Loss",
  "weight-gain": "Weight Gain",
  diabetes: "Diabetes (Diabetic)",
  "insulin-resistance": "Insulin Resistance / Prediabetes",
  pcos: "PCOS",
  hypothyroid: "Hypothyroidism",
  hypertension: "Hypertension (DASH)",
  renal: "Renal / Kidney",
  pregnancy: "Pregnancy",
  lactation: "Lactation",
  "high-protein": "High Protein",
};

// The 11 food-exchange groups used in the comprehensive menu.
export type FoodGroup =
  | "CEREALS"
  | "PULSES"
  | "MILK"
  | "MEAT"
  | "VEG_A"
  | "VEG_B"
  | "VEG_C"
  | "FRUITS"
  | "SUGARS"
  | "FATS"
  | "NUTS";

export const FOOD_GROUP_LABELS: Record<FoodGroup, string> = {
  CEREALS: "Cereals",
  PULSES: "Pulses",
  MILK: "Milk",
  MEAT: "Egg, Meat & Fish",
  VEG_A: "Veg A (Green Leafy)",
  VEG_B: "Veg B (Other Veg)",
  VEG_C: "Veg C (Roots & Tubers)",
  FRUITS: "Fruits",
  SUGARS: "Sugars",
  FATS: "Fats & Oil",
  NUTS: "Nuts & Oilseed",
};

export const FOOD_GROUP_ORDER: FoodGroup[] = [
  "CEREALS",
  "PULSES",
  "MILK",
  "MEAT",
  "VEG_A",
  "VEG_B",
  "VEG_C",
  "FRUITS",
  "SUGARS",
  "FATS",
  "NUTS",
];

// Nutrient content of ONE exchange of a food group (per the exchange PDF).
export interface ExchangeUnit {
  energy: number; // kcal
  protein: number; // g
  fat: number; // g
  cho: number; // g
}

export const MEAL_TIMES = [
  "earlyMorning",
  "breakfast",
  "midMorning",
  "lunch",
  "eveningSnack",
  "dinner",
  "bedtime",
] as const;

export type MealTime = (typeof MEAL_TIMES)[number];

export const MEAL_TIME_LABELS: Record<MealTime, string> = {
  earlyMorning: "Early Morning",
  breakfast: "Breakfast",
  midMorning: "Mid Morning",
  lunch: "Lunch",
  eveningSnack: "Evening Snack",
  dinner: "Dinner",
  bedtime: "Bedtime",
};

// --- Inputs -----------------------------------------------------------------

export interface SubjectInfo {
  clientName: string;
  age: number;
  sex: Sex;
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
  incomeGroup: IncomeGroup;
  allergies: string;
  /** Primary condition (first of `conditions` by clinical priority). */
  dietType: DietType;
  /** Every condition / goal selected for the client (never empty). */
  conditions: DietType[];
  dietPreference: DietPreference;
  objective: string;
  /** Insulin resistance / prediabetes flag (applies on top of dietType). */
  glycemicStatus: GlycemicStatus;
  labs: GlycemicLabs;
}

export interface NutritionSettings {
  bmrMethod: BmrMethod;
  ibwMethod: IbwMethod;
  // Physical-activity increment as a fraction of BMR (e.g. 0.5 = +50%).
  activityFactor: number;
  // Specific Dynamic Action as a fraction of (BMR + PA). Usually 0.10.
  sdaFactor: number;
  // Protein grams per kg of reference body weight.
  proteinPerKg: number;
  // Which weight to base protein on: ideal or actual.
  proteinBasis: "ideal" | "actual";
  // Fat as a fraction of total energy.
  fatPercent: number;
  // Optional kcal added to / taken off TEE for the weight goal. null = automatic.
  goalAdjustment?: number | null;
  // Optional manual energy override (kcal). If set, replaces computed energy.
  energyOverride?: number | null;
}

// --- Results ----------------------------------------------------------------

export interface MacroResult {
  grams: number;
  kcal: number;
  percent: number;
}

export interface RdaComparisonRow {
  nutrient: "ENERGY" | "PROTEIN" | "FAT" | "CARBOHYDRATE";
  rda: number; // reference (recommended)
  mrda: number; // modified/planned for this subject
  difference: number; // mrda - rda
  unit: string;
}

export interface CalcResults {
  ibw: number; // kg
  bmi: number;
  bmiCategory: string;
  bmr: number; // kcal
  pa: number; // kcal from physical activity
  sda: number; // kcal thermic effect
  tee: number; // total energy expenditure = BMR + PA + SDA
  goalAdjustment: number; // +/- kcal applied for weight goal
  energy: number; // final target kcal (tee + goalAdjustment or override)
  /** How the target was set: formula, or typed in by the coach. */
  energySource?: "auto" | "manual";
  /** Set when the formula target was raised to the safe minimum (1200 F / 1500 M). */
  energyFloored?: boolean;
  weightStatus: number; // ibw - actual weight
  weightStatusLabel: string;
  referenceWeight: number; // weight used for protein
  protein: MacroResult;
  fat: MacroResult;
  cho: MacroResult;
  rdaComparison: RdaComparisonRow[];
  bmrMethodLabel: string;
  ibwMethodLabel: string;
}

// --- Menu plan --------------------------------------------------------------

export interface ComprehensiveRow {
  group: FoodGroup;
  exchanges: number;
  energy: number;
  protein: number;
  fat: number;
  cho: number;
}

export type DistributiveMenu = Record<FoodGroup, Record<MealTime, number>>;

export interface DescriptiveItem {
  id: string;
  mealTime: MealTime;
  recipe: string;
  ingredients: string;
  group: FoodGroup | "";
  exchanges: number;
  energy: number;
  protein: number;
  fat: number;
  cho: number;
}

export interface MenuPlan {
  comprehensive: ComprehensiveRow[];
  distributive: DistributiveMenu;
  descriptive: DescriptiveItem[];
  totals: { energy: number; protein: number; fat: number; cho: number };
}

// --- Analysis ---------------------------------------------------------------

export interface Analysis {
  dietaryGoals: string[];
  dos: string[];
  donts: string[];
  foodsToInclude: string[];
  foodsToExclude: string[];
  aiNarrative?: string;
  generatedBy: "builtin" | "claude";
}
