"use client";

import { useMemo } from "react";
import { customIngredientKey, registerCustomIngredients } from "@/lib/foodbank/bank";
import type { CustomDishRow } from "@/lib/foodbank/client";
import { INGREDIENTS } from "@/lib/foodbank/ingredients";
import type { CustomDishData, Dish, Ingredient } from "@/lib/foodbank/types";
import type { RecipeActions } from "./RecipeEditor";

async function send(url: string, method: string, body: unknown) {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Could not save.");
  return data as { dish: CustomDishRow; chartsUpdated?: number };
}

const plain = (d: CustomDishData): CustomDishData => {
  const { variantOf: _v, chartId: _c, replaces: _r, replaceActive: _a, ...rest } = d;
  return rest;
};

/**
 * Recipe actions backed by the custom-dish API. `chart` adds the
 * "customised for this client" option and keeps the open chart in step.
 */
export function useRecipeBank({
  customIngredients,
  setCustomRows,
  chart,
}: {
  customIngredients: Ingredient[];
  setCustomRows: (fn: (rows: CustomDishRow[]) => CustomDishRow[]) => void;
  chart?: {
    id: string;
    /** Save pending edits before the server rewrites charts. */
    flush: () => Promise<void>;
    /** Point every use of `fromId` in this chart at `toId`. */
    swapDish: (fromId: string, toId: string) => void;
    /** Reload this chart after the server changed it. */
    reload: () => Promise<void>;
  };
}): RecipeActions {
  return useMemo(() => {
    const addRow = (row: CustomDishRow) => setCustomRows((rows) => [row, ...rows.filter((r) => r.id !== row.id)]);

    const actions: RecipeActions = {
      ingredients: [...INGREDIENTS, ...customIngredients].sort((a, b) => a.name.localeCompare(b.name)),

      async addIngredient(data) {
        const { dish: row } = await send("/api/foodbank/dishes", "POST", { kind: "ingredient", ...data });
        registerCustomIngredients([row]);
        addRow(row);
        return { ...data, key: customIngredientKey(row.id), source: "Added by coach", category: "", cost: 1 } as Ingredient;
      },

      async saveNew(_base: Dish, data) {
        const { dish: row } = await send("/api/foodbank/dishes", "POST", plain(data));
        addRow(row);
        return row.id;
      },

      async replace(base, data) {
        if (base.custom) {
          // The coach's own dish (or a replacement already made): update it in place.
          const { dish: row } = await send(`/api/foodbank/dishes/${base.id}`, "PUT", data);
          addRow(row);
          return;
        }
        await chart?.flush();
        const { dish: row } = await send("/api/foodbank/dishes", "POST", { ...plain(data), replaces: base.id, replaceActive: true });
        addRow(row);
        if (chart) await chart.reload();
      },

      async restore(dish) {
        const { dish: row } = await send(`/api/foodbank/dishes/${dish.id}`, "PUT", { restoreOriginal: true });
        addRow(row);
      },
    };

    if (chart) {
      actions.forClient = async (base, data) => {
        if (base.hidden && base.chartId === chart.id) {
          // Already this client's version — just update it.
          const { dish: row } = await send(`/api/foodbank/dishes/${base.id}`, "PUT", data);
          addRow(row);
          return base.id;
        }
        const { dish: row } = await send("/api/foodbank/dishes", "POST", { ...plain(data), variantOf: base.id, chartId: chart.id });
        addRow(row);
        chart.swapDish(base.id, row.id);
        return row.id;
      };
    }
    return actions;
  }, [customIngredients, setCustomRows, chart]);
}
