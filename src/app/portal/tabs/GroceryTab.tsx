"use client";

import GroceryList from "@/components/foodbank/GroceryList";
import type { ChartDTO } from "@/lib/foodbank/server";
import type { Dish } from "@/lib/foodbank/types";

/** Grocery: the shopping list for the plan (not restyled yet). */
export default function GroceryTab({ chart, index }: { chart: ChartDTO; index: Record<string, Dish> }) {
  return (
    <div className="card p-4">
      <h2 className="mb-3 text-lg font-bold text-slate-900">Grocery list</h2>
      <GroceryList days={chart.days} index={index} storageKey={`nutriplan:grocery:${chart.id}:${chart.version}`} />
    </div>
  );
}
