import type { MealTime } from "../types";
import { MEAL_TIMES } from "../types";
import { formatPortion } from "./bank";
import { ChartDay, newUid, PlanItem } from "./engine";
import type { Dish } from "./types";

export type ChangeAction = "swap" | "remove" | "add" | "portion";
export type ChangeScope = "this" | "all";

export interface ChangeSpec {
  day: number;
  meal: MealTime;
  action: ChangeAction;
  scope: ChangeScope;
  targetUid?: string | null;
  fromItem?: PlanItem | null;
  toItem?: PlanItem | null;
}

export interface ApplyResult {
  days: ChartDay[];
  applied: number; // number of items changed
  conflict?: string;
}

function clone(days: ChartDay[]): ChartDay[] {
  return JSON.parse(JSON.stringify(days)) as ChartDay[];
}

/** Locate the target item: by uid first, then by dish in the same meal. */
function findTarget(day: ChartDay | undefined, meal: MealTime, spec: ChangeSpec): PlanItem | undefined {
  if (!day) return undefined;
  const items = day.meals[meal] ?? [];
  return (
    items.find((i) => i.uid === spec.targetUid) ??
    (spec.fromItem ? items.find((i) => i.dishId === spec.fromItem!.dishId) : undefined)
  );
}

/** Apply a change request to a chart (returns a new array; input untouched). */
export function applyChange(input: ChartDay[], spec: ChangeSpec): ApplyResult {
  const days = clone(input);
  const day = days.find((d) => d.day === spec.day);
  if (!day) return { days: input, applied: 0, conflict: "That day is no longer in the chart." };

  if (spec.action === "add") {
    if (!spec.toItem) return { days: input, applied: 0, conflict: "Nothing to add." };
    day.meals[spec.meal] = [...(day.meals[spec.meal] ?? []), { ...spec.toItem, uid: newUid(), by: "client" }];
    return { days, applied: 1 };
  }

  const target = findTarget(day, spec.meal, spec);
  if (!target) {
    return { days: input, applied: 0, conflict: "The item was changed or removed since the request was made." };
  }
  const fromDish = target.dishId;

  // Which (day, meal, item) tuples does this change touch?
  const targets: { d: ChartDay; meal: MealTime; it: PlanItem }[] = [];
  if (spec.scope === "all" && spec.action !== "portion") {
    for (const d of days) {
      for (const m of MEAL_TIMES) {
        for (const it of d.meals[m] ?? []) if (it.dishId === fromDish) targets.push({ d, meal: m, it });
      }
    }
  } else {
    targets.push({ d: day, meal: spec.meal, it: target });
  }

  for (const t of targets) {
    if (spec.action === "remove") {
      t.d.meals[t.meal] = t.d.meals[t.meal].filter((x) => x.uid !== t.it.uid);
    } else if (spec.action === "swap" && spec.toItem) {
      t.it.dishId = spec.toItem.dishId;
      t.it.units = spec.toItem.units;
      t.it.by = "client";
      t.it.locked = false;
    } else if (spec.action === "portion" && spec.toItem) {
      t.it.units = spec.toItem.units;
      t.it.by = "client";
    }
  }
  return { days, applied: targets.length };
}

export const ACTION_LABELS: Record<ChangeAction, string> = {
  swap: "Swap dish",
  remove: "Remove dish",
  add: "Add dish",
  portion: "Change portion",
};

/** Human-readable summary of a change request. */
export function describeRequest(r: { action: string; scope: string; fromItem: PlanItem | null; toItem: PlanItem | null }, index: Record<string, Dish>) {
  const from = r.fromItem ? index[r.fromItem.dishId] : undefined;
  const to = r.toItem ? index[r.toItem.dishId] : undefined;
  const fromTxt = from ? `${from.name} (${formatPortion(from, r.fromItem!.units)})` : "a dish";
  const toTxt = to ? `${to.name} (${formatPortion(to, r.toItem!.units)})` : "";
  const scope = r.scope === "all" ? " — everywhere in the plan" : "";
  switch (r.action as ChangeAction) {
    case "swap":
      return `Swap ${fromTxt} → ${toTxt}${scope}`;
    case "remove":
      return `Remove ${fromTxt}${scope}`;
    case "add":
      return `Add ${toTxt}`;
    case "portion":
      return `Change ${from?.name ?? "portion"}: ${from ? formatPortion(from, r.fromItem!.units) : ""} → ${to ? formatPortion(to, r.toItem!.units) : ""}`;
    default:
      return ACTION_LABELS[r.action as ChangeAction] ?? r.action;
  }
}

