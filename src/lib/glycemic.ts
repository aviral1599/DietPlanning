import type { DietType, GlycemicLabs, GlycemicStatus } from "./types";

// ---------------------------------------------------------------------------
// Insulin resistance / prediabetes helpers (shared by server and client).
//
// Cut-offs:
//  • HbA1c — normal < 5.7 %, prediabetes 5.7–6.4 %, diabetes ≥ 6.5 %
//    (ADA Standards of Care; also used by ICMR / RSSDI).
//  • Fasting plasma glucose — normal < 100, prediabetes (IFG) 100–125,
//    diabetes ≥ 126 mg/dL.
//  • 2-h post-glucose — normal < 140, prediabetes (IGT) 140–199,
//    diabetes ≥ 200 mg/dL.
//  • HOMA-IR = fasting insulin (µIU/mL) × fasting glucose (mg/dL) ÷ 405.
//    ≥ 2.5 is the commonly used insulin-resistance cut-off; studies in Asian
//    Indians suggest resistance can begin around 2.0, so 2.0–2.5 is flagged
//    as borderline.
// ---------------------------------------------------------------------------

export const GLYCEMIC_STATUSES: GlycemicStatus[] = ["none", "insulin-resistance", "prediabetes"];

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

/** Accepts a JSON string (DB) or an object (request body). */
export function normalizeLabs(raw: unknown): GlycemicLabs {
  let o: Record<string, unknown> = {};
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") o = parsed as Record<string, unknown>;
    } catch {
      o = {};
    }
  } else if (raw && typeof raw === "object") {
    o = raw as Record<string, unknown>;
  }
  const clamp = (v: number | null, max: number) => (v != null && v <= max ? v : null);
  return {
    hba1c: clamp(num(o.hba1c), 20),
    fastingGlucose: clamp(num(o.fastingGlucose), 600),
    postprandialGlucose: clamp(num(o.postprandialGlucose), 800),
    fastingInsulin: clamp(num(o.fastingInsulin), 500),
  };
}

export function normalizeStatus(raw: unknown): GlycemicStatus {
  return GLYCEMIC_STATUSES.includes(raw as GlycemicStatus) ? (raw as GlycemicStatus) : "none";
}

export function homaIr(labs: GlycemicLabs): number | null {
  if (!labs.fastingGlucose || !labs.fastingInsulin) return null;
  return Math.round(((labs.fastingGlucose * labs.fastingInsulin) / 405) * 10) / 10;
}

export function hasLabs(labs: GlycemicLabs | null | undefined): boolean {
  return !!labs && Object.values(labs).some((v) => typeof v === "number" && v > 0);
}

export type LabTone = "ok" | "warn" | "high";

export interface LabFinding {
  key: "hba1c" | "fastingGlucose" | "postprandialGlucose" | "homaIr";
  label: string;
  value: string;
  band: string;
  tone: LabTone;
}

export interface LabInterpretation {
  findings: LabFinding[];
  /** What the labs point to — "diabetes" means the values are in the diabetic range. */
  suggested: GlycemicStatus | "diabetes" | null;
  homaIr: number | null;
}

export function interpretLabs(labs: GlycemicLabs): LabInterpretation {
  const findings: LabFinding[] = [];
  let level = 0; // 0 normal, 1 insulin resistance, 2 prediabetes, 3 diabetes

  if (labs.hba1c) {
    const v = labs.hba1c;
    const [band, tone, l]: [string, LabTone, number] =
      v >= 6.5 ? ["diabetes range (6.5+)", "high", 3] : v >= 5.7 ? ["prediabetes range (5.7–6.4)", "warn", 2] : ["normal (< 5.7)", "ok", 0];
    findings.push({ key: "hba1c", label: "HbA1c", value: `${v}%`, band, tone });
    level = Math.max(level, l);
  }
  if (labs.fastingGlucose) {
    const v = labs.fastingGlucose;
    const [band, tone, l]: [string, LabTone, number] =
      v >= 126 ? ["diabetes range (126+)", "high", 3] : v >= 100 ? ["impaired fasting glucose (100–125)", "warn", 2] : ["normal (< 100)", "ok", 0];
    findings.push({ key: "fastingGlucose", label: "Fasting glucose", value: `${v} mg/dL`, band, tone });
    level = Math.max(level, l);
  }
  if (labs.postprandialGlucose) {
    const v = labs.postprandialGlucose;
    const [band, tone, l]: [string, LabTone, number] =
      v >= 200 ? ["diabetes range (200+)", "high", 3] : v >= 140 ? ["impaired glucose tolerance (140–199)", "warn", 2] : ["normal (< 140)", "ok", 0];
    findings.push({ key: "postprandialGlucose", label: "2-h glucose", value: `${v} mg/dL`, band, tone });
    level = Math.max(level, l);
  }
  const homa = homaIr(labs);
  if (homa != null) {
    const [band, tone, l]: [string, LabTone, number] =
      homa >= 2.5 ? ["insulin resistant (2.5+)", "warn", 1] : homa >= 2 ? ["borderline (2.0–2.4)", "warn", 1] : ["normal (< 2.0)", "ok", 0];
    findings.push({ key: "homaIr", label: "HOMA-IR", value: String(homa), band, tone });
    level = Math.max(level, l);
  }

  const suggested =
    findings.length === 0 ? null : level === 3 ? "diabetes" : level === 2 ? "prediabetes" : level === 1 ? "insulin-resistance" : "none";
  return { findings, suggested, homaIr: homa };
}

const asList = (c: DietType | DietType[]): DietType[] => (Array.isArray(c) ? c : [c]);

/**
 * Every condition that should shape food choices for this client. The
 * glycaemic flag adds "insulin-resistance" on top of the selected conditions
 * (diabetes already covers it).
 */
export function conditionsOf(conds: DietType | DietType[], glycemicStatus?: GlycemicStatus | null): DietType[] {
  const out = [...asList(conds)];
  if (glycemicStatus && glycemicStatus !== "none" && !out.includes("diabetes") && !out.includes("insulin-resistance")) {
    out.push("insulin-resistance");
  }
  return out;
}

/** Needs blood-sugar-friendly (low-GI, carb-controlled) planning. */
export function isGlycemicConcern(conds: DietType | DietType[], glycemicStatus?: GlycemicStatus | null): boolean {
  const list = asList(conds);
  return (
    list.some((c) => c === "diabetes" || c === "insulin-resistance" || c === "pcos") ||
    (!!glycemicStatus && glycemicStatus !== "none")
  );
}

/** One-line text for exports: "Prediabetes — HbA1c 6.1%: prediabetes range …; …". Empty if nothing to report. */
export function glycemicSummary(s: { dietType: DietType; conditions?: DietType[]; glycemicStatus?: GlycemicStatus | null; labs?: GlycemicLabs | null }): string {
  const diabetic = s.dietType === "diabetes" || !!s.conditions?.includes("diabetes");
  const status = diabetic
    ? ""
    : s.glycemicStatus === "prediabetes"
      ? "Prediabetes"
      : s.glycemicStatus === "insulin-resistance"
        ? "Insulin resistance"
        : "";
  const labs = interpretLabs(s.labs ?? {}).findings.map((f) => `${f.label} ${f.value}: ${f.band}`).join("; ");
  return [status, labs].filter(Boolean).join(" — ");
}
