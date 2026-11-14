"use client";

import { useMemo, useState } from "react";
import { DietMark } from "@/components/foodbank/ui";
import { formatPortion } from "@/lib/foodbank/bank";
import { dishFitsProfile, foodRelevance, type ChartPrefs, type ChartProfile, type FoodRelevance } from "@/lib/foodbank/engine";
import { CUISINE_SHORT, type Dish, type DishRole } from "@/lib/foodbank/types";
import { DIET_TYPE_LABELS } from "@/lib/types";

const GROUPS: { key: string; label: string; roles: DishRole[] }[] = [
  { key: "breakfast", label: "Breakfast", roles: ["breakfast"] },
  { key: "mains", label: "Roti, rice & one-pot", roles: ["staple", "one-pot"] },
  { key: "dal", label: "Dal & protein", roles: ["dal", "protein"] },
  { key: "sabzi", label: "Sabzi", roles: ["sabzi"] },
  { key: "sides", label: "Salad, curd & soup", roles: ["salad", "raita", "soup", "side"] },
  { key: "snacks", label: "Snacks", roles: ["snack", "sweet"] },
  { key: "fruit", label: "Fruit & nuts", roles: ["fruit", "nuts"] },
  { key: "drinks", label: "Drinks", roles: ["beverage"] },
];
const PAGE = 12;
const FOCUS_LABEL: Partial<Record<string, string>> = {
  "ir-friendly": "insulin-friendly foods",
  "low-gi": "low GI",
  millet: "millets",
  "high-fibre": "high fibre",
  "high-protein": "high protein",
  "iron-rich": "iron-rich foods",
  "calcium-rich": "calcium-rich foods",
};

type Row = { dish: Dish; rel: FoodRelevance; recommended: boolean; avoided: boolean };
type Show = "all" | "recommended" | "chosen";

