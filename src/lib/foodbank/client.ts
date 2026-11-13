"use client";

import { useMemo } from "react";
import { BUILTIN_DISHES, customToDish } from "./bank";
import type { Dish } from "./types";

export interface CustomDishRow {
  id: string;
  coachId: string;
  data: string;
}

/** Built-in + custom dishes as a list and an id → dish index. */
export function useDishes(customRows: CustomDishRow[] | undefined) {
  return useMemo(() => {
    const custom = (customRows ?? []).map(customToDish).filter((d): d is Dish => !!d);
    const all = [...custom, ...BUILTIN_DISHES];
    const index: Record<string, Dish> = Object.fromEntries(all.map((d) => [d.id, d]));
    return { all, index, custom };
  }, [customRows]);
}

export function fmtDate(iso: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" }) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", opts);
}

export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
