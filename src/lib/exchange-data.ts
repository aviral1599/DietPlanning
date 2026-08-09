import type { ExchangeUnit, FoodGroup } from "./types";

// ---------------------------------------------------------------------------
// Canonical nutrient content of ONE exchange of each food group.
// Derived from the group headers of the Food Exchange List. Energy is computed
// with the Atwater factors (P*4 + C*4 + F*9) so the whole plan reconciles
// internally regardless of source rounding.
// ---------------------------------------------------------------------------
export const EXCHANGE_UNITS: Record<FoodGroup, ExchangeUnit> = {
  CEREALS: mk(2, 0.5, 15),
  PULSES: mk(7, 0.5, 17),
  MILK: mk(8, 5, 12), // toned-milk basis (clinical default)
  MEAT: mk(7, 5, 0), // medium-fat meat exchange
  VEG_A: mk(3, 0.4, 2.5), // green leafy vegetables
  VEG_B: mk(2, 0.2, 3.5), // other vegetables
  VEG_C: mk(1.5, 0.1, 10), // roots & tubers
  FRUITS: mk(1, 0.2, 10),
  SUGARS: mk(0, 0, 5),
  FATS: mk(0, 5, 0),
  NUTS: mk(2, 5, 2),
};

function mk(protein: number, fat: number, cho: number): ExchangeUnit {
  return {
    protein,
    fat,
    cho,
    energy: Math.round(protein * 4 + cho * 4 + fat * 9),
  };
}

export interface FoodItem {
  group: FoodGroup;
  subgroup?: string;
  name: string;
  amountG: number; // grams for one exchange
  protein: number;
  fat: number;
  cho: number;
  energy: number;
  note?: string;
}

