import { glycemicSummary } from "./glycemic";
import Anthropic from "@anthropic-ai/sdk";
import { Analysis, CalcResults, MenuPlan, SubjectInfo } from "./types";
import { DIET_TYPE_LABELS } from "./types";

// Latest capable balanced model for clinical narrative generation.
const MODEL = "claude-sonnet-5";

export function resolveApiKey(coachKey?: string | null): string | null {
  return coachKey?.trim() || process.env.ANTHROPIC_API_KEY || null;
}

/**
 * Enrich a built-in analysis with a Claude-generated clinical narrative and
 * refined guidance. Returns a new Analysis with generatedBy = "claude".
 * Throws on missing key or API error (caller surfaces the message).
 */
export async function enhanceAnalysisWithClaude(params: {
  apiKey: string;
  subject: SubjectInfo;
  results: CalcResults;
  menuPlan: MenuPlan;
  base: Analysis;
}): Promise<Analysis> {
  const { apiKey, subject, results, menuPlan, base } = params;
  const client = new Anthropic({ apiKey });

  const prompt = `You are a senior clinical dietitian working in India, using the food-exchange system. Write a personalised diet-plan analysis for this client. Be practical, culturally appropriate to Indian foods, and evidence-based.

CLIENT
- Name: ${subject.clientName}
- Age/Sex: ${subject.age} / ${subject.sex}
- Height/Weight: ${subject.heightCm} cm / ${subject.weightKg} kg
- Activity: ${subject.activityLevel}
- Diet preference: ${subject.dietPreference}
- Condition/goal: ${DIET_TYPE_LABELS[subject.dietType]}
- Blood sugar (insulin resistance / prediabetes, labs): ${glycemicSummary(subject) || "normal / not tested"}
- Income group: ${subject.incomeGroup}
- Allergies: ${subject.allergies || "none"}
- Objective / case study: ${subject.objective || "not specified"}

ASSESSMENT (already computed)
- IBW: ${results.ibw} kg | BMI: ${results.bmi} (${results.bmiCategory})
- BMR: ${results.bmr} kcal | Target energy: ${results.energy} kcal
- Protein: ${results.protein.grams} g | Fat: ${results.fat.grams} g | CHO: ${results.cho.grams} g
- Planned exchanges give ~${menuPlan.totals.energy} kcal.

Return ONLY valid JSON (no markdown) with this exact shape:
{
  "narrative": "2-3 short paragraphs of clinical reasoning and encouragement, addressed to the coach about this client",
  "dietaryGoals": ["..."],
  "dos": ["..."],
  "donts": ["..."],
  "foodsToInclude": ["..."],
  "foodsToExclude": ["..."]
}
Keep each list to 4-7 concise, specific items. Respect the client's allergies and diet preference strictly.`;

  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 1500,
    messages: [{ role: "user", content: prompt }],
  });

  const text = msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

  const json = extractJson(text);
  if (!json) {
    // Fall back to built-in with the raw narrative attached.
    return { ...base, aiNarrative: text, generatedBy: "claude" };
  }

  return {
    dietaryGoals: arr(json.dietaryGoals, base.dietaryGoals),
    dos: arr(json.dos, base.dos),
    donts: arr(json.donts, base.donts),
    foodsToInclude: arr(json.foodsToInclude, base.foodsToInclude),
    foodsToExclude: arr(json.foodsToExclude, base.foodsToExclude),
    aiNarrative: typeof json.narrative === "string" ? json.narrative : undefined,
    generatedBy: "claude",
  };
}

function arr(value: unknown, fallback: string[]): string[] {
  if (Array.isArray(value) && value.every((v) => typeof v === "string")) {
    return value as string[];
  }
  return fallback;
}

function extractJson(text: string): Record<string, unknown> | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}
