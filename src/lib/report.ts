import { computeAssessment, defaultSettings } from "./nutrition";
import { buildMenuPlan } from "./planner";
import { buildBuiltinAnalysis } from "./analysis";
import { normalizeLabs, normalizeStatus } from "./glycemic";
import {
  Analysis,
  CalcResults,
  MenuPlan,
  NutritionSettings,
  SubjectInfo,
} from "./types";

export interface FullReport {
  subject: SubjectInfo;
  settings: NutritionSettings;
  results: CalcResults;
  menuPlan: MenuPlan;
  analysis: Analysis;
}

/**
 * Build a complete computed report from subject info.
 * Optionally accepts partial settings / a pre-edited menu / analysis to preserve
 * coach edits while recomputing derived values.
 */
export function buildFullReport(
  subject: SubjectInfo,
  overrides?: {
    settings?: Partial<NutritionSettings>;
    menuPlan?: MenuPlan;
    analysis?: Analysis;
  }
): FullReport {
  const settings: NutritionSettings = {
    ...defaultSettings(subject),
    ...(overrides?.settings ?? {}),
  };
  const results = computeAssessment(subject, settings);
  const menuPlan = overrides?.menuPlan ?? buildMenuPlan(results, subject);
  const analysis = overrides?.analysis ?? buildBuiltinAnalysis(subject, results);
  return { subject, settings, results, menuPlan, analysis };
}

/** Coerce raw form/db values into a typed SubjectInfo. */
export function toSubjectInfo(raw: Record<string, unknown>): SubjectInfo {
  const dietType = (raw.dietType as SubjectInfo["dietType"]) ?? "general";
  let glycemicStatus = normalizeStatus(raw.glycemicStatus);
  // "Insulin resistance / prediabetes" as the main condition implies the flag;
  // diabetes supersedes it.
  if (dietType === "insulin-resistance" && glycemicStatus === "none") glycemicStatus = "insulin-resistance";
  if (dietType === "diabetes") glycemicStatus = "none";
  return {
    clientName: String(raw.clientName ?? "").trim(),
    age: Number(raw.age ?? 0),
    sex: (raw.sex as SubjectInfo["sex"]) ?? "male",
    heightCm: Number(raw.heightCm ?? 0),
    weightKg: Number(raw.weightKg ?? 0),
    activityLevel:
      (raw.activityLevel as SubjectInfo["activityLevel"]) ?? "sedentary",
    incomeGroup: (raw.incomeGroup as SubjectInfo["incomeGroup"]) ?? "middle",
    allergies: String(raw.allergies ?? ""),
    dietType,
    dietPreference:
      (raw.dietPreference as SubjectInfo["dietPreference"]) ?? "vegetarian",
    objective: String(raw.objective ?? ""),
    glycemicStatus,
    labs: normalizeLabs(raw.labs),
  };
}