// ---------------------------------------------------------------------------
// Full food item database transcribed from the Food Exchange List PDF.
// Values are per ONE exchange of that food.
// ---------------------------------------------------------------------------
export const FOOD_ITEMS: FoodItem[] = [
  // ---- MILK -------------------------------------------------------------
  { group: "MILK", subgroup: "Whole", name: "Milk, whole, buffalo", amountG: 217, protein: 8, fat: 14.3, cho: 18.2, energy: 233 },
  { group: "MILK", subgroup: "Whole", name: "Milk, whole, cow", amountG: 245, protein: 8, fat: 11, cho: 12.1, energy: 179 },
  { group: "MILK", subgroup: "Whole", name: "Full cream milk", amountG: 250, protein: 8, fat: 15, cho: 12, energy: 218 },
  { group: "MILK", subgroup: "Toned", name: "Toned milk", amountG: 250, protein: 8, fat: 7.5, cho: 11, energy: 152 },
  { group: "MILK", subgroup: "Toned", name: "Double toned milk", amountG: 250, protein: 8, fat: 3.8, cho: 11, energy: 116 },
  { group: "MILK", subgroup: "Skim", name: "Skim milk, liquid", amountG: 320, protein: 8, fat: 0, cho: 14.7, energy: 93, note: "Add 2 fat exchanges (no fat)" },
  { group: "MILK", subgroup: "Skim", name: "Skim milk powder", amountG: 21, protein: 8, fat: 0, cho: 10.7, energy: 75, note: "Add 2 fat exchanges (no fat)" },
  { group: "MILK", subgroup: "Powder", name: "Whole milk powder", amountG: 31, protein: 8, fat: 8, cho: 11.8, energy: 157 },
  { group: "MILK", subgroup: "Product", name: "Paneer", amountG: 42, protein: 8, fat: 6.3, cho: 5.2, energy: 108 },
  { group: "MILK", subgroup: "Product", name: "Khoa", amountG: 49, protein: 8, fat: 10.1, cho: 8.1, energy: 155 },
  { group: "MILK", subgroup: "Product", name: "Cheese", amountG: 33, protein: 8, fat: 8.3, cho: 2.1, energy: 117 },
  { group: "MILK", subgroup: "Product", name: "Curds", amountG: 258, protein: 8, fat: 10.3, cho: 7.7, energy: 158 },

  // ---- MEAT / EGG / FISH -------------------------------------------------
  { group: "MEAT", subgroup: "Medium fat", name: "Egg, poultry, whole raw", amountG: 53, protein: 7, fat: 4.8, cho: 0, energy: 71 },
  { group: "MEAT", subgroup: "High fat", name: "Egg, poultry, yolk raw", amountG: 45, protein: 7, fat: 11.8, cho: 0, energy: 134 },
  { group: "MEAT", subgroup: "Medium fat", name: "Hilsa", amountG: 32, protein: 7, fat: 5.9, cho: 0, energy: 83 },
  { group: "MEAT", subgroup: "Medium fat", name: "Chicken, thigh skinless", amountG: 39, protein: 7, fat: 5.5, cho: 0, energy: 78 },
  { group: "MEAT", subgroup: "Lean", name: "Chicken, breast skinless", amountG: 32, protein: 7, fat: 2.9, cho: 0, energy: 54 },
  { group: "MEAT", subgroup: "Medium fat", name: "Chicken, wings skinless", amountG: 40, protein: 7, fat: 5.5, cho: 0, energy: 77 },
  { group: "MEAT", subgroup: "Lean", name: "Goat chops", amountG: 34, protein: 7, fat: 2, cho: 0, energy: 46 },
  { group: "MEAT", subgroup: "Lean", name: "Goat legs", amountG: 31, protein: 7, fat: 2.5, cho: 0, energy: 49 },
  { group: "MEAT", subgroup: "Medium fat", name: "Goat brain", amountG: 51, protein: 7, fat: 4.1, cho: 0, energy: 65 },
  { group: "MEAT", subgroup: "Lean", name: "Sardines", amountG: 39, protein: 7, fat: 3.5, cho: 0, energy: 59 },
  { group: "MEAT", subgroup: "Lean", name: "Paneer (meat exch.)", amountG: 37, protein: 7, fat: 3.5, cho: 0, energy: 95 },
  { group: "MEAT", subgroup: "Very lean", name: "Egg, poultry, white raw", amountG: 65, protein: 7, fat: 0.4, cho: 0, energy: 29 },
  { group: "MEAT", subgroup: "Very lean", name: "Chicken, liver", amountG: 33, protein: 7, fat: 1.3, cho: 0, energy: 41 },
  { group: "MEAT", subgroup: "Very lean", name: "Goat kidney", amountG: 45, protein: 7, fat: 1.3, cho: 0, energy: 40 },
  { group: "MEAT", subgroup: "Very lean", name: "Goat liver", amountG: 34, protein: 7, fat: 1.7, cho: 0, energy: 43 },
  { group: "MEAT", subgroup: "Very lean", name: "Sheep liver", amountG: 31, protein: 7, fat: 1.5, cho: 0, energy: 41 },
  { group: "MEAT", subgroup: "Very lean", name: "Katla (fish)", amountG: 39, protein: 7, fat: 0.8, cho: 0, energy: 37 },
  { group: "MEAT", subgroup: "Very lean", name: "Pomfret, white", amountG: 37, protein: 7, fat: 1.9, cho: 0, energy: 45 },
  { group: "MEAT", subgroup: "Very lean", name: "Prawn, big", amountG: 36, protein: 7, fat: 0.2, cho: 0, energy: 33 },
  { group: "MEAT", subgroup: "Very lean", name: "Prawn, small", amountG: 54, protein: 7, fat: 0.4, cho: 0, energy: 38 },
  { group: "MEAT", subgroup: "Very lean", name: "Rohu (fish)", amountG: 36, protein: 7, fat: 0.8, cho: 0, energy: 37 },
  { group: "MEAT", subgroup: "Very lean", name: "Crab", amountG: 68, protein: 7, fat: 1, cho: 0, energy: 56 },
  { group: "MEAT", subgroup: "Very lean", name: "Crab, sea", amountG: 46, protein: 7, fat: 0.3, cho: 0, energy: 31 },

  // ---- PULSES & LEGUMES --------------------------------------------------
  { group: "PULSES", name: "Bengal gram dal", amountG: 32, protein: 7, fat: 1.7, cho: 14.9, energy: 105 },
  { group: "PULSES", name: "Bengal gram whole", amountG: 37, protein: 7, fat: 1.9, cho: 14.7, energy: 106 },
  { group: "PULSES", name: "Black gram dal", amountG: 30, protein: 7, fat: 0.5, cho: 15.3, energy: 97 },
  { group: "PULSES", name: "Cow pea, brown", amountG: 34, protein: 7, fat: 0.4, cho: 18.6, energy: 109 },
  { group: "PULSES", name: "Cow pea, white", amountG: 33, protein: 7, fat: 0.4, cho: 17.7, energy: 106 },
  { group: "PULSES", name: "Green gram dal", amountG: 29, protein: 7, fat: 0.4, cho: 15.3, energy: 94 },
  { group: "PULSES", name: "Green gram whole", amountG: 31, protein: 7, fat: 0.4, cho: 14.3, energy: 91 },
  { group: "PULSES", name: "Horse gram, whole", amountG: 32, protein: 7, fat: 0.2, cho: 18.4, energy: 105 },
  { group: "PULSES", name: "Lentil dal", amountG: 29, protein: 7, fat: 0.2, cho: 15.2, energy: 93 },
  { group: "PULSES", name: "Lentil whole, brown", amountG: 31, protein: 7, fat: 0.2, cho: 15, energy: 93 },
  { group: "PULSES", name: "Moth beans", amountG: 35, protein: 7, fat: 0.6, cho: 18.2, energy: 108 },
  { group: "PULSES", name: "Peas, dry", amountG: 34, protein: 7, fat: 0.6, cho: 16.8, energy: 103 },
  { group: "PULSES", name: "Rajmah, black", amountG: 37, protein: 7, fat: 0.6, cho: 18.3, energy: 110 },
  { group: "PULSES", name: "Rajmah, brown", amountG: 36, protein: 7, fat: 0.6, cho: 17.6, energy: 107 },
  { group: "PULSES", name: "Rajmah, red", amountG: 35, protein: 7, fat: 0.6, cho: 17, energy: 105 },
  { group: "PULSES", name: "Red gram dal", amountG: 33, protein: 7, fat: 0.5, cho: 18.2, energy: 109 },
  { group: "PULSES", name: "Red gram, whole", amountG: 34, protein: 7, fat: 0.5, cho: 14.4, energy: 93 },
  { group: "PULSES", name: "Ricebean", amountG: 35, protein: 7, fat: 0.2, cho: 17.9, energy: 106 },
  { group: "PULSES", name: "Soyabean, brown", amountG: 20, protein: 7, fat: 4, cho: 2.5, energy: 76 },
  { group: "PULSES", name: "Soyabean, white", amountG: 19, protein: 7, fat: 3.7, cho: 1.9, energy: 72 },
  { group: "PULSES", name: "Bean, dry", amountG: 35, protein: 7, fat: 0.4, cho: 20, energy: 105 },
  { group: "PULSES", name: "Nutrinuggets (soya)", amountG: 14, protein: 7, fat: 0.1, cho: 4.2, energy: 48 },

  // ---- VEG A : GREEN LEAFY ----------------------------------------------
  { group: "VEG_A", name: "Amaranth, tender green", amountG: 110, protein: 3.6, fat: 1.5, cho: 2.5, energy: 34 },
  { group: "VEG_A", name: "Bathua leaves", amountG: 98, protein: 2.5, fat: 0.4, cho: 2.5, energy: 27 },
  { group: "VEG_A", name: "Cabbage, green", amountG: 77, protein: 1.1, fat: 0.1, cho: 2.5, energy: 17 },
  { group: "VEG_A", name: "Cauliflower leaves", amountG: 74, protein: 2.9, fat: 0.3, cho: 2.5, energy: 26 },
  { group: "VEG_A", name: "Colocasia leaves", amountG: 68, protein: 2.3, fat: 0.9, cho: 2.5, energy: 30 },
  { group: "VEG_A", name: "Coriander leaves", amountG: 130, protein: 4.6, fat: 0.9, cho: 2.5, energy: 40 },
  { group: "VEG_A", name: "Curry leaves", amountG: 55, protein: 4.1, fat: 0.6, cho: 2.5, energy: 35 },
  { group: "VEG_A", name: "Drumstick leaves", amountG: 45, protein: 2.9, fat: 0.7, cho: 2.5, energy: 30 },
  { group: "VEG_A", name: "Fenugreek leaves (methi)", amountG: 115, protein: 4.2, fat: 1, cho: 2.5, energy: 40 },
  { group: "VEG_A", name: "Lettuce", amountG: 83, protein: 1.2, fat: 0.2, cho: 2.5, energy: 18 },
  { group: "VEG_A", name: "Mint leaves (pudina)", amountG: 105, protein: 4.9, fat: 0.7, cho: 2.5, energy: 39 },
  { group: "VEG_A", name: "Mustard leaves (sarson)", amountG: 104, protein: 3.7, fat: 0.5, cho: 2.5, energy: 31 },
  { group: "VEG_A", name: "Radish leaves", amountG: 90, protein: 2, fat: 0.5, cho: 2.5, energy: 23 },
  { group: "VEG_A", name: "Spinach (palak)", amountG: 122, protein: 2.6, fat: 0.8, cho: 2.5, energy: 30 },

  // ---- VEG B : OTHER VEGETABLES -----------------------------------------
  { group: "VEG_B", name: "Beans, sem", amountG: 68, protein: 1.94, fat: 0.7, cho: 3.5, energy: 29 },
  { group: "VEG_B", name: "Bitter gourd (karela)", amountG: 124, protein: 1.8, fat: 0.3, cho: 3.5, energy: 26 },
  { group: "VEG_B", name: "Bottle gourd (lauki)", amountG: 208, protein: 1.1, fat: 0.3, cho: 3.5, energy: 23 },
  { group: "VEG_B", name: "Brinjal (baingan)", amountG: 100, protein: 1.5, fat: 0.3, cho: 3.5, energy: 25 },
  { group: "VEG_B", name: "Broad beans, bakla", amountG: 166, protein: 6.4, fat: 0.2, cho: 3.5, energy: 49 },
  { group: "VEG_B", name: "Capsicum, green", amountG: 190, protein: 2.1, fat: 0.6, cho: 3.5, energy: 31 },
  { group: "VEG_B", name: "Capsicum, red", amountG: 164, protein: 2.4, fat: 0.8, cho: 3.5, energy: 33 },
  { group: "VEG_B", name: "Capsicum, yellow", amountG: 180, protein: 2.4, fat: 0.7, cho: 3.5, energy: 34 },
  { group: "VEG_B", name: "Cauliflower", amountG: 172, protein: 3.7, fat: 0.8, cho: 3.5, energy: 39 },
  { group: "VEG_B", name: "Cucumber, green", amountG: 100, protein: 0.7, fat: 0.2, cho: 3.5, energy: 20 },
  { group: "VEG_B", name: "Cucumber, green short", amountG: 124, protein: 1, fat: 0.2, cho: 3.5, energy: 22 },
  { group: "VEG_B", name: "Drumstick", amountG: 93, protein: 2.4, fat: 0.2, cho: 3.5, energy: 27 },
  { group: "VEG_B", name: "French beans", amountG: 131, protein: 3.3, fat: 0.3, cho: 3.5, energy: 32 },
  { group: "VEG_B", name: "Jackfruit, raw", amountG: 101, protein: 2, fat: 0.4, cho: 3.5, energy: 27 },
  { group: "VEG_B", name: "Knolkhol", amountG: 252, protein: 4, fat: 0.9, cho: 3.5, energy: 40 },
  { group: "VEG_B", name: "Ladies finger (bhindi)", amountG: 97, protein: 2, fat: 0.2, cho: 3.5, energy: 27 },
  { group: "VEG_B", name: "Mushroom", amountG: 177, protein: 6.5, fat: 0.7, cho: 3.5, energy: 49 },
  { group: "VEG_B", name: "Parwar (pointed gourd)", amountG: 99, protein: 1.4, fat: 0.3, cho: 3.5, energy: 24 },
  { group: "VEG_B", name: "Peas, fresh", amountG: 29, protein: 2.1, fat: 0, cho: 3.5, energy: 24 },
  { group: "VEG_B", name: "Pumpkin, green cylindrical", amountG: 83, protein: 0.7, fat: 0.1, cho: 3.5, energy: 21 },
  { group: "VEG_B", name: "Pumpkin, orange round", amountG: 88, protein: 0.7, fat: 0.1, cho: 3.5, energy: 20 },
  { group: "VEG_B", name: "Ridge gourd (torai)", amountG: 156, protein: 1.5, fat: 0.2, cho: 3.5, energy: 24 },
  { group: "VEG_B", name: "Snake gourd (chichinda)", amountG: 285, protein: 2.5, fat: 0.7, cho: 3.5, energy: 34 },
  { group: "VEG_B", name: "Tinda", amountG: 184, protein: 2, fat: 0.3, cho: 3.5, energy: 26 },
  { group: "VEG_B", name: "Tomato, ripe", amountG: 129, protein: 1.2, fat: 0.6, cho: 3.5, energy: 25 },
  { group: "VEG_B", name: "Broccoli", amountG: 77, protein: 1.8, fat: 0, cho: 3.5, energy: 21 },

  // ---- VEG C : ROOTS & TUBERS -------------------------------------------
  { group: "VEG_C", name: "Beetroot", amountG: 162, protein: 3.2, fat: 0.2, cho: 10, energy: 58 },
  { group: "VEG_C", name: "Carrot, orange", amountG: 180, protein: 1.7, fat: 0.8, cho: 10, energy: 60 },
  { group: "VEG_C", name: "Carrot, red", amountG: 149, protein: 1.5, fat: 0.7, cho: 10, energy: 57 },
  { group: "VEG_C", name: "Colocasia", amountG: 56, protein: 1.9, fat: 0.1, cho: 10, energy: 50 },
  { group: "VEG_C", name: "Lotus root", amountG: 68, protein: 1.3, fat: 0.6, cho: 10, energy: 54 },
  { group: "VEG_C", name: "Onion, big", amountG: 105, protein: 1.6, fat: 0.3, cho: 10, energy: 50 },
  { group: "VEG_C", name: "Onion, small", amountG: 86, protein: 1.6, fat: 0.1, cho: 10, energy: 49 },
  { group: "VEG_C", name: "Potato, brown skin big", amountG: 67, protein: 1, fat: 0.2, cho: 10, energy: 47 },
  { group: "VEG_C", name: "Potato, brown skin small", amountG: 78, protein: 1.1, fat: 0.2, cho: 10, energy: 48 },
  { group: "VEG_C", name: "Potato, red skin", amountG: 65, protein: 1.2, fat: 0.1, cho: 10, energy: 48 },
  { group: "VEG_C", name: "Sweet potato, pink skin", amountG: 42, protein: 0.5, fat: 0.1, cho: 10, energy: 45 },
  { group: "VEG_C", name: "Tapioca", amountG: 56, protein: 0.6, fat: 0.1, cho: 10, energy: 45 },
  { group: "VEG_C", name: "Water chestnut (singhara)", amountG: 47, protein: 0.4, fat: 0.2, cho: 10, energy: 45 },
  { group: "VEG_C", name: "Yam, ordinary", amountG: 57, protein: 1.2, fat: 0.1, cho: 10, energy: 48 },
  { group: "VEG_C", name: "Yam, elephant", amountG: 57, protein: 1.5, fat: 0.1, cho: 10, energy: 48 },
  { group: "VEG_C", name: "Turnip", amountG: 161, protein: 0.9, fat: 0.3, cho: 10, energy: 47 },
  { group: "VEG_C", name: "Radish, round red skin", amountG: 165, protein: 1.5, fat: 0.3, cho: 10, energy: 51 },
  { group: "VEG_C", name: "Radish, round white skin", amountG: 163, protein: 1.3, fat: 0.2, cho: 10, energy: 50 },

  // ---- FRUITS ------------------------------------------------------------
  { group: "FRUITS", name: "Amla", amountG: 228, protein: 0.8, fat: 0.4, cho: 10, energy: 54 },
  { group: "FRUITS", name: "Apple, big", amountG: 76, protein: 0.2, fat: 0.5, cho: 10, energy: 47 },
  { group: "FRUITS", name: "Apricot, dried", amountG: 14, protein: 0.4, fat: 0.1, cho: 10, energy: 44 },
  { group: "FRUITS", name: "Apricot, processed", amountG: 91, protein: 1.3, fat: 0.6, cho: 10, energy: 51 },
  { group: "FRUITS", name: "Banana, ripe robusta", amountG: 42, protein: 0.5, fat: 0.1, cho: 10, energy: 44 },
  { group: "FRUITS", name: "Cherries, red", amountG: 84, protein: 1.3, fat: 0.4, cho: 10, energy: 50 },
  { group: "FRUITS", name: "Dates, processed", amountG: 15, protein: 0.2, fat: 0.1, cho: 10, energy: 43 },
  { group: "FRUITS", name: "Dates, dry pale brown", amountG: 13, protein: 0.3, fat: 0, cho: 10, energy: 42 },
  { group: "FRUITS", name: "Grapes, seedless green", amountG: 85, protein: 0.5, fat: 0.2, cho: 10, energy: 45 },
  { group: "FRUITS", name: "Grapes, seedless black", amountG: 50, protein: 0.6, fat: 0.2, cho: 10, energy: 45 },
  { group: "FRUITS", name: "Guava, white flesh", amountG: 195, protein: 2.8, fat: 0.6, cho: 10, energy: 63 },
  { group: "FRUITS", name: "Guava, pink flesh", amountG: 109, protein: 1.3, fat: 0.3, cho: 10, energy: 51 },
  { group: "FRUITS", name: "Litchi", amountG: 88, protein: 0.9, fat: 0.2, cho: 10, energy: 47 },
  { group: "FRUITS", name: "Lime, sweet pulp (mosambi)", amountG: 193, protein: 1.5, fat: 0.4, cho: 10, energy: 53 },
  { group: "FRUITS", name: "Mango, ripe (totapari)", amountG: 78, protein: 0.3, fat: 0.4, cho: 10, energy: 46 },
  { group: "FRUITS", name: "Mango, ripe (paheri)", amountG: 115, protein: 0.8, fat: 0.7, cho: 10, energy: 52 },
  { group: "FRUITS", name: "Melon, musk orange flesh", amountG: 236, protein: 1, fat: 0.8, cho: 10, energy: 55 },
  { group: "FRUITS", name: "Orange, pulp", amountG: 126, protein: 0.9, fat: 0.2, cho: 10, energy: 47 },
  { group: "FRUITS", name: "Papaya", amountG: 217, protein: 0.9, fat: 0.3, cho: 10, energy: 52 },
  { group: "FRUITS", name: "Pear", amountG: 124, protein: 0.4, fat: 0.3, cho: 10, energy: 47 },
  { group: "FRUITS", name: "Peach", amountG: 128, protein: 1.1, fat: 0.5, cho: 10, energy: 51 },
  { group: "FRUITS", name: "Pineapple", amountG: 106, protein: 0.6, fat: 0.2, cho: 10, energy: 46 },
  { group: "FRUITS", name: "Plums", amountG: 83, protein: 0.5, fat: 0.3, cho: 10, energy: 47 },
  { group: "FRUITS", name: "Pomegranate", amountG: 86, protein: 1.1, fat: 0.1, cho: 10, energy: 47 },
  { group: "FRUITS", name: "Sapota (chikoo)", amountG: 72, protein: 0.7, fat: 0.9, cho: 10, energy: 53 },
  { group: "FRUITS", name: "Strawberry", amountG: 294, protein: 2.9, fat: 1.6, cho: 10, energy: 72 },
  { group: "FRUITS", name: "Watermelon, pale green", amountG: 331, protein: 2, fat: 0.5, cho: 10, energy: 55 },
  { group: "FRUITS", name: "Grapefruit", amountG: 143, protein: 1.4, fat: 0.1, cho: 10, energy: 46 },
  { group: "FRUITS", name: "Raisins, dried golden", amountG: 15, protein: 0.4, fat: 0.1, cho: 10, energy: 44 },

  // ---- CEREALS / STARCH --------------------------------------------------
  { group: "CEREALS", name: "Bajra", amountG: 24, protein: 2.6, fat: 1.3, cho: 15, energy: 84 },
  { group: "CEREALS", name: "Barley", amountG: 24, protein: 2.6, fat: 0.3, cho: 15, energy: 76 },
  { group: "CEREALS", name: "Jowar", amountG: 22, protein: 2.2, fat: 0.4, cho: 15, energy: 74 },
  { group: "CEREALS", name: "Maize, dry", amountG: 23, protein: 2, fat: 0.9, cho: 15, energy: 77 },
  { group: "CEREALS", name: "Ragi", amountG: 22, protein: 1.6, fat: 0.4, cho: 15, energy: 71 },
  { group: "CEREALS", name: "Rice (raw milled)", amountG: 19, protein: 1.5, fat: 0.1, cho: 15, energy: 68 },
  { group: "CEREALS", name: "Rice flakes (poha)", amountG: 20, protein: 1.5, fat: 0.2, cho: 15, energy: 71 },
  { group: "CEREALS", name: "Rice puffed (murmura)", amountG: 19, protein: 1.4, fat: 0.3, cho: 15, energy: 69 },
  { group: "CEREALS", name: "Semolina (suji)", amountG: 22, protein: 2.5, fat: 0.2, cho: 15, energy: 73 },
  { group: "CEREALS", name: "Vermicelli", amountG: 21, protein: 2, fat: 0.9, cho: 15, energy: 70 },
  { group: "CEREALS", name: "Wheat flour (atta)", amountG: 23, protein: 2.4, fat: 0.4, cho: 15, energy: 74 },
  { group: "CEREALS", name: "Wheat flour, refined (maida)", amountG: 20, protein: 2.1, fat: 0.2, cho: 15, energy: 70 },
  { group: "CEREALS", name: "Oatmeal", amountG: 24, protein: 3.3, fat: 0, cho: 15, energy: 90 },
  { group: "CEREALS", name: "Cornflakes", amountG: 18, protein: 1.4, fat: 0, cho: 15, energy: 72 },
  { group: "CEREALS", name: "Bread, brown", amountG: 31, protein: 2.7, fat: 0, cho: 15, energy: 76 },
  { group: "CEREALS", name: "Bread, white", amountG: 29, protein: 2.3, fat: 0, cho: 15, energy: 69 },
  { group: "CEREALS", name: "Pasta / noodle / macaroni", amountG: 20, protein: 2.3, fat: 0, cho: 15, energy: 70 },
  { group: "CEREALS", name: "Sago (sabudana)", amountG: 17, protein: 0, fat: 0, cho: 15, energy: 60 },
  { group: "CEREALS", name: "Biscuit, salty", amountG: 22, protein: 2, fat: 5, cho: 15, energy: 108 },
  { group: "CEREALS", name: "Biscuit, sweet", amountG: 23, protein: 2, fat: 5, cho: 15, energy: 109 },
  { group: "CEREALS", name: "Potato, brown skin big (starch)", amountG: 101, protein: 1.6, fat: 0.2, cho: 15, energy: 71 },

  // ---- SUGARS ------------------------------------------------------------
  { group: "SUGARS", name: "Sugar", amountG: 5, protein: 0, fat: 0, cho: 5, energy: 20 },
  { group: "SUGARS", name: "Jaggery (gur)", amountG: 6, protein: 0, fat: 0, cho: 5, energy: 20 },
  { group: "SUGARS", name: "Honey", amountG: 7, protein: 0, fat: 0, cho: 5, energy: 20 },
  { group: "SUGARS", name: "Glucose", amountG: 5, protein: 0, fat: 0, cho: 5, energy: 20 },

  // ---- FATS & OILS (visible fat) ----------------------------------------
  { group: "FATS", name: "Cooking oil", amountG: 5, protein: 0, fat: 5, cho: 0, energy: 45 },
  { group: "FATS", name: "Ghee", amountG: 5, protein: 0, fat: 5, cho: 0, energy: 45 },
  { group: "FATS", name: "Butter", amountG: 6, protein: 0, fat: 5, cho: 0, energy: 45 },
  { group: "FATS", name: "Hydrogenated oil (vanaspati)", amountG: 5, protein: 0, fat: 5, cho: 0, energy: 45 },
  { group: "FATS", name: "Cream, 40%", amountG: 15, protein: 0, fat: 5, cho: 0, energy: 45 },
  { group: "FATS", name: "Cream, light 20%", amountG: 25, protein: 0, fat: 5, cho: 0, energy: 45 },
  { group: "FATS", name: "Mayonnaise", amountG: 6, protein: 0, fat: 5, cho: 0, energy: 45 },

  // ---- NUTS & OILSEEDS ---------------------------------------------------
  { group: "NUTS", name: "Almonds", amountG: 9, protein: 1.6, fat: 5, cho: 2, energy: 55 },
  { group: "NUTS", name: "Cashewnuts", amountG: 11, protein: 2.1, fat: 5, cho: 2, energy: 64 },
  { group: "NUTS", name: "Walnuts", amountG: 8, protein: 1.2, fat: 5, cho: 2, energy: 54 },
  { group: "NUTS", name: "Groundnuts", amountG: 13, protein: 3.1, fat: 5, cho: 2, energy: 68 },
  { group: "NUTS", name: "Gingelly seeds (til), fresh", amountG: 12, protein: 2.6, fat: 5, cho: 2, energy: 62 },
  { group: "NUTS", name: "Coconut, dry", amountG: 8, protein: 0.6, fat: 5, cho: 2, energy: 50 },
  { group: "NUTS", name: "Coconut, fresh", amountG: 12, protein: 0.5, fat: 5, cho: 2, energy: 49 },
];

/** ICMR "My Plate" reference intake (grams/day) — used for guidance text. */
export const ICMR_MY_PLATE = {
  vegetables: 400,
  fruits: 100,
  cerealsMillets: 250,
  pulsesLegumes: 85,
  milkCurd: 300,
  nutsSeeds: 35,
  fatsOils: 27,
};
