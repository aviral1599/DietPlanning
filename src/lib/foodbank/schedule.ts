// Calendar helpers for diet charts: meal times per day, exercise /
// supplement / water / note events, recurring series and block layout.
// Pure functions — safe on client and server.

import { MEAL_TIMES, MEAL_TIME_LABELS, type MealTime } from "../types";
import {
  newUid,
  weekdayOf,
  type ChartDay,
  type ChartEvent,
  type EventKind,
  type Intensity,
  MEAL_TIME_DEFAULTS,
} from "./engine";

export const EVENT_KINDS: EventKind[] = ["exercise", "supplement", "water", "note"];

export const KIND_LABELS: Record<EventKind | "meal", string> = {
  meal: "Meal",
  exercise: "Exercise",
  supplement: "Supplement",
  water: "Water",
  note: "Note",
};

/** How long each meal block is drawn on the calendar (display only). */
export const MEAL_MINUTES: Record<MealTime, number> = {
  earlyMorning: 20,
  breakfast: 40,
  midMorning: 20,
  lunch: 45,
  eveningSnack: 25,
  dinner: 40,
  bedtime: 15,
};

/** kcal burned per minute for a ~60–70 kg adult (rough, informational). */
export const KCAL_PER_MIN: Record<Intensity, number> = { light: 3.5, moderate: 4.8, vigorous: 7.5 };

export const EXERCISE_PRESETS = [
  "Brisk walk",
  "Yoga",
  "Strength training",
  "Cycling",
  "Swimming",
  "Pilates",
  "Dance workout",
  "Stretching",
  "Post-meal walk",
];
export const SUPPLEMENT_PRESETS = [
  "Vitamin D3",
  "Vitamin B12",
  "Omega-3",
  "Myo-inositol",
  "Magnesium glycinate",
  "Iron",
  "Calcium + D3",
  "Probiotic",
  "Chromium picolinate",
  "Berberine",
  "Folic acid",
];
export const SUPPLEMENT_TIMINGS = ["With food", "Empty stomach", "Before bed", "After workout"];

// ---- time ----------------------------------------------------------------

export const toMin = (hm: string | undefined): number => {
  if (!hm) return 0;
  const [h, m] = hm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};
export const toHM = (min: number): string => {
  const m = Math.max(0, Math.min(24 * 60 - 1, Math.round(min)));
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};
/** "6:30 am" */
export const fmt12 = (hm: string | number): string => {
  const min = typeof hm === "number" ? hm : toMin(hm);
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
};

/** The time a meal is eaten on a given day (per-day override → chart default). */
export function mealTimeOn(day: ChartDay, meal: MealTime, chartTimes: Partial<Record<MealTime, string>>): string {
  return day.times?.[meal] || chartTimes[meal] || MEAL_TIME_DEFAULTS[meal];
}

export function estimateBurn(minutes: number, intensity: Intensity = "moderate"): number {
  return Math.round(minutes * KCAL_PER_MIN[intensity]);
}

export function eventLabel(e: ChartEvent): string {
  if (e.kind === "water") return `Water${e.ml ? ` · ${e.ml} ml` : ""}`;
  if (e.kind === "supplement") return e.dose ? `${e.title} · ${e.dose}` : e.title;
  if (e.kind === "exercise") return `${e.title} · ${e.minutes} min`;
  return e.title;
}

/** One line for exports: "07:00 Brisk walk · 40 min, moderate". */
export function eventLine(e: ChartEvent): string {
  const extra = [
    e.kind === "exercise" && e.intensity ? e.intensity : "",
    e.kind === "supplement" && e.timing ? e.timing.toLowerCase() : "",
  ].filter(Boolean);
  return `${e.time} ${eventLabel(e)}${extra.length ? `, ${extra.join(", ")}` : ""}${e.text ? ` - ${e.text}` : ""}`;
}

export interface DayActivity {
  burned: number;
  exerciseMin: number;
  supplements: number;
  waterMl: number;
}
export function dayActivity(day: ChartDay): DayActivity {
  const a: DayActivity = { burned: 0, exerciseMin: 0, supplements: 0, waterMl: 0 };
  for (const e of day.events ?? []) {
    if (e.kind === "exercise") {
      a.burned += e.kcal ?? 0;
      a.exerciseMin += e.minutes;
    } else if (e.kind === "supplement") a.supplements++;
    else if (e.kind === "water") a.waterMl += e.ml ?? 0;
  }
  return a;
}

