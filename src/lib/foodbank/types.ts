import type { DietType, FoodGroup, MealTime } from "../types";

// ---------------------------------------------------------------------------
// Ingredients (raw foods) — nutrient data per 100 g edible portion.
// ---------------------------------------------------------------------------

export type Allergen =
  | "gluten"
  | "dairy"
  | "egg"
  | "fish"
  | "shellfish"
  | "peanut"
  | "tree-nuts"
  | "soy"
  | "sesame";

export const ALLERGEN_LABELS: Record<Allergen, string> = {
  gluten: "Gluten / wheat",
  dairy: "Dairy / lactose",
  egg: "Egg",
  fish: "Fish",
  shellfish: "Shellfish",
  peanut: "Peanut",
  "tree-nuts": "Tree nuts",
  soy: "Soy",
  sesame: "Sesame",
};

export type AnimalSource = "dairy" | "egg" | "meat" | "fish" | "honey";

export type IngredientGroup = FoodGroup | "OTHER";

export interface Nutrients {
  kcal: number;
  protein: number; // g
  fat: number; // g
  carbs: number; // g, available carbohydrate (excludes fibre)
  fibre: number; // g
  calcium: number; // mg
  iron: number; // mg
  sodium: number; // mg
  potassium: number; // mg
  vitaminC: number; // mg
  folate: number; // µg
}

export const NUTRIENT_KEYS: (keyof Nutrients)[] = [
  "kcal",
  "protein",
  "fat",
  "carbs",
  "fibre",
  "calcium",
  "iron",
  "sodium",
  "potassium",
  "vitaminC",
  "folate",
];

export const NUTRIENT_META: Record<keyof Nutrients, { label: string; unit: string }> = {
  kcal: { label: "Energy", unit: "kcal" },
  protein: { label: "Protein", unit: "g" },
  fat: { label: "Fat", unit: "g" },
  carbs: { label: "Carbs", unit: "g" },
  fibre: { label: "Fibre", unit: "g" },
  calcium: { label: "Calcium", unit: "mg" },
  iron: { label: "Iron", unit: "mg" },
  sodium: { label: "Sodium", unit: "mg" },
  potassium: { label: "Potassium", unit: "mg" },
  vitaminC: { label: "Vitamin C", unit: "mg" },
  folate: { label: "Folate", unit: "µg" },
};

export interface Ingredient {
  key: string;
  name: string;
  group: IngredientGroup;
  source: string; // e.g. "IFCT 2017 A019"
  per100: Nutrients;
  category: string; // grocery-list category
  cost: 1 | 2 | 3; // 1 budget … 3 premium
  allergens?: Allergen[];
  animal?: AnimalSource;
  root?: boolean; // underground — excluded for Jain diets
  liquid?: boolean; // quantities shown in ml
  piece?: { grams: number; singular: string; plural: string };
}

// ---------------------------------------------------------------------------
// Dishes (recipes) — defined per ONE unit (1 roti, 1 katori, 1 idli …).
// ---------------------------------------------------------------------------

export type DishRole =
  | "breakfast" // complete breakfast item (poha, idli, paratha …)
  | "staple" // roti / rice / millet
  | "dal" // dal, legume curry, kadhi
  | "protein" // paneer / egg / meat / fish / soya / tofu
  | "sabzi" // vegetable dish
  | "one-pot" // khichdi, biryani, curd rice … (fills several roles)
  | "salad"
  | "raita" // curd / raita
  | "soup"
  | "snack"
  | "beverage"
  | "fruit"
  | "nuts"
  | "sweet"
  | "side"; // chutney, pickle, papad

export const ROLE_LABELS: Record<DishRole, string> = {
  breakfast: "Breakfast",
  staple: "Roti / Rice",
  dal: "Dal & Legumes",
  protein: "Protein dish",
  sabzi: "Sabzi",
  "one-pot": "One-pot meal",
  salad: "Salad",
  raita: "Curd / Raita",
  soup: "Soup",
  snack: "Snack",
  beverage: "Beverage",
  fruit: "Fruit",
  nuts: "Nuts & Seeds",
  sweet: "Sweet",
  side: "Chutney / Side",
};

export type Cuisine =
  | "north"
  | "south"
  | "west"
  | "east"
  | "pan-indian"
  | "continental"
  | "fusion"
  | "indo-chinese"
  | "middle-eastern";

export const CUISINE_LABELS: Record<Cuisine, string> = {
  north: "North Indian",
  south: "South Indian",
  west: "Gujarati / Maharashtrian / Rajasthani",
  east: "Bengali / Odia / Bihari",
  "pan-indian": "Pan-Indian",
  continental: "Continental",
  fusion: "Indo-Western Fusion",
  "indo-chinese": "Indo-Chinese",
  "middle-eastern": "Middle Eastern",
};

