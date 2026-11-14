"use client";

import { useMemo, useState } from "react";
import { fmtDate } from "@/lib/foodbank/client";
import { WEEKDAYS, weekdayOf, type ChartDay, type ChartEvent, type EventKind, type Intensity } from "@/lib/foodbank/engine";
import {
  daysForRepeat,
  estimateBurn,
  EVENT_KINDS,
  EXERCISE_PRESETS,
  fmt12,
  KIND_LABELS,
  mealTimeOn,
  seriesCount,
  SUPPLEMENT_PRESETS,
  SUPPLEMENT_TIMINGS,
  type EventDraft,
  type Repeat,
  type Scope,
} from "@/lib/foodbank/schedule";
import { MEAL_TIMES, MEAL_TIME_LABELS, type MealTime } from "@/lib/types";
import { Icon, KIND_STYLES } from "@/components/foodbank/CalendarIcons";

const DURATIONS = [5, 10, 15, 20, 30, 40, 45, 60, 75, 90, 120];
const WATER_ML = [200, 250, 300, 500, 750, 1000];

function defaultsFor(kind: EventKind, time: string): EventDraft {
  switch (kind) {
    case "exercise":
      return { kind, title: "Brisk walk", time, minutes: 30, intensity: "moderate", kcal: estimateBurn(30, "moderate") };
    case "supplement":
      return { kind, title: "Vitamin D3", time, minutes: 15, dose: "", timing: "With food" };
    case "water":
      return { kind, title: "Water", time, minutes: 15, ml: 500 };
    default:
      return { kind, title: "", time, minutes: 15, text: "" };
  }
}

