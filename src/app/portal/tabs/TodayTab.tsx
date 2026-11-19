"use client";

import { fmtDate } from "@/lib/foodbank/client";
import { dayTotals, type ChartDay, type PlanItem } from "@/lib/foodbank/engine";
import { dayActivity, dayTimeline } from "@/lib/foodbank/schedule";
import type { ChartDTO } from "@/lib/foodbank/server";
import type { Dish } from "@/lib/foodbank/types";
import type { MealTime } from "@/lib/types";
import CalorieCard from "../today/CalorieCard";
import CoachNote from "../today/CoachNote";
import EventCard from "../today/EventCard";
import LogDayCard from "../today/LogDayCard";
import MealCard from "../today/MealCard";
import TimelineRow from "../today/TimelineRow";
import WeekStrip from "../today/WeekStrip";
import { checkKey } from "../today/week";

/** Today: week strip, the day's planned totals, "Log your day", then meals and events in time order. */
export default function TodayTab({
  chart,
  day,
  todayStr,
  index,
  checks,
  choices,
  pendingUids,
  coachName,
  onSelectDate,
  onToggleEaten,
  onChoose,
  onOpenItem,
  onAddToMeal,
}: {
  chart: ChartDTO;
  day: ChartDay;
  todayStr: string | null;
  index: Record<string, Dish>;
  checks: Record<string, true>;
  choices: Record<string, number>;
  pendingUids: Set<string | null>;
  coachName: string;
  onSelectDate: (date: string) => void;
  onToggleEaten: (meal: MealTime) => void;
  onChoose: (uid: string, choice: number) => void;
  onOpenItem: (item: PlanItem, meal: MealTime) => void;
  onAddToMeal: (meal: MealTime) => void;
}) {
  return (
    <div className="tracking-[-0.04em]">
      <h1 className="sr-only">
        {day.date === todayStr ? "Today, " : ""}
        {fmtDate(day.date, { weekday: "long", day: "numeric", month: "long" })}
      </h1>
      <div className="pt-4">
        <WeekStrip days={chart.days} checks={checks} todayStr={todayStr} selectedDate={day.date} onSelect={onSelectDate} />
      </div>

      <CalorieCard className="mt-[30px]" totals={dayTotals(day, index)} targets={chart.targets} activity={dayActivity(day)} />

      <LogDayCard className="mt-8" />

      <ol className="mt-8 space-y-6 px-4">
        {dayTimeline(day, chart.mealTimes).map((entry) =>
          entry.type === "event" ? (
            <TimelineRow key={entry.event.uid} kind={entry.event.kind} time={entry.time}>
              <EventCard event={entry.event} />
            </TimelineRow>
          ) : (
            <TimelineRow key={entry.meal} kind="meal" time={entry.time}>
              <MealCard
                meal={entry.meal}
                items={day.meals[entry.meal]}
                index={index}
                pendingUids={pendingUids}
                eaten={!!checks[checkKey(day.day, entry.meal)]}
                onToggleEaten={() => onToggleEaten(entry.meal)}
                choiceOf={(uid) => choices[`${day.day}:${uid}`]}
                onChoose={onChoose}
                onOpen={(item) => onOpenItem(item, entry.meal)}
                onAdd={() => onAddToMeal(entry.meal)}
              />
            </TimelineRow>
          )
        )}
      </ol>

      {chart.notes && <CoachNote className="mt-8" coachName={coachName} notes={chart.notes} />}
    </div>
  );
}
