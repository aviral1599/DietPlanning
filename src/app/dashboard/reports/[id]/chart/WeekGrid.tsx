"use client";

import { DietMark, Meter } from "@/components/foodbank/ui";
import { formatPortion } from "@/lib/foodbank/bank";
import { fmtDate } from "@/lib/foodbank/client";
import { dayTotals, mealTotals, type ChartDay, type ChartTargets } from "@/lib/foodbank/engine";
import type { Dish } from "@/lib/foodbank/types";
import { MEAL_TIMES, MEAL_TIME_LABELS, type MealTime } from "@/lib/types";

export interface CellRef {
  day: number;
  meal: MealTime;
  /** Set when a single dish in the cell is selected (for copy). */
  uid?: string;
}

export default function WeekGrid({
  days,
  index,
  targets,
  mealTimes,
  selected,
  pendingCells,
  onSelect,
  onRegenerateDay,
  onMealTimeChange,
  busyDay,
}: {
  days: ChartDay[];
  index: Record<string, Dish>;
  targets: ChartTargets;
  mealTimes: Record<MealTime, string>;
  selected: CellRef | null;
  pendingCells: Set<string>;
  onSelect: (c: CellRef) => void;
  onRegenerateDay: (day: number) => void;
  onMealTimeChange?: (meal: MealTime, time: string) => void;
  busyDay?: number | null;
}) {
  const meals = MEAL_TIMES.filter((m) => (targets.slotShare?.[m] ?? 0) > 0 || days.some((d) => d.meals[m]?.length));

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="w-full min-w-[1080px] table-fixed border-collapse text-xs">
        <colgroup>
          <col style={{ width: 112 }} />
          {days.map((d) => (
            <col key={d.day} />
          ))}
        </colgroup>
        <thead>
          <tr className="bg-slate-50">
            <th className="sticky left-0 z-10 border-b border-r border-slate-200 bg-slate-50 px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Meal
            </th>
            {days.map((d) => (
              <th key={d.day} className="border-b border-r border-slate-200 px-2 py-2 text-left align-top last:border-r-0">
                <div className="flex items-start justify-between gap-1">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Day {d.day + 1}</div>
                    <div className="text-sm font-semibold text-slate-800">{fmtDate(d.date)}</div>
                  </div>
                  <button
                    className="rounded-md px-1.5 py-0.5 text-sm text-slate-400 hover:bg-slate-200 hover:text-slate-700 disabled:animate-spin"
                    title="Regenerate this day (locked dishes stay)"
                    aria-label={`Regenerate day ${d.day + 1}`}
                    disabled={busyDay === d.day}
                    onClick={() => onRegenerateDay(d.day)}
                  >
                    ⟳
                  </button>
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {meals.map((m) => (
            <tr key={m}>
              <th className="sticky left-0 z-10 border-b border-r border-slate-200 bg-white px-2 py-2 text-left align-top">
                <div className="text-[12px] font-semibold text-slate-700">{MEAL_TIME_LABELS[m]}</div>
                {onMealTimeChange ? (
                  <input
                    type="time"
                    value={mealTimes[m] ?? ""}
                    onChange={(e) => onMealTimeChange(m, e.target.value)}
                    className="mt-0.5 w-[88px] rounded border border-transparent bg-transparent px-0.5 text-[11px] text-slate-400 hover:border-slate-200 focus:border-brand-400 focus:outline-none"
                    aria-label={`${MEAL_TIME_LABELS[m]} time`}
                  />
                ) : (
                  <div className="text-[11px] text-slate-400">{mealTimes[m]}</div>
                )}
                <div className="mt-0.5 text-[10px] text-slate-300">~{Math.round(targets.kcal * (targets.slotShare?.[m] ?? 0))} kcal</div>
              </th>
              {days.map((d) => {
                const items = d.meals[m] ?? [];
                const isSel = selected?.day === d.day && selected?.meal === m;
                const pending = pendingCells.has(`${d.day}:${m}`);
                const k = mealTotals(items, index).kcal;
                return (
                  <td
                    key={d.day}
                    onClick={() => onSelect({ day: d.day, meal: m })}
                    className={`relative cursor-pointer border-b border-r border-slate-200 p-1.5 align-top transition last:border-r-0 ${
                      isSel ? "bg-brand-50 ring-2 ring-inset ring-brand-500" : "hover:bg-slate-50"
                    }`}
                  >
                    {pending && (
                      <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-amber-500 ring-2 ring-white" title="Client change request pending" />
                    )}
                    <div className="flex flex-col gap-1">
                      {items.map((it) => {
                        const dish = index[it.dishId];
                        if (!dish) return <span key={it.uid} className="text-red-500">Missing dish</span>;
                        return (
                          <div
                            key={it.uid}
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelect({ day: d.day, meal: m, uid: it.uid });
                            }}
                            className={`rounded-md border px-1.5 py-1 leading-tight ${
                              isSel && selected?.uid === it.uid
                                ? "border-brand-500 bg-white ring-2 ring-brand-400"
                                : it.by === "client"
                                  ? "border-blue-200 bg-blue-50"
                                  : "border-slate-200 bg-white"
                            }`}
                          >
                            <div className="flex items-start gap-1">
                              <span className="mt-0.5"><DietMark dish={dish} size={9} /></span>
                              <span className="line-clamp-2 font-medium text-slate-700">{dish.name}</span>
                              {it.locked && <span className="ml-auto text-[10px]" title="Locked">🔒</span>}
                            </div>
                            <div className="pl-3.5 text-[10px] text-slate-400">{formatPortion(dish, it.units)}</div>
                            {(it.alts ?? []).map((a, i) => {
                              const ad = index[a.dishId];
                              return ad ? (
                                <div key={i} className="mt-0.5 border-t border-dashed border-slate-200 pl-3.5 pt-0.5 text-[10px] text-slate-500">
                                  <span className="font-semibold uppercase text-slate-400">or</span> {ad.name}{" "}
                                  <span className="text-slate-400">· {formatPortion(ad, a.units)}</span>
                                </div>
                              ) : null;
                            })}
                          </div>
                        );
                      })}
                      {items.length === 0 ? (
                        <span className="py-2 text-center text-[11px] text-slate-300">+ add</span>
                      ) : (
                        <span className="text-right text-[10px] tabular-nums text-slate-400">{Math.round(k)} kcal</span>
                      )}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-slate-50">
            <th className="sticky left-0 z-10 border-r border-slate-200 bg-slate-50 px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Day total
            </th>
            {days.map((d) => {
              const t = dayTotals(d, index);
              return (
                <td key={d.day} className="space-y-1.5 border-r border-slate-200 px-2 py-2 last:border-r-0">
                  <Meter compact label="kcal" value={t.kcal} target={targets.kcal} unit="" />
                  <Meter compact label="Protein" value={t.protein} target={targets.protein} unit="g" mode="min" />
                </td>
              );
            })}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
