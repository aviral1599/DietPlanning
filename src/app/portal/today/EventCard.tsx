import type { ChartEvent } from "@/lib/foodbank/engine";

/** Exercise, supplement, water or note on the timeline. No tick: events aren't logged yet. */
export default function EventCard({ event }: { event: ChartEvent }) {
  const title = event.kind === "water" ? (event.ml ? `Drink ${event.ml} ml water` : "Drink water") : event.title;
  const detail =
    event.kind === "exercise"
      ? [`${event.minutes} min`, event.intensity].filter(Boolean).join(" · ")
      : event.kind === "supplement"
        ? [event.dose, event.timing].filter(Boolean).join(" · ")
        : "";
  return (
    <div className="min-w-0 flex-1 rounded-[20px] bg-white px-3.5 py-3">
      <div className="flex min-h-6 items-center">
        <h3 className="text-[12px] leading-4">
          <span className="font-medium">{title}</span>
          {detail && <span className="ml-1.5 tracking-[-0.05em] text-[#a5a5a5]">{detail}</span>}
        </h3>
      </div>
      {event.text && <p className="mt-1 whitespace-pre-line text-[12px] leading-4 text-[#666]">{event.text}</p>}
    </div>
  );
}