export default function FoodSelector({
  dishes,
  profile,
  prefs,
  clientName,
  preferred,
  excluded,
  onChange,
}: {
  dishes: Dish[];
  profile: ChartProfile;
  /** Settings from step 1 (focus, avoid, cuisines, ingredient exclusions). */
  prefs: Partial<ChartPrefs>;
  clientName: string;
  preferred: string[];
  excluded: string[];
  onChange: (preferred: string[], excluded: string[]) => void;
}) {
  const [group, setGroup] = useState(GROUPS[0].key);
  const [search, setSearch] = useState("");
  const [show, setShow] = useState<Show>("all");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const pref = useMemo(() => new Set(preferred), [preferred]);
  const excl = useMemo(() => new Set(excluded), [excluded]);

  // Rank every dish this client can eat (diet, allergies, condition, disliked ingredients).
  const { byGroup, hiddenCount } = useMemo(() => {
    const ok = dishes.filter((d) => !d.hidden && dishFitsProfile(d, profile, { excludeIngredients: prefs.excludeIngredients }));
    const avoid = new Set(prefs.avoidTags ?? []);
    const byGroup: Record<string, Row[]> = {};
    for (const g of GROUPS) {
      const rows = ok
        .filter((d) => g.roles.includes(d.role))
        .map((d) => ({ dish: d, rel: foodRelevance(d, profile, prefs, (c) => DIET_TYPE_LABELS[c]), avoided: d.allTags.some((t) => avoid.has(t)) }))
        .sort((a, b) => b.rel.score - a.rel.score || a.dish.name.localeCompare(b.dish.name));
      // Recommended: the best-scoring quarter of the group with no cautions.
      const clean = rows.filter((r) => !r.rel.cautions.length && !r.avoided && r.rel.score > 0);
      const cut = Math.max(4, Math.ceil(rows.length / 4));
      const top = new Set(clean.slice(0, cut).map((r) => r.dish.id));
      byGroup[g.key] = rows.map((r) => ({ ...r, recommended: top.has(r.dish.id) }));
    }
    return { byGroup, hiddenCount: dishes.filter((d) => !d.hidden).length - ok.length };
  }, [dishes, profile, prefs]);

  const set = (id: string, state: "prefer" | "exclude" | "auto") => {
    const p = new Set(preferred);
    const e = new Set(excluded);
    p.delete(id);
    e.delete(id);
    if (state === "prefer") p.add(id);
    if (state === "exclude") e.add(id);
    onChange([...p], [...e]);
  };
  const bulk = (ids: string[], state: "prefer" | "exclude" | "auto") => {
    const p = new Set(preferred);
    const e = new Set(excluded);
    for (const id of ids) {
      p.delete(id);
      e.delete(id);
      if (state === "prefer") p.add(id);
      if (state === "exclude") e.add(id);
    }
    onChange([...p], [...e]);
  };

  const q = search.trim().toLowerCase();
  const rowsAll = byGroup[group] ?? [];
  const rows = rowsAll.filter((r) => {
    if (q && !r.dish.name.toLowerCase().includes(q) && !(r.dish.local ?? "").toLowerCase().includes(q)) return false;
    if (show === "recommended") return r.recommended;
    if (show === "chosen") return pref.has(r.dish.id) || excl.has(r.dish.id);
    return true;
  });
  const limit = expanded[group] || q || show !== "all" ? rows.length : PAGE;
  const left = rowsAll.filter((r) => !excl.has(r.dish.id) && (!r.avoided || pref.has(r.dish.id))).length;
  const conditions = [profile.dietType, ...(profile.conditions ?? [])].filter((c, i, a) => a.indexOf(c) === i);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-brand-100 bg-brand-50/60 p-4 text-sm text-slate-700">
        <div className="font-semibold text-slate-900">Suggested foods for {clientName}</div>
        <p className="mt-1 text-slate-600">
          Ranked for {conditions.map((c) => DIET_TYPE_LABELS[c]).join(" + ")}
          {prefs.focusTags?.length ? `, with a focus on ${prefs.focusTags.map((t) => FOCUS_LABEL[t] ?? t.replace(/-/g, " ")).join(", ")}` : ""}. Mark the foods the client likes with{" "}
          <b className="text-brand-700">★ Include</b> so the planner uses them often, and anything they won&apos;t eat with{" "}
          <b className="text-red-600">✕ Exclude</b>. Leave the rest to the planner.
        </p>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
          <span>
            <b className="text-brand-700">{preferred.length}</b> included
          </span>
          <span>
            <b className="text-red-600">{excluded.length}</b> excluded
          </span>
          {hiddenCount > 0 && <span>{hiddenCount} foods hidden because of diet, allergies, condition or disliked ingredients</span>}
        </div>
      </div>

      <div className="flex flex-col gap-4 md:flex-row">
        {/* groups */}
        <nav aria-label="Food groups" className="flex gap-1.5 overflow-x-auto md:w-52 md:shrink-0 md:flex-col md:overflow-visible">
          {GROUPS.map((g) => {
            const list = byGroup[g.key] ?? [];
            const inc = list.filter((r) => pref.has(r.dish.id)).length;
            const exc = list.filter((r) => excl.has(r.dish.id)).length;
            const active = g.key === group;
            return (
              <button
                key={g.key}
                onClick={() => setGroup(g.key)}
                aria-current={active}
                className={`flex shrink-0 items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm ${
                  active ? "bg-slate-900 text-white" : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
                }`}
              >
                <span className="whitespace-nowrap font-medium">{g.label}</span>
                <span className={`whitespace-nowrap text-[11px] tabular-nums ${active ? "text-slate-300" : "text-slate-400"}`}>
                  {inc > 0 && <span className={active ? "text-brand-300" : "text-brand-700"}>★{inc} </span>}
                  {exc > 0 && <span className={active ? "text-red-300" : "text-red-600"}>✕{exc} </span>}
                  {list.length}
                </span>
              </button>
            );
          })}
        </nav>

        {/* dishes */}
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <input className="input max-w-xs py-1.5" placeholder="Search this group" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search foods" />
            <div role="group" aria-label="Show" className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
              {(
                [
                  ["all", "All, best first"],
                  ["recommended", "Recommended"],
                  ["chosen", "My choices"],
                ] as const
              ).map(([v, l]) => (
                <button
                  key={v}
                  aria-pressed={show === v}
                  onClick={() => setShow(v)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium ${show === v ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
                >
                  {l}
                </button>
              ))}
            </div>
            <div className="ml-auto flex flex-wrap gap-1.5">
              <button className="btn-secondary px-2.5 py-1 text-xs" onClick={() => bulk(rowsAll.filter((r) => r.recommended).map((r) => r.dish.id), "prefer")}>
                ★ Include recommended
              </button>
              <button
                className="btn-secondary px-2.5 py-1 text-xs"
                onClick={() => bulk(rowsAll.filter((r) => r.rel.cautions.length && !pref.has(r.dish.id)).map((r) => r.dish.id), "exclude")}
              >
                ✕ Exclude flagged
              </button>
              <button className="btn-ghost px-2 py-1 text-xs" onClick={() => bulk(rowsAll.map((r) => r.dish.id), "auto")}>
                Clear group
              </button>
            </div>
          </div>

          {left < 4 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Only {left} {GROUPS.find((g) => g.key === group)?.label.toLowerCase()} option{left === 1 ? "" : "s"} left for the planner. Expect repeats, or include a few more.
            </div>
          )}

          <ul className="grid gap-2 lg:grid-cols-2">
            {rows.slice(0, limit).map(({ dish: d, rel, recommended, avoided }) => {
              const state = pref.has(d.id) ? "prefer" : excl.has(d.id) ? "exclude" : "auto";
              return (
                <li
                  key={d.id}
                  className={`flex items-start gap-2 rounded-lg border p-2.5 ${
                    state === "prefer" ? "border-brand-300 bg-brand-50/60" : state === "exclude" ? "border-red-200 bg-red-50/40" : "border-slate-200 bg-white"
                  }`}
                >
                  <span className="mt-1">
                    <DietMark dish={d} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className={`text-sm font-medium ${state === "exclude" ? "text-slate-400 line-through" : "text-slate-800"}`}>
                      {d.name}
                      {recommended && state === "auto" && <span className="ml-1.5 rounded bg-brand-100 px-1.5 py-px text-[10px] font-semibold text-brand-800">Recommended</span>}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {Math.round(d.perUnit.kcal * d.unit.default)} kcal · {formatPortion(d, d.unit.default)} · {CUISINE_SHORT[d.cuisine]}
                    </div>
                    {(rel.reasons.length > 0 || rel.cautions.length > 0 || avoided) && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {rel.reasons.map((r) => (
                          <span key={r} className="rounded-full bg-emerald-50 px-1.5 py-px text-[10px] font-medium text-emerald-700 ring-1 ring-emerald-100">
                            {r}
                          </span>
                        ))}
                        {rel.cautions.map((c) => (
                          <span key={c} className="rounded-full bg-amber-50 px-1.5 py-px text-[10px] font-medium text-amber-800 ring-1 ring-amber-200">
                            {c}
                          </span>
                        ))}
                        {avoided && state !== "prefer" && (
                          <span className="rounded-full bg-slate-100 px-1.5 py-px text-[10px] font-medium text-slate-500">Skipped by Avoid settings</span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      aria-pressed={state === "prefer"}
                      onClick={() => set(d.id, state === "prefer" ? "auto" : "prefer")}
                      title="Include — the planner uses it often"
                      className={`rounded-md border px-2 py-1 text-xs font-semibold ${
                        state === "prefer" ? "border-brand-600 bg-brand-600 text-white" : "border-slate-200 bg-white text-slate-500 hover:border-brand-400 hover:text-brand-700"
                      }`}
                    >
                      ★<span className="sr-only"> Include {d.name}</span>
                    </button>
                    <button
                      aria-pressed={state === "exclude"}
                      onClick={() => set(d.id, state === "exclude" ? "auto" : "exclude")}
                      title="Exclude — never used in this chart"
                      className={`rounded-md border px-2 py-1 text-xs font-semibold ${
                        state === "exclude" ? "border-red-500 bg-red-500 text-white" : "border-slate-200 bg-white text-slate-500 hover:border-red-300 hover:text-red-600"
                      }`}
                    >
                      ✕<span className="sr-only"> Exclude {d.name}</span>
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
          {rows.length === 0 && <div className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">No foods match.</div>}
          {rows.length > limit && (
            <button className="btn-ghost w-full text-xs" onClick={() => setExpanded({ ...expanded, [group]: true })}>
              Show all {rows.length} {GROUPS.find((g) => g.key === group)?.label.toLowerCase()}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
