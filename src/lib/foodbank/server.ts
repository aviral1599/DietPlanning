import "server-only";
import { prisma } from "../db";
import { safeJsonParse } from "../api";
import type { CalcResults, MealTime, MenuPlan, SubjectInfo } from "../types";
import { toSubjectInfo } from "../report";
import { expandCustomRows, parseAllergies } from "./bank";
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

/** Coach's custom rows expanded (ingredients registered, pool + full index). */
export async function loadCoachFood(coachId: string) {
  const rows = await prisma.customDish.findMany({ where: { coachId }, orderBy: { createdAt: "desc" } });
  return expandCustomRows(rows);
}

/** Dishes the generator may use: built-in + the coach's own (replacements applied). */
export async function loadDishPool(coachId: string): Promise<Dish[]> {
  return (await loadCoachFood(coachId)).pool;
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
  /** Options the client ticked: key `${day}:${uid}` → 0 main, 1.. alternative. */
  choices?: Record<string, number>;
  /** Meals the client ticked as eaten (portal only): key `${day}:${meal}`. */
  checks?: Record<string, true>;
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

/**
 * Point every item (and alternative) that uses `fromId` at `toId` in all of a
 * coach's charts. Returns how many charts changed. Used when a coach replaces
 * a built-in dish with their own version.
 */
export async function rewriteDishInCharts(coachId: string, fromId: string, toId: string, onlyChartId?: string): Promise<number> {
  const charts = await prisma.dietChart.findMany({ where: { coachId, ...(onlyChartId ? { id: onlyChartId } : {}) } });
  let changed = 0;
  for (const c of charts) {
    const days = safeJsonParse<ChartDay[]>(c.days, []);
    let hit = false;
    for (const d of days) {
      for (const items of Object.values(d.meals ?? {})) {
        for (const it of items ?? []) {
          if (it.dishId === fromId) {
            it.dishId = toId;
            hit = true;
          }
          for (const a of it.alts ?? []) {
            if (a.dishId === fromId) {
              a.dishId = toId;
              hit = true;
            }
          }
        }
      }
    }
    if (hit) {
      await prisma.dietChart.update({ where: { id: c.id }, data: { days: JSON.stringify(days), version: { increment: 1 }, updatedBy: "coach" } });
      changed++;
    }
  }
  return changed;
}

export { chartPool } from "./bank";

export const choiceKey = (day: number, uid: string) => `${day}:${uid}`;

/** Client-ticked options for these charts, by chart id. */
export async function loadChoices(chartIds: string[]): Promise<Record<string, Record<string, number>>> {
  if (!chartIds.length) return {};
  // Never let ticks break loading a chart (e.g. before the MealChoice table exists).
  const rows = await prisma.mealChoice.findMany({ where: { chartId: { in: chartIds } } }).catch((e) => {
    console.error("loadChoices failed", e);
    return [];
  });
  const out: Record<string, Record<string, number>> = {};
  for (const r of rows) (out[r.chartId] ??= {})[choiceKey(r.day, r.uid)] = r.choice;
  return out;
}

/** Chart DTOs with the client's ticked options attached. */
export async function chartsWithChoices(rows: ChartRow[]): Promise<ChartDTO[]> {
  const choices = await loadChoices(rows.map((r) => r.id));
  return rows.map((r) => ({ ...toChartDTO(r), choices: choices[r.id] ?? {} }));
}

export const mealCheckKey = (day: number, meal: string) => `${day}:${meal}`;

/** Meals the client ticked as eaten, by chart id (key `${day}:${meal}`). */
export async function loadMealChecks(chartIds: string[]): Promise<Record<string, Record<string, true>>> {
  if (!chartIds.length) return {};
  // Never let ticks break loading a chart (e.g. before the MealCheck table exists).
  const rows = await prisma.mealCheck.findMany({ where: { chartId: { in: chartIds } } }).catch((e) => {
    console.error("loadMealChecks failed", e);
    return [];
  });
  const out: Record<string, Record<string, true>> = {};
  for (const r of rows) (out[r.chartId] ??= {})[mealCheckKey(r.day, r.meal)] = true;
  return out;
}
