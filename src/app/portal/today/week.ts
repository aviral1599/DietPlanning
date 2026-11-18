// Week strip logic for the portal's Today tab. Pure functions, no React.
import { addDays, weekdayOf, type ChartDay } from "@/lib/foodbank/engine";
import { MEAL_TIMES, type MealTime } from "@/lib/types";

/** Key of a ticked meal in `chart.checks` (same shape as the server's mealCheckKey). */
export const checkKey = (day: number, meal: MealTime) => `${day}:${meal}`;

/** The meals that have something planned on this day (empty slots don't count). */
export function plannedMeals(day: ChartDay): MealTime[] {
  return MEAL_TIMES.filter((m) => (day.meals?.[m]?.length ?? 0) > 0);
}

export function dayProgress(day: ChartDay, checks: Record<string, true>) {
  const meals = plannedMeals(day);
  const ticked = meals.filter((m) => checks[checkKey(day.day, m)]).length;
  return { ticked, total: meals.length };
}

/**
 * How a plan day's circle looks:
 * - done: every meal ticked (any date, today included)
 * - missed: a past day with nothing ticked
 * - partial: a past day with some meals ticked (arc = ticked / total)
 * - today: today, not all ticked (grey ring, arc = ticked / total, small dot)
 * - future: a plan day after today (dotted ring)
 */
export type DayStatus =
  | { kind: "done" }
  | { kind: "missed" }
  | { kind: "partial"; progress: number }
  | { kind: "today"; progress: number }
  | { kind: "future" };

export function dayStatus(day: ChartDay, checks: Record<string, true>, todayStr: string | null): DayStatus {
  const { ticked, total } = dayProgress(day, checks);
  if (total > 0 && ticked === total) return { kind: "done" };
  const progress = total > 0 ? ticked / total : 0;
  // Before the browser has told us today's date, draw every day as upcoming.
  if (!todayStr) return { kind: "future" };
  if (day.date === todayStr) return { kind: "today", progress };
  if (day.date > todayStr || total === 0) return { kind: "future" };
  return ticked === 0 ? { kind: "missed" } : { kind: "partial", progress };
}

/**
 * Monday-to-Sunday weeks covering the whole plan. Each week lists its 7 ISO
 * dates; dates outside the plan are still listed (drawn faint, not tappable).
 */
export function planWeeks(days: ChartDay[]): string[][] {
  if (!days.length) return [];
  const dates = days.map((d) => d.date).sort();
  const first = dates[0];
  const last = dates[dates.length - 1];
  const weeks: string[][] = [];
  for (let monday = addDays(first, -weekdayOf(first)); monday <= last; monday = addDays(monday, 7)) {
    weeks.push(Array.from({ length: 7 }, (_, i) => addDays(monday, i)));
  }
  return weeks;
}

/** The day to open on: today if it is in the plan, otherwise Day 1. */
export function defaultDate(days: ChartDay[], todayStr: string | null): string | null {
  if (!days.length) return null;
  if (todayStr && days.some((d) => d.date === todayStr)) return todayStr;
  return [...days].sort((a, b) => a.day - b.day)[0].date;
}
