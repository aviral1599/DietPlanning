import { DIET_TYPE_LABELS } from "./types";

export const ACTIVITY_OPTIONS = [
  { value: "sedentary", label: "Sedentary (little/no exercise)" },
  { value: "moderate", label: "Moderate (exercise 3–5×/week)" },
  { value: "heavy", label: "Heavy (hard exercise / labour)" },
];

export const INCOME_OPTIONS = [
  { value: "low", label: "Low income" },
  { value: "middle", label: "Middle income" },
  { value: "high", label: "High income" },
];

export const DIET_PREFERENCE_OPTIONS = [
  { value: "vegetarian", label: "Vegetarian" },
  { value: "non-vegetarian", label: "Non-vegetarian" },
  { value: "eggetarian", label: "Eggetarian" },
  { value: "vegan", label: "Vegan" },
];

export const DIET_TYPE_OPTIONS = Object.entries(DIET_TYPE_LABELS).map(
  ([value, label]) => ({ value, label })
);

export const SEX_OPTIONS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
];

export const BMR_METHOD_OPTIONS = [
  { value: "harris-benedict", label: "Harris–Benedict (revised)" },
  { value: "mifflin", label: "Mifflin–St Jeor" },
  { value: "icmr", label: "ICMR / FAO-WHO" },
];

export const IBW_METHOD_OPTIONS = [
  { value: "broca", label: "Broca index" },
  { value: "devine", label: "Devine formula" },
  { value: "bmi22", label: "BMI 22 target" },
];
