"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import GroceryList from "@/components/foodbank/GroceryList";
import { RecipeContext } from "@/components/foodbank/RecipeEditor";
import { useRecipeBank } from "@/components/foodbank/useRecipeBank";
import { Chip, Meter, Modal, Toggle } from "@/components/foodbank/ui";
import { chartPool, parseAllergies } from "@/lib/foodbank/bank";
import { fmtDate, useDishes, type CustomDishRow } from "@/lib/foodbank/client";
import { chartSummary, defaultPrefs, dishFitsProfile, type ChartDay, type ChartPrefs, type ChartProfile, type PlanItem } from "@/lib/foodbank/engine";
import type { ChartDTO } from "@/lib/foodbank/server";
import type { MealTime, SubjectInfo } from "@/lib/types";
import ChartGenerator from "./ChartGenerator";
import MealEditor, { type PendingRequest } from "./MealEditor";
import WeekGrid, { type CellRef } from "./WeekGrid";

type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

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

  // ---- derived -----------------------------------------------------------------
  const chartRequests = requests.filter((r) => r.chartId === chart?.id);
  const pendingCells = new Set(chartRequests.map((r) => `${r.day}:${r.meal}`));
  const weeks = chart ? Math.ceil(chart.days.length / 7) : 0;
  const weekDays = chart ? chart.days.slice(week * 7, week * 7 + 7) : [];
  const summary = chart ? chartSummary(chart.days, index) : null;
  const selDay = chart && sel ? chart.days.find((d) => d.day === sel.day) : undefined;

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
          <button className="btn-secondary px-3 py-1.5 text-xs" onClick={() => regenerate({})} disabled={busy}>
            {busy ? "…" : "⟳ Regenerate"}
          </button>
          <button className="btn-secondary px-3 py-1.5 text-xs" onClick={() => setMode("settings")}>
            Settings
          </button>
          <button className="btn-secondary px-3 py-1.5 text-xs" onClick={() => setGrocery(true)}>
            🛒 Grocery
          </button>
          <a className="btn-secondary px-3 py-1.5 text-xs" href={`/api/charts/${chart.id}/export`}>
            Excel
          </a>
          <a className="btn-accent px-3 py-1.5 text-xs" href={`/api/charts/${chart.id}/pdf`} target="_blank" rel="noopener noreferrer">
            ⬇ PDF
          </a>
          <button className="btn-ghost px-2 py-1.5 text-xs" onClick={() => setMode("new")} title="Create another chart">
            + New
          </button>
          <button className="btn-ghost px-2 py-1.5 text-xs text-red-600" onClick={deleteChart} title="Delete chart">
            Delete
          </button>
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
      {error && (
        <div className="flex items-center justify-between rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          <span>{error}</span>
          <button className="text-xs underline" onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      {/* Summary */}
      {summary && (
        <div className="card grid grid-cols-2 gap-4 p-4 sm:grid-cols-3 lg:grid-cols-6">
          <Meter label="Avg energy" value={summary.avg.kcal} target={chart.targets.kcal} unit=" kcal" />
          <Meter
            label="Protein"
            value={summary.avg.protein}
            target={chart.targets.protein}
            unit=" g"
            mode={subject.conditions?.includes("renal") || subject.dietType === "renal" ? "max" : "min"}
          />
          <Meter label="Carbs" value={summary.avg.carbs} target={chart.targets.carbs} unit=" g" mode="max" />
          <Meter label="Fat" value={summary.avg.fat} target={chart.targets.fat} unit=" g" />
          <Meter label="Fibre" value={summary.avg.fibre} target={chart.targets.fibre} unit=" g" mode="min" />
          <Meter
            label="Sodium"
            value={summary.avg.sodium}
            target={(["hypertension", "renal"] as const).some((c) => subject.dietType === c || subject.conditions?.includes(c)) ? 1500 : 2000}
            unit=" mg"
            mode="max"
          />
          <div className="col-span-2 flex flex-wrap items-center gap-2 text-xs text-slate-500 sm:col-span-3 lg:col-span-6">
            <Chip size="sm" tone="brand">{summary.uniqueDishes} different dishes</Chip>
            <Chip size="sm">Avg Ca {Math.round(summary.avg.calcium)} mg</Chip>
            <Chip size="sm">Avg Fe {summary.avg.iron.toFixed(1)} mg</Chip>
            {chartRequests.length > 0 && <Chip size="sm" tone="amber">{chartRequests.length} client request{chartRequests.length > 1 ? "s" : ""} pending</Chip>}
            <span className="text-slate-400">Click any meal to edit · 🔒 locks a dish when regenerating</span>
          </div>
        </div>
      )}

      {weeks > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {Array.from({ length: weeks }, (_, i) => (
            <Chip key={i} tone="brand" active={week === i} onClick={() => setWeek(i)}>
              Week {i + 1}
            </Chip>
          ))}
        </div>
      )}

      <div className="flex gap-4">
        <div className="min-w-0 flex-1">
          <WeekGrid
            days={weekDays}
            index={index}
            targets={chart.targets}
            mealTimes={chart.mealTimes}
            selected={sel}
            pendingCells={pendingCells}
            onSelect={setSel}
            onRegenerateDay={(day) => regenerate({ day })}
            busyDay={busyDay}
            onMealTimeChange={(meal: MealTime, time: string) => {
              const mealTimes = { ...chart.mealTimes, [meal]: time };
              setChart({ ...chart, mealTimes });
              queueSave({ mealTimes });
            }}
          />
        </div>
        {sel && selDay && (
          <aside className="fixed inset-x-0 bottom-0 z-40 h-[80vh] overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-2xl lg:sticky lg:top-20 lg:z-auto lg:h-[calc(100vh-7rem)] lg:w-[400px] lg:shrink-0 lg:rounded-xl lg:shadow-sm">
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
              mealTime={chart.mealTimes[sel.meal]}
              pending={chartRequests.filter((r) => r.day === sel.day && r.meal === sel.meal)}
              onChange={(items: PlanItem[]) =>
                setDays(chart.days.map((d) => (d.day === sel.day ? { ...d, meals: { ...d.meals, [sel.meal]: items } } : d)))
              }
              onResolve={resolveRequest}
              onClose={() => setSel(null)}
            />
          </aside>
        )}
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

      <Modal open={grocery} onClose={() => setGrocery(false)} title="Grocery list" wide>
        <GroceryList days={chart.days} index={index} />
      </Modal>
    </div>
    </RecipeContext.Provider>
  );
}