/** Meals and events of a day in time order (for portal / exports). */
export type TimelineEntry =
  | { type: "meal"; meal: MealTime; time: string; label: string }
  | { type: "event"; event: ChartEvent; time: string; label: string };

export function dayTimeline(day: ChartDay, chartTimes: Partial<Record<MealTime, string>>, includeEmptyMeals = false): TimelineEntry[] {
  const out: TimelineEntry[] = [];
  for (const m of MEAL_TIMES) {
    if (!includeEmptyMeals && !day.meals[m]?.length) continue;
    out.push({ type: "meal", meal: m, time: mealTimeOn(day, m, chartTimes), label: MEAL_TIME_LABELS[m] });
  }
  for (const e of day.events ?? []) out.push({ type: "event", event: e, time: e.time, label: eventLabel(e) });
  return out.sort((a, b) => toMin(a.time) - toMin(b.time));
}

// ---- recurring events ------------------------------------------------------

export type Repeat = "daily" | "weekdays" | "custom" | "once";

/** Which chart days a new event lands on. `weekdays` are 0 = Mon … 6 = Sun. */
export function daysForRepeat(days: ChartDay[], from: number, repeat: Repeat, weekdays: number[]): number[] {
  if (repeat === "once") return [from];
  return days
    .filter((d) => {
      const wd = weekdayOf(d.date);
      if (repeat === "daily") return true;
      if (repeat === "weekdays") return wd <= 4;
      return weekdays.includes(wd);
    })
    .map((d) => d.day);
}

export type EventDraft = Omit<ChartEvent, "uid" | "series">;

function sortEvents(list: ChartEvent[]): ChartEvent[] {
  return [...list].sort((a, b) => toMin(a.time) - toMin(b.time));
}

/** Add an event to every listed day; copies share a series id when there is more than one. */
export function addEvent(days: ChartDay[], targetDays: number[], draft: EventDraft): { days: ChartDay[]; uids: Record<number, string> } {
  const set = new Set(targetDays);
  const series = set.size > 1 ? `s_${newUid()}` : undefined;
  const uids: Record<number, string> = {};
  const next = days.map((d) => {
    if (!set.has(d.day)) return d;
    const ev: ChartEvent = { ...draft, uid: newUid(), ...(series ? { series } : {}) };
    uids[d.day] = ev.uid;
    return { ...d, events: sortEvents([...(d.events ?? []), ev]) };
  });
  return { days: next, uids };
}

export function findEvent(days: ChartDay[], day: number, uid: string): ChartEvent | undefined {
  return days.find((d) => d.day === day)?.events?.find((e) => e.uid === uid);
}

export function seriesCount(days: ChartDay[], series: string | undefined): number {
  if (!series) return 1;
  return days.reduce((n, d) => n + (d.events ?? []).filter((e) => e.series === series).length, 0);
}

export type Scope = "one" | "all";

/** Patch an event on one day, or every copy in its series. */
export function updateEvent(days: ChartDay[], day: number, uid: string, patch: Partial<EventDraft>, scope: Scope): ChartDay[] {
  const ev = findEvent(days, day, uid);
  if (!ev) return days;
  const hit = (d: ChartDay, e: ChartEvent) => (scope === "all" && ev.series ? e.series === ev.series : d.day === day && e.uid === uid);
  return days.map((d) => {
    if (!d.events?.some((e) => hit(d, e))) return d;
    return { ...d, events: sortEvents(d.events.map((e) => (hit(d, e) ? { ...e, ...patch } : e))) };
  });
}

export function removeEvent(days: ChartDay[], day: number, uid: string, scope: Scope): ChartDay[] {
  const ev = findEvent(days, day, uid);
  if (!ev) return days;
  return days.map((d) => {
    const list = d.events ?? [];
    const keep = list.filter((e) => !(scope === "all" && ev.series ? e.series === ev.series : d.day === day && e.uid === uid));
    return keep.length === list.length ? d : { ...d, events: keep };
  });
}

/** Move one copy to another day/time (it leaves its series when the day changes). */
export function moveEvent(days: ChartDay[], fromDay: number, uid: string, toDay: number, time: string): ChartDay[] {
  const ev = findEvent(days, fromDay, uid);
  if (!ev) return days;
  if (fromDay === toDay) return updateEvent(days, fromDay, uid, { time }, "one");
  const moved: ChartEvent = { ...ev, time };
  delete moved.series;
  return days.map((d) => {
    if (d.day === fromDay) return { ...d, events: (d.events ?? []).filter((e) => e.uid !== uid) };
    if (d.day === toDay) return { ...d, events: sortEvents([...(d.events ?? []), moved]) };
    return d;
  });
}

