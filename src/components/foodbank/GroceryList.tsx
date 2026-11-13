"use client";

import { useEffect, useMemo, useState } from "react";
import { groceryList, type ChartDay } from "@/lib/foodbank/engine";
import type { Dish } from "@/lib/foodbank/types";
import { fmtDate } from "@/lib/foodbank/client";
import { Chip } from "./ui";

const ORDER = [
  "Vegetables",
  "Leafy Greens",
  "Fruits",
  "Grains & Millets",
  "Pulses & Legumes",
  "Dairy & Alternatives",
  "Eggs, Meat & Fish",
  "Nuts & Seeds",
  "Oils & Fats",
  "Sweeteners",
  "Spices & Condiments",
  "Beverages",
  "Others",
];

export default function GroceryList({
  days,
  index,
  storageKey,
}: {
  days: ChartDay[];
  index: Record<string, Dish>;
  /** when set, ticked items are remembered on this device */
  storageKey?: string;
}) {
  const weeks = Math.max(1, Math.ceil(days.length / 7));
  const [week, setWeek] = useState(0);
  const slice = days.slice(week * 7, week * 7 + 7);
  const list = useMemo(() => groceryList(slice, index), [slice, index]);
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  const key = storageKey ? `${storageKey}:w${week}` : null;
  useEffect(() => {
    if (!key) return;
    try {
      setChecked(JSON.parse(localStorage.getItem(key) ?? "{}"));
    } catch {
      setChecked({});
    }
  }, [key]);
  const toggle = (k: string) => {
    const next = { ...checked, [k]: !checked[k] };
    setChecked(next);
    if (key) {
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {
        /* storage unavailable — keep in memory */
      }
    }
  };

  const rank = (c: string) => (ORDER.includes(c) ? ORDER.indexOf(c) : ORDER.length);
  const cats = Object.keys(list).sort((a, b) => rank(a) - rank(b));
  const total = cats.reduce((s, c) => s + list[c].length, 0);
  const done = cats.reduce((s, c) => s + list[c].filter((l) => checked[l.key]).length, 0);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {Array.from({ length: weeks }, (_, i) => (
            <Chip key={i} tone="brand" active={week === i} onClick={() => setWeek(i)}>
              Week {i + 1}
            </Chip>
          ))}
        </div>
        {slice.length > 0 && (
          <div className="text-xs text-slate-500">
            {fmtDate(slice[0].date)} – {fmtDate(slice[slice.length - 1].date)} · {done}/{total} ticked
          </div>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {cats.map((c) => (
          <div key={c} className="break-inside-avoid">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-brand-700">{c}</div>
            <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
              {list[c].map((l) => (
                <li key={l.key}>
                  <label className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm">
                    <input type="checkbox" checked={!!checked[l.key]} onChange={() => toggle(l.key)} className="accent-brand-600" />
                    <span className={`flex-1 ${checked[l.key] ? "text-slate-400 line-through" : "text-slate-700"}`}>{l.name}</span>
                    <span className="tabular-nums text-xs text-slate-500">{l.display}</span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[11px] text-slate-400">
        Quantities are raw weights for one person, rounded. Salt and water are not listed.
      </p>
    </div>
  );
}
