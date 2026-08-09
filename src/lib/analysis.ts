import { Analysis, CalcResults, DietType, SubjectInfo } from "./types";

// ---------------------------------------------------------------------------
// Built-in, rule-based analysis engine. Produces dietary goals, do's & don'ts,
// and foods to include / exclude — tailored to the subject's condition, BMI
// and diet preference. This runs with no API key. The Claude layer (ai.ts)
// can optionally enrich the narrative.
// ---------------------------------------------------------------------------

interface Guidance {
  goals: string[];
  dos: string[];
  donts: string[];
  include: string[];
  exclude: string[];
}

const CONDITION_GUIDANCE: Record<DietType, Guidance> = {
  general: {
    goals: [
      "Maintain a balanced intake across all food groups.",
      "Preserve ideal body weight and healthy BMI.",
      "Ensure adequate micronutrients, fibre and hydration.",
    ],
    dos: [
      "Eat 4–5 small meals at regular intervals.",
      "Include a variety of coloured vegetables and seasonal fruit.",
      "Drink 2.5–3 L of water daily.",
    ],
    donts: [
      "Avoid skipping meals, especially breakfast.",
      "Limit deep-fried and heavily processed foods.",
    ],
    include: ["Whole grains", "Seasonal vegetables & fruits", "Dals & legumes", "Milk & curd", "Nuts & seeds"],
    exclude: ["Excess sugar & sweets", "Fried snacks", "Sugary beverages"],
  },
  "weight-loss": {
    goals: [
      "Create a modest calorie deficit (~500 kcal/day) for gradual fat loss.",
      "Preserve lean muscle with adequate protein.",
      "Improve satiety with high-fibre, high-volume foods.",
    ],
    dos: [
      "Fill half the plate with non-starchy vegetables.",
      "Prioritise protein at each meal (dal, egg, paneer, curd).",
      "Use whole grains over refined; keep portions measured.",
      "Walk / exercise 30–45 min most days.",
    ],
    donts: [
      "Avoid sugar, sweets, and sweetened drinks.",
      "Limit fried foods, maida and bakery items.",
      "Avoid late-night heavy meals.",
    ],
    include: ["Green leafy vegetables", "Sprouts & legumes", "Egg whites / lean protein", "Buttermilk", "Whole fruits (not juice)"],
    exclude: ["Sugar, jaggery, honey", "Sweets & desserts", "Ghee-laden / fried foods", "White rice & maida", "Packaged snacks"],
  },
  "weight-gain": {
    goals: [
      "Create a calorie surplus (~500 kcal/day) for healthy weight gain.",
      "Support muscle synthesis with sufficient protein.",
      "Increase energy density without excess junk.",
    ],
    dos: [
      "Add calorie-dense healthy foods: nuts, seeds, nut butters, full-fat milk.",
      "Eat frequent meals and post-workout snacks.",
      "Include dry-fruit milkshakes and paneer/eggs.",
    ],
    donts: [
      "Don't fill up on low-calorie foods alone.",
      "Avoid empty-calorie junk for weight gain.",
    ],
    include: ["Full-cream milk & paneer", "Dry fruits & nuts", "Banana, mango, chikoo", "Whole grains & potatoes", "Eggs / chicken"],
    exclude: ["Excess tea/coffee before meals", "Aerated drinks"],
  },
  diabetes: {
    goals: [
      "Achieve steady blood-glucose control with consistent carbohydrate distribution.",
      "Favour low-glycaemic-index, high-fibre carbohydrates.",
      "Attain / maintain healthy body weight.",
    ],
    dos: [
      "Distribute carbohydrates evenly across small, frequent meals.",
      "Choose whole grains, dals, and non-starchy vegetables.",
      "Include fibre (methi, oats, sprouts) and adequate protein.",
      "Monitor portion sizes of cereals and fruit.",
    ],
    donts: [
      "Avoid sugar, honey, jaggery and sweets.",
      "Avoid fruit juices, sugary drinks and refined flour.",
      "Limit potato, white rice and high-GI fruits (mango, banana, chikoo).",
    ],
    include: ["Whole grains (jowar, bajra, oats)", "Green leafy & non-starchy veg", "Dals, sprouts, soya", "Low-GI fruits (guava, apple, papaya)", "Methi, cinnamon, flax"],
    exclude: ["Sugar & sweets", "Fruit juice & honey", "White rice, maida, potato", "Mango, banana, grapes, chikoo", "Fried & processed foods"],
  },
  pcos: {
    goals: [
      "Improve insulin sensitivity via low-GI, balanced meals.",
      "Support gradual weight reduction if overweight.",
      "Ensure adequate protein and anti-inflammatory foods.",
    ],
    dos: [
      "Choose complex carbs and pair carbs with protein/fat.",
      "Include high-fibre vegetables and omega-3 sources.",
      "Stay active; strength + cardio training.",
    ],
    donts: [
      "Avoid refined sugar, maida and sugary drinks.",
      "Limit dairy if advised; avoid trans fats.",
    ],
    include: ["Whole grains & millets", "Leafy greens & salads", "Legumes & sprouts", "Flaxseed, walnuts", "Low-GI fruits (berries, guava, apple)"],
    exclude: ["Sugar & sweets", "Refined flour products", "Sugary & aerated drinks", "Deep-fried foods"],
  },
  hypothyroid: {
    goals: [
      "Support metabolism with adequate energy and protein.",
      "Ensure iodine, selenium and zinc sufficiency.",
      "Manage weight and constipation with fibre.",
    ],
    dos: [
      "Use iodised salt; include selenium sources (nuts, seeds).",
      "Cook goitrogenic vegetables (cabbage, cauliflower) well.",
      "Include fibre-rich foods and stay hydrated.",
    ],
    donts: [
      "Avoid raw goitrogens in excess (raw cabbage, broccoli).",
      "Limit soy around thyroid medication timing.",
      "Take medication on empty stomach, away from calcium/iron.",
    ],
    include: ["Iodised salt", "Nuts & seeds (Brazil, pumpkin)", "Whole grains", "Dals & lean protein", "Cooked vegetables & fruit"],
    exclude: ["Excess raw cruciferous veg", "Excess soy products", "Highly processed foods"],
  },
  hypertension: {
    goals: [
      "Follow a DASH-style, low-sodium eating pattern.",
      "Increase potassium, calcium and magnesium intake.",
      "Attain healthy weight and limit alcohol.",
    ],
    dos: [
      "Keep salt under ~5 g/day; use herbs & spices for flavour.",
      "Eat plenty of fruit, vegetables and low-fat dairy.",
      "Choose whole grains and unsalted nuts.",
    ],
    donts: [
      "Avoid papad, pickles, sauces and processed/packaged foods.",
      "Limit added salt and salted snacks.",
      "Avoid excess caffeine and alcohol.",
    ],
    include: ["Fruits & vegetables (potassium-rich)", "Low-fat milk & curd", "Whole grains", "Unsalted nuts", "Banana, orange, spinach"],
    exclude: ["Table salt excess, papad, pickle", "Packaged & canned foods", "Salted snacks & namkeen", "Processed meats"],
  },
  renal: {
    goals: [
      "Provide controlled protein of high biological value.",
      "Manage sodium, potassium and phosphorus per stage.",
      "Meet energy needs to prevent catabolism.",
    ],
    dos: [
      "Match protein to prescription; favour egg white / milk protein.",
      "Leach high-potassium vegetables before cooking.",
      "Coordinate closely with the treating nephrologist.",
    ],
    donts: [
      "Avoid high-potassium foods if restricted (banana, coconut water, potato).",
      "Limit phosphorus (dals, nuts, cola) as advised.",
      "Avoid added salt and processed foods.",
    ],
    include: ["Controlled high-BV protein", "Leached vegetables", "Apple, pear, papaya (lower K)", "Adequate energy from safe carbs"],
    exclude: ["High-potassium fruits/veg (if restricted)", "Excess dals & nuts (phosphorus)", "Salt & processed foods"],
  },
  pregnancy: {
    goals: [
      "Meet increased energy, protein, iron, calcium and folate needs.",
      "Support healthy maternal weight gain.",
      "Ensure food safety and hydration.",
    ],
    dos: [
      "Add an extra ~350 kcal and extra protein daily (2nd/3rd trimester).",
      "Include iron + vitamin C, calcium and folate-rich foods.",
      "Eat small frequent meals to manage nausea.",
    ],
    donts: [
      "Avoid raw/undercooked foods, unpasteurised dairy.",
      "Limit caffeine; avoid alcohol entirely.",
    ],
    include: ["Milk & curd", "Dals, egg, lean meat", "Green leafy veg (folate/iron)", "Citrus fruit", "Nuts & seeds"],
    exclude: ["Raw/undercooked meat & egg", "Unpasteurised dairy", "Excess caffeine", "Alcohol"],
  },
  lactation: {
    goals: [
      "Support milk production with extra energy and fluids.",
      "Maintain protein, calcium and micronutrient intake.",
    ],
    dos: [
      "Add ~500 kcal and extra protein daily.",
      "Stay very well hydrated; include galactagogues (methi, oats).",
      "Continue calcium and iron-rich foods.",
    ],
    donts: [
      "Avoid alcohol; limit caffeine.",
      "Watch for foods that upset the infant.",
    ],
    include: ["Milk & dairy", "Dals, egg, lean protein", "Oats, methi", "Fruits & vegetables", "Nuts & seeds"],
    exclude: ["Alcohol", "Excess caffeine"],
  },
  "high-protein": {
    goals: [
      "Meet elevated protein needs for muscle building / recovery.",
      "Distribute protein across all meals.",
      "Support training with adequate carbohydrate.",
    ],
    dos: [
      "Include a protein source at every meal and post-workout.",
      "Combine cereals + pulses for complete protein (veg).",
      "Hydrate well and time carbs around training.",
    ],
    donts: [
      "Don't neglect carbohydrate for energy.",
      "Avoid relying only on supplements.",
    ],
    include: ["Egg, chicken, fish", "Paneer, curd, milk", "Dals, soya, sprouts", "Whole grains", "Nuts & seeds"],
    exclude: ["Empty-calorie junk", "Sugary drinks"],
  },
};

