"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import GroceryList from "@/components/foodbank/GroceryList";
import { RecipeContext } from "@/components/foodbank/RecipeEditor";
import { useRecipeBank } from "@/components/foodbank/useRecipeBank";
import { Icon } from "@/components/foodbank/CalendarIcons";
import { Chip, Meter, Modal, Toggle } from "@/components/foodbank/ui";
import { chartPool, parseAllergies } from "@/lib/foodbank/bank";
import { fmtDate, useDishes, type CustomDishRow } from "@/lib/foodbank/client";
import { chartSummary, dayTotals, defaultPrefs, dishFitsProfile, MEAL_TIME_DEFAULTS, newUid, type ChartDay, type ChartPrefs, type ChartProfile, type PlanItem } from "@/lib/foodbank/engine";
import {
  addEvent,
  dayActivity,
  EVENT_KINDS,
  estimateBurn,
  eventLabel,
  findEvent,
  fmt12,
  KIND_LABELS,
  mealTimeOn,
  moveEvent,
  removeEvent,
  setMealTime,
  updateEvent,
  type EventDraft,
  type Scope,
} from "@/lib/foodbank/schedule";
import { cloneItems, copyDay, copyItemsTo, nearestMeal } from "@/lib/foodbank/copy";
import type { ChartDTO } from "@/lib/foodbank/server";
import { MEAL_TIME_LABELS, type MealTime, type SubjectInfo } from "@/lib/types";
import CalendarView, { type CalendarFilter } from "./CalendarView";
import EventEditor from "./EventEditor";
import CopyToPanel, { type CopyOptions, type CopySource } from "./CopyToPanel";
import ChartGenerator from "./ChartGenerator";
import MealEditor, { type PendingRequest } from "./MealEditor";
import WeekGrid, { type CellRef } from "./WeekGrid";

type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";
type View = "week" | "day" | "table";
const VIEW_KEY = "nutriplan:chart-view";
const KIND_DOT: Record<keyof CalendarFilter, string> = {
  meal: "bg-brand-400",
  exercise: "bg-orange-400",
  supplement: "bg-violet-400",
  water: "bg-sky-400",
  note: "bg-amber-400",
};

