import { DIET_TYPE_LABELS, type DietType, type GlycemicStatus } from "./types";

// ---------------------------------------------------------------------------
// A client can have several conditions / goals at once (e.g. PCOS +
// hypothyroidism + weight loss). `conditions` holds all of them; `dietType`
// stays as the "primary" one (first in priority order) for older code paths
// and the database column.
// ---------------------------------------------------------------------------

const ALL = Object.keys(DIET_TYPE_LABELS) as DietType[];

/** Clinical priority — the first selected one becomes the primary condition. */
export const CONDITION_PRIORITY: DietType[] = [
  "renal",
  "pregnancy",
  "lactation",
  "diabetes",
  "insulin-resistance",
  "pcos",
  "hypothyroid",
  "hypertension",
  "weight-loss",
  "weight-gain",
  "high-protein",
  "general",
];

/** Pairs that can't both apply — picking one removes the other. */
export const CONDITION_CONFLICTS: [DietType, DietType][] = [
  ["weight-loss", "weight-gain"],
  ["pregnancy", "lactation"],
  ["diabetes", "insulin-resistance"], // diabetes already covers it
];

export function conflictsWith(c: DietType): DietType[] {
  return CONDITION_CONFLICTS.flatMap(([a, b]) => (a === c ? [b] : b === c ? [a] : []));
}

const byPriority = (a: DietType, b: DietType) => CONDITION_PRIORITY.indexOf(a) - CONDITION_PRIORITY.indexOf(b);

/**
 * Clean a list from a request body / DB (array or JSON string). Falls back to
 * `fallback` (the old single dietType) when the list is empty. Never empty:
 * "general" alone means no specific condition.
 */
export function normalizeConditions(raw: unknown, fallback?: unknown): DietType[] {
  let list: unknown = raw;
  if (typeof raw === "string") {
    try {
      list = JSON.parse(raw);
    } catch {
      list = [];
    }
  }
  let out = Array.isArray(list) ? (list.filter((c) => ALL.includes(c as DietType)) as DietType[]) : [];
  out = [...new Set(out)];
  if (out.length === 0 && ALL.includes(fallback as DietType)) out = [fallback as DietType];
  // Resolve conflicts: diabetes wins over insulin resistance; otherwise keep the first listed.
  if (out.includes("diabetes")) out = out.filter((c) => c !== "insulin-resistance");
  const kept: DietType[] = [];
  for (const c of out) if (!kept.some((k) => conflictsWith(c).includes(k))) kept.push(c);
  out = kept.filter((c) => c !== "general" || kept.length === 1);
  if (out.length === 0) out = ["general"];
  return out.sort(byPriority);
}

export const primaryCondition = (conds: DietType[]): DietType => conds[0] ?? "general";

/** Toggle a condition in a picker, applying conflicts and the "general" rule. */
export function toggleCondition(conds: DietType[], c: DietType): DietType[] {
  if (c === "general") return ["general"];
  if (conds.includes(c)) {
    const rest = conds.filter((x) => x !== c);
    return rest.length ? rest : ["general"];
  }
  const blocked = conflictsWith(c);
  return normalizeConditions([...conds.filter((x) => x !== "general" && !blocked.includes(x)), c]);
}

/** e.g. "PCOS + Hypothyroidism + Weight Loss + Prediabetes". */
export function conditionsLabel(conds: DietType[], glycemicStatus?: GlycemicStatus | null): string {
  const list = conds.length ? conds : ["general" as DietType];
  const parts = list.map((c) => (c === "insulin-resistance" ? (glycemicStatus === "prediabetes" ? "Prediabetes" : "Insulin resistance") : DIET_TYPE_LABELS[c]));
  const showFlag =
    glycemicStatus && glycemicStatus !== "none" && !list.includes("diabetes") && !list.includes("insulin-resistance");
  if (showFlag) {
    const g = glycemicStatus === "prediabetes" ? "Prediabetes" : "Insulin resistance";
    if (list.length === 1 && list[0] === "general") return g;
    parts.push(g);
  }
  return parts.join(" + ");
}

/** Conditions for a subject-like object (handles rows saved before multi-select). */
export function subjectConditions(s: { dietType?: string | null; conditions?: unknown }): DietType[] {
  return normalizeConditions(s.conditions, s.dietType);
}