/** Short labels for chips. */
export const CUISINE_SHORT: Record<Cuisine, string> = {
  north: "North",
  south: "South",
  west: "West",
  east: "East",
  "pan-indian": "Pan-Indian",
  continental: "Continental",
  fusion: "Fusion",
  "indo-chinese": "Indo-Chinese",
  "middle-eastern": "Middle East",
};

export type DishTag =
  // style
  | "traditional"
  | "modern"
  | "fusion"
  | "comfort"
  | "festive"
  | "kid-friendly"
  // method
  | "quick"
  | "no-cook"
  | "steamed"
  | "baked"
  | "grilled"
  | "fried"
  | "roasted"
  | "fermented"
  // nutrition (some are auto-derived)
  | "millet"
  | "high-protein"
  | "high-fibre"
  | "low-cal"
  | "iron-rich"
  | "calcium-rich"
  | "probiotic"
  | "omega-3"
  | "low-gi" // auto: low glycaemic index and a meaningful carbohydrate load
  | "ir-friendly" // auto: suits insulin resistance / prediabetes (see bank.ts)
  // context
  | "light"
  | "heavy"
  | "fasting"
  | "budget"
  | "winter"
  | "summer"
  | "monsoon";

export type GI = "low" | "medium" | "high";

/** Representative GI value per category, used to estimate glycaemic load. */
export const GI_VALUE: Record<GI, number> = { low: 45, medium: 62, high: 80 };

/** Readable labels for tags shown on chips. */
export const TAG_LABELS: Partial<Record<DishTag, string>> = {
  "low-gi": "Low GI",
  "ir-friendly": "Insulin-friendly",
  "high-protein": "High protein",
  "high-fibre": "High fibre",
  "low-cal": "Low calorie",
  "iron-rich": "Iron-rich",
  "calcium-rich": "Calcium-rich",
  "omega-3": "Omega-3",
  "kid-friendly": "Kid-friendly",
  "no-cook": "No-cook",
};

export const tagLabel = (t: DishTag): string => TAG_LABELS[t] ?? t.replace(/-/g, " ");

/** Glycaemic-load band for one portion (standard cut-offs). */
export const glBand = (gl: number): "low" | "medium" | "high" => (gl <= 10 ? "low" : gl < 20 ? "medium" : "high");

/** How often a dish may appear — controls indulgence & variety. */
export type Frequency = "daily" | "regular" | "weekly" | "occasional";

export interface DishUnit {
  label: string; // "roti", "katori", "plate"
  plural: string;
  default: number;
  step: number;
  min: number;
  max: number;
  note?: string; // "≈150 g cooked"
}

export interface DishDef {
  id: string;
  name: string;
  local?: string; // regional name
  cuisine: Cuisine;
  region?: string;
  role: DishRole;
  /** Extra roles a one-pot / combo dish satisfies in a meal. */
  fills?: DishRole[];
  slots: MealTime[];
  unit: DishUnit;
  /** grams (ml for liquids) of each ingredient per ONE unit */
  ingredients: Record<string, number>;
  tags?: DishTag[];
  gi?: GI;
  freq?: Frequency;
  avoidFor?: DietType[];
  goodFor?: DietType[];
  /** dishes automatically served alongside (idli → sambar, chutney) */
  companions?: string[];
  stapleKind?: "rice" | "roti";
  staplePref?: "rice" | "roti";
  method?: string;
  prepMins?: number;
}

export type DietFlag = "veg" | "egg" | "nonveg" | "vegan" | "jain";

/** A dish with all derived data computed. */
export interface Dish extends DishDef {
  perUnit: Nutrients;
  exchanges: Partial<Record<FoodGroup, number>>;
  allergens: Allergen[];
  diet: {
    vegetarian: boolean; // no egg, meat, fish
    eggetarian: boolean; // no meat / fish
    vegan: boolean;
    jain: boolean;
  };
  autoTags: DishTag[];
  allTags: DishTag[];
  /** Estimated glycaemic load of ONE unit (GI category × available carbs). */
  glPerUnit: number;
  cost: 1 | 2 | 3;
  custom?: boolean;
  ownerId?: string | null;
}

/** A coach-created dish stored in the database. */
export interface CustomDishData extends Omit<DishDef, "id"> {
  /** If set, nutrients per unit are entered manually instead of computed. */
  manualPerUnit?: Partial<Nutrients> | null;
}