export default function ChartTab({ reportId, subject }: { reportId: string; subject: SubjectInfo }) {
  const [charts, setCharts] = useState<ChartDTO[] | null>(null);
  const [chart, setChart] = useState<ChartDTO | null>(null);
  const [customRows, setCustomRows] = useState<CustomDishRow[]>([]);
  const [requests, setRequests] = useState<PendingRequest[]>([]);
  const [portalEnabled, setPortalEnabled] = useState(false);
  const [mode, setMode] = useState<"view" | "new" | "settings">("view");
  const [busy, setBusy] = useState(false);
  const [busyDay, setBusyDay] = useState<number | null>(null);
  const [week, setWeek] = useState(0);
  const [sel, setSel] = useState<CellRef | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [conflict, setConflict] = useState(false);
  const [grocery, setGrocery] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Calendar
  const [view, setView] = useState<View>("week");
  const [dayIdx, setDayIdx] = useState(0);
  const [evSel, setEvSel] = useState<{ day: number; uid?: string; time?: string } | null>(null);
  const [filters, setFilters] = useState<CalendarFilter>({ meal: true, exercise: true, supplement: true, water: true, note: true });
  const [menuOpen, setMenuOpen] = useState(false);
  const [undoMsg, setUndoMsg] = useState<string | null>(null);

  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(VIEW_KEY);
    } catch {
      /* storage blocked */
    }
    if (saved === "week" || saved === "day" || saved === "table") setView(saved);
    else if (window.innerWidth < 768) setView("day");
  }, []);
  const changeView = (v: View) => {
    setView(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      /* storage blocked */
    }
  };

  const { all, index, custom, ingredients: customIngredients } = useDishes(customRows);
  const profile: ChartProfile = useMemo(
    () => ({
      dietType: subject.dietType,
      conditions: subject.conditions,
      dietPreference: subject.dietPreference,
      allergens: parseAllergies(subject.allergies),
      incomeGroup: subject.incomeGroup,
      glycemicStatus: subject.glycemicStatus,
    }),
    [subject]
  );
  // This chart's client-customised dishes stand in for their originals.
  const pool = useMemo(
    () => (chart ? chartPool({ pool: all, custom }, chart.id) : all).filter((d) => dishFitsProfile(d, profile, chart?.prefs)),
    [all, custom, profile, chart?.prefs, chart?.id]
  );
  // Condition-aware starting point for a new chart (coach can change any of it).
  const newDefaults = useMemo(() => {
    const p = defaultPrefs(profile, 7);
    return { focusTags: p.focusTags, avoidTags: p.avoidTags, nonVegDays: p.nonVegDays };
  }, [profile]);

  // ---- loading ----------------------------------------------------------------
  const loadRequests = useCallback(async () => {
    const r = await fetch("/api/requests?status=pending").then((x) => x.json()).catch(() => ({ requests: [] }));
    setRequests(r.requests ?? []);
  }, []);

  useEffect(() => {
    (async () => {
      const [c, d, p] = await Promise.all([
        fetch(`/api/reports/${reportId}/charts`).then((r) => r.json()),
        fetch("/api/foodbank/dishes").then((r) => r.json()),
        fetch(`/api/reports/${reportId}/portal`).then((r) => r.json()),
      ]);
      setCharts(c.charts ?? []);
      setChart(c.charts?.[0] ?? null);
      setCustomRows(d.dishes ?? []);
      setPortalEnabled(!!p.portal?.enabled);
      if (!c.charts?.length) setMode("new");
      loadRequests();
    })().catch(() => setError("Could not load diet charts."));
    const t = setInterval(loadRequests, 60_000);
    return () => clearInterval(t);
  }, [reportId, loadRequests]);

  // ---- autosave queue (one request in flight, latest edits win) -------------
  const versionRef = useRef(0);
  const pendingRef = useRef<Record<string, unknown> | null>(null);
  const inFlight = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chartIdRef = useRef<string | null>(null);

  useEffect(() => {
    versionRef.current = chart?.version ?? 0;
    chartIdRef.current = chart?.id ?? null;
  }, [chart?.id, chart?.version]);

  const flush = useCallback(async () => {
    if (inFlight.current || !pendingRef.current || !chartIdRef.current) return;
    const patch = pendingRef.current;
    pendingRef.current = null;
    inFlight.current = true;
    setSaveState("saving");
    try {
      const res = await fetch(`/api/charts/${chartIdRef.current}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...patch, baseVersion: versionRef.current }),
      });
      const data = await res.json();
      if (res.status === 409) {
        setConflict(true);
        setSaveState("error");
      } else if (!res.ok) {
        setSaveState("error");
      } else {
        versionRef.current = data.chart.version;
        setChart((c) => (c ? { ...c, version: data.chart.version, updatedAt: data.chart.updatedAt, shared: data.chart.shared } : c));
        setSaveState("saved");
      }
    } catch {
      setSaveState("error");
    } finally {
      inFlight.current = false;
      if (pendingRef.current) flush();
    }
  }, []);

  const queueSave = useCallback(
    (patch: Record<string, unknown>) => {
      pendingRef.current = { ...(pendingRef.current ?? {}), ...patch };
      setSaveState("dirty");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(flush, 700);
    },
    [flush]
  );

  const setDays = (days: ChartDay[]) => {
    setChart((c) => (c ? { ...c, days } : c));
    queueSave({ days });
  };

  // ---- calendar edits (undoable) ---------------------------------------------
  const history = useRef<ChartDay[][]>([]);
  useEffect(() => {
    history.current = [];
  }, [chart?.id]);
  const commitDays = (next: ChartDay[], msg: string) => {
    const c = chartRef.current;
    if (!c) return;
    history.current = [...history.current.slice(-29), c.days];
    setDays(next);
    flash(msg);
    setUndoMsg(msg);
  };
  const undo = () => {
    const prev = history.current.pop();
    if (!prev) return flash("Nothing to undo");
    setDays(prev);
    setUndoMsg(null);
    flash("Undone");
  };
  const selectMeal = (day: number, meal: MealTime) => {
    setSel({ day, meal });
    setEvSel(null);
    setDayIdx(day);
  };
  const selectEvent = (day: number, uid: string) => {
    setEvSel({ day, uid });
    setSel(null);
    setDayIdx(day);
  };
  const createAt = (day: number, time: string) => {
    setEvSel({ day, time });
    setSel(null);
    setDayIdx(day);
  };
  const moveMeal = (day: number, meal: MealTime, time: string) => {
    const c = chartRef.current;
    if (!c) return;
    commitDays(setMealTime(c.days, day, meal, time, c.mealTimes), `${MEAL_TIME_LABELS[meal]} moved to ${fmt12(time)} on day ${day + 1}`);
  };
  const mealTimeForAll = (meal: MealTime, time: string) => {
    const c = chartRef.current;
    if (!c) return;
    history.current = [...history.current.slice(-29), c.days];
    const mealTimes = { ...c.mealTimes, [meal]: time };
    const days = c.days.map((d) => {
      if (!d.times?.[meal]) return d;
      const times = { ...d.times };
      delete times[meal];
      return { ...d, times: Object.keys(times).length ? times : undefined };
    });
    setChart({ ...c, mealTimes, days });
    queueSave({ mealTimes, days });
    flash(`${MEAL_TIME_LABELS[meal]} is now at ${fmt12(time)} every day`);
  };
  const onMoveEvent = (from: number, uid: string, to: number, time: string) => {
    const c = chartRef.current;
    const ev = c && findEvent(c.days, from, uid);
    if (!c || !ev) return;
    commitDays(moveEvent(c.days, from, uid, to, time), `${eventLabel(ev)} moved to ${fmt12(time)}${to !== from ? ` on day ${to + 1}` : ""}`);
    setEvSel((s) => (s?.uid === uid ? { day: to, uid } : s));
  };
  const onResizeEvent = (day: number, uid: string, minutes: number) => {
    const c = chartRef.current;
    const ev = c && findEvent(c.days, day, uid);
    if (!c || !ev) return;
    const patch = ev.kind === "exercise" ? { minutes, kcal: estimateBurn(minutes, ev.intensity) } : { minutes };
    commitDays(updateEvent(c.days, day, uid, patch, "one"), `${ev.kind === "water" ? "Water" : ev.title} now ${minutes} min`);
  };
  const onCreateEvent = (draft: EventDraft, targetDays: number[]) => {
    const c = chartRef.current;
    if (!c || !evSel) return;
    const { days, uids } = addEvent(c.days, targetDays, draft);
    const n = targetDays.length;
    commitDays(days, `Added ${draft.kind === "water" ? "water" : draft.title} to ${n > 1 ? `${n} days` : `day ${targetDays[0] + 1}`}`);
    setEvSel(uids[evSel.day] ? { day: evSel.day, uid: uids[evSel.day] } : null);
  };
  const onUpdateEvent = (patch: Partial<EventDraft>, scope: Scope) => {
    const c = chartRef.current;
    if (!c || !evSel?.uid) return;
    commitDays(updateEvent(c.days, evSel.day, evSel.uid, patch, scope), scope === "all" ? "Saved for every day it repeats" : `Saved for day ${evSel.day + 1}`);
  };
  const onDeleteEvent = (scope: Scope) => {
    const c = chartRef.current;
    if (!c || !evSel?.uid) return;
    const ev = findEvent(c.days, evSel.day, evSel.uid);
    commitDays(removeEvent(c.days, evSel.day, evSel.uid, scope), `Deleted ${ev ? eventLabel(ev) : "item"}${scope === "all" ? " from every day" : ""}`);
    setEvSel(null);
  };

  // ---- actions -----------------------------------------------------------------
  const replaceChart = (c: ChartDTO) => {
    setChart(c);
    setCharts((list) => (list ? [c, ...list.filter((x) => x.id !== c.id)] : [c]));
    versionRef.current = c.version;
    setConflict(false);
  };

  const generate = async (prefs: Partial<ChartPrefs>) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/reports/${reportId}/charts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prefs }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      replaceChart(data.chart);
      setWeek(0);
      setSel(null);
      setMode("view");
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "Could not generate the chart.");
    } finally {
      setBusy(false);
    }
  };

  const regenerate = async (body: { day?: number; prefs?: Partial<ChartPrefs> }) => {
    if (!chart) return;
    if (timer.current) clearTimeout(timer.current);
    await flush();
    if (typeof body.day === "number") setBusyDay(body.day);
    else setBusy(true);
    try {
      const res = await fetch(`/api/charts/${chart.id}/regenerate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      replaceChart(data.chart);
      setMode("view");
      if (body.prefs) setWeek(0);
    } catch {
      setError("Regeneration failed.");
    } finally {
      setBusy(false);
      setBusyDay(null);
    }
  };

  const reload = async () => {
    if (!chart) return;
    const data = await fetch(`/api/charts/${chart.id}`).then((r) => r.json());
    if (data.chart) replaceChart(data.chart);
  };

  // ---- recipe editing (customise for client / save as new / replace) --------
  const chartRef = useRef(chart);
  chartRef.current = chart;
  const reloadRef = useRef(reload);
  reloadRef.current = reload;
  const recipeChart = useMemo(
    () =>
      chart
        ? {
            id: chart.id,
            flush: async () => {
              if (timer.current) clearTimeout(timer.current);
              await flush();
            },
            swapDish: (fromId: string, toId: string) => {
              const c = chartRef.current;
              if (!c) return;
              const days = c.days.map((d) => ({
                ...d,
                meals: Object.fromEntries(
                  Object.entries(d.meals).map(([m, items]) => [
                    m,
                    items.map((it) => ({
                      ...it,
                      dishId: it.dishId === fromId ? toId : it.dishId,
                      alts: it.alts?.map((a) => (a.dishId === fromId ? { ...a, dishId: toId } : a)),
                    })),
                  ])
                ) as ChartDay["meals"],
              }));
              setChart({ ...c, days });
              queueSave({ days });
            },
            reload: () => reloadRef.current(),
          }
        : undefined,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [chart?.id, flush, queueSave]
  );
  const recipeActions = useRecipeBank({ customIngredients, setCustomRows, chart: recipeChart });

  const resolveRequest = async (id: string, decision: "approve" | "reject", note: string) => {
    if (timer.current) clearTimeout(timer.current);
    await flush();
    const res = await fetch(`/api/requests/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision, coachNote: note }),
    });
    const data = await res.json();
    if (!res.ok) setError(data.error ?? "Could not resolve the request.");
    await Promise.all([loadRequests(), reload()]);
  };

  const toggleShare = async (shared: boolean) => {
    if (!chart) return;
    setChart({ ...chart, shared });
    const res = await fetch(`/api/charts/${chart.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shared }),
    });
    if (!res.ok) setChart({ ...chart, shared: !shared });
  };

  const deleteChart = async () => {
    if (!chart || !confirm(`Delete “${chart.title}”? This cannot be undone.`)) return;
    await fetch(`/api/charts/${chart.id}`, { method: "DELETE" });
    const rest = (charts ?? []).filter((c) => c.id !== chart.id);
    setCharts(rest);
    setChart(rest[0] ?? null);
    setSel(null);
    if (!rest.length) setMode("new");
  };

  // ---- copy & paste (⌘C / ⌘V, Copy / Paste buttons) ------------------------------
  // The clipboard lives in localStorage so dishes can also be pasted into
  // another client's chart.
  const CLIP_KEY = "nutriplan:chart-clipboard";
  const flash = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice((n) => (n === msg ? null : n)), 3500);
  };
  const clipRef = useRef<PlanItem[] | null>(null);
  const [clipLabel, setClipLabel] = useState<string | null>(null);
  const labelFor = (items: PlanItem[]) => {
    const first = index[items[0]?.dishId]?.name ?? "1 dish";
    return items.length > 1 ? `${first} + ${items.length - 1} more` : first;
  };
  const readClip = (): PlanItem[] | null => {
    let clip = clipRef.current;
    try {
      const raw = localStorage.getItem(CLIP_KEY);
      if (raw) clip = JSON.parse(raw) as PlanItem[];
    } catch {
      /* use memory copy */
    }
    return clip?.length ? clip : null;
  };
  useEffect(() => {
    const c = readClip();
    if (c && c.some((i) => index[i.dishId])) setClipLabel(labelFor(c.filter((i) => index[i.dishId])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);
  const copyItems = (items: PlanItem[]) => {
    if (!items.length) return;
    try {
      localStorage.setItem(CLIP_KEY, JSON.stringify(items));
    } catch {
      /* storage blocked — fall back to memory */
    }
    clipRef.current = items;
    setClipLabel(labelFor(items));
    flash(`Copied ${labelFor(items)} — select another meal and press ⌘V`);
  };
  const pasteInto = (dayNum: number, meal: MealTime) => {
    const c = chartRef.current;
    const clip = readClip();
    if (!c || !clip) return;
    const pasted = cloneItems(clip.filter((i) => index[i.dishId])).map((i) => ({ ...i, alts: i.alts?.filter((a) => index[a.dishId]) }));
    if (!pasted.length) return flash("Those dishes aren't available in this food bank.");
    const misfit = pasted.filter((i) => !dishFitsProfile(index[i.dishId], profile, c.prefs)).map((i) => index[i.dishId].name);
    const days = c.days.map((d) => (d.day === dayNum ? { ...d, meals: { ...d.meals, [meal]: [...(d.meals[meal] ?? []), ...pasted] } } : d));
    commitDays(
      days,
      `Pasted ${labelFor(pasted)} into ${MEAL_TIME_LABELS[meal]}, day ${dayNum + 1}` +
        (misfit.length ? ` — note: ${misfit.join(", ")} may not suit this client's diet or allergies` : "")
    );
  };
  const keyRef = useRef<(e: KeyboardEvent) => void>(() => {});
  keyRef.current = (e: KeyboardEvent) => {
    if (!(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey) return;
    const k = e.key.toLowerCase();
    if (k !== "c" && k !== "v") return;
    const t = e.target as HTMLElement | null;
    if (t && (t.closest("input, textarea, select, [contenteditable=true]") || t.isContentEditable)) return;
    if (k === "c" && window.getSelection()?.toString()) return; // let normal text copy work
    const c = chartRef.current;
    if (!c || !sel) return;
    const day = c.days.find((d) => d.day === sel.day);
    if (!day) return;
    const items = day.meals[sel.meal] ?? [];
    if (k === "c") {
      const picked = sel.uid ? items.filter((i) => i.uid === sel.uid) : items;
      if (!picked.length) return;
      e.preventDefault();
      copyItems(picked);
      return;
    }
    if (!readClip()) return;
    e.preventDefault();
    pasteInto(sel.day, sel.meal);
  };
  useEffect(() => {
    const h = (e: KeyboardEvent) => keyRef.current(e);
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  // ---- copy to other days / meals, duplicate by ⌥-drag ------------------------------
  const [copyReq, setCopyReq] = useState<{ source: CopySource; items?: PlanItem[] } | null>(null);
  const openCopyItems = (day: number, meal: MealTime, items: PlanItem[]) =>
    setCopyReq({ source: { kind: "items", day, meal, label: labelFor(items) }, items });
  const openCopyDay = (day: number) => setCopyReq({ source: { kind: "day", day } });
  const applyCopy = (opts: CopyOptions) => {
    const c = chartRef.current;
    if (!c || !copyReq) return;
    const n = opts.days.length;
    const where = `${n} day${n > 1 ? "s" : ""}`;
    if (copyReq.source.kind === "day") {
      commitDays(copyDay(c.days, copyReq.source.day, opts.days, { schedule: opts.schedule }), `Copied day ${copyReq.source.day + 1} to ${where}`);
    } else {
      commitDays(
        copyItemsTo(c.days, copyReq.items ?? [], opts.days, opts.meal, opts.mode),
        `Copied ${copyReq.source.label} to ${MEAL_TIME_LABELS[opts.meal]} on ${where}`
      );
    }
    setCopyReq(null);
  };
  const onDuplicateMeal = (fromDay: number, meal: MealTime, toDay: number, time: string) => {
    const c = chartRef.current;
    const src = c?.days.find((d) => d.day === fromDay);
    const dst = c?.days.find((d) => d.day === toDay);
    if (!c || !src || !dst) return;
    const items = src.meals[meal] ?? [];
    if (!items.length) return flash("That meal is empty — nothing to copy.");
    const target = nearestMeal(dst, time, c.mealTimes);
    if (target === meal && toDay === fromDay) return;
    commitDays(copyItemsTo(c.days, items, [toDay], target, "add"), `Copied ${MEAL_TIME_LABELS[meal]} to ${MEAL_TIME_LABELS[target]} on day ${toDay + 1}`);
  };
  const onDuplicateEvent = (fromDay: number, uid: string, toDay: number, time: string) => {
    const c = chartRef.current;
    const ev = c && findEvent(c.days, fromDay, uid);
    if (!c || !ev) return;
    const draft: EventDraft = { ...ev, time };
    delete (draft as Partial<typeof ev>).uid;
    delete (draft as Partial<typeof ev>).series;
    commitDays(addEvent(c.days, [toDay], draft).days, `Copied ${eventLabel(ev)} to day ${toDay + 1} at ${fmt12(time)}`);
  };

  // ---- calendar shortcuts: D / W / T views, ← → navigate, N new, Delete, ⌘Z ----
  const calKeyRef = useRef<(e: KeyboardEvent) => void>(() => {});
  calKeyRef.current = (e: KeyboardEvent) => {
    const t = e.target as HTMLElement | null;
    if (t && (t.closest("input, textarea, select, [contenteditable=true]") || t.isContentEditable)) return;
    if (mode !== "view" || !chart || grocery) return;
    if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "z") {
      e.preventDefault();
      undo();
      return;
    }
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key;
    if (k === "Escape") {
      setSel(null);
      setEvSel(null);
      setMenuOpen(false);
    } else if (k === "d" || k === "D") changeView("day");
    else if (k === "w" || k === "W") changeView("week");
    else if (k === "t" || k === "T") changeView("table");
    else if (k === "ArrowLeft") go(-1);
    else if (k === "ArrowRight") go(1);
    else if ((k === "n" || k === "N") && view !== "table") {
      e.preventDefault();
      createAt(Math.min(dayIdx, chart.days.length - 1), "09:00");
    } else if ((k === "Delete" || k === "Backspace") && evSel?.uid) {
      e.preventDefault();
      const ev = findEvent(chart.days, evSel.day, evSel.uid);
      commitDays(removeEvent(chart.days, evSel.day, evSel.uid, "one"), `Deleted ${ev ? eventLabel(ev) : "item"} from day ${evSel.day + 1}`);
      setEvSel(null);
    }
  };
  useEffect(() => {
    const h = (e: KeyboardEvent) => calKeyRef.current(e);
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  // ---- derived -----------------------------------------------------------------
  const chartRequests = requests.filter((r) => r.chartId === chart?.id);
  const pendingCells = new Set(chartRequests.map((r) => `${r.day}:${r.meal}`));
  const weeks = chart ? Math.ceil(chart.days.length / 7) : 0;
  const weekDays = chart ? chart.days.slice(week * 7, week * 7 + 7) : [];
  const summary = chart ? chartSummary(chart.days, index) : null;
  const selDay = chart && sel ? chart.days.find((d) => d.day === sel.day) : undefined;
  const curIdx = chart ? Math.max(0, Math.min(dayIdx, chart.days.length - 1)) : 0;
  const curDay = chart?.days[curIdx];
  const calDays = view === "day" ? (curDay ? [curDay] : []) : weekDays;
  const shown = view === "day" && curDay ? dayTotals(curDay, index) : summary?.avg;
  const activity = (() => {
    if (!chart) return { burned: 0, exerciseMin: 0 };
    const list = view === "day" && curDay ? [curDay] : chart.days;
    const n = Math.max(1, list.length);
    const tot = list.reduce((a, d) => {
      const x = dayActivity(d);
      return { burned: a.burned + x.burned, exerciseMin: a.exerciseMin + x.exerciseMin };
    }, { burned: 0, exerciseMin: 0 });
    return { burned: Math.round(tot.burned / n), exerciseMin: Math.round(tot.exerciseMin / n) };
  })();
  const evDay = chart && evSel ? chart.days.find((d) => d.day === evSel.day) : undefined;
  const evObj = chart && evSel?.uid ? findEvent(chart.days, evSel.day, evSel.uid) : undefined;
  function go(dir: 1 | -1) {
    if (!chart) return;
    if (view === "day") {
      const n = Math.max(0, Math.min(chart.days.length - 1, curIdx + dir));
      setDayIdx(n);
      setWeek(Math.floor(n / 7));
    } else {
      const n = Math.max(0, Math.min(weeks - 1, week + dir));
      setWeek(n);
      setDayIdx(n * 7);
    }
  }

  if (charts === null) {
    return <div className="card p-10 text-center text-sm text-slate-400">Loading diet charts…</div>;
  }

  if (mode !== "view" || !chart) {
    return (
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-slate-900">
          {mode === "settings" ? "Regenerate with new settings" : "Create a diet chart"}
        </h2>
        <p className="mb-5 mt-1 text-sm text-slate-500">
          Builds a day-by-day plan of real dishes from the food bank, sized to{" "}
          <b>{subject.clientName}</b>’s targets and rotated so dishes don’t repeat too often.
          {mode === "settings" && " Locked dishes are kept."}
        </p>
        {error && <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        <ChartGenerator
          initial={mode === "settings" ? chart?.prefs : newDefaults}
          dietPreference={subject.dietPreference}
          dishes={all}
          profile={profile}
          clientName={subject.clientName}
          busy={busy}
          submitLabel={mode === "settings" ? "Regenerate chart" : "Generate diet chart"}
          onSubmit={(prefs) => (mode === "settings" ? regenerate({ prefs }) : generate(prefs))}
          onCancel={chart ? () => setMode("view") : undefined}
        />
      </div>
    );
  }

  return (
    <RecipeContext.Provider value={recipeActions}>
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="card flex flex-wrap items-center gap-3 p-3">
        <div className="min-w-0 flex-1">
          <input
            className="w-full rounded-md border border-transparent bg-transparent px-1 text-lg font-semibold text-slate-900 hover:border-slate-200 focus:border-brand-400 focus:outline-none"
            value={chart.title}
            onChange={(e) => {
              setChart({ ...chart, title: e.target.value });
              queueSave({ title: e.target.value });
            }}
            aria-label="Chart title"
          />
          <div className="px-1 text-xs text-slate-500">
            {fmtDate(chart.startDate, { day: "numeric", month: "short", year: "numeric" })} –{" "}
            {chart.days.length ? fmtDate(chart.days[chart.days.length - 1].date, { day: "numeric", month: "short", year: "numeric" }) : ""} ·{" "}
            {chart.days.length} days ·{" "}
            <span className={saveState === "error" ? "text-red-600" : "text-slate-400"}>
              {saveState === "saving" ? "Saving…" : saveState === "dirty" ? "Unsaved changes" : saveState === "error" ? "Save failed" : "All changes saved"}
            </span>
          </div>
        </div>
        {charts.length > 1 && (
          <select
            className="input w-auto py-1.5 text-xs"
            value={chart.id}
            onChange={(e) => {
              const c = charts.find((x) => x.id === e.target.value);
              if (c) {
                setChart(c);
                setWeek(0);
                setSel(null);
              }
            }}
            aria-label="Choose chart"
          >
            {charts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title} · {fmtDate(c.startDate, { day: "numeric", month: "short" })}
              </option>
            ))}
          </select>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Toggle
            checked={chart.shared}
            onChange={toggleShare}
            label={<span className="text-xs font-medium">{chart.shared ? "Shared with client" : "Share with client"}</span>}
          />
          <a className="btn-accent px-3 py-1.5 text-xs" href={`/api/charts/${chart.id}/pdf`} target="_blank" rel="noopener noreferrer">
            <Icon name="download" className="h-3.5 w-3.5" /> PDF
          </a>
          <div className="relative">
            <button
              className="btn-secondary px-2.5 py-1.5 text-xs"
              onClick={() => setMenuOpen((o) => !o)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
            >
              <Icon name="more" className="h-4 w-4" /> More
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} aria-hidden="true" />
                <div role="menu" className="absolute right-0 top-full z-40 mt-1 w-56 rounded-xl border border-slate-200 bg-white p-1 text-sm shadow-lg">
                  {[
                    { label: busy ? "Regenerating…" : "Regenerate whole chart", run: () => regenerate({}), disabled: busy },
                    { label: "Chart settings", run: () => setMode("settings") },
                    { label: "Grocery list", run: () => setGrocery(true) },
                    { label: `Copy day ${curIdx + 1} to other days`, run: () => openCopyDay(curIdx) },
                  ].map((it) => (
                    <button
                      key={it.label}
                      role="menuitem"
                      disabled={it.disabled}
                      className="block w-full rounded-lg px-3 py-2 text-left text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                      onClick={() => {
                        setMenuOpen(false);
                        it.run();
                      }}
                    >
                      {it.label}
                    </button>
                  ))}
                  <a role="menuitem" className="block rounded-lg px-3 py-2 text-slate-700 hover:bg-slate-100" href={`/api/charts/${chart.id}/export`} onClick={() => setMenuOpen(false)}>
                    Export Excel
                  </a>
                  <button
                    role="menuitem"
                    className="block w-full rounded-lg px-3 py-2 text-left text-slate-700 hover:bg-slate-100"
                    onClick={() => {
                      setMenuOpen(false);
                      setMode("new");
                    }}
                  >
                    New chart
                  </button>
                  <div className="my-1 border-t border-slate-100" />
                  <button
                    role="menuitem"
                    className="block w-full rounded-lg px-3 py-2 text-left text-red-600 hover:bg-red-50"
                    onClick={() => {
                      setMenuOpen(false);
                      deleteChart();
                    }}
                  >
                    Delete chart
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {chart.shared && !portalEnabled && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          This chart is marked as shared, but the client doesn’t have portal access yet — set it up in the <b>Client Portal</b> tab.
        </div>
      )}
      {conflict && (
        <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <span>This chart was changed elsewhere (e.g. an approved client request). Reload to continue editing.</span>
          <button className="btn-secondary px-3 py-1 text-xs" onClick={reload}>Reload</button>
        </div>
      )}
      {notice && (
        <div role="status" className="fixed bottom-6 left-1/2 z-50 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-3 rounded-lg bg-slate-900 px-4 py-2 text-sm text-white shadow-lg">
          <span>{notice}</span>
          {undoMsg === notice && (
            <button className="rounded-md bg-white/15 px-2.5 py-0.5 text-xs font-semibold hover:bg-white/25" onClick={undo}>
              Undo
            </button>
          )}
        </div>
      )}
      {error && (
        <div className="flex items-center justify-between rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          <span>{error}</span>
          <button className="text-xs underline" onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      {/* Summary */}
      {summary && (
        <div className="card grid grid-cols-2 gap-4 p-4 sm:grid-cols-3 lg:grid-cols-6">
          <Meter label={view === "day" ? "Energy" : "Avg energy"} value={shown?.kcal ?? 0} target={chart.targets.kcal} unit=" kcal" />
          <Meter
            label="Protein"
            value={shown?.protein ?? 0}
            target={chart.targets.protein}
            unit=" g"
            mode={subject.conditions?.includes("renal") || subject.dietType === "renal" ? "max" : "min"}
          />
          <Meter label="Carbs" value={shown?.carbs ?? 0} target={chart.targets.carbs} unit=" g" mode="max" />
          <Meter label="Fat" value={shown?.fat ?? 0} target={chart.targets.fat} unit=" g" />
          <Meter label="Fibre" value={shown?.fibre ?? 0} target={chart.targets.fibre} unit=" g" mode="min" />
          <Meter
            label="Sodium"
            value={shown?.sodium ?? 0}
            target={(["hypertension", "renal"] as const).some((c) => subject.dietType === c || subject.conditions?.includes(c)) ? 1500 : 2000}
            unit=" mg"
            mode="max"
          />
          <div className="col-span-2 flex flex-wrap items-center gap-2 text-xs text-slate-500 sm:col-span-3 lg:col-span-6">
            {view === "day" && curDay && <Chip size="sm" tone="slate">Day {curDay.day + 1} · {fmtDate(curDay.date)}</Chip>}
            {activity.burned > 0 && (
              <Chip size="sm" tone="amber">
                Exercise {activity.exerciseMin} min · −{activity.burned} kcal · net {Math.round((shown?.kcal ?? 0) - activity.burned)} kcal
                {view === "day" ? "" : " /day"}
              </Chip>
            )}
            <Chip size="sm" tone="brand">{summary.uniqueDishes} different dishes</Chip>
            <Chip size="sm">Avg Ca {Math.round(summary.avg.calcium)} mg</Chip>
            <Chip size="sm">Avg Fe {summary.avg.iron.toFixed(1)} mg</Chip>
            {chartRequests.length > 0 && <Chip size="sm" tone="amber">{chartRequests.length} client request{chartRequests.length > 1 ? "s" : ""} pending</Chip>}
            <span className="text-slate-400">
              {view === "table"
                ? "Click any meal to edit · click a meal or a dish, then ⌘C / ⌘V to copy & paste · 🔒 locks a dish when regenerating"
                : "Click an empty slot to add exercise, supplements or water · drag to move, hold ⌥ Option while dragging to duplicate · ⌘C / ⌘V copies dishes · 🔒 keeps a dish when regenerating"}
            </span>
          </div>
        </div>
      )}

      {/* Calendar toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="View" className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5">
          {(["week", "day", "table"] as const).map((v) => (
            <button
              key={v}
              aria-pressed={view === v}
              onClick={() => changeView(v)}
              title={`${v[0].toUpperCase()} key`}
              className={`rounded-md px-3 py-1 text-xs font-semibold capitalize ${view === v ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
            >
              {v}
            </button>
          ))}
        </div>
        <div className="flex items-center">
          <button className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30" onClick={() => go(-1)} disabled={view === "day" ? curIdx === 0 : week === 0} aria-label={view === "day" ? "Previous day" : "Previous week"}>
            <Icon name="left" />
          </button>
          <button
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30"
            onClick={() => go(1)}
            disabled={view === "day" ? curIdx >= chart.days.length - 1 : week >= weeks - 1}
            aria-label={view === "day" ? "Next day" : "Next week"}
          >
            <Icon name="right" />
          </button>
          <span className="ml-1 text-sm font-semibold text-slate-800">
            {view === "day" && curDay
              ? `Day ${curDay.day + 1} · ${fmtDate(curDay.date, { weekday: "long", day: "numeric", month: "short" })}`
              : weekDays.length
                ? `${weeks > 1 ? `Week ${week + 1} · ` : ""}${fmtDate(weekDays[0].date, { day: "numeric", month: "short" })} – ${fmtDate(weekDays[weekDays.length - 1].date, { day: "numeric", month: "short" })}`
                : ""}
          </span>
        </div>
        {view !== "table" && (
          <div role="group" aria-label="Show on calendar" className="flex min-w-0 flex-wrap gap-1.5">
            {(["meal", ...EVENT_KINDS] as const).map((k) => (
              <button
                key={k}
                aria-pressed={filters[k]}
                onClick={() => setFilters((f) => ({ ...f, [k]: !f[k] }))}
                className={`inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-xs font-medium text-slate-600 ${filters[k] ? "" : "line-through opacity-50"}`}
              >
                <span className={`h-2 w-2 rounded-full ${KIND_DOT[k]}`} />
                {KIND_LABELS[k]}
              </button>
            ))}
          </div>
        )}
        <div className="ml-auto flex items-center gap-2">
          {view === "day" && curDay && (
            <button className="btn-secondary px-3 py-1.5 text-xs" onClick={() => openCopyDay(curDay.day)}>
              <Icon name="copy" className="h-3.5 w-3.5" /> Copy day
            </button>
          )}
          {view === "day" && curDay && (
            <button className="btn-secondary px-3 py-1.5 text-xs" onClick={() => regenerate({ day: curDay.day })} disabled={busyDay === curDay.day}>
              <Icon name="refresh" className={`h-3.5 w-3.5 ${busyDay === curDay.day ? "animate-spin" : ""}`} /> Regenerate day
            </button>
          )}
          {view !== "table" && (
            <button className="btn-primary px-3 py-1.5 text-xs" onClick={() => createAt(curIdx, "09:00")} title="N key">
              <Icon name="plus" className="h-3.5 w-3.5" /> Add
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-4">
        <div className="min-w-0 flex-1">
          {view === "table" ? (
            <WeekGrid
              days={weekDays}
              index={index}
              targets={chart.targets}
              mealTimes={chart.mealTimes}
              selected={sel}
              pendingCells={pendingCells}
              onSelect={(c) => {
                setSel(c);
                setEvSel(null);
                setDayIdx(c.day);
              }}
              onRegenerateDay={(day) => regenerate({ day })}
              busyDay={busyDay}
              onMealTimeChange={(meal: MealTime, time: string) => {
                const mealTimes = { ...chart.mealTimes, [meal]: time };
                setChart({ ...chart, mealTimes });
                queueSave({ mealTimes });
              }}
            />
          ) : (
            <CalendarView
              days={calDays}
              view={view}
              index={index}
              targets={chart.targets}
              chartTimes={chart.mealTimes}
              filters={filters}
              currentDay={curIdx}
              selectedMeal={sel}
              selectedEvent={evSel?.uid ? { day: evSel.day, uid: evSel.uid } : null}
              pendingCells={pendingCells}
              busyDay={busyDay}
              onSelectMeal={selectMeal}
              onSelectEvent={selectEvent}
              onCreate={createAt}
              onOpenDay={(d) => {
                setDayIdx(d);
                changeView("day");
              }}
              onRegenerateDay={(day) => regenerate({ day })}
              onMoveMeal={moveMeal}
              onMoveEvent={onMoveEvent}
              onResizeEvent={onResizeEvent}
              onDuplicateMeal={onDuplicateMeal}
              onDuplicateEvent={onDuplicateEvent}
              onCopyDay={openCopyDay}
            />
          )}
        </div>
        {sel && selDay ? (
          <aside className="fixed inset-x-0 bottom-0 z-40 flex h-[80vh] flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-2xl lg:sticky lg:top-20 lg:z-auto lg:h-[calc(100vh-7rem)] lg:w-[400px] lg:shrink-0 lg:rounded-xl lg:shadow-sm">
            <div className="min-h-0 flex-1">
              <MealEditor
                key={`${sel.day}:${sel.meal}`}
                day={selDay}
                meal={sel.meal}
                allDays={chart.days}
                index={index}
                choices={chart.choices ?? {}}
                pool={pool}
                profile={profile}
                prefs={chart.prefs}
                targets={chart.targets}
                mealTime={fmt12(mealTimeOn(selDay, sel.meal, chart.mealTimes))}
                pending={chartRequests.filter((r) => r.day === sel.day && r.meal === sel.meal)}
                onChange={(items: PlanItem[]) =>
                  setDays(chart.days.map((d) => (d.day === sel.day ? { ...d, meals: { ...d.meals, [sel.meal]: items } } : d)))
                }
                onResolve={resolveRequest}
                onClose={() => setSel(null)}
                onCopyTo={(items) => openCopyItems(sel.day, sel.meal, items)}
                pasteLabel={clipLabel}
                onPaste={() => pasteInto(sel.day, sel.meal)}
              />
            </div>
            <MealTimeBar
              key={`t-${sel.day}:${sel.meal}`}
              day={selDay}
              meal={sel.meal}
              chartTime={chart.mealTimes[sel.meal] || MEAL_TIME_DEFAULTS[sel.meal]}
              onDay={(t) => moveMeal(sel.day, sel.meal, t)}
              onAll={(t) => mealTimeForAll(sel.meal, t)}
            />
          </aside>
        ) : evSel && evDay ? (
          <aside className="fixed inset-x-0 bottom-0 z-40 h-[80vh] overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-2xl lg:sticky lg:top-20 lg:z-auto lg:h-[calc(100vh-7rem)] lg:w-[380px] lg:shrink-0 lg:rounded-xl lg:shadow-sm">
            <EventEditor
              key={evSel.uid ?? `new-${evSel.day}-${evSel.time}`}
              days={chart.days}
              day={evSel.day}
              event={evObj}
              initialTime={evSel.time}
              chartTimes={chart.mealTimes}
              onCreate={onCreateEvent}
              onUpdate={onUpdateEvent}
              onDelete={onDeleteEvent}
              onMoveMealHere={(meal, time) => {
                moveMeal(evSel.day, meal, time);
                selectMeal(evSel.day, meal);
              }}
              onClose={() => setEvSel(null)}
            />
          </aside>
        ) : null}
      </div>

      {/* Note to client */}
      <div className="card p-4">
        <label className="label" htmlFor="chartNotes">Message to client (shown in their portal & PDF)</label>
        <textarea
          id="chartNotes"
          className="input min-h-[80px]"
          placeholder="e.g. Drink 2.5–3 L water daily. Walk 30 minutes after dinner. Use minimal oil; prefer steaming and grilling."
          value={chart.notes}
          onChange={(e) => {
            setChart({ ...chart, notes: e.target.value });
            queueSave({ notes: e.target.value });
          }}
        />
      </div>

      <Modal open={!!copyReq} onClose={() => setCopyReq(null)} title={copyReq?.source.kind === "day" ? "Copy a whole day" : "Copy to other days or meals"}>
        {copyReq && (
          <CopyToPanel
            key={JSON.stringify(copyReq.source)}
            days={chart.days}
            source={copyReq.source}
            onApply={applyCopy}
            onCancel={() => setCopyReq(null)}
          />
        )}
      </Modal>

      <Modal open={grocery} onClose={() => setGrocery(false)} title="Grocery list" wide>
        <GroceryList days={chart.days} index={index} />
      </Modal>
    </div>
    </RecipeContext.Provider>
  );
}

/** Footer under the meal editor: this day's time for the meal, or every day's. */
function MealTimeBar({
  day,
  meal,
  chartTime,
  onDay,
  onAll,
}: {
  day: ChartDay;
  meal: MealTime;
  chartTime: string;
  onDay: (time: string) => void;
  onAll: (time: string) => void;
}) {
  const current = day.times?.[meal] ?? chartTime;
  const [value, setValue] = useState(current);
  const custom = !!day.times?.[meal];
  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 bg-slate-50/70 px-4 py-2.5 text-xs text-slate-500">
      <label className="flex items-center gap-2">
        <span className="font-medium text-slate-600">Time on day {day.day + 1}</span>
        <input
          type="time"
          step={300}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={() => value && value !== current && onDay(value)}
          onKeyDown={(e) => e.key === "Enter" && value && value !== current && onDay(value)}
          className="rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-xs text-slate-700 focus:border-brand-400 focus:outline-none"
        />
      </label>
      {custom ? (
        <button className="text-brand-700 hover:underline" onClick={() => onDay(chartTime)}>
          Reset to {fmt12(chartTime)}
        </button>
      ) : (
        <span>Same as every day</span>
      )}
      {value !== chartTime && (
        <button className="ml-auto text-brand-700 hover:underline" onClick={() => onAll(value)}>
          Use {fmt12(value)} every day
        </button>
      )}
    </div>
  );
}
