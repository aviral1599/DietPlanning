"use client";

import { useMemo, useState } from "react";
import DishDetail from "@/components/foodbank/DishDetail";
import DishPicker from "@/components/foodbank/DishPicker";
import { Chip, DietMark, MacroLine, Meter } from "@/components/foodbank/ui";
import { formatPortion, scaled, snapUnits } from "@/lib/foodbank/bank";
import { describeRequest } from "@/lib/foodbank/changes";
import { fmtDate } from "@/lib/foodbank/client";
import {
  mealTotals,
  newUid,
  suggestSwaps,
  type ChartDay,
  type ChartPrefs,
  type ChartProfile,
  type ChartTargets,
  type PlanItem,
} from "@/lib/foodbank/engine";
import type { Dish } from "@/lib/foodbank/types";
import { MEAL_TIME_LABELS, type MealTime } from "@/lib/types";

export interface PendingRequest {
  id: string;
  chartId: string;
  day: number;
  meal: string;
  action: string;
  scope: string;
  fromItem: PlanItem | null;
  toItem: PlanItem | null;
  note: string;
  clientName: string;
  createdAt: string;
}

export default function MealEditor({
  day,
  meal,
  allDays,
  index,
  pool,
  profile,
  prefs,
  targets,
  mealTime,
  pending,
  onChange,
  onResolve,
  onClose,
}: {
  day: ChartDay;
  meal: MealTime;
  allDays: ChartDay[];
  index: Record<string, Dish>;
  pool: Dish[]; // dishes that fit the client's profile
  profile: ChartProfile;
  prefs: ChartPrefs;
  targets: ChartTargets;
  mealTime?: string;
  pending: PendingRequest[];
  onChange: (items: PlanItem[]) => void;
  onResolve: (id: string, decision: "approve" | "reject", note: string) => void;
  onClose: () => void;
}) {
  const items = day.meals[meal] ?? [];
  const [swapFor, setSwapFor] = useState<string | null>(null);
  const [detailFor, setDetailFor] = useState<string | null>(null);
  const [adding, setAdding] = useState(items.length === 0);
  const [rejectNote, setRejectNote] = useState<Record<string, string>>({});

  const target = targets.kcal * (targets.slotShare?.[meal] ?? 0);
  const tot = mealTotals(items, index);

  const suggestions = useMemo(
    () => (swapFor ? suggestSwaps(allDays, day.day, meal, swapFor, profile, prefs, pool, 8) : []),
    [swapFor, allDays, day.day, meal, profile, prefs, pool]
  );

  const update = (uid: string, patch: Partial<PlanItem>) =>
    onChange(items.map((i) => (i.uid === uid ? { ...i, ...patch, by: i.by === "auto" ? "coach" : i.by } : i)));

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-2 border-b border-slate-100 px-4 py-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Day {day.day + 1} · {fmtDate(day.date)}
          </div>
          <div className="text-lg font-semibold text-slate-900">
            {MEAL_TIME_LABELS[meal]} {mealTime && <span className="text-sm font-normal text-slate-400">at {mealTime}</span>}
          </div>
        </div>
        <button onClick={onClose} className="rounded-lg p-1 text-xl leading-none text-slate-400 hover:bg-slate-100" aria-label="Close editor">
          ×
        </button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-3">
        {target > 0 && <Meter label="Meal energy" value={tot.kcal} target={target} unit=" kcal" />}

        {pending.map((r) => (
          <div key={r.id} className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">Client request · {r.clientName}</div>
            <div className="mt-0.5 font-medium text-slate-800">{describeRequest(r, index)}</div>
            {r.note && <div className="mt-1 text-slate-600">“{r.note}”</div>}
            <input
              className="input mt-2 py-1 text-xs"
              placeholder="Optional note to client"
              value={rejectNote[r.id] ?? ""}
              onChange={(e) => setRejectNote({ ...rejectNote, [r.id]: e.target.value })}
            />
            <div className="mt-2 flex gap-2">
              <button className="btn-primary px-3 py-1 text-xs" onClick={() => onResolve(r.id, "approve", rejectNote[r.id] ?? "")}>
                Approve & apply
              </button>
              <button className="btn-secondary px-3 py-1 text-xs" onClick={() => onResolve(r.id, "reject", rejectNote[r.id] ?? "")}>
                Decline
              </button>
            </div>
          </div>
        ))}

        <ul className="space-y-2">
          {items.map((it) => {
            const d = index[it.dishId];
            if (!d) return null;
            const n = scaled(d.perUnit, it.units);
            return (
              <li key={it.uid} className={`rounded-lg border p-2.5 ${it.by === "client" ? "border-blue-200 bg-blue-50/40" : "border-slate-200"}`}>
                <div className="flex items-start gap-2">
                  <span className="mt-1"><DietMark dish={d} /></span>
                  <button className="min-w-0 flex-1 text-left" onClick={() => setDetailFor(detailFor === it.uid ? null : it.uid)}>
                    <div className="font-medium text-slate-800">{d.name}</div>
                    <div className="text-[11px]"><MacroLine kcal={n.kcal} protein={n.protein} carbs={n.carbs} fat={n.fat} /></div>
                  </button>
                  <button
                    className={`rounded-md px-1.5 text-sm ${it.locked ? "text-brand-700" : "text-slate-300 hover:text-slate-600"}`}
                    onClick={() => update(it.uid, { locked: !it.locked })}
                    title={it.locked ? "Locked — kept when regenerating" : "Lock this dish"}
                    aria-label={it.locked ? "Unlock dish" : "Lock dish"}
                  >
                    {it.locked ? "🔒" : "🔓"}
                  </button>
                  <button
                    className="rounded-md px-1.5 text-lg leading-none text-slate-300 hover:text-red-600"
                    onClick={() => onChange(items.filter((i) => i.uid !== it.uid))}
                    aria-label={`Remove ${d.name}`}
                    title="Remove"
                  >
                    ×
                  </button>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <div className="inline-flex items-center overflow-hidden rounded-lg border border-slate-200">
                    <button
                      className="px-2.5 py-1 text-slate-600 hover:bg-slate-100 disabled:opacity-30"
                      disabled={it.units <= d.unit.min}
                      onClick={() => update(it.uid, { units: snapUnits(d, it.units - d.unit.step) })}
                      aria-label="Decrease portion"
                    >
                      −
                    </button>
                    <span className="min-w-[92px] px-2 text-center text-xs font-medium text-slate-700">{formatPortion(d, it.units)}</span>
                    <button
                      className="px-2.5 py-1 text-slate-600 hover:bg-slate-100 disabled:opacity-30"
                      disabled={it.units >= d.unit.max}
                      onClick={() => update(it.uid, { units: snapUnits(d, it.units + d.unit.step) })}
                      aria-label="Increase portion"
                    >
                      +
                    </button>
                  </div>
                  <button className="btn-ghost px-2 py-1 text-xs" onClick={() => setSwapFor(swapFor === it.uid ? null : it.uid)}>
                    ⇄ Swap
                  </button>
                </div>
                {swapFor === it.uid && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {suggestions.length === 0 && <span className="text-xs text-slate-400">No close alternatives for this profile.</span>}
                    {suggestions.map((s) => {
                      const sd = index[s.dishId];
                      return (
                        <Chip
                          key={s.dishId}
                          tone="brand"
                          onClick={() => {
                            update(it.uid, { dishId: s.dishId, units: s.units, locked: false });
                            setSwapFor(null);
                          }}
                        >
                          {sd?.name} · {sd ? formatPortion(sd, s.units) : ""} <span className="opacity-60">· {s.kcal} kcal · {s.reason}</span>
                        </Chip>
                      );
                    })}
                  </div>
                )}
                {detailFor === it.uid && (
                  <div className="mt-2 rounded-lg bg-slate-50 p-3">
                    <DishDetail dish={d} units={it.units} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        <div>
          {!adding ? (
            <button className="btn-secondary w-full" onClick={() => setAdding(true)}>
              + Add from food bank
            </button>
          ) : (
            <div className="rounded-xl border border-slate-200 p-3">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-sm font-semibold text-slate-800">Add from food bank</div>
                {items.length > 0 && (
                  <button className="text-xs text-slate-400 hover:text-slate-700" onClick={() => setAdding(false)}>
                    Close
                  </button>
                )}
              </div>
              <DishPicker
                dishes={pool}
                meal={meal}
                remainingKcal={Math.max(0, target - tot.kcal)}
                inMeal={items.map((i) => i.dishId)}
                onPick={(dish, units) => onChange([...items, { uid: newUid(), dishId: dish.id, units, by: "coach" }])}
                maxHeight="22rem"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
