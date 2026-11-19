"use client";

import { Icon, KIND_STYLES } from "@/components/foodbank/CalendarIcons";
import { Chip, DietMark } from "@/components/foodbank/ui";
import { formatPortion } from "@/lib/foodbank/bank";
import { fmtDate } from "@/lib/foodbank/client";
import { dayTotals, type ChartDay, type PlanItem } from "@/lib/foodbank/engine";
import { eventLabel, fmt12, mealTimeOn } from "@/lib/foodbank/schedule";
import type { ChartDTO } from "@/lib/foodbank/server";
import type { Dish } from "@/lib/foodbank/types";
import { MEAL_TIMES, MEAL_TIME_LABELS, type MealTime } from "@/lib/types";

/** My Plan: the whole plan week by week (not restyled yet). */
export default function PlanTab({
  chart,
  index,
  week,
  onWeekChange,
  todayStr,
  choices,
  pendingUids,
  onOpen,
}: {
  chart: ChartDTO;
  index: Record<string, Dish>;
  week: number;
  onWeekChange: (week: number) => void;
  todayStr: string | null;
  choices: Record<string, number>;
  pendingUids: Set<string | null>;
  onOpen: (item: PlanItem, meal: MealTime, day: ChartDay) => void;
}) {
  const w = Math.min(week, Math.max(0, Math.ceil(chart.days.length / 7) - 1));
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-slate-900">{chart.title}</h2>
          <div className="text-xs text-slate-500">
            {fmtDate(chart.startDate, { day: "numeric", month: "short" })} – {fmtDate(chart.days[chart.days.length - 1].date, { day: "numeric", month: "short", year: "numeric" })}
          </div>
        </div>
        <a href="/api/portal/chart/pdf" target="_blank" rel="noopener noreferrer" className="btn-accent px-3 py-1.5 text-xs">⬇ Download PDF</a>
      </div>
      {chart.days.length > 7 && (
        <div className="flex flex-wrap gap-1.5">
          {Array.from({ length: Math.ceil(chart.days.length / 7) }, (_, i) => (
            <Chip key={i} tone="brand" active={w === i} onClick={() => onWeekChange(i)}>Week {i + 1}</Chip>
          ))}
        </div>
      )}
      <div className="space-y-3">
        {chart.days.slice(w * 7, w * 7 + 7).map((d) => {
          const t = dayTotals(d, index);
          return (
            <details key={d.day} className="card group overflow-hidden" open={d.date === todayStr}>
              <summary className="flex cursor-pointer items-center justify-between px-4 py-3">
                <div>
                  <div className="font-semibold text-slate-900">{fmtDate(d.date, { weekday: "long", day: "numeric", month: "short" })}</div>
                  <div className="text-xs text-slate-500">{Math.round(t.kcal)} kcal · {Math.round(t.protein)} g protein</div>
                </div>
                <span className="text-slate-400 transition group-open:rotate-90">›</span>
              </summary>
              <div className="divide-y divide-slate-100 border-t border-slate-100">
                {MEAL_TIMES.filter((m) => d.meals[m]?.length).map((m) => (
                  <div key={m} className="flex gap-3 px-4 py-2.5">
                    <div className="w-24 shrink-0">
                      <div className="text-xs font-semibold text-slate-700">{MEAL_TIME_LABELS[m]}</div>
                      <div className="text-[11px] text-slate-400">{fmt12(mealTimeOn(d, m, chart.mealTimes))}</div>
                    </div>
                    <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
                      {d.meals[m].map((it) => {
                        const dish = index[it.dishId];
                        if (!dish) return null;
                        return (
                          <button key={it.uid} onClick={() => onOpen(it, m, d)} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700 hover:border-brand-400">
                            <DietMark dish={dish} size={9} />
                            {dish.name}
                            <span className="text-slate-400">· {formatPortion(dish, it.units)}</span>
                            {(it.alts ?? []).map((a, i) =>
                              index[a.dishId] ? (
                                <span key={i} className="text-slate-500">
                                  <b className="font-semibold text-slate-400"> or </b>
                                  {index[a.dishId].name}
                                </span>
                              ) : null
                            )}
                            {choices[`${d.day}:${it.uid}`] !== undefined && <span className="text-brand-600" title="You ticked an option">✓</span>}
                            {pendingUids.has(it.uid) && <span className="h-1.5 w-1.5 rounded-full bg-amber-500" title="Change requested" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
                {(d.events ?? []).length > 0 && (
                  <div className="flex gap-3 px-4 py-2.5">
                    <div className="w-24 shrink-0 text-xs font-semibold text-slate-700">Exercise and supplements</div>
                    <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
                      {(d.events ?? []).map((e) => (
                        <span key={e.uid} className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${KIND_STYLES[e.kind].block}`}>
                          <Icon name={e.kind} className="h-3 w-3" />
                          {eventLabel(e)}
                          <span className="opacity-60">· {fmt12(e.time)}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </details>
          );
        })}
      </div>
    </>
  );
}
