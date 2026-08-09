"use client";

import { useMemo, useState } from "react";
import {
  ComprehensiveRow,
  DescriptiveItem,
  DistributiveMenu,
  FoodGroup,
  FOOD_GROUP_LABELS,
  FOOD_GROUP_ORDER,
  MealTime,
  MEAL_TIMES,
  MEAL_TIME_LABELS,
  MenuPlan,
} from "@/lib/types";
import { EXCHANGE_UNITS } from "@/lib/exchange-data";
import { buildComprehensive, buildDistributive } from "@/lib/planner";
import { round } from "@/lib/nutrition";
import { MealDistributionChart } from "./Charts";
import type { LoadedReport } from "./ReportWorkspace";

const numInput =
  "w-16 rounded border border-slate-200 px-1.5 py-1 text-center text-sm focus:border-brand-400 focus:outline-none";

export default function MenuTab({
  report,
  onMenuChange,
  onSave,
  saving,
}: {
  report: LoadedReport;
  onMenuChange: (m: MenuPlan) => void;
  onSave: (m: MenuPlan) => void;
  saving: boolean;
}) {
  const menu = report.menuPlan;
  const target = report.results;

  // Comprehensive is authoritative for exchange counts. Derive alloc map.
  const alloc = useMemo(() => {
    const m = {} as Record<FoodGroup, number>;
    for (const g of FOOD_GROUP_ORDER) m[g] = 0;
    menu.comprehensive?.forEach((r) => (m[r.group] = r.exchanges));
    return m;
  }, [menu.comprehensive]);

  function setExchanges(group: FoodGroup, value: number) {
    const nextAlloc = { ...alloc, [group]: Math.max(0, value) };
    const { rows, totals } = buildComprehensive(nextAlloc);
    onMenuChange({ ...menu, comprehensive: rows, totals });
  }

  function redistribute() {
    const distributive = buildDistributive(alloc);
    onMenuChange({ ...menu, distributive });
  }

  function setDistCell(group: FoodGroup, meal: MealTime, value: number) {
    const distributive: DistributiveMenu = {
      ...menu.distributive,
      [group]: { ...menu.distributive[group], [meal]: Math.max(0, value) },
    };
    onMenuChange({ ...menu, distributive });
  }

  function updateDescriptive(items: DescriptiveItem[]) {
    onMenuChange({ ...menu, descriptive: items });
  }

  const totals = menu.totals ?? { energy: 0, protein: 0, fat: 0, cho: 0 };

  return (
    <div className="space-y-8">
      {/* Target vs planned banner */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <TargetCard label="Energy" target={target.energy} planned={totals.energy} unit="kcal" />
        <TargetCard label="Protein" target={target.protein.grams} planned={totals.protein} unit="g" />
        <TargetCard label="Fat" target={target.fat.grams} planned={totals.fat} unit="g" />
        <TargetCard label="Carbohydrate" target={target.cho.grams} planned={totals.cho} unit="g" />
      </div>

      {/* Comprehensive menu */}
      <section className="card p-6">
        <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-brand-700">
          Comprehensive Menu — Exchanges by Food Group
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="th">Food Group</th>
                <th className="th text-center">Exchanges</th>
                <th className="th text-right">Energy (kcal)</th>
                <th className="th text-right">Protein (g)</th>
                <th className="th text-right">Fat (g)</th>
                <th className="th text-right">CHO (g)</th>
              </tr>
            </thead>
            <tbody>
              {(menu.comprehensive ?? []).map((r: ComprehensiveRow) => (
                <tr key={r.group}>
                  <td className="td font-medium">{FOOD_GROUP_LABELS[r.group]}</td>
                  <td className="td text-center">
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      className={numInput}
                      value={r.exchanges}
                      onChange={(e) => setExchanges(r.group, Number(e.target.value))}
                    />
                  </td>
                  <td className="td text-right">{r.energy}</td>
                  <td className="td text-right">{r.protein}</td>
                  <td className="td text-right">{r.fat}</td>
                  <td className="td text-right">{r.cho}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 font-bold">
                <td className="td">TOTAL</td>
                <td className="td"></td>
                <td className="td text-right">{totals.energy}</td>
                <td className="td text-right">{totals.protein}</td>
                <td className="td text-right">{totals.fat}</td>
                <td className="td text-right">{totals.cho}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <div className="mt-3 flex justify-end">
          <button className="btn-secondary text-xs" onClick={redistribute}>
            ↻ Auto-distribute across meals
          </button>
        </div>
      </section>

      {/* Distributive menu */}
      <section className="card p-6">
        <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-brand-700">
          Distributive Menu — Exchanges across Meal Times
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="th">Food Group</th>
                {MEAL_TIMES.map((m) => (
                  <th key={m} className="th text-center text-[10px]">
                    {MEAL_TIME_LABELS[m]}
                  </th>
                ))}
                <th className="th text-center">Total</th>
              </tr>
            </thead>
            <tbody>
              {FOOD_GROUP_ORDER.map((g) => {
                const rowTotal = MEAL_TIMES.reduce(
                  (s, m) => s + (menu.distributive?.[g]?.[m] ?? 0),
                  0
                );
                const mismatch = Math.abs(rowTotal - alloc[g]) > 0.01;
                return (
                  <tr key={g}>
                    <td className="td font-medium">{FOOD_GROUP_LABELS[g]}</td>
                    {MEAL_TIMES.map((m) => (
                      <td key={m} className="td text-center">
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          className={numInput + " w-12"}
                          value={menu.distributive?.[g]?.[m] ?? 0}
                          onChange={(e) => setDistCell(g, m, Number(e.target.value))}
                        />
                      </td>
                    ))}
                    <td
                      className={`td text-center font-semibold ${
                        mismatch ? "text-red-600" : "text-slate-700"
                      }`}
                      title={mismatch ? `Should total ${alloc[g]}` : ""}
                    >
                      {round(rowTotal)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-slate-400">
          Totals in red don&apos;t match the prescribed exchanges above. Use
          Auto-distribute or adjust cells.
        </p>
      </section>

      {/* Meal distribution chart */}
      <section className="card p-6">
        <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-brand-700">
          Energy Distribution by Meal
        </h3>
        <MealDistributionChart menuPlan={menu} />
      </section>

      {/* Descriptive menu */}
      <DescriptiveEditor
        items={menu.descriptive ?? []}
        onChange={updateDescriptive}
      />

      <div className="flex justify-end">
        <button className="btn-primary" disabled={saving} onClick={() => onSave(menu)}>
          {saving ? "Saving…" : "Save menu plan"}
        </button>
      </div>
    </div>
  );
}

function TargetCard({
  label,
  target,
  planned,
  unit,
}: {
  label: string;
  target: number;
  planned: number;
  unit: string;
}) {
  const diff = planned - target;
  const pct = target > 0 ? Math.abs(diff / target) : 0;
  const ok = pct <= 0.1;
  return (
    <div className="card p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="text-xl font-bold text-slate-900">{planned}</span>
        <span className="text-xs text-slate-400">/ {target} {unit}</span>
      </div>
      <div className={`text-xs font-medium ${ok ? "text-brand-600" : "text-amber-600"}`}>
        {diff > 0 ? "+" : ""}
        {round(diff)} {unit} {ok ? "· on target" : "· adjust"}
      </div>
    </div>
  );
}

function DescriptiveEditor({
  items,
  onChange,
}: {
  items: DescriptiveItem[];
  onChange: (items: DescriptiveItem[]) => void;
}) {
  const update = (id: string, patch: Partial<DescriptiveItem>) =>
    onChange(items.map((it) => (it.id === id ? { ...it, ...patch } : it)));

  const remove = (id: string) => onChange(items.filter((it) => it.id !== id));

  const add = () =>
    onChange([
      ...items,
      {
        id: `d${Date.now()}`,
        mealTime: "breakfast",
        recipe: "",
        ingredients: "",
        group: "",
        exchanges: 0,
        energy: 0,
        protein: 0,
        fat: 0,
        cho: 0,
      },
    ]);

  return (
    <section className="card p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-bold uppercase tracking-wide text-brand-700">
          Descriptive Menu — Recipes &amp; Timing
        </h3>
        <button className="btn-secondary text-xs" onClick={add}>
          + Add row
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="th">Meal</th>
              <th className="th">Recipe</th>
              <th className="th">Ingredients</th>
              <th className="th text-right">Energy</th>
              <th className="th text-right">P</th>
              <th className="th text-right">F</th>
              <th className="th text-right">CHO</th>
              <th className="th"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id}>
                <td className="td">
                  <select
                    className="w-28 rounded border border-slate-200 px-1 py-1 text-xs"
                    value={it.mealTime}
                    onChange={(e) =>
                      update(it.id, { mealTime: e.target.value as MealTime })
                    }
                  >
                    {MEAL_TIMES.map((m) => (
                      <option key={m} value={m}>
                        {MEAL_TIME_LABELS[m]}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="td">
                  <input
                    className="w-full min-w-[10rem] rounded border border-slate-200 px-1.5 py-1"
                    value={it.recipe}
                    onChange={(e) => update(it.id, { recipe: e.target.value })}
                  />
                </td>
                <td className="td">
                  <input
                    className="w-full min-w-[10rem] rounded border border-slate-200 px-1.5 py-1"
                    value={it.ingredients}
                    onChange={(e) => update(it.id, { ingredients: e.target.value })}
                  />
                </td>
                {(["energy", "protein", "fat", "cho"] as const).map((k) => (
                  <td key={k} className="td text-right">
                    <input
                      type="number"
                      className={numInput + " w-14"}
                      value={it[k]}
                      onChange={(e) => update(it.id, { [k]: Number(e.target.value) })}
                    />
                  </td>
                ))}
                <td className="td">
                  <button
                    className="text-xs text-slate-300 hover:text-red-500"
                    onClick={() => remove(it.id)}
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td className="td text-center text-slate-400" colSpan={8}>
                  No recipe rows yet. Click &ldquo;Add row&rdquo; or recalculate to
                  auto-draft.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
