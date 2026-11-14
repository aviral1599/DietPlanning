"use client";

import { useMemo } from "react";
import { expandCustomRows } from "./bank";

export interface CustomDishRow {
  id: string;
  coachId: string;
  data: string;
}

/**
 * Built-in + custom dishes. `all` is what pickers and the food bank offer;
 * `index` resolves every dish id (including client-specific versions).
 */
export function useDishes(customRows: CustomDishRow[] | undefined) {
  return useMemo(() => {
    const { custom, pool, index, ingredients, replaced } = expandCustomRows(customRows ?? []);
    return { all: pool, index, custom, ingredients, replaced };
  }, [customRows]);
}

export function fmtDate(iso: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" }) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", opts);
}

export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
