import {
  ActivityLevel,
  BmrMethod,
  CalcResults,
  DietType,
  IbwMethod,
  MacroResult,
  NutritionSettings,
  RdaComparisonRow,
  Sex,
  SubjectInfo,
} from "./types";

export const round = (n: number, d = 1) => {
  const f = 10 ** d;
  return Math.round(n * f) / f;
};

// ---------------------------------------------------------------------------
// Default calculation settings, derived from the subject where sensible.
// ---------------------------------------------------------------------------

// Physical activity as a fraction of BMR. With SDA (10 %) on top these give
// the standard overall multipliers of BMR: sedentary ~1.2, light ~1.375,
// moderate ~1.55, heavy ~1.75.
export const ACTIVITY_PA_FACTOR: Record<ActivityLevel, number> = {
  sedentary: 0.1,
  light: 0.25,
  moderate: 0.4,
  heavy: 0.6,
};

/** Overall TEE ÷ BMR for a set of factors, e.g. 1.38. */
export const activityMultiplier = (activityFactor: number, sdaFactor: number) =>
  round((1 + activityFactor) * (1 + sdaFactor), 2);

/** Lowest auto target, unless the coach types one in. */
export const MIN_ENERGY: Record<Sex, number> = { female: 1200, male: 1500 };

// Protein g/kg reference weight by therapeutic diet type.
const PROTEIN_PER_KG: Record<DietType, number> = {
  general: 1.0,
  "weight-loss": 1.2,
  "weight-gain": 1.5,
  diabetes: 1.0,
  "insulin-resistance": 1.1,
  pcos: 1.2,
  hypothyroid: 1.0,
  hypertension: 1.0,
  renal: 0.8,
  pregnancy: 1.1,
  lactation: 1.2,
  "high-protein": 1.6,
};

// Fat as fraction of total energy by diet type.
const FAT_PERCENT: Record<DietType, number> = {
  general: 0.25,
  "weight-loss": 0.25,
  "weight-gain": 0.28,
  diabetes: 0.25,
  "insulin-resistance": 0.27, // a little more (mainly MUFA) fat in place of refined carbohydrate
  pcos: 0.25,
  hypothyroid: 0.25,
  hypertension: 0.2,
  renal: 0.3,
  pregnancy: 0.28,
  lactation: 0.28,
  "high-protein": 0.25,
};

/**
 * Automatic kcal adjustment to TEE for the weight goal.
 *  • Weight loss −500 (≈ 0.5 kg/week), weight gain +500.
 *  • PCOS, insulin resistance / prediabetes: −300 when overweight
 *    (BMI ≥ 23, Asian cut-off) — a steady 5–10 % weight loss is the
 *    best-proven way to improve insulin sensitivity. The coach can pick a
 *    bigger deficit from the suggestions.
 *  • Any other condition with a glycaemic flag and BMI ≥ 23: −300.
 */
export function autoGoalAdjustment(subject: SubjectInfo): number {
  const b = bmi(subject.weightKg, subject.heightCm);
  switch (subject.dietType) {
    case "weight-loss":
      return -500;
    case "weight-gain":
      return 500;
    case "pcos":
    case "insulin-resistance":
    case "diabetes":
      return b >= 23 ? -300 : 0;
    case "general":
    case "hypothyroid":
    case "hypertension":
    case "high-protein":
      return subject.glycemicStatus && subject.glycemicStatus !== "none" && b >= 23 ? -300 : 0;
    default:
      return 0; // renal, pregnancy, lactation — no deficit
  }
}