function Seg<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="group" aria-label={label} className="inline-flex flex-wrap rounded-lg border border-slate-200 bg-slate-50 p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-md px-2.5 py-1 text-xs font-medium ${value === o.value ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function EventEditor({
  days,
  day,
  event,
  initialTime,
  chartTimes,
  onCreate,
  onUpdate,
  onDelete,
  onMoveMealHere,
  onClose,
}: {
  days: ChartDay[];
  day: number;
  /** Set when editing an existing event; otherwise a new one is created. */
  event?: ChartEvent;
  initialTime?: string;
  chartTimes: Partial<Record<MealTime, string>>;
  onCreate: (draft: EventDraft, targetDays: number[]) => void;
  onUpdate: (patch: Partial<EventDraft>, scope: Scope) => void;
  onDelete: (scope: Scope) => void;
  onMoveMealHere: (meal: MealTime, time: string) => void;
  onClose: () => void;
}) {
  const isNew = !event;
  const dayObj = days.find((d) => d.day === day);
  const [tab, setTab] = useState<EventKind | "meal">(event?.kind ?? "exercise");
  const [form, setForm] = useState<EventDraft>(() => (event ? { ...event } : defaultsFor("exercise", initialTime ?? "09:00")));
  const [kcalTouched, setKcalTouched] = useState(false);
  const [repeat, setRepeat] = useState<Repeat>("daily");
  const [weekdays, setWeekdays] = useState<number[]>(() => (dayObj ? [weekdayOf(dayObj.date)] : []));
  const total = seriesCount(days, event?.series);
  const [scope, setScope] = useState<Scope>(total > 1 ? "all" : "one");
  const [dirty, setDirty] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const targetDays = useMemo(() => daysForRepeat(days, day, repeat, weekdays), [days, day, repeat, weekdays]);

  const set = (patch: Partial<EventDraft>) => {
    setForm((f) => {
      const next = { ...f, ...patch };
      if (next.kind === "exercise" && !kcalTouched && ("minutes" in patch || "intensity" in patch)) {
        next.kcal = estimateBurn(next.minutes, next.intensity ?? "moderate");
      }
      return next;
    });
    setDirty(true);
  };

  const switchKind = (k: EventKind | "meal") => {
    setTab(k);
    if (k !== "meal") {
      setForm((f) => defaultsFor(k, f.time));
      setKcalTouched(false);
    }
  };

  const save = () => {
    const clean: EventDraft = { ...form, title: form.kind === "water" ? "Water" : form.title.trim() || KIND_LABELS[form.kind] };
    if (isNew) onCreate(clean, targetDays.length ? targetDays : [day]);
    else {
      onUpdate(clean, scope);
      setDirty(false);
    }
  };

  const style = KIND_STYLES[tab === "meal" ? "meal" : tab];
  const presets = form.kind === "exercise" ? EXERCISE_PRESETS : form.kind === "supplement" ? SUPPLEMENT_PRESETS : [];

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-2 border-b border-slate-100 px-4 py-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Day {day + 1}
            {dayObj ? ` · ${fmtDate(dayObj.date)}` : ""}
          </div>
          <div className="text-lg font-semibold text-slate-900">
            {isNew ? `Add at ${fmt12(form.time)}` : KIND_LABELS[form.kind]}
          </div>
        </div>
        <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100" aria-label="Close editor">
          <Icon name="x" className="h-5 w-5" />
        </button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {isNew && (
          <div role="group" aria-label="Type" className="grid grid-cols-5 gap-1.5">
            {(["meal", ...EVENT_KINDS] as const).map((k) => (
              <button
                key={k}
                type="button"
                aria-pressed={tab === k}
                onClick={() => switchKind(k)}
                className={`flex flex-col items-center gap-1 rounded-lg border px-1 py-2 text-[11px] font-medium transition ${
                  tab === k ? KIND_STYLES[k].block : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
                }`}
              >
                <Icon name={k} className="h-4 w-4" />
                {KIND_LABELS[k]}
              </button>
            ))}
          </div>
        )}

        {tab === "meal" && dayObj ? (
          <div className="space-y-2">
            <p className="text-sm text-slate-500">Meals are fixed slots in the chart. Move one to {fmt12(form.time)} on this day:</p>
            <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
              {MEAL_TIMES.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => onMoveMealHere(m, form.time)}
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-50"
                >
                  <span className="font-medium text-slate-700">{MEAL_TIME_LABELS[m]}</span>
                  <span className="text-xs text-slate-400">now {fmt12(mealTimeOn(dayObj, m, chartTimes))} → {fmt12(form.time)}</span>
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-400">To add dishes, click the meal on the calendar.</p>
          </div>
        ) : (
          <>
            {form.kind !== "water" && (
              <div>
                <input
                  className={`w-full rounded-lg border border-slate-200 px-3 py-2 text-base font-semibold focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100`}
                  value={form.title}
                  onChange={(e) => set({ title: e.target.value })}
                  placeholder={form.kind === "note" ? "Weigh-in, fasting" : form.kind === "supplement" ? "Vitamin D3" : "Brisk walk"}
                  list={presets.length ? "event-presets" : undefined}
                  aria-label="Name"
                  autoFocus={isNew}
                />
                {presets.length > 0 && (
                  <datalist id="event-presets">
                    {presets.map((p) => (
                      <option key={p} value={p} />
                    ))}
                  </datalist>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="label">Time</span>
                <input type="time" step={300} className="input py-1.5" value={form.time} onChange={(e) => e.target.value && set({ time: e.target.value })} />
              </label>
              {form.kind === "exercise" ? (
                <label className="block">
                  <span className="label">Duration</span>
                  <select className="input py-1.5" value={form.minutes} onChange={(e) => set({ minutes: Number(e.target.value) })}>
                    {[...new Set([...DURATIONS, form.minutes])].sort((a, b) => a - b).map((m) => (
                      <option key={m} value={m}>
                        {m} min
                      </option>
                    ))}
                  </select>
                </label>
              ) : form.kind === "water" ? (
                <label className="block">
                  <span className="label">Amount</span>
                  <select className="input py-1.5" value={form.ml} onChange={(e) => set({ ml: Number(e.target.value) })}>
                    {[...new Set([...WATER_ML, form.ml ?? 500])].sort((a, b) => a - b).map((m) => (
                      <option key={m} value={m}>
                        {m} ml
                      </option>
                    ))}
                  </select>
                </label>
              ) : form.kind === "supplement" ? (
                <label className="block">
                  <span className="label">Dose</span>
                  <input className="input py-1.5" value={form.dose ?? ""} placeholder="1000 IU" onChange={(e) => set({ dose: e.target.value })} />
                </label>
              ) : (
                <div />
              )}
            </div>

            {form.kind === "exercise" && (
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="label">Intensity</span>
                  <select className="input py-1.5" value={form.intensity} onChange={(e) => set({ intensity: e.target.value as Intensity })}>
                    <option value="light">Light</option>
                    <option value="moderate">Moderate</option>
                    <option value="vigorous">Vigorous</option>
                  </select>
                </label>
                <label className="block">
                  <span className="label">Burns about</span>
                  <div className="relative">
                    <input
                      type="number"
                      min={0}
                      className="input py-1.5 pr-10"
                      value={form.kcal ?? 0}
                      onChange={(e) => {
                        setKcalTouched(true);
                        set({ kcal: Math.max(0, Number(e.target.value) || 0) });
                      }}
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">kcal</span>
                  </div>
                </label>
                <p className="col-span-2 text-xs text-slate-400">Shown as net energy only; the food target doesn&apos;t change.</p>
              </div>
            )}

            {form.kind === "supplement" && (
              <label className="block">
                <span className="label">Take</span>
                <select className="input py-1.5" value={form.timing} onChange={(e) => set({ timing: e.target.value })}>
                  {SUPPLEMENT_TIMINGS.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </label>
            )}

            <label className="block">
              <span className="label">{form.kind === "note" ? "Note for the client" : "Instructions (optional)"}</span>
              <textarea
                className="input min-h-[64px] py-1.5"
                value={form.text ?? ""}
                placeholder={form.kind === "exercise" ? "Keep a pace where you can talk but not sing." : form.kind === "note" ? "Weigh yourself before breakfast and log it." : ""}
                onChange={(e) => set({ text: e.target.value })}
              />
            </label>

            {isNew ? (
              <div className="space-y-2 rounded-lg border border-slate-200 p-3">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <Icon name="repeat" className="h-4 w-4 text-slate-400" /> Repeats
                </div>
                <Seg
                  label="Repeats"
                  value={repeat}
                  onChange={setRepeat}
                  options={[
                    { value: "daily", label: "Every day" },
                    { value: "weekdays", label: "Mon–Fri" },
                    { value: "custom", label: "Pick days" },
                    { value: "once", label: "One time" },
                  ]}
                />
                {repeat === "custom" && (
                  <div className="flex flex-wrap gap-1">
                    {WEEKDAYS.map((w, i) => {
                      const on = weekdays.includes(i);
                      return (
                        <button
                          key={w}
                          type="button"
                          aria-pressed={on}
                          onClick={() => setWeekdays((cur) => (on ? cur.filter((x) => x !== i) : [...cur, i]))}
                          className={`w-11 rounded-md border py-1 text-xs font-medium ${on ? "border-brand-600 bg-brand-600 text-white" : "border-slate-200 bg-white text-slate-500"}`}
                        >
                          {w}
                        </button>
                      );
                    })}
                  </div>
                )}
                <p className="text-xs text-slate-400">
                  {repeat === "once"
                    ? `Only on day ${day + 1}.`
                    : `Adds to ${targetDays.length} of ${days.length} days in this chart.`}
                </p>
              </div>
            ) : (
              total > 1 && (
                <div className="space-y-2 rounded-lg border border-slate-200 p-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                    <Icon name="repeat" className="h-4 w-4 text-slate-400" /> Repeats on {total} days
                  </div>
                  <Seg
                    label="Apply changes to"
                    value={scope}
                    onChange={setScope}
                    options={[
                      { value: "all", label: `All ${total} days` },
                      { value: "one", label: "This day only" },
                    ]}
                  />
                </div>
              )
            )}
          </>
        )}
      </div>

      {tab !== "meal" && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-4 py-3">
          {isNew ? (
            <button className="btn-ghost px-3 py-1.5 text-sm" onClick={onClose}>
              Cancel
            </button>
          ) : confirmDelete ? (
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
              Delete
              {total > 1 && (
                <button className="btn-secondary px-2.5 py-1 text-xs text-red-600" onClick={() => onDelete("all")}>
                  All {total} days
                </button>
              )}
              <button className="btn-secondary px-2.5 py-1 text-xs text-red-600" onClick={() => onDelete("one")}>
                {total > 1 ? "This day" : "Yes, delete"}
              </button>
              <button className="btn-ghost px-2 py-1 text-xs" onClick={() => setConfirmDelete(false)}>
                Keep
              </button>
            </div>
          ) : (
            <button className="btn-ghost px-3 py-1.5 text-sm text-red-600" onClick={() => setConfirmDelete(true)}>
              Delete
            </button>
          )}
          {(isNew || dirty) && (
            <button className={`btn-primary px-4 py-1.5 text-sm`} onClick={save}>
              {isNew
                ? repeat === "once" || targetDays.length <= 1
                  ? `Add to day ${day + 1}`
                  : `Add to ${targetDays.length} days`
                : scope === "all" && total > 1
                  ? `Save for ${total} days`
                  : "Save"}
            </button>
          )}
          {!isNew && !dirty && !confirmDelete && <span className={`text-xs ${style.chip}`}>Drag on the calendar to move</span>}
        </div>
      )}
    </div>
  );
}
