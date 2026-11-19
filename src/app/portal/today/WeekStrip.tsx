"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import { cn } from "@/lib/utils";
import { fmtDate } from "@/lib/foodbank/client";
import type { ChartDay } from "@/lib/foodbank/engine";
import DayStatusRing from "./DayStatusRing";
import { dayProgress, dayStatus, planWeeks } from "./week";

/**
 * Monday-to-Sunday strip of the plan's days. A plan longer than a week swipes
 * sideways one week at a time (scroll snap). Dates outside the plan are faint
 * and can't be tapped.
 */
export default function WeekStrip({
  days,
  checks,
  todayStr,
  selectedDate,
  onSelect,
}: {
  days: ChartDay[];
  checks: Record<string, true>;
  todayStr: string | null;
  selectedDate: string | null;
  onSelect: (date: string) => void;
}) {
  const weeks = useMemo(() => planWeeks(days), [days]);
  const byDate = useMemo(() => new Map(days.map((d) => [d.date, d])), [days]);
  const scroller = useRef<HTMLDivElement>(null);
  const page = selectedDate ? weeks.findIndex((w) => w.includes(selectedDate)) : -1;

  // Show the week of the selected day (today or Day 1 on open). Swiping on its
  // own doesn't change the selection, so a data reload won't jump the strip.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el || page < 0) return;
    el.scrollTo({ left: page * el.clientWidth, behavior: "instant" });
  }, [page, weeks.length]);

  return (
    <div
      ref={scroller}
      className="flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {weeks.map((week, wi) => (
        <ul
          key={week[0]}
          aria-label={weeks.length > 1 ? `Week ${wi + 1} of ${weeks.length}` : "This week"}
          className="grid w-full shrink-0 snap-start snap-always grid-cols-7 px-3"
        >
          {week.map((date) => {
            const day = byDate.get(date);
            const num = Number(date.slice(8, 10));
            if (!day) {
              return (
                <li key={date} aria-hidden="true" className="flex flex-col items-center gap-0.5 py-0.5 opacity-30">
                  <span className="flex h-5 w-5 items-center justify-center text-[11px] leading-none text-[#616161]">{num}</span>
                  <DayStatusRing status={null} />
                </li>
              );
            }
            const selected = date === selectedDate;
            const { ticked, total } = dayProgress(day, checks);
            return (
              <li key={date} className="flex justify-center">
                <button
                  type="button"
                  onClick={() => onSelect(date)}
                  aria-pressed={selected}
                  aria-current={date === todayStr ? "date" : undefined}
                  aria-label={`${fmtDate(date, { weekday: "long", day: "numeric", month: "long" })}: ${ticked} of ${total} meals ticked`}
                  className="flex flex-col items-center gap-0.5 rounded-xl px-2 py-0.5 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span
                    className={cn(
                      "flex h-5 w-5 items-center justify-center rounded-full text-[11px] leading-none tabular-nums",
                      selected ? "bg-[#0a0a0a] font-medium text-white" : "text-[#616161]"
                    )}
                  >
                    {num}
                  </span>
                  <DayStatusRing status={dayStatus(day, checks, todayStr)} />
                </button>
              </li>
            );
          })}
        </ul>
      ))}
    </div>
  );
}