export function defaultSettings(subject: SubjectInfo): NutritionSettings {
  // Insulin resistance / prediabetes on top of another goal: slightly more
  // protein (satiety, blunts post-meal glucose) unless protein is restricted.
  let proteinPerKg = PROTEIN_PER_KG[subject.dietType] ?? 1.0;
  if (subject.glycemicStatus && subject.glycemicStatus !== "none" && subject.dietType !== "renal") {
    proteinPerKg = Math.max(proteinPerKg, 1.1);
  }
  return {
    // Mifflin–St Jeor is the most accurate predictive equation for adults,
    // including overweight/obese (Academy of Nutrition & Dietetics).
    bmrMethod: "mifflin",
    ibwMethod: "broca",
    activityFactor: ACTIVITY_PA_FACTOR[subject.activityLevel] ?? ACTIVITY_PA_FACTOR.sedentary,
    sdaFactor: 0.1,
    proteinPerKg,
    proteinBasis: "ideal",
    fatPercent: FAT_PERCENT[subject.dietType] ?? 0.25,
    goalAdjustment: null,
    energyOverride: null,
  };
}

// ---------------------------------------------------------------------------
// Ideal Body Weight
// ---------------------------------------------------------------------------

export function idealBodyWeight(
  heightCm: number,
  sex: Sex,
  method: IbwMethod
): number {
  switch (method) {
    case "devine": {
      const inches = heightCm / 2.54;
      const over60 = Math.max(0, inches - 60);
      return (sex === "male" ? 50 : 45.5) + 2.3 * over60;
    }
    case "bmi22": {
      const m = heightCm / 100;
      return 22 * m * m; // target BMI 22 (Asian-Indian healthy midpoint)
    }
    case "broca":
    default:
      // Broca index: height(cm) - 100, with a small correction for women.
      return heightCm - 100 - (sex === "female" ? 5 : 0);
  }
}

export const IBW_METHOD_LABELS: Record<IbwMethod, string> = {
  broca: "Broca index (Ht cm − 100)",
  devine: "Devine formula",
  bmi22: "BMI 22 target",
};

// ---------------------------------------------------------------------------
// BMI
// ---------------------------------------------------------------------------

export function bmi(weightKg: number, heightCm: number): number {
  const m = heightCm / 100;
  return weightKg / (m * m);
}

// Asian-Indian BMI cut-offs (WHO Asia-Pacific).
export function bmiCategory(value: number): string {
  if (value < 18.5) return "Underweight";
  if (value < 23) return "Normal";
  if (value < 25) return "Overweight (at risk)";
  if (value < 30) return "Obese I";
  return "Obese II";
}

// ---------------------------------------------------------------------------
// BMR
// ---------------------------------------------------------------------------

export function basalMetabolicRate(
  weightKg: number,
  heightCm: number,
  age: number,
  sex: Sex,
  method: BmrMethod
): number {
  switch (method) {
    case "mifflin": {
      const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
      return base + (sex === "male" ? 5 : -161);
    }
    case "icmr": {
      // FAO/WHO/ICMR weight-based equations by age band.
      if (sex === "male") {
        if (age < 30) return 15.3 * weightKg + 679;
        if (age <= 60) return 11.6 * weightKg + 879;
        return 13.5 * weightKg + 487;
      } else {
        if (age < 30) return 14.7 * weightKg + 496;
        if (age <= 60) return 8.7 * weightKg + 829;
        return 10.5 * weightKg + 596;
      }
    }
    case "harris-benedict":
    default: {
      // Revised Harris-Benedict (Roza & Shizgal, 1984).
      if (sex === "male") {
        return 88.362 + 13.397 * weightKg + 4.799 * heightCm - 5.677 * age;
      }
      return 447.593 + 9.247 * weightKg + 3.098 * heightCm - 4.33 * age;
    }
  }
}

/** The BMR equation written out, for display. */
export function bmrFormula(sex: Sex, method: BmrMethod): string {
  switch (method) {
    case "mifflin":
      return `10 × wt + 6.25 × ht − 5 × age ${sex === "male" ? "+ 5" : "− 161"}`;
    case "icmr":
      return "FAO/WHO/ICMR weight-based equation for age band";
    default:
      return sex === "male"
        ? "88.36 + 13.40 × wt + 4.80 × ht − 5.68 × age"
        : "447.59 + 9.25 × wt + 3.10 × ht − 4.33 × age";
  }
}