/** Set a meal's time on one day; clears the override when it equals the chart default. */
export function setMealTime(days: ChartDay[], day: number, meal: MealTime, time: string, chartTimes: Partial<Record<MealTime, string>>): ChartDay[] {
  const def = chartTimes[meal] || MEAL_TIME_DEFAULTS[meal];
  return days.map((d) => {
    if (d.day !== day) return d;
    const times = { ...(d.times ?? {}) };
    if (time === def) delete times[meal];
    else times[meal] = time;
    return { ...d, times: Object.keys(times).length ? times : undefined };
  });
}

/** Keep calendar data (events, per-day times, notes) when meals are regenerated. */
export function carryOverSchedule(prev: ChartDay[], next: ChartDay[]): ChartDay[] {
  const byDay = new Map(prev.map((d) => [d.day, d]));
  return next.map((d) => {
    const old = byDay.get(d.day);
    if (!old) return d;
    return {
      ...d,
      ...(old.events?.length ? { events: old.events } : {}),
      ...(old.times && Object.keys(old.times).length ? { times: old.times } : {}),
      ...(old.note ? { note: old.note } : {}),
    };
  });
}

/** Copy one day's events and per-day times onto other days (meals untouched). */
export function copyDaySchedule(days: ChartDay[], from: number, to: number[]): ChartDay[] {
  const src = days.find((d) => d.day === from);
  if (!src) return days;
  const set = new Set(to.filter((t) => t !== from));
  return days.map((d) =>
    set.has(d.day)
      ? {
          ...d,
          events: (src.events ?? []).map((e) => {
            const c = { ...e, uid: newUid() };
            delete c.series;
            return c;
          }),
          times: src.times ? { ...src.times } : undefined,
        }
      : d
  );
}

// ---- layout ------------------------------------------------------------------

export interface Block<T> {
  item: T;
  start: number; // minutes from midnight
  end: number; // drawn end (at least the minimum height)
  lane: number;
  lanes: number;
}

/** Side-by-side lanes for overlapping blocks within one day column. */
export function layoutBlocks<T>(items: { item: T; start: number; minutes: number }[], minMinutes: number): Block<T>[] {
  const sorted = items
    .map((x) => ({ item: x.item, start: x.start, end: x.start + Math.max(x.minutes, minMinutes), lane: 0, lanes: 1 }))
    .sort((a, b) => a.start - b.start || b.end - a.end);
  const out: Block<T>[] = [];
  let cluster: Block<T>[] = [];
  let clusterEnd = -1;
  const flush = () => {
    const laneEnds: number[] = [];
    for (const b of cluster) {
      let l = laneEnds.findIndex((end) => end <= b.start);
      if (l < 0) {
        l = laneEnds.length;
        laneEnds.push(0);
      }
      laneEnds[l] = b.end;
      b.lane = l;
    }
    for (const b of cluster) {
      b.lanes = laneEnds.length;
      out.push(b);
    }
    cluster = [];
  };
  for (const b of sorted) {
    if (cluster.length && b.start >= clusterEnd) {
      flush();
      clusterEnd = -1;
    }
    cluster.push(b);
    clusterEnd = Math.max(clusterEnd, b.end);
  }
  if (cluster.length) flush();
  return out;
}

/** Visible hour range that fits everything on the given days (at least 6 am – 11 pm). */
export function hourRange(days: ChartDay[], chartTimes: Partial<Record<MealTime, string>>): [number, number] {
  let lo = 6 * 60;
  let hi = 23 * 60;
  for (const d of days) {
    for (const m of MEAL_TIMES) {
      if (!d.meals[m]?.length) continue;
      const t = toMin(mealTimeOn(d, m, chartTimes));
      lo = Math.min(lo, t);
      hi = Math.max(hi, t + MEAL_MINUTES[m]);
    }
    for (const e of d.events ?? []) {
      const t = toMin(e.time);
      lo = Math.min(lo, t);
      hi = Math.max(hi, t + e.minutes);
    }
  }
  return [Math.max(0, Math.floor(lo / 60)), Math.min(24, Math.ceil(hi / 60))];
}
