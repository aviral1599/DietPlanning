import { DIET_TYPE_LABELS } from "./types";

export const ACTIVITY_OPTIONS = [
  { value: "sedentary", label: "Sedentary (desk job, little/no exercise)" },
  { value: "light", label: "Light (walks / light exercise 1–3×/week)" },
  { value: "moderate", label: "Moderate (exercise 3–5×/week)" },
  { value: "heavy", label: "Heavy (hard daily exercise / labour)" },
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
  { value: "jain", label: "Jain (no root veg / onion / garlic)" },
];

export const DIET_TYPE_OPTIONS = Object.entries(DIET_TYPE_LABELS).map(
  ([value, label]) => ({ value, label })
);

export const SEX_OPTIONS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
];

export const BMR_METHOD_OPTIONS = [
  { value: "mifflin", label: "Mifflin–St Jeor (recommended)" },
  { value: "harris-benedict", label: "Harris–Benedict (revised)" },
  { value: "icmr", label: "ICMR / FAO-WHO" },
];

export const IBW_METHOD_OPTIONS = [
  { value: "broca", label: "Broca index" },
  { value: "devine", label: "Devine formula" },
  { value: "bmi22", label: "BMI 22 target" },
];
