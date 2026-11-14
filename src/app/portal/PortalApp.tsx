"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { interpretLabs } from "@/lib/glycemic";
import { conditionsLabel, subjectConditions } from "@/lib/conditions";
import { useRouter } from "next/navigation";
import DishDetail from "@/components/foodbank/DishDetail";
import GroceryList from "@/components/foodbank/GroceryList";
import { Chip, DietMark, Meter, Modal } from "@/components/foodbank/ui";
import { formatPortion, scaled } from "@/lib/foodbank/bank";
import { fmtDate, todayISO, useDishes } from "@/lib/foodbank/client";
import { dayTotals, dishFitsProfile, mealTotals, type ChartDay, type PlanItem } from "@/lib/foodbank/engine";
import type { PortalData } from "@/lib/foodbank/portal";
import { DIET_TYPE_LABELS, MEAL_TIMES, MEAL_TIME_LABELS, type MealTime } from "@/lib/types";
import { describeRequest } from "@/lib/foodbank/changes";
import RequestSheet from "./RequestSheet";

type Tab = "today" | "plan" | "grocery" | "profile" | "requests";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "today", label: "Today", icon: "☀️" },
  { id: "plan", label: "My Plan", icon: "📅" },
  { id: "grocery", label: "Grocery", icon: "🛒" },
  { id: "profile", label: "Profile", icon: "👤" },
  { id: "requests", label: "Requests", icon: "💬" },
];

