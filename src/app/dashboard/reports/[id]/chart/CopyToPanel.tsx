"use client";

import { useState } from "react";
import { fmtDate } from "@/lib/foodbank/client";
import type { CopyMode } from "@/lib/foodbank/copy";
import { WEEKDAYS, weekdayOf, type ChartDay } from "@/lib/foodbank/engine";
import { MEAL_TIMES, MEAL_TIME_LABELS, type MealTime } from "@/lib/types";

export type CopySource =
  | { kind: "items"; day: number; meal: MealTime; label: string }
  | { kind: "day"; day: number };

export interface CopyOptions {
  days: number[];
  meal: MealTime;
  mode: CopyMode;
  schedule: boolean;
}

export default function CopyToPanel({
  days,
  source,
  onApply,
  onCancel,
}: {
  days: ChartDay[];
  source: CopySource;
  onApply: (opts: CopyOptions) => void;
  onCancel: () => void;
}) {
  const isDay = source.kind === "day";
  const srcDay = days.find((d) => d.day === source.day);
  const [meal, setMeal] = useState<MealTime>(source.kind === "items" ? source.meal : "breakfast");
  const [mode, setMode] = useState<CopyMode>("add");
  const [schedule, setSchedule] = useState(true);
  const [picked, setPicked] = useState<Set<number>>(new Set());

  // Copying a dish to another meal on the same day is fine; a whole day onto itself isn't.
  const selectable = (d: ChartDay) => !(d.day === source.day && (isDay || meal === (source.kind === "items" ? source.meal : null)));
  const toggle = (d: number) =>
    setPicked((p) => {
      const n = new Set(p);
      if (n.has(d)) n.delete(d);
      else n.add(d);
      return n;
    });
  const pick = (f: (d: ChartDay) => boolean) => setPicked(new Set(days.filter((d) => selectable(d) && f(d)).map((d) => d.day)));
  const weeks: ChartDay[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
  const chosen = [...picked].filter((d) => {
    const day = days.find((x) => x.day === d);
    return day && selectable(day);
  });
  const srcWeekday = srcDay ? weekdayOf(srcDay.date) : 0;

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        {source.kind === "items" ? (
          <>
            Copy <b className="text-slate-900">{source.label}</b> from {MEAL_TIME_LABELS[source.meal]} on day {source.day + 1}
            {srcDay ? ` (${fmtDate(srcDay.date)})` : ""}.
          </>
        ) : (
          <>
            Copy everything on <b className="text-slate-900">day {source.day + 1}</b>
            {srcDay ? ` (${fmtDate(srcDay.date, { weekday: "long", day: "numeric", month: "short" })})` : ""} to other days.
          </>
        )}
      </p>

      {!isDay && (
        <label className="block">
          <span className="label">Into which meal</span>
          <select className="input max-w-xs py-1.5" value={meal} onChange={(e) => setMeal(e.target.value as MealTime)}>
            {MEAL_TIMES.map((m) => (
              <option key={m} value={m}>
                {MEAL_TIME_LABELS[m]}
                {source.kind === "items" && m === source.meal ? " (same meal)" : ""}
              </option>
            ))}
          </select>
        </label>
      )}

      <div>
        <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
          <span className="label mb-0">To which days</span>
          <span className="flex flex-wrap gap-2 text-xs">
            <button className="font-medium text-brand-700 hover:underline" onClick={() => pick(() => true)}>
              All days
            </button>
            <button className="font-medium text-brand-700 hover:underline" onClick={() => pick((d) => d.day > source.day && Math.floor(d.day / 7) === Math.floor(source.day / 7))}>
              Rest of this week
            </button>
            {days.length > 7 && (
              <button className="font-medium text-brand-700 hover:underline" onClick={() => pick((d) => weekdayOf(d.date) === srcWeekday)}>
                Every {WEEKDAYS[srcWeekday]}
              </button>
            )}
            <button className="text-slate-500 hover:underline" onClick={() => setPicked(new Set())}>
              Clear
            </button>
          </span>
        </div>
        <div className="space-y-1.5">
          {weeks.map((w, wi) => (
            <div key={wi} className="flex flex-wrap items-center gap-1.5">
              {weeks.length > 1 && <span className="w-14 text-[11px] font-semibold uppercase text-slate-400">Week {wi + 1}</span>}
              {w.map((d) => {
                const can = selectable(d);
                const on = picked.has(d.day) && can;
                return (
                  <button
                    key={d.day}
                    disabled={!can}
                    aria-pressed={on}
                    onClick={() => toggle(d.day)}
                    title={can ? fmtDate(d.date) : "This is the source"}
                    className={`flex w-14 flex-col items-center rounded-lg border py-1 text-xs ${
                      on ? "border-brand-600 bg-brand-600 text-white" : can ? "border-slate-200 bg-white text-slate-600 hover:border-brand-400" : "border-dashed border-slate-200 text-slate-300"
                    }`}
                  >
                    <span className="font-semibold">{WEEKDAYS[weekdayOf(d.date)]}</span>
                    <span className={on ? "text-brand-100" : "text-slate-400"}>{Number(d.date.slice(8, 10))}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {isDay ? (
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={schedule} onChange={(e) => setSchedule(e.target.checked)} className="h-4 w-4 accent-brand-600" />
            Also copy exercise, supplements, water and meal times
          </label>
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">This replaces every meal on the chosen days. You can undo it straight after.</p>
        </div>
      ) : (
        <div role="radiogroup" aria-label="How to copy" className="flex flex-wrap gap-4 text-sm text-slate-700">
          <label className="flex items-center gap-2">
            <input type="radio" name="copy-mode" checked={mode === "add"} onChange={() => setMode("add")} className="accent-brand-600" />
            Add to what&apos;s there
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="copy-mode" checked={mode === "replace"} onChange={() => setMode("replace")} className="accent-brand-600" />
            Replace that meal
          </label>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-3">
        <button className="btn-ghost" onClick={onCancel}>
          Cancel
        </button>
        <button className="btn-primary" disabled={!chosen.length} onClick={() => onApply({ days: chosen, meal, mode, schedule })}>
          {chosen.length ? `Copy to ${chosen.length} day${chosen.length > 1 ? "s" : ""}` : "Choose days"}
        </button>
      </div>
    </div>
  );
}
