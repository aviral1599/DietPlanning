"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from "react";
import { formatPortion } from "@/lib/foodbank/bank";
import { dayTotals, mealTotals, WEEKDAYS, weekdayOf, type ChartDay, type ChartEvent, type ChartTargets, type EventKind } from "@/lib/foodbank/engine";
import {
  dayActivity,
  eventLabel,
  fmt12,
  hourRange,
  layoutBlocks,
  MEAL_MINUTES,
  mealTimeOn,
  toHM,
  toMin,
} from "@/lib/foodbank/schedule";
import type { Dish } from "@/lib/foodbank/types";
import { MEAL_TIMES, MEAL_TIME_LABELS, type MealTime } from "@/lib/types";
import { Icon, KIND_STYLES } from "@/components/foodbank/CalendarIcons";

export type CalendarFilter = Record<EventKind | "meal", boolean>;
export interface EventRef {
  day: number;
  uid: string;
}

type Item = { kind: "meal"; meal: MealTime; key: string; srcDay?: number } | { kind: "event"; event: ChartEvent; key: string };

interface Drag {
  item: Item;
  day: number;
  startMin: number;
  minutes: number;
  x: number;
  y: number;
  resize: boolean;
  /** ⌥/Alt held at drag start: drop a copy and leave the original. */
  copy: boolean;
  moved: boolean;
}

/** Live position of the block being dragged. */
interface Preview {
  key: string;
  fromDay: number;
  toDay: number;
  start: number;
  minutes: number;
  label: string;
  copy: boolean;
}

const SNAP = 15;
const MIN_BLOCK_PX = 24;

function statusClass(v: number, target: number) {
  if (!target) return "bg-slate-300";
  const r = v / target;
  return Math.abs(r - 1) <= 0.05 ? "bg-brand-500" : Math.abs(r - 1) <= 0.12 ? "bg-amber-400" : "bg-red-400";
}