export default function PortalApp({ initial }: { initial: PortalData }) {
  const router = useRouter();
  const [data, setData] = useState<PortalData>(initial);
  const [tab, setTab] = useState<Tab>("today");
  const [dayIdx, setDayIdx] = useState(0);
  const [week, setWeek] = useState(0);
  const [detail, setDetail] = useState<{ item: PlanItem; meal: MealTime; day: ChartDay } | null>(null);
  const [request, setRequest] = useState<{ item: PlanItem | null; meal: MealTime; day: ChartDay } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [updatedBanner, setUpdatedBanner] = useState(false);
  // Resolved in the browser only, so server (UTC) and client (local) renders match.
  const [todayStr, setTodayStr] = useState<string | null>(null);
  useEffect(() => setTodayStr(todayISO()), []);

  const { all, index } = useDishes(data.customDishes);
  const chart = data.chart;
  const profile = data.profile;
  const pool = useMemo(() => (profile ? all.filter((d) => dishFitsProfile(d, profile, chart?.prefs)) : all), [all, profile, chart?.prefs]);
  const pending = data.requests.filter((r) => r.status === "pending");
  const pendingUids = new Set(pending.map((r) => r.targetUid).filter(Boolean));

  // Open on today's day if it falls inside the plan.
  useEffect(() => {
    if (!chart) return;
    const t = todayISO();
    const idx = chart.days.findIndex((d) => d.date === t);
    if (idx >= 0) {
      setDayIdx(idx);
      setWeek(Math.floor(idx / 7));
    }
  }, [chart]);

  // "Your plan was updated" banner, based on the last version this device saw.
  useEffect(() => {
    if (!chart) return;
    const key = `nutriplan:seen:${chart.id}`;
    try {
      const seen = Number(localStorage.getItem(key) ?? 0);
      if (seen && chart.version > seen) setUpdatedBanner(true);
      localStorage.setItem(key, String(chart.version));
    } catch {
      /* storage unavailable */
    }
  }, [chart]);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/portal/me");
    if (res.status === 401 || res.status === 403) {
      router.push("/portal/login");
      return;
    }
    if (res.ok) setData(await res.json());
  }, [router]);

  // Keep in sync with the nutritionist: refresh when the tab regains focus.
  useEffect(() => {
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh]);

  const flash = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 3000);
  };

  const logout = async () => {
    await fetch("/api/portal/logout", { method: "POST" });
    router.push("/portal/login");
    router.refresh();
  };

  const cancelRequest = async (id: string) => {
    await fetch(`/api/portal/requests/${id}`, { method: "DELETE" });
    refresh();
  };

  const firstName = data.client.name.split(" ")[0];
  const today = chart?.days[dayIdx];

  return (
    <div className="min-h-screen bg-slate-50 pb-24 md:pb-8">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-widest text-brand-600">{data.coach.clinicName}</div>
            <div className="text-base font-bold text-slate-900">Hi, {firstName} 👋</div>
          </div>
          <button onClick={logout} className="btn-ghost px-3 py-1.5 text-xs">Sign out</button>
        </div>
        <nav className="mx-auto hidden max-w-4xl gap-1 px-4 pb-2 md:flex">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} className={`rounded-lg px-3 py-1.5 text-sm font-medium ${tab === t.id ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100"}`}>
              {t.label}
              {t.id === "requests" && pending.length > 0 && <span className="ml-1.5 rounded-full bg-amber-500 px-1.5 text-[10px] font-bold text-white">{pending.length}</span>}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-4xl space-y-4 px-4 py-4">
        {updatedBanner && (
          <div className="flex items-center justify-between rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-800">
            <span>✨ {data.coach.name} has updated your plan.</span>
            <button className="text-xs underline" onClick={() => setUpdatedBanner(false)}>Got it</button>
          </div>
        )}

        {!chart && tab !== "profile" && (
          <div className="card p-8 text-center">
            <div className="text-4xl">🥗</div>
            <h2 className="mt-2 text-lg font-semibold text-slate-900">Your plan is being prepared</h2>
            <p className="mt-1 text-sm text-slate-500">
              {data.coach.name} is putting together your personalised diet chart. You’ll see it here as soon as it’s shared.
            </p>
            <button className="btn-secondary mt-4" onClick={() => setTab("profile")}>View my profile</button>
          </div>
        )}

        {/* TODAY */}
        {chart && tab === "today" && today && (
          <>
            <div className="flex items-center justify-between">
              <button className="btn-ghost h-9 w-9 p-0" onClick={() => setDayIdx(Math.max(0, dayIdx - 1))} disabled={dayIdx === 0} aria-label="Previous day">‹</button>
              <div className="text-center">
                <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  {today.date === todayStr ? "Today" : `Day ${today.day + 1} of ${chart.days.length}`}
                </div>
                <div className="text-lg font-bold text-slate-900">{fmtDate(today.date, { weekday: "long", day: "numeric", month: "long" })}</div>
              </div>
              <button className="btn-ghost h-9 w-9 p-0" onClick={() => setDayIdx(Math.min(chart.days.length - 1, dayIdx + 1))} disabled={dayIdx >= chart.days.length - 1} aria-label="Next day">›</button>
            </div>

            <DayTotalsCard day={today} index={index} targets={chart.targets} />

            <div className="space-y-3">
              {MEAL_TIMES.filter((m) => today.meals[m]?.length).map((m) => (
                <MealCard
                  key={m}
                  meal={m}
                  time={chart.mealTimes[m]}
                  items={today.meals[m]}
                  index={index}
                  pendingUids={pendingUids}
                  onOpen={(item) => setDetail({ item, meal: m, day: today })}
                  onAdd={() => setRequest({ item: null, meal: m, day: today })}
                />
              ))}
            </div>

            {chart.notes && (
              <div className="card p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-brand-700">Note from {data.coach.name}</div>
                <p className="mt-1 whitespace-pre-line text-sm text-slate-700">{chart.notes}</p>
              </div>
            )}
          </>
        )}

        {/* FULL PLAN */}
        {chart && tab === "plan" && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-bold text-slate-900">{chart.title}</h2>
                <div className="text-xs text-slate-500">
                  {fmtDate(chart.startDate, { day: "numeric", month: "short" })} – {fmtDate(chart.days[chart.days.length - 1].date, { day: "numeric", month: "short", year: "numeric" })}
                </div>
              </div>
              <a href="/api/portal/chart/pdf" target="_blank" rel="noopener noreferrer" className="btn-accent px-3 py-1.5 text-xs">⬇ Download PDF</a>
            </div>
            {chart.days.length > 7 && (
              <div className="flex flex-wrap gap-1.5">
                {Array.from({ length: Math.ceil(chart.days.length / 7) }, (_, i) => (
                  <Chip key={i} tone="brand" active={week === i} onClick={() => setWeek(i)}>Week {i + 1}</Chip>
                ))}
              </div>
            )}
            <div className="space-y-3">
              {chart.days.slice(week * 7, week * 7 + 7).map((d) => {
                const t = dayTotals(d, index);
                return (
                  <details key={d.day} className="card group overflow-hidden" open={d.date === todayStr}>
                    <summary className="flex cursor-pointer items-center justify-between px-4 py-3">
                      <div>
                        <div className="font-semibold text-slate-900">{fmtDate(d.date, { weekday: "long", day: "numeric", month: "short" })}</div>
                        <div className="text-xs text-slate-500">{Math.round(t.kcal)} kcal · {Math.round(t.protein)} g protein</div>
                      </div>
                      <span className="text-slate-400 transition group-open:rotate-90">›</span>
                    </summary>
                    <div className="divide-y divide-slate-100 border-t border-slate-100">
                      {MEAL_TIMES.filter((m) => d.meals[m]?.length).map((m) => (
                        <div key={m} className="flex gap-3 px-4 py-2.5">
                          <div className="w-24 shrink-0">
                            <div className="text-xs font-semibold text-slate-700">{MEAL_TIME_LABELS[m]}</div>
                            <div className="text-[11px] text-slate-400">{chart.mealTimes[m]}</div>
                          </div>
                          <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
                            {d.meals[m].map((it) => {
                              const dish = index[it.dishId];
                              if (!dish) return null;
                              return (
                                <button key={it.uid} onClick={() => setDetail({ item: it, meal: m, day: d })} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700 hover:border-brand-400">
                                  <DietMark dish={dish} size={9} />
                                  {dish.name}
                                  <span className="text-slate-400">· {formatPortion(dish, it.units)}</span>
                                  {pendingUids.has(it.uid) && <span className="h-1.5 w-1.5 rounded-full bg-amber-500" title="Change requested" />}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </details>
                );
              })}
            </div>
          </>
        )}

        {/* GROCERY */}
        {chart && tab === "grocery" && (
          <div className="card p-4">
            <h2 className="mb-3 text-lg font-bold text-slate-900">Grocery list</h2>
            <GroceryList days={chart.days} index={index} storageKey={`nutriplan:grocery:${chart.id}:${chart.version}`} />
          </div>
        )}

        {/* PROFILE */}
        {tab === "profile" && <ProfileView data={data} />}

        {/* REQUESTS */}
        {tab === "requests" && (
          <div className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900">My requests</h2>
            {data.requests.length === 0 && (
              <div className="card p-6 text-center text-sm text-slate-500">
                Want something different? Tap any dish in your plan and choose <b>Request a change</b>.
              </div>
            )}
            {data.requests.map((r) => (
              <div key={r.id} className="card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs text-slate-500">
                      Day {r.day + 1} · {MEAL_TIME_LABELS[r.meal as MealTime]} · {new Date(r.createdAt).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}
                    </div>
                    <div className="mt-0.5 text-sm font-medium text-slate-800">{describeRequest(r, index)}</div>
                    {r.note && <div className="mt-1 text-xs text-slate-500">Your note: “{r.note}”</div>}
                    {r.coachNote && <div className="mt-1 text-xs text-brand-700">{data.coach.name}: “{r.coachNote}”</div>}
                  </div>
                  <span className={`badge shrink-0 ${r.status === "approved" ? "bg-brand-100 text-brand-700" : r.status === "rejected" ? "bg-red-100 text-red-700" : r.status === "pending" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500"}`}>
                    {r.status === "rejected" ? "declined" : r.status}
                  </span>
                </div>
                {r.status === "pending" && (
                  <button className="mt-2 text-xs text-slate-500 underline" onClick={() => cancelRequest(r.id)}>Withdraw request</button>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`relative flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${tab === t.id ? "text-brand-700" : "text-slate-500"}`}>
            <span className="text-lg leading-none">{t.icon}</span>
            {t.label}
            {t.id === "requests" && pending.length > 0 && (
              <span className="absolute right-[22%] top-1 rounded-full bg-amber-500 px-1 text-[9px] font-bold text-white">{pending.length}</span>
            )}
          </button>
        ))}
      </nav>

      {/* Dish detail sheet */}
      {detail && index[detail.item.dishId] && (
        <Modal
          open
          onClose={() => setDetail(null)}
          title={index[detail.item.dishId].name}
          footer={
            chart && (
              <button
                className="btn-primary w-full py-2.5"
                onClick={() => {
                  setRequest({ item: detail.item, meal: detail.meal, day: detail.day });
                  setDetail(null);
                }}
                disabled={pendingUids.has(detail.item.uid)}
              >
                {pendingUids.has(detail.item.uid) ? "Change already requested" : "Request a change"}
              </button>
            )
          }
        >
          <DishDetail dish={index[detail.item.dishId]} units={detail.item.units} showSources={false} />
        </Modal>
      )}

      {request && chart && profile && (
        <RequestSheet
          chartId={chart.id}
          days={chart.days}
          day={request.day}
          meal={request.meal}
          item={request.item}
          index={index}
          pool={pool}
          profile={profile}
          prefs={chart.prefs}
          onClose={() => setRequest(null)}
          onSubmitted={() => {
            setRequest(null);
            flash("Request sent to your nutritionist");
            refresh();
          }}
        />
      )}

      {toast && (
        <div className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full bg-slate-900 px-4 py-2 text-sm text-white shadow-lg md:bottom-6">{toast}</div>
      )}
    </div>
  );
}

function DayTotalsCard({ day, index, targets }: { day: ChartDay; index: Record<string, import("@/lib/foodbank/types").Dish>; targets: { kcal: number; protein: number; carbs: number; fat: number } }) {
  const t = dayTotals(day, index);
  return (
    <div className="card grid grid-cols-2 gap-3 p-4 sm:grid-cols-4">
      <Meter label="Energy" value={t.kcal} target={targets.kcal} unit=" kcal" />
      <Meter label="Protein" value={t.protein} target={targets.protein} unit=" g" mode="min" />
      <Meter label="Carbs" value={t.carbs} target={targets.carbs} unit=" g" mode="max" />
      <Meter label="Fat" value={t.fat} target={targets.fat} unit=" g" />
    </div>
  );
}

function MealCard({
  meal,
  time,
  items,
  index,
  pendingUids,
  onOpen,
  onAdd,
}: {
  meal: MealTime;
  time?: string;
  items: PlanItem[];
  index: Record<string, import("@/lib/foodbank/types").Dish>;
  pendingUids: Set<string | null>;
  onOpen: (item: PlanItem) => void;
  onAdd: () => void;
}) {
  const k = mealTotals(items, index).kcal;
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/60 px-4 py-2">
        <div className="flex items-baseline gap-2">
          <span className="font-semibold text-slate-800">{MEAL_TIME_LABELS[meal]}</span>
          {time && <span className="text-xs text-slate-400">{time}</span>}
        </div>
        <span className="text-xs tabular-nums text-slate-400">{Math.round(k)} kcal</span>
      </div>
      <ul className="divide-y divide-slate-100">
        {items.map((it) => {
          const d = index[it.dishId];
          if (!d) return null;
          const n = scaled(d.perUnit, it.units);
          return (
            <li key={it.uid}>
              <button onClick={() => onOpen(it)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50">
                <DietMark dish={d} />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium text-slate-800">{d.name}</span>
                  <span className="block text-xs text-slate-500">
                    {formatPortion(d, it.units)}
                    {d.unit.note ? (it.units === 1 ? ` · ${d.unit.note}` : ` · ${d.unit.note} each`) : ""}
                  </span>
                </span>
                {pendingUids.has(it.uid) ? (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">change requested</span>
                ) : (
                  <span className="text-xs tabular-nums text-slate-400">{Math.round(n.kcal)} kcal</span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
      <button onClick={onAdd} className="w-full border-t border-slate-100 py-2 text-xs font-medium text-slate-400 hover:bg-slate-50 hover:text-brand-700">
        + Ask to add something
      </button>
    </div>
  );
}

function ProfileView({ data }: { data: PortalData }) {
  const s = data.subject;
  const r = data.results;
  const a = data.analysis;
  const labFindings = s ? interpretLabs(s.labs ?? {}).findings : [];
  if (!s || !r) {
    return <div className="card p-6 text-center text-sm text-slate-500">Your assessment will appear here once your nutritionist completes it.</div>;
  }
  const stat = (label: string, value: string, sub?: string) => (
    <div className="rounded-xl bg-slate-50 p-3">
      <div className="text-[11px] uppercase tracking-wide text-slate-400">{label}</div>
      <div className="text-lg font-bold text-slate-900">{value}</div>
      {sub && <div className="text-xs text-slate-500">{sub}</div>}
    </div>
  );
  const list = (title: string, items: string[] | undefined, tone: string) =>
    items && items.length > 0 ? (
      <div className="card p-4">
        <div className={`mb-2 text-sm font-semibold ${tone}`}>{title}</div>
        <ul className="space-y-1.5 text-sm text-slate-700">
          {items.map((x, i) => (
            <li key={i} className="flex gap-2"><span className="text-slate-300">•</span>{x}</li>
          ))}
        </ul>
      </div>
    ) : null;

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <h2 className="text-lg font-bold text-slate-900">{s.clientName}</h2>
        <p className="text-sm text-slate-500">
          {s.age} years · {s.sex} · {s.heightCm} cm · {s.weightKg} kg · {conditionsLabel(subjectConditions(s), s.glycemicStatus)} · <span className="capitalize">{s.dietPreference}</span>
        </p>
        {labFindings.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {labFindings.map((f) => (
              <span
                key={f.key}
                className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${
                  f.tone === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : f.tone === "warn" ? "border-amber-200 bg-amber-50 text-amber-800" : "border-red-200 bg-red-50 text-red-700"
                }`}
              >
                {f.label} {f.value} · {f.band}
              </span>
            ))}
          </div>
        )}
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stat("BMI", r.bmi.toFixed(1), r.bmiCategory)}
          {stat("Ideal weight", `${r.ibw} kg`, r.weightStatusLabel)}
          {stat("Daily energy", `${Math.round(r.energy)} kcal`)}
          {stat("Daily protein", `${Math.round(r.protein.grams)} g`)}
        </div>
        {data.reportDate && <p className="mt-3 text-[11px] text-slate-400">Assessment updated {new Date(data.reportDate).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}</p>}
      </div>
      {list("Your goals", a?.dietaryGoals, "text-brand-700")}
      <div className="grid gap-4 sm:grid-cols-2">
        {list("Do’s ✓", a?.dos, "text-brand-700")}
        {list("Don’ts ✗", a?.donts, "text-red-600")}
        {list("Foods to include", a?.foodsToInclude, "text-brand-700")}
        {list("Foods to limit / avoid", a?.foodsToExclude, "text-amber-700")}
      </div>
    </div>
  );
}
