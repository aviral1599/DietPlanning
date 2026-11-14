// Copy / duplicate dishes, meals and whole days inside a diet chart.
// Pure functions — every copy gets fresh uids and is marked as a coach edit.

import { MEAL_TIMES, type MealTime } from "../types";
import { newUid, type ChartDay, type ChartEvent, type PlanItem } from "./engine";
import { mealTimeOn, toMin } from "./schedule";

export type CopyMode = "add" | "replace";

/** Fresh copies: new uids, unlocked, attributed to the coach. */
export function cloneItems(items: PlanItem[]): PlanItem[] {
  return items.map((i) => ({ ...i, uid: newUid(), locked: false, by: "coach" as const, alts: i.alts?.map((a) => ({ ...a })) }));
}

/** Put copies of `items` into the given meal on each target day. */
export function copyItemsTo(days: ChartDay[], items: PlanItem[], targetDays: number[], meal: MealTime, mode: CopyMode): ChartDay[] {
  const set = new Set(targetDays);
  return days.map((d) => {
    if (!set.has(d.day)) return d;
    const existing = mode === "replace" ? [] : d.meals[meal] ?? [];
    // In "add" mode skip dishes already in that meal so a copy never doubles up.
    const fresh = cloneItems(items).filter((i) => mode === "replace" || !existing.some((e) => e.dishId === i.dishId));
    return { ...d, meals: { ...d.meals, [meal]: [...existing, ...fresh] } };
  });
}

/** Copy one day's meals (and optionally its exercise / supplements and meal times) onto other days, replacing what's there. */
export function copyDay(days: ChartDay[], from: number, targetDays: number[], opts: { schedule: boolean }): ChartDay[] {
  const src = days.find((d) => d.day === from);
  if (!src) return days;
  const set = new Set(targetDays.filter((t) => t !== from));
  return days.map((d) => {
    if (!set.has(d.day)) return d;
    const meals = Object.fromEntries(MEAL_TIMES.map((m) => [m, cloneItems(src.meals[m] ?? [])])) as ChartDay["meals"];
    if (!opts.schedule) return { ...d, meals };
    const events: ChartEvent[] = (src.events ?? []).map((e) => {
      const c = { ...e, uid: newUid() };
      delete c.series;
      return c;
    });
    return { ...d, meals, events, times: src.times ? { ...src.times } : undefined };
  });
}

/** The meal slot whose time on `day` is closest to `time` — used when a meal is dropped somewhere new. */
export function nearestMeal(day: ChartDay, time: string, chartTimes: Partial<Record<MealTime, string>>): MealTime {
  const t = toMin(time);
  let best: MealTime = "breakfast";
  let bestGap = Infinity;
  for (const m of MEAL_TIMES) {
    const gap = Math.abs(toMin(mealTimeOn(day, m, chartTimes)) - t);
    if (gap < bestGap) {
      bestGap = gap;
      best = m;
    }
  }
  return best;
}