export const BMR_METHOD_LABELS: Record<BmrMethod, string> = {
  "harris-benedict": "Harris–Benedict (revised)",
  mifflin: "Mifflin–St Jeor",
  icmr: "ICMR / FAO-WHO",
};

// ---------------------------------------------------------------------------
// ICMR RDA reference values (used for the comparison table)
// ---------------------------------------------------------------------------

// "light" is interpolated between ICMR sedentary and moderate.
const RDA_ENERGY: Record<Sex, Record<ActivityLevel, number>> = {
  male: { sedentary: 2110, light: 2410, moderate: 2710, heavy: 3470 },
  female: { sedentary: 1660, light: 1895, moderate: 2130, heavy: 2720 },
};

const RDA_PROTEIN: Record<Sex, number> = { male: 54, female: 46 };

const RDA_FAT: Record<Sex, Record<ActivityLevel, number>> = {
  male: { sedentary: 25, light: 27, moderate: 30, heavy: 40 },
  female: { sedentary: 20, light: 22, moderate: 25, heavy: 30 },
};

// ---------------------------------------------------------------------------
// Full assessment
// ---------------------------------------------------------------------------

function macro(grams: number, kcalPerG: number, energy: number): MacroResult {
  const kcal = grams * kcalPerG;
  return {
    grams: round(grams),
    kcal: round(kcal),
    percent: energy > 0 ? round((kcal / energy) * 100) : 0,
  };
}

export function computeAssessment(
  subject: SubjectInfo,
  settings: NutritionSettings
): CalcResults {
  const ibw = idealBodyWeight(subject.heightCm, subject.sex, settings.ibwMethod);
  const bmiVal = bmi(subject.weightKg, subject.heightCm);
  const bmr = basalMetabolicRate(
    subject.weightKg,
    subject.heightCm,
    subject.age,
    subject.sex,
    settings.bmrMethod
  );

  const pa = settings.activityFactor * bmr;
  const sda = settings.sdaFactor * (bmr + pa);
  const tee = bmr + pa + sda;

  const goalAdjustment =
    settings.goalAdjustment != null && Number.isFinite(settings.goalAdjustment)
      ? settings.goalAdjustment
      : autoGoalAdjustment(subject);
  const manual = settings.energyOverride != null && settings.energyOverride > 0;
  const floor = MIN_ENERGY[subject.sex] ?? 1200;
  const formula = tee + goalAdjustment;
  const energyFloored = !manual && goalAdjustment < 0 && formula < floor;
  const energy = Math.round(
    manual ? (settings.energyOverride as number) : energyFloored ? Math.min(floor, tee) : formula
  );

  // Reference weight for protein (guard against negative/implausible IBW).
  const referenceWeight =
    settings.proteinBasis === "ideal" && ibw > 0 ? ibw : subject.weightKg;

  const proteinGrams = settings.proteinPerKg * referenceWeight;
  const protein = macro(proteinGrams, 4, energy);

  const fatKcal = settings.fatPercent * energy;
  const fat = macro(fatKcal / 9, 9, energy);

  // CHO = remaining energy after protein & fat.
  const choKcal = Math.max(0, energy - protein.kcal - fat.kcal);
  const cho = macro(choKcal / 4, 4, energy);

  const weightStatus = ibw - subject.weightKg;
  const weightStatusLabel =
    Math.abs(weightStatus) < 2
      ? "At ideal body weight"
      : weightStatus < 0
        ? `${round(Math.abs(weightStatus))} kg above IBW`
        : `${round(weightStatus)} kg below IBW`;

  const rdaComparison = buildRdaComparison(subject, {
    energy,
    protein: protein.grams,
    fat: fat.grams,
    cho: cho.grams,
  });

  return {
    ibw: round(ibw),
    bmi: round(bmiVal, 1),
    bmiCategory: bmiCategory(bmiVal),
    bmr: round(bmr, 0),
    pa: round(pa, 0),
    sda: round(sda, 0),
    tee: round(tee, 0),
    goalAdjustment: round(goalAdjustment, 0),
    energy: round(energy, 0),
    energySource: manual ? "manual" : "auto",
    energyFloored,
    weightStatus: round(weightStatus),
    weightStatusLabel,
    referenceWeight: round(referenceWeight),
    protein,
    fat,
    cho,
    rdaComparison,
    bmrMethodLabel: BMR_METHOD_LABELS[settings.bmrMethod],
    ibwMethodLabel: IBW_METHOD_LABELS[settings.ibwMethod],
  };
}

