"use client";

import { useMemo, useState } from "react";
import DishPicker from "@/components/foodbank/DishPicker";
import { Chip, DietMark, MacroLine, Modal } from "@/components/foodbank/ui";
import { formatPortion, scaled, snapUnits } from "@/lib/foodbank/bank";
import { fmtDate } from "@/lib/foodbank/client";
import { suggestSwaps, type ChartDay, type ChartPrefs, type ChartProfile, type PlanItem } from "@/lib/foodbank/engine";
import type { Dish } from "@/lib/foodbank/types";
import { MEAL_TIME_LABELS, type MealTime } from "@/lib/types";

type Action = "swap" | "portion" | "remove" | "add";

export default function RequestSheet({
  chartId,
  days,
  day,
  meal,
  item,
  index,
  pool,
  profile,
  prefs,
  onClose,
  onSubmitted,
}: {
  chartId: string;
  days: ChartDay[];
  day: ChartDay;
  meal: MealTime;
  item: PlanItem | null; // null => add to meal
  index: Record<string, Dish>;
  pool: Dish[];
  profile: ChartProfile;
  prefs: ChartPrefs;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const dish = item ? index[item.dishId] : undefined;
  const [action, setAction] = useState<Action>(item ? "swap" : "add");
  const [toDish, setToDish] = useState<{ dish: Dish; units: number } | null>(null);
  const [units, setUnits] = useState(item?.units ?? 1);
  const [scope, setScope] = useState<"this" | "all">("this");
  const [note, setNote] = useState("");
  const [browse, setBrowse] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const suggestions = useMemo(
    () => (item && action === "swap" ? suggestSwaps(days, day.day, meal, item.uid, profile, prefs, pool, 6) : []),
    [item, action, days, day.day, meal, profile, prefs, pool]
  );

  const canSubmit =
    action === "remove" ||
    (action === "portion" && dish && units !== item?.units) ||
    ((action === "swap" || action === "add") && !!toDish);

  const submit = async () => {
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/portal/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chartId,
          day: day.day,
          meal,
          action,
          scope,
          targetUid: item?.uid,
          toDishId: toDish?.dish.id,
          units: action === "portion" ? units : toDish?.units,
          note,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onSubmitted();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send your request.");
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={item ? "Request a change" : `Add to ${MEAL_TIME_LABELS[meal]}`}
      footer={
        <div className="space-y-2">
          {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
          <button className="btn-primary w-full py-2.5" disabled={!canSubmit || sending} onClick={submit}>
            {sending ? "Sending…" : "Send to my nutritionist"}
          </button>
          <p className="text-center text-[11px] text-slate-400">Your plan changes once your nutritionist approves.</p>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="text-xs text-slate-500">
          {fmtDate(day.date, { weekday: "long", day: "numeric", month: "long" })} · {MEAL_TIME_LABELS[meal]}
        </div>

        {dish && item && (
          <div className="flex items-center gap-2 rounded-lg bg-slate-50 p-3">
            <DietMark dish={dish} />
            <div className="min-w-0 flex-1">
              <div className="font-medium text-slate-800">{dish.name}</div>
              <div className="text-xs text-slate-500">{formatPortion(dish, item.units)}</div>
            </div>
          </div>
        )}

        {item && (
          <div className="flex flex-wrap gap-1.5">
            {(["swap", "portion", "remove"] as Action[]).map((a) => (
              <Chip key={a} tone="brand" active={action === a} onClick={() => { setAction(a); setToDish(null); }}>
                {a === "swap" ? "Swap for something else" : a === "portion" ? "Change portion" : "Remove it"}
              </Chip>
            ))}
          </div>
        )}

        {action === "portion" && dish && (
          <div className="flex items-center justify-center gap-3 py-2">
            <button className="btn-secondary h-10 w-10 p-0 text-lg" onClick={() => setUnits(snapUnits(dish, units - dish.unit.step))} disabled={units <= dish.unit.min} aria-label="Less">−</button>
            <div className="min-w-[140px] text-center">
              <div className="text-lg font-semibold text-slate-900">{formatPortion(dish, units)}</div>
              <div className="text-xs"><MacroLine kcal={scaled(dish.perUnit, units).kcal} protein={scaled(dish.perUnit, units).protein} /></div>
            </div>
            <button className="btn-secondary h-10 w-10 p-0 text-lg" onClick={() => setUnits(snapUnits(dish, units + dish.unit.step))} disabled={units >= dish.unit.max} aria-label="More">+</button>
          </div>
        )}

        {(action === "swap" || action === "add") && (
          <div className="space-y-2">
            {toDish ? (
              <div className="flex items-center gap-2 rounded-lg border-2 border-brand-500 bg-brand-50 p-3">
                <DietMark dish={toDish.dish} />
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-slate-800">{toDish.dish.name}</div>
                  <div className="text-xs text-slate-600">
                    {formatPortion(toDish.dish, toDish.units)} · <MacroLine kcal={scaled(toDish.dish.perUnit, toDish.units).kcal} protein={scaled(toDish.dish.perUnit, toDish.units).protein} />
                  </div>
                </div>
                <button className="text-xs text-slate-500 underline" onClick={() => setToDish(null)}>Change</button>
              </div>
            ) : (
              <>
                {suggestions.length > 0 && !browse && (
                  <>
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Good alternatives</div>
                    <div className="flex flex-col gap-1.5">
                      {suggestions.map((s) => {
                        const d = index[s.dishId];
                        if (!d) return null;
                        return (
                          <button key={s.dishId} onClick={() => setToDish({ dish: d, units: s.units })} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-left hover:border-brand-400">
                            <DietMark dish={d} />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium text-slate-800">{d.name}</span>
                              <span className="block text-[11px] text-slate-500">{formatPortion(d, s.units)} · {s.kcal} kcal · {s.reason}</span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
                {(browse || suggestions.length === 0) ? (
                  <DishPicker
                    dishes={pool}
                    meal={meal}
                    roles={dish ? [dish.role] : undefined}
                    remainingKcal={dish && item ? scaled(dish.perUnit, item.units).kcal : undefined}
                    onPick={(d, u) => setToDish({ dish: d, units: u })}
                    actionLabel="Choose"
                    maxHeight="16rem"
                  />
                ) : (
                  <button className="btn-ghost w-full text-sm" onClick={() => setBrowse(true)}>Browse the full food bank</button>
                )}
              </>
            )}
          </div>
        )}

        {item && (action === "swap" || action === "remove") && (
          <div className="flex flex-col gap-1.5 text-sm">
            <label className="flex items-center gap-2">
              <input type="radio" name="scope" checked={scope === "this"} onChange={() => setScope("this")} className="accent-brand-600" />
              Only on this day
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" name="scope" checked={scope === "all"} onChange={() => setScope("all")} className="accent-brand-600" />
              Every time {dish?.name ?? "this dish"} appears in my plan
            </label>
          </div>
        )}

        <div>
          <label className="label" htmlFor="reqnote">Note for your nutritionist (optional)</label>
          <textarea id="reqnote" className="input min-h-[60px]" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. I don’t enjoy bitter gourd / I eat out on Tuesdays" maxLength={500} />
        </div>
      </div>
    </Modal>
  );
}