export default function CalendarView({
  days,
  view,
  index,
  targets,
  chartTimes,
  filters,
  currentDay,
  selectedMeal,
  selectedEvent,
  pendingCells,
  busyDay,
  onSelectMeal,
  onSelectEvent,
  onCreate,
  onOpenDay,
  onRegenerateDay,
  onMoveMeal,
  onMoveEvent,
  onResizeEvent,
  onDuplicateMeal,
  onDuplicateEvent,
  onCopyDay,
}: {
  days: ChartDay[];
  view: "week" | "day";
  index: Record<string, Dish>;
  targets: ChartTargets;
  chartTimes: Partial<Record<MealTime, string>>;
  filters: CalendarFilter;
  currentDay: number;
  selectedMeal: { day: number; meal: MealTime } | null;
  selectedEvent: EventRef | null;
  pendingCells: Set<string>;
  busyDay?: number | null;
  onSelectMeal: (day: number, meal: MealTime) => void;
  onSelectEvent: (day: number, uid: string) => void;
  onCreate: (day: number, time: string) => void;
  onOpenDay: (day: number) => void;
  onRegenerateDay: (day: number) => void;
  onMoveMeal: (day: number, meal: MealTime, time: string) => void;
  onMoveEvent: (fromDay: number, uid: string, toDay: number, time: string) => void;
  onResizeEvent: (day: number, uid: string, minutes: number) => void;
  onDuplicateMeal: (fromDay: number, meal: MealTime, toDay: number, time: string) => void;
  onDuplicateEvent: (fromDay: number, uid: string, toDay: number, time: string) => void;
  onCopyDay: (day: number) => void;
}) {
  const week = view === "week";
  const hh = week ? 56 : 64; // px per hour
  // Meals get a taller minimum so their dishes stay readable.
  const mealMinPx = week ? 30 : 46;
  const [h0, h1] = useMemo(() => hourRange(days, chartTimes), [days, chartTimes]);
  const totalH = (h1 - h0) * hh;
  const y = (min: number) => ((min - h0 * 60) / 60) * hh;

  const gridRef = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const callbacks = useRef({ onMoveMeal, onMoveEvent, onResizeEvent, onSelectMeal, onSelectEvent, onDuplicateMeal, onDuplicateEvent });
  callbacks.current = { onMoveMeal, onMoveEvent, onResizeEvent, onSelectMeal, onSelectEvent, onDuplicateMeal, onDuplicateEvent };

  // "now" line for today's column
  const [now, setNow] = useState<{ date: string; min: number } | null>(null);
  useEffect(() => {
    const tick = () => {
      const d = new Date();
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      setNow({ date: iso, min: d.getHours() * 60 + d.getMinutes() });
    };
    tick();
    const t = setInterval(tick, 60_000);
    return () => clearInterval(t);
  }, []);

  // ---- drag / resize ------------------------------------------------------
  const [preview, setPreview] = useState<Preview | null>(null);
  const previewRef = useRef<Preview | null>(null);
  const daysRef = useRef(days);
  daysRef.current = days;

  useEffect(() => {
    const set = (p: Preview | null) => {
      previewRef.current = p;
      setPreview(p);
    };
    const move = (e: PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      const dx = e.clientX - d.x;
      const dy = e.clientY - d.y;
      if (!d.moved && Math.hypot(dx, dy) < 5) return;
      d.moved = true;
      const dm = Math.round(((dy / hh) * 60) / SNAP) * SNAP;
      if (d.resize) {
        const minutes = Math.max(SNAP, Math.min(240, d.minutes + dm));
        set({ key: d.item.key, fromDay: d.day, toDay: d.day, start: d.startMin, minutes, label: `${minutes} min`, copy: false });
        return;
      }
      const start = Math.max(h0 * 60, Math.min(h1 * 60 - SNAP, d.startMin + dm));
      let toDay = d.day;
      // events (and copies of anything) may move to another day in week view; meals stay on their day
      if (week && (d.item.kind === "event" || d.copy) && gridRef.current) {
        const col = Array.from(gridRef.current.querySelectorAll<HTMLElement>("[data-col]")).find((c) => {
          const r = c.getBoundingClientRect();
          return e.clientX >= r.left && e.clientX < r.right;
        });
        if (col) toDay = Number(col.dataset.col);
      }
      const date = daysRef.current.find((x) => x.day === toDay)?.date;
      const dayName = toDay !== d.day && date ? `${WEEKDAYS[weekdayOf(date)]} ` : "";
      set({
        key: d.copy ? `${d.item.key}#copy` : d.item.key,
        fromDay: d.day,
        toDay,
        start,
        minutes: d.minutes,
        label: `${d.copy ? "Copy → " : ""}${dayName}${fmt12(start)}`,
        copy: d.copy,
      });
    };
    const up = () => {
      const d = drag.current;
      const p = previewRef.current;
      drag.current = null;
      set(null);
      if (!d) return;
      const cb = callbacks.current;
      if (!d.moved || !p) {
        if (d.item.kind === "meal") cb.onSelectMeal(d.day, d.item.meal);
        else cb.onSelectEvent(d.day, d.item.event.uid);
        return;
      }
      if (d.copy) {
        if (p.start === d.startMin && p.toDay === d.day) return;
        if (d.item.kind === "meal") cb.onDuplicateMeal(d.day, d.item.meal, p.toDay, toHM(p.start));
        else cb.onDuplicateEvent(d.day, d.item.event.uid, p.toDay, toHM(p.start));
        return;
      }
      if (d.item.kind === "meal") {
        if (p.start !== d.startMin) cb.onMoveMeal(d.day, d.item.meal, toHM(p.start));
      } else if (d.resize) {
        if (p.minutes !== d.minutes) cb.onResizeEvent(d.day, d.item.event.uid, p.minutes);
      } else if (p.start !== d.startMin || p.toDay !== d.day) {
        cb.onMoveEvent(d.day, d.item.event.uid, p.toDay, toHM(p.start));
      }
    };
    const cancel = () => {
      drag.current = null;
      set(null);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
    };
  }, [hh, h0, h1, week]);

  const startDrag = (e: RPointerEvent<HTMLElement>, item: Item, day: number, startMin: number, minutes: number) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const resize = !!(e.target as HTMLElement).closest("[data-resize]");
    drag.current = { item, day, startMin, minutes, x: e.clientX, y: e.clientY, resize, copy: e.altKey && !resize, moved: false };
  };

  // Items per column, with the dragged block moved to where the pointer is.
  const columns = useMemo(() => {
    const map = new Map<number, { item: Item; start: number; minutes: number }[]>();
    for (const d of days) {
      const items: { item: Item; start: number; minutes: number }[] = [];
      if (filters.meal)
        for (const m of MEAL_TIMES) {
          if (!d.meals[m]?.length && !(targets.slotShare?.[m] > 0)) continue;
          items.push({ item: { kind: "meal", meal: m, key: `m-${m}` }, start: toMin(mealTimeOn(d, m, chartTimes)), minutes: Math.max(MEAL_MINUTES[m], (mealMinPx / hh) * 60) });
        }
      for (const e of d.events ?? []) {
        if (!filters[e.kind]) continue;
        items.push({ item: { kind: "event", event: e, key: e.uid }, start: toMin(e.time), minutes: e.minutes });
      }
      map.set(d.day, items);
    }
    if (preview) {
      const src = map.get(preview.fromDay) ?? [];
      const srcKey = preview.copy ? preview.key.replace(/#copy$/, "") : preview.key;
      const i = src.findIndex((x) => x.item.key === srcKey);
      if (i >= 0) {
        const it = preview.copy ? src[i] : src.splice(i, 1)[0];
        const item = it.item.kind === "meal" && preview.copy ? { ...it.item, key: preview.key, srcDay: preview.fromDay } : { ...it.item, key: preview.key };
        const moved = { ...it, item, start: preview.start, minutes: preview.minutes } as typeof it;
        map.get(preview.toDay)?.push(moved);
      }
    }
    return map;
  }, [days, filters, targets.slotShare, chartTimes, preview, mealMinPx, hh]);

  // ---- hover slot + click-to-create ------------------------------------------
  const slotAt = (col: HTMLElement, clientY: number) => {
    const r = col.getBoundingClientRect();
    const m = Math.floor(((clientY - r.top) / hh) * (60 / SNAP)) * SNAP;
    return Math.max(h0 * 60, Math.min(h1 * 60 - SNAP, h0 * 60 + m));
  };

  return (
    <div className="h-[calc(100vh-14rem)] min-h-[480px] overflow-auto overscroll-contain rounded-xl border border-slate-200 bg-white">
      <div
        ref={gridRef}
        className="relative grid"
        style={{ gridTemplateColumns: `52px repeat(${days.length}, minmax(0, 1fr))`, minWidth: week ? 860 : undefined }}
      >
        {/* header row */}
        <div className="sticky left-0 top-0 z-30 border-b border-slate-200 bg-white" />
        {days.map((d) => {
          const t = dayTotals(d, index);
          const a = dayActivity(d);
          const isCur = week && d.day === currentDay;
          const wd = WEEKDAYS[weekdayOf(d.date)];
          const dateNum = Number(d.date.slice(8, 10));
          return (
            <div key={d.day} className="sticky top-0 z-20 flex min-w-0 flex-col gap-1 border-b border-l border-slate-200 bg-white px-2 pb-1.5 pt-2 first-of-type:border-l-0">
              <div className="flex items-center justify-between gap-1">
                <button
                  className="-ml-1 flex items-baseline gap-1.5 rounded-md px-1 py-0.5 hover:bg-slate-100"
                  onClick={() => onOpenDay(d.day)}
                  title={week ? `Day ${d.day + 1} · open day view` : undefined}
                >
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{wd}</span>
                  <span className={`text-lg font-bold leading-none ${isCur ? "text-brand-600" : "text-slate-800"}`}>{dateNum}</span>
                  {!week && <span className="text-[11px] text-slate-400">Day {d.day + 1}</span>}
                </button>
                <span className="flex items-center">
                <button
                  className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  title="Copy this day to other days"
                  aria-label={`Copy day ${d.day + 1} to other days`}
                  onClick={() => onCopyDay(d.day)}
                >
                  <Icon name="copy" className="h-3.5 w-3.5" />
                </button>
                <button
                  className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:animate-spin"
                  title="Regenerate this day's meals (locked dishes stay)"
                  aria-label={`Regenerate day ${d.day + 1}`}
                  disabled={busyDay === d.day}
                  onClick={() => onRegenerateDay(d.day)}
                >
                  <Icon name="refresh" className="h-3.5 w-3.5" />
                </button>
                </span>
              </div>
              <div className="flex justify-between text-[11px] tabular-nums text-slate-500">
                <span>
                  {Math.round(t.kcal)} / {targets.kcal} kcal
                </span>
                {a.burned > 0 && <span className="text-orange-600">−{a.burned}</span>}
              </div>
              <div className="h-[3px] overflow-hidden rounded-full bg-slate-100">
                <div className={`h-full rounded-full ${statusClass(t.kcal, targets.kcal)}`} style={{ width: `${Math.min(100, (t.kcal / targets.kcal) * 100)}%` }} />
              </div>
            </div>
          );
        })}

        {/* time labels */}
        <div className="sticky left-0 z-10 border-r border-slate-100 bg-white" style={{ height: totalH }}>
          {Array.from({ length: h1 - h0 - 1 }, (_, i) => h0 + i + 1).map((hr) => (
            <div key={hr} className="absolute right-2 -translate-y-1/2 whitespace-nowrap text-[11px] tabular-nums text-slate-400" style={{ top: (hr - h0) * hh }}>
              {((hr + 11) % 12) + 1} {hr < 12 ? "am" : "pm"}
            </div>
          ))}
        </div>

        {/* day columns */}
        {days.map((d) => {
          const items = columns.get(d.day) ?? [];
          const blocks = layoutBlocks(items, (MIN_BLOCK_PX / hh) * 60);
          const isCur = week && d.day === currentDay;
          return (
            <div
              key={d.day}
              data-col={d.day}
              className={`group/col relative cursor-copy border-l border-slate-100 first-of-type:border-l-0 ${isCur ? "bg-brand-50/30" : ""}`}
              style={{
                height: totalH,
                backgroundImage: "linear-gradient(#e2e8f0 1px, transparent 1px), linear-gradient(#f1f5f9 1px, transparent 1px)",
                backgroundSize: `100% ${hh}px, 100% ${hh / 2}px`,
              }}
              onMouseMove={(e) => {
                const col = e.currentTarget;
                const hover = col.querySelector<HTMLElement>("[data-hover]");
                if (!hover) return;
                const onEmpty = e.target === col || e.target === hover;
                hover.style.display = onEmpty && !drag.current?.moved ? "flex" : "none";
                if (!onEmpty) return;
                const m = slotAt(col, e.clientY);
                hover.style.top = `${y(m)}px`;
                hover.textContent = `+ ${fmt12(m)}`;
              }}
              onMouseLeave={(e) => {
                const hover = e.currentTarget.querySelector<HTMLElement>("[data-hover]");
                if (hover) hover.style.display = "none";
              }}
              onClick={(e) => {
                const col = e.currentTarget;
                if (e.target !== col && !(e.target as HTMLElement).hasAttribute("data-hover")) return;
                onCreate(d.day, toHM(slotAt(col, e.clientY)));
              }}
            >
              <div
                data-hover
                className="pointer-events-none absolute inset-x-1 z-0 hidden items-center rounded-md border-[1.5px] border-dashed border-brand-400 bg-brand-50/60 px-1.5 text-[11px] font-semibold text-brand-700"
                style={{ height: hh / 4 }}
              />
              {now && now.date === d.date && now.min >= h0 * 60 && now.min <= h1 * 60 && (
                <div className="pointer-events-none absolute inset-x-0 z-10 h-0.5 bg-red-400" style={{ top: y(now.min) }}>
                  <span className="absolute -left-1 -top-[3px] h-2 w-2 rounded-full bg-red-400" />
                </div>
              )}
              {blocks.map((b) => {
                const top = y(b.start);
                const dragging = preview?.key === b.item.key && preview.toDay === d.day;
                const minutes = dragging ? preview.minutes : b.item.kind === "meal" ? MEAL_MINUTES[b.item.meal] : b.item.event.minutes;
                const height = Math.max((minutes / 60) * hh, b.item.kind === "meal" ? mealMinPx : MIN_BLOCK_PX) - 2;
                const tiny = height < 34;
                const style = dragging
                  ? { top, height, left: 3, width: "calc(100% - 6px)" }
                  : { top, height, left: `calc(${(b.lane / b.lanes) * 100}% + 3px)`, width: `calc(${100 / b.lanes}% - 6px)` };
                const dragAttrs = dragging ? { "data-dragging": "true", "data-time": preview.label } : {};
                const base =
                  "absolute z-[1] cursor-grab touch-none select-none overflow-hidden rounded-lg border px-1.5 text-left text-[12px] leading-tight transition-shadow hover:z-[5] hover:shadow-md data-[dragging=true]:z-40 data-[dragging=true]:cursor-grabbing data-[dragging=true]:opacity-90 data-[dragging=true]:shadow-lg data-[dragging=true]:transition-none data-[dragging=true]:after:absolute data-[dragging=true]:after:right-1 data-[dragging=true]:after:top-0.5 data-[dragging=true]:after:rounded data-[dragging=true]:after:bg-white data-[dragging=true]:after:px-1 data-[dragging=true]:after:text-[10px] data-[dragging=true]:after:font-semibold data-[dragging=true]:after:text-slate-700 data-[dragging=true]:after:content-[attr(data-time)]";

                if (b.item.kind === "meal") {
                  const m = b.item.meal;
                  const srcDay = (b.item as { srcDay?: number }).srcDay;
                  const its = (srcDay != null ? days.find((x) => x.day === srcDay) ?? d : d).meals[m] ?? [];
                  const k = mealTotals(its, index).kcal;
                  const sel = selectedMeal?.day === d.day && selectedMeal.meal === m;
                  const locked = its.some((i) => i.locked);
                  const names = its.map((i) => index[i.dishId]?.name ?? "Missing dish").join(" + ");
                  const custom = !!d.times?.[m];
                  return (
                    <div
                      key={b.item.key}
                      role="button"
                      tabIndex={0}
                      aria-label={`${MEAL_TIME_LABELS[m]} at ${fmt12(b.start)}: ${names || "empty"}`}
                      className={`${base} ${KIND_STYLES.meal.block} ${tiny ? "py-0.5" : "py-1"} ${sel ? "z-[6] ring-2 ring-slate-800" : ""}`}
                      style={style}
                      {...dragAttrs}
                      onPointerDown={(e) => startDrag(e, b.item, d.day, b.start, minutes)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onSelectMeal(d.day, m);
                        }
                      }}
                    >
                      {pendingCells.has(`${d.day}:${m}`) && (
                        <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-amber-500 ring-2 ring-white" title="Client change request pending" />
                      )}
                      {week ? (
                        <>
                          <div className="flex min-w-0 items-center gap-1">
                            <span className="truncate font-semibold">{names || <span className="text-brand-700/60">+ Add dishes</span>}</span>
                            {locked && <Icon name="lock" className="h-3 w-3 opacity-70" />}
                          </div>
                          {!tiny && (
                            <div className="truncate text-[11px] opacity-75">
                              {MEAL_TIME_LABELS[m]} · {Math.round(k)} kcal{custom ? " · moved" : ""}
                            </div>
                          )}
                        </>
                      ) : (
                        <>
                          <div className="flex min-w-0 items-center gap-1.5">
                            <Icon name="meal" className="h-3 w-3 opacity-70" />
                            <span className="truncate font-semibold">{MEAL_TIME_LABELS[m]}</span>
                            {locked && <Icon name="lock" className="h-3 w-3 opacity-70" />}
                            <span className="ml-auto whitespace-nowrap text-[11px] tabular-nums opacity-75">
                              {fmt12(b.start)} · {Math.round(k)} kcal
                            </span>
                          </div>
                          {!tiny && (
                            <div className="mt-0.5 line-clamp-2 text-[11.5px] opacity-85">
                              {its.length
                                ? its
                                    .map((i) => {
                                      const dish = index[i.dishId];
                                      if (!dish) return "Missing dish";
                                      const alts = (i.alts ?? []).map((a) => index[a.dishId]?.name).filter(Boolean);
                                      return `${dish.name} (${formatPortion(dish, i.units)})${alts.length ? ` or ${alts.join(" or ")}` : ""}`;
                                    })
                                    .join(" · ")
                                : "No dishes yet — click to add"}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  );
                }

                const ev = b.item.event;
                const sel = selectedEvent?.day === d.day && selectedEvent.uid === ev.uid;
                const right =
                  ev.kind === "exercise" ? (ev.kcal ? `−${ev.kcal} kcal` : "") : ev.kind === "supplement" ? ev.dose ?? "" : ev.kind === "water" ? `${ev.ml ?? ""} ml` : "";
                return (
                  <div
                    key={b.item.key}
                    role="button"
                    tabIndex={0}
                    aria-label={`${eventLabel(ev)} at ${fmt12(ev.time)}`}
                    className={`${base} ${KIND_STYLES[ev.kind].block} ${tiny ? "py-0.5" : "py-1"} ${sel ? "z-[6] ring-2 ring-slate-800" : ""}`}
                    style={style}
                    {...dragAttrs}
                    onPointerDown={(e) => startDrag(e, b.item, d.day, b.start, ev.minutes)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onSelectEvent(d.day, ev.uid);
                      }
                    }}
                  >
                    <div className="flex min-w-0 items-center gap-1.5">
                      <Icon name={ev.kind} className="h-3 w-3 opacity-70" />
                      <span className="truncate font-semibold">{ev.kind === "water" ? "Water" : ev.title}</span>
                      {ev.series && !week && <Icon name="repeat" className="h-3 w-3 opacity-50" />}
                      {(!week || !tiny) && right && <span className="ml-auto whitespace-nowrap text-[11px] tabular-nums opacity-75">{right}</span>}
                    </div>
                    {!tiny && ev.kind === "exercise" && (
                      <div className="truncate text-[11px] opacity-75">
                        {ev.minutes} min · {ev.intensity}
                      </div>
                    )}
                    {!tiny && ev.kind === "supplement" && ev.timing && <div className="truncate text-[11px] opacity-75">{ev.timing}</div>}
                    {!tiny && ev.text && <div className="line-clamp-2 text-[11px] opacity-75">{ev.text}</div>}
                    <span data-resize className="absolute inset-x-0 bottom-0 h-1.5 cursor-ns-resize" title="Drag to change length" />
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
