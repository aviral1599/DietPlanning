import "server-only";
import { prisma } from "../db";
import { safeJsonParse } from "../api";
import type { CalcResults, MealTime, MenuPlan, SubjectInfo } from "../types";
import { toSubjectInfo } from "../report";
import { BUILTIN_DISHES, customToDish, parseAllergies } from "./bank";
import {
  buildTargets,
  ChartDay,
  ChartPrefs,
  ChartProfile,
  ChartTargets,
  defaultPrefs,
  MEAL_TIME_DEFAULTS,
} from "./engine";
import type { Dish } from "./types";

type ReportRow = NonNullable<Awaited<ReturnType<typeof prisma.report.findUnique>>>;
type ChartRow = NonNullable<Awaited<ReturnType<typeof prisma.dietChart.findUnique>>>;

/** Coach's custom dishes as computed Dish objects. */
export async function loadCustomDishes(coachId: string): Promise<Dish[]> {
  const rows = await prisma.customDish.findMany({ where: { coachId }, orderBy: { createdAt: "desc" } });
  return rows.map(customToDish).filter((d): d is Dish => !!d);
}

/** Built-in + the coach's custom dishes. */
export async function loadDishPool(coachId: string): Promise<Dish[]> {
  return [...BUILTIN_DISHES, ...(await loadCustomDishes(coachId))];
}

export function profileFromSubject(s: SubjectInfo): ChartProfile {
  return {
    dietType: s.dietType,
    conditions: s.conditions,
    dietPreference: s.dietPreference,
    allergens: parseAllergies(s.allergies),
    incomeGroup: s.incomeGroup,
    glycemicStatus: s.glycemicStatus,
  };
}

export function reportContext(report: ReportRow) {
  const subject = toSubjectInfo(report as unknown as Record<string, unknown>);
  const results = safeJsonParse<CalcResults | null>(report.results, null);
  const menuPlan = safeJsonParse<MenuPlan | null>(report.menuPlan, null);
  return { subject, results, menuPlan, profile: profileFromSubject(subject) };
}

export function targetsFor(report: ReportRow, prefs: ChartPrefs): ChartTargets {
  const { results, menuPlan } = reportContext(report);
  if (!results) throw new Error("Report has no computed results");
  return buildTargets(results, menuPlan, prefs);
}

export function newPrefsFor(report: ReportRow, partial: Partial<ChartPrefs>): ChartPrefs {
  const { profile } = reportContext(report);
  const base = defaultPrefs(profile, partial.days ?? 7);
  return { ...base, ...partial, seed: partial.seed ?? base.seed };
}

export interface ChartDTO {
  id: string;
  reportId: string;
  clientId: string | null;
  title: string;
  startDate: string;
  days: ChartDay[];
  prefs: ChartPrefs;
  targets: ChartTargets;
  mealTimes: Record<MealTime, string>;
  notes: string;
  shared: boolean;
  version: number;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}

export function toChartDTO(row: ChartRow): ChartDTO {
  return {
    id: row.id,
    reportId: row.reportId,
    clientId: row.clientId,
    title: row.title,
    startDate: row.startDate,
    days: safeJsonParse<ChartDay[]>(row.days, []),
    prefs: safeJsonParse<ChartPrefs>(row.prefs, {} as ChartPrefs),
    targets: safeJsonParse<ChartTargets>(row.targets, {} as ChartTargets),
    mealTimes: { ...MEAL_TIME_DEFAULTS, ...safeJsonParse<Record<MealTime, string>>(row.mealTimes, {} as Record<MealTime, string>) },
    notes: row.notes,
    shared: row.shared,
    version: row.version,
    updatedBy: row.updatedBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** A chart owned by this coach, or null. */
export async function ownedChart(coachId: string, id: string) {
  const chart = await prisma.dietChart.findUnique({ where: { id } });
  if (!chart || chart.coachId !== coachId) return null;
  return chart;
}

/**
 * Make sure a report is linked to a Client record (created from the report's
 * subject snapshot if needed). Returns the client.
 */
export async function ensureClientForReport(report: ReportRow) {
  if (report.clientId) {
    const existing = await prisma.client.findUnique({ where: { id: report.clientId } });
    if (existing) return existing;
  }
  const client = await prisma.client.create({
    data: { coachId: report.coachId, name: report.clientName, sex: report.sex },
  });
  await prisma.report.update({ where: { id: report.id }, data: { clientId: client.id } });
  await prisma.dietChart.updateMany({ where: { reportId: report.id }, data: { clientId: client.id } });
  return client;
}