function buildRdaComparison(
  subject: SubjectInfo,
  planned: { energy: number; protein: number; fat: number; cho: number }
): RdaComparisonRow[] {
  const rdaEnergy = RDA_ENERGY[subject.sex][subject.activityLevel];
  const rdaProtein = RDA_PROTEIN[subject.sex];
  const rdaFat = RDA_FAT[subject.sex][subject.activityLevel];
  const rdaCho = round((0.6 * rdaEnergy) / 4); // WHO ~60% energy from CHO

  const row = (
    nutrient: RdaComparisonRow["nutrient"],
    rda: number,
    mrda: number,
    unit: string
  ): RdaComparisonRow => ({
    nutrient,
    rda: round(rda),
    mrda: round(mrda),
    difference: round(mrda - rda),
    unit,
  });

  return [
    row("ENERGY", rdaEnergy, planned.energy, "kcal"),
    row("PROTEIN", rdaProtein, planned.protein, "g"),
    row("FAT", rdaFat, planned.fat, "g"),
    row("CARBOHYDRATE", rdaCho, planned.cho, "g"),
  ];
}

// ---------------------------------------------------------------------------
// Target-energy suggestions shown to the coach (click to apply).
// ---------------------------------------------------------------------------

export interface EnergySuggestion {
  key: string;
  label: string;
  kcal: number;
  note: string;
}

export function energySuggestions(subject: SubjectInfo, results: CalcResults): EnergySuggestion[] {
  const tee = results.tee;
  const wt = subject.weightKg;
  const b = results.bmi;
  const floor = MIN_ENERGY[subject.sex] ?? 1200;
  const r = (n: number) => Math.round(n / 10) * 10;
  const out: EnergySuggestion[] = [];
  const add = (key: string, label: string, kcal: number, note: string) => {
    const v = r(kcal);
    if (v < floor || out.some((o) => Math.abs(o.kcal - v) < 30)) return;
    out.push({ key, label, kcal: v, note });
  };
  const noDeficit = ["renal", "pregnancy", "lactation", "weight-gain"].includes(subject.dietType);

  add("maintain", "Maintain weight", tee, "TEE — no deficit");
  if (!noDeficit && (b >= 23 || subject.dietType === "weight-loss")) {
    add("mild", "Gentle loss", tee - 300, "TEE − 300 · ~0.3 kg/week");
    add("loss", "Weight loss", tee - 500, "TEE − 500 · ~0.5 kg/week");
    if (b >= 25) {
      add("kg25", "25 kcal/kg body wt", 25 * wt, `25 × ${wt} kg · obesity guideline`);
      add("kg20", "20 kcal/kg body wt", 20 * wt, `20 × ${wt} kg · faster loss`);
    }
  }
  if (subject.dietType === "weight-gain" || b < 18.5) {
    add("gain3", "Gentle gain", tee + 300, "TEE + 300");
    add("gain5", "Weight gain", tee + 500, "TEE + 500 · ~0.5 kg/week");
  }
  if (b < 23 && results.ibw > 0) add("ibw30", "30 kcal/kg ideal wt", 30 * results.ibw, `30 × ${results.ibw} kg IBW`);
  return out.sort((a, c) => a.kcal - c.kcal);
}
