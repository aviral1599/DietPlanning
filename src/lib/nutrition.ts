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

const ACTIVITY_PA_FACTOR: Record<ActivityLevel, number> = {
  sedentary: 0.4,
  moderate: 0.6,
  heavy: 1.0,
};

// Protein g/kg reference weight by therapeutic diet type.
const PROTEIN_PER_KG: Record<DietType, number> = {
  general: 1.0,
  "weight-loss": 1.2,
  "weight-gain": 1.5,
  diabetes: 1.0,
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
  pcos: 0.25,
  hypothyroid: 0.25,
  hypertension: 0.2,
  renal: 0.3,
  pregnancy: 0.28,
  lactation: 0.28,
  "high-protein": 0.25,
};

// Energy adjustment (kcal) applied to TEE for the weight goal.
const GOAL_ADJUSTMENT: Partial<Record<DietType, number>> = {
  "weight-loss": -500,
  "weight-gain": 500,
  pcos: -300, // mild deficit commonly advised
};

export function defaultSettings(subject: SubjectInfo): NutritionSettings {
  return {
    bmrMethod: "harris-benedict",
    ibwMethod: "broca",
    activityFactor: ACTIVITY_PA_FACTOR[subject.activityLevel],
    sdaFactor: 0.1,
    proteinPerKg: PROTEIN_PER_KG[subject.dietType] ?? 1.0,
    proteinBasis: "ideal",
    fatPercent: FAT_PERCENT[subject.dietType] ?? 0.25,
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

export const BMR_METHOD_LABELS: Record<BmrMethod, string> = {
  "harris-benedict": "Harris–Benedict (revised)",
  mifflin: "Mifflin–St Jeor",
  icmr: "ICMR / FAO-WHO",
};

// ---------------------------------------------------------------------------
// ICMR RDA reference values (used for the comparison table)
// ---------------------------------------------------------------------------

const RDA_ENERGY: Record<Sex, Record<ActivityLevel, number>> = {
  male: { sedentary: 2110, moderate: 2710, heavy: 3470 },
  female: { sedentary: 1660, moderate: 2130, heavy: 2720 },
};

const RDA_PROTEIN: Record<Sex, number> = { male: 54, female: 46 };

const RDA_FAT: Record<Sex, Record<ActivityLevel, number>> = {
  male: { sedentary: 25, moderate: 30, heavy: 40 },
  female: { sedentary: 20, moderate: 25, heavy: 30 },
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

  const goalAdjustment = GOAL_ADJUSTMENT[subject.dietType] ?? 0;
  const energy =
    settings.energyOverride != null && settings.energyOverride > 0
      ? settings.energyOverride
      : tee + goalAdjustment;

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
    bmr: round(bmr),
    pa: round(pa),
    sda: round(sda),
    tee: round(tee),
    goalAdjustment,
    energy: round(energy),
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