export function buildBuiltinAnalysis(
  subject: SubjectInfo,
  results: CalcResults
): Analysis {
  const g = CONDITION_GUIDANCE[subject.dietType] ?? CONDITION_GUIDANCE.general;

  const goals = [...g.goals];
  const dos = [...g.dos];
  const donts = [...g.donts];
  const include = [...g.include];
  const exclude = [...g.exclude];

  // BMI-driven additions.
  if (results.bmi >= 25) {
    goals.push(
      `Reduce weight toward IBW (${results.ibw} kg); current BMI ${results.bmi} (${results.bmiCategory}).`
    );
  } else if (results.bmi < 18.5) {
    goals.push(
      `Gain weight toward IBW (${results.ibw} kg); current BMI ${results.bmi} (${results.bmiCategory}).`
    );
  }

  // Allergy handling.
  const allergies = subject.allergies
    .split(/[,;\n]/)
    .map((a) => a.trim())
    .filter(Boolean);
  if (allergies.length) {
    allergies.forEach((a) =>
      exclude.push(`${a} (declared allergy — strictly avoid)`)
    );
    donts.push(`Strictly avoid all forms of: ${allergies.join(", ")}.`);
  }

  // Income-group note.
  if (subject.incomeGroup === "low") {
    dos.push(
      "Use economical protein sources: seasonal dals, groundnuts, eggs, and local greens."
    );
  }

  // Diet-preference note.
  if (subject.dietPreference === "vegan") {
    dos.push(
      "Use fortified plant milk, soya, and B12 supplementation to cover milk-group nutrients."
    );
  }

  return {
    dietaryGoals: goals,
    dos,
    donts,
    foodsToInclude: include,
    foodsToExclude: exclude,
    generatedBy: "builtin",
  };
}
