"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { todayISO, useDishes } from "@/lib/foodbank/client";
import { dishFitsProfile, type ChartDay, type PlanItem } from "@/lib/foodbank/engine";
import type { PortalData } from "@/lib/foodbank/portal";
import type { MealTime } from "@/lib/types";
import RequestSheet from "./RequestSheet";
import DishSheet, { type DishSheetTarget } from "./shell/DishSheet";
import PlanPending from "./shell/PlanPending";
import TabBar, { type Tab } from "./shell/TabBar";
import UpdatedBanner from "./shell/UpdatedBanner";
import GroceryTab from "./tabs/GroceryTab";
import PlanTab from "./tabs/PlanTab";
import ProfileTab from "./tabs/ProfileTab";
import RequestsTab from "./tabs/RequestsTab";
import TodayTab from "./tabs/TodayTab";
import { checkKey, defaultDate } from "./today/week";

/**
 * The client portal shell: data, tab state, ticks, sheets and the bottom tab
 * bar. Each tab renders from ./tabs. Phone layout at every screen width.
 */
export default function PortalApp({ initial }: { initial: PortalData }) {
  const router = useRouter();
  const [data, setData] = useState<PortalData>(initial);
  const [tab, setTab] = useState<Tab>("today");
  // The Today tab's day, by date so it survives data reloads.
  const [selectedDate, setSelectedDate] = useState<string | null>(() => defaultDate(initial.chart?.days ?? [], null));
  const [week, setWeek] = useState(0);
  const [detail, setDetail] = useState<DishSheetTarget | null>(null);
  const [request, setRequest] = useState<{ item: PlanItem | null; meal: MealTime; day: ChartDay } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [updatedBanner, setUpdatedBanner] = useState(false);
  const [choices, setChoices] = useState<Record<string, number>>(initial.chart?.choices ?? {});
  const [checks, setChecks] = useState<Record<string, true>>(initial.chart?.checks ?? {});
  // Tick saves in flight, and when this device last changed each tick
  // ("check:day:meal" / "choice:day:uid"), so reloads don't undo fresh taps.
  const saving = useRef(new Set<string>());
  const touchedAt = useRef(new Map<string, number>());
  const chartId = useRef<string | null>(initial.chart?.id ?? null);

  const flash = useCallback((m: string) => {
    setToast(m);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }, []);

  // Saves one tick: optimistic, one save per tick at a time, reverted on error
  // (unless the portal has moved to another chart meanwhile).
  const saveTick = async (tag: string, apply: () => void, revert: () => void, url: string, body: Record<string, unknown>, error: string) => {
    if (!data.chart || saving.current.has(tag)) return;
    const id = data.chart.id;
    apply();
    saving.current.add(tag);
    touchedAt.current.set(tag, Date.now());
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chartId: id, ...body }),
    }).catch(() => null);
    saving.current.delete(tag);
    touchedAt.current.set(tag, Date.now());
    if ((!res || !res.ok) && chartId.current === id) {
      revert();
      flash(error);
    }
  };

  // The client ticks which option they had ("this OR that").
  const pickOption = (day: number, uid: string, choice: number) => {
    const key = `${day}:${uid}`;
    const prev = choices[key];
    const next = prev === choice ? null : choice; // tapping the ticked option clears it
    const set = (v: number | null | undefined) =>
      setChoices((c) => {
        const out = { ...c };
        if (v === null || v === undefined) delete out[key];
        else out[key] = v;
        return out;
      });
    saveTick(`choice:${key}`, () => set(next), () => set(prev), "/api/portal/choices", { day, uid, choice: next }, "Couldn't save your choice. Please try again.");
  };

  // The client ticks a whole meal as eaten.
  const toggleEaten = (day: number, meal: MealTime) => {
    const key = checkKey(day, meal);
    const was = !!checks[key];
    const set = (on: boolean) =>
      setChecks((c) => {
        const out = { ...c };
        if (on) out[key] = true;
        else delete out[key];
        return out;
      });
    saveTick(`check:${key}`, () => set(!was), () => set(was), "/api/portal/meal-checks", { day, meal, done: !was }, "Couldn't save your tick. Please try again.");
  };

  // Resolved in the browser only, so server (UTC) and client (local) renders match.
  const [todayStr, setTodayStr] = useState<string | null>(null);
  useEffect(() => setTodayStr(todayISO()), []);

  const { all, index } = useDishes(data.customDishes);
  const chart = data.chart;
  const profile = data.profile;
  const pool = useMemo(() => (profile ? all.filter((d) => dishFitsProfile(d, profile, chart?.prefs)) : all), [all, profile, chart?.prefs]);
  const pending = data.requests.filter((r) => r.status === "pending");
  const pendingUids = new Set(pending.map((r) => r.targetUid).filter(Boolean));

  // Open on today's day if it falls inside the plan (else Day 1). Only once:
  // later data reloads keep whatever day the client is looking at.
  const opened = useRef(false);
  useEffect(() => {
    if (!chart || !todayStr || opened.current) return;
    opened.current = true;
    setSelectedDate(defaultDate(chart.days, todayStr));
    const idx = chart.days.findIndex((d) => d.date === todayStr);
    if (idx >= 0) setWeek(Math.floor(idx / 7));
  }, [chart, todayStr]);

  // After a reload, fall back only if the selected day no longer exists.
  useEffect(() => {
    if (!chart) return;
    if (selectedDate && chart.days.some((d) => d.date === selectedDate)) return;
    setSelectedDate(defaultDate(chart.days, todayStr));
  }, [chart, selectedDate, todayStr]);

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
    const startedAt = Date.now();
    const res = await fetch("/api/portal/me");
    if (res.status === 401 || res.status === 403) {
      router.push("/portal/login");
      return;
    }
    if (!res.ok) return;
    const next: PortalData = await res.json();
    setData(next);
    // Take the server's ticks (they may come from another device), except ones
    // changed here after this load began. A different chart starts from its own.
    const switched = (next.chart?.id ?? null) !== chartId.current;
    chartId.current = next.chart?.id ?? null;
    const keepLocal = (tag: string) => !switched && (saving.current.has(tag) || (touchedAt.current.get(tag) ?? 0) >= startedAt);
    const merge = <T,>(server: Record<string, T>, local: Record<string, T>, prefix: string) => {
      const out = { ...server };
      for (const key of new Set([...Object.keys(server), ...Object.keys(local)])) {
        if (!keepLocal(prefix + key)) continue;
        if (key in local) out[key] = local[key];
        else delete out[key];
      }
      return out;
    };
    setChecks((local) => merge(next.chart?.checks ?? {}, local, "check:"));
    setChoices((local) => merge(next.chart?.choices ?? {}, local, "choice:"));
  }, [router]);

  // Keep in sync with the nutritionist: refresh when the tab regains focus.
  useEffect(() => {
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh]);

  const logout = async () => {
    await fetch("/api/portal/logout", { method: "POST" });
    router.push("/portal/login");
    router.refresh();
  };

  const cancelRequest = async (id: string) => {
    await fetch(`/api/portal/requests/${id}`, { method: "DELETE" });
    refresh();
  };

  const day = chart ? chart.days.find((d) => d.date === selectedDate) ?? chart.days[0] : undefined;

  return (
    <div className="portal-app min-h-dvh bg-[#f6f6f6] text-[#0a0a0a]">
      <div className="mx-auto min-h-dvh w-full max-w-[430px] pb-[calc(92px+env(safe-area-inset-bottom))] pt-[env(safe-area-inset-top)]">
        {updatedBanner && <UpdatedBanner coachName={data.coach.name} onDismiss={() => setUpdatedBanner(false)} />}

        {!chart && tab !== "profile" && <PlanPending coachName={data.coach.name} onViewProfile={() => setTab("profile")} />}

        {chart && tab === "today" && day && (
          <TodayTab
            chart={chart}
            day={day}
            todayStr={todayStr}
            index={index}
            checks={checks}
            choices={choices}
            pendingUids={pendingUids}
            coachName={data.coach.name}
            onSelectDate={setSelectedDate}
            onToggleEaten={(meal) => toggleEaten(day.day, meal)}
            onChoose={(uid, c) => pickOption(day.day, uid, c)}
            onOpenItem={(item, meal) => setDetail({ item, meal, day })}
            onAddToMeal={(meal) => setRequest({ item: null, meal, day })}
          />
        )}

        {chart && tab === "plan" && (
          <div className="space-y-4 px-4 py-4">
            <PlanTab
              chart={chart}
              index={index}
              week={week}
              onWeekChange={setWeek}
              todayStr={todayStr}
              choices={choices}
              pendingUids={pendingUids}
              onOpen={(item, meal, d) => setDetail({ item, meal, day: d })}
            />
          </div>
        )}

        {chart && tab === "grocery" && (
          <div className="px-4 py-4">
            <GroceryTab chart={chart} index={index} />
          </div>
        )}

        {tab === "profile" && (
          <div className="px-4 py-4">
            <ProfileTab data={data} onSignOut={logout} />
          </div>
        )}

        {tab === "requests" && (
          <div className="px-4 py-4">
            <RequestsTab requests={data.requests} index={index} coachName={data.coach.name} onCancel={cancelRequest} />
          </div>
        )}
      </div>

      <TabBar tab={tab} onChange={setTab} pending={pending.length} />

      <DishSheet
        target={detail}
        index={index}
        canRequest={!!chart}
        pendingUids={pendingUids}
        onClose={() => setDetail(null)}
        onRequest={(t) => {
          setRequest({ item: t.item, meal: t.meal, day: t.day });
          setDetail(null);
        }}
      />

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
        <div
          role="status"
          className="fixed bottom-[calc(84px+env(safe-area-inset-bottom))] left-1/2 z-50 w-max max-w-[calc(100vw-32px)] -translate-x-1/2 rounded-full bg-[#171717] px-4 py-2 text-center text-[13px] text-white shadow-lg"
        >
          {toast}
        </div>
      )}
    </div>
  );
}
