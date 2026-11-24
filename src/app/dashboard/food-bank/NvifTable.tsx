"use client";

import { useMemo, useState } from "react";
import { INGREDIENT_MAP } from "@/lib/foodbank/bank";
import { INGREDIENT_TO_NVIF, NVIF_FOODS } from "@/lib/nvif/data";
import { NVIF_EXCHANGE_LISTS } from "@/lib/nvif/reference";

// Which food-bank ingredients each book food is linked to.
const LINKED = new Map<number, { name: string; approx?: boolean }[]>();
for (const [key, link] of Object.entries(INGREDIENT_TO_NVIF)) {
  const ing = INGREDIENT_MAP[key];
  if (!ing) continue;
  const list = LINKED.get(link.sl) ?? [];
  list.push({ name: ing.name, approx: link.approx });
  LINKED.set(link.sl, list);
}

const fmt = (v: number | undefined, d = 1) => (v == null ? "—" : d === 0 ? String(Math.round(v)) : v.toFixed(d));

/** Read-only reference: "Nutritive Value of Indian Foods" (NIN 1989), common foods. */
export default function NvifTable() {
  const [q, setQ] = useState("");
  const [group, setGroup] = useState("");
  const [linkedOnly, setLinkedOnly] = useState(false);
  const groups = useMemo(() => Array.from(new Set(NVIF_FOODS.map((f) => f.group))), []);
  const rows = NVIF_FOODS.filter(
    (f) =>
      (!group || f.group === group) &&
      (!linkedOnly || LINKED.has(f.sl)) &&
      (!q || `${f.name} ${(LINKED.get(f.sl) ?? []).map((l) => l.name).join(" ")}`.toLowerCase().includes(q.toLowerCase()))
  );

  return (
    <div className="space-y-4">
      <div className="card space-y-1.5 p-4 text-xs leading-relaxed text-slate-600">
        <p className="text-sm font-semibold text-slate-800">
          Nutritive Value of Indian Foods — NIN-ICMR, 1989 edition (Gopalan, Rama Sastri, Balasubramanian; revised by
          Narasinga Rao, Deosthale, Pant)
        </p>
        <p>
          Reference only. Food bank nutrition is calculated from IFCT 2017, NIN&rsquo;s newer tables. When comparing,
          note that this book&rsquo;s <b>carbs are by difference</b> (they include most dietary fibre), its <b>fibre is
          crude fibre</b> (far lower than dietary fibre), and energy uses 4/4/9 kcal per gram. A dash means the book
          gives no value, not zero.
        </p>
      </div>

      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3">
          <input className="input max-w-xs" placeholder="Search food" value={q} onChange={(e) => setQ(e.target.value)} />
          <select className="input w-auto" value={group} onChange={(e) => setGroup(e.target.value)} aria-label="Food group">
            <option value="">All groups</option>
            {groups.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
          <label className="flex items-center gap-1.5 text-xs text-slate-600">
            <input type="checkbox" checked={linkedOnly} onChange={(e) => setLinkedOnly(e.target.checked)} />
            Only foods used in the food bank
          </label>
          <span className="ml-auto text-xs text-slate-400">{rows.length} of {NVIF_FOODS.length} foods · per 100 g edible portion</span>
        </div>
        <div className="max-h-[70vh] overflow-auto">
          <table className="w-full min-w-[1150px] text-xs">
            <thead className="sticky top-0 bg-slate-50">
              <tr>
                {["#", "Food (book)", "kcal", "Protein", "Fat", "Carbs*", "Crude fibre", "Ca mg", "Fe mg", "Na mg", "K mg", "Vit C mg", "Folate µg", "Food bank ingredient"].map((h) => (
                  <th key={h} className="px-3 py-2 text-left font-semibold text-slate-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((f) => (
                <tr key={f.sl} className="border-t border-slate-100">
                  <td className="px-3 py-1.5 tabular-nums text-slate-400">{f.sl}</td>
                  <td className="px-3 py-1.5">
                    <div className="font-medium text-slate-800">{f.name}</div>
                    <div className="text-[10px] text-slate-400">{f.group}</div>
                  </td>
                  <td className="px-3 py-1.5 tabular-nums">{fmt(f.kcal, 0)}</td>
                  <td className="px-3 py-1.5 tabular-nums">{fmt(f.protein)}</td>
                  <td className="px-3 py-1.5 tabular-nums">{fmt(f.fat)}</td>
                  <td className="px-3 py-1.5 tabular-nums">{fmt(f.carbs)}</td>
                  <td className="px-3 py-1.5 tabular-nums">{fmt(f.fibre)}</td>
                  <td className="px-3 py-1.5 tabular-nums">{fmt(f.calcium, 0)}</td>
                  <td className="px-3 py-1.5 tabular-nums">{fmt(f.iron)}</td>
                  <td className="px-3 py-1.5 tabular-nums">{fmt(f.sodium, 0)}</td>
                  <td className="px-3 py-1.5 tabular-nums">{fmt(f.potassium, 0)}</td>
                  <td className="px-3 py-1.5 tabular-nums">{fmt(f.vitc, 0)}</td>
                  <td className="px-3 py-1.5 tabular-nums">{fmt(f.folate_total, 0)}</td>
                  <td className="px-3 py-1.5 text-slate-500">
                    {(LINKED.get(f.sl) ?? []).map((l) => (
                      <span key={l.name} className="mr-1 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[10px]">
                        {l.name}{l.approx ? " (≈)" : ""}
                      </span>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="border-t border-slate-100 p-3 text-[11px] text-slate-400">
          * Carbohydrate by difference. (≈) = related form or variety, not an identical food.
        </p>
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-slate-100 p-3 text-sm font-semibold text-slate-800">
          The book&rsquo;s food exchange system (Table 2, 1 cup = 200 ml)
          <span className="ml-2 text-xs font-normal text-slate-400">
            For reference — plans use the clinic&rsquo;s 11-group exchange list.
          </span>
        </div>
        <table className="w-full text-xs">
          <thead className="bg-slate-50">
            <tr>
              {["Exchange list", "Serving", "Carbs g", "Protein g", "Fat g", "kcal"].map((h) => (
                <th key={h} className="px-3 py-2 text-left font-semibold text-slate-600">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {NVIF_EXCHANGE_LISTS.map((r) => (
              <tr key={r.list} className="border-t border-slate-100">
                <td className="px-3 py-1.5 font-medium text-slate-800">{r.list}</td>
                <td className="px-3 py-1.5">{r.serving}</td>
                <td className="px-3 py-1.5">{r.carbs}</td>
                <td className="px-3 py-1.5">{r.protein}</td>
                <td className="px-3 py-1.5">{r.fat}</td>
                <td className="px-3 py-1.5">{r.kcal}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
