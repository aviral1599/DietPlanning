import { Check } from "lucide-react";
import { formatPortion } from "@/lib/foodbank/bank";
import type { PlanItem } from "@/lib/foodbank/engine";
import type { Dish } from "@/lib/foodbank/types";
import { cn } from "@/lib/utils";

/** "Have this OR that": the client ticks which option they had (saved as a MealChoice). */
export default function OptionPicker({
  item,
  index,
  chosen,
  onChoose,
}: {
  item: PlanItem;
  index: Record<string, Dish>;
  chosen: number | undefined;
  onChoose: (choice: number) => void;
}) {
  const options = [{ dishId: item.dishId, units: item.units }, ...(item.alts ?? [])];
  return (
    <div className="-mt-1 space-y-1.5 pb-3 pl-[38px] pr-3.5">
      <p className="text-[12px] leading-4 text-[#666]">Choose one, tick what you had:</p>
      <div role="radiogroup" aria-label={`Options for ${index[item.dishId]?.name ?? "this dish"}`} className="space-y-1.5">
        {options.map((opt, ci) => {
          const od = index[opt.dishId];
          if (!od) return null;
          const on = chosen === ci;
          return (
            <button
              key={ci}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChoose(ci)}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-xl border px-3 py-2 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                on ? "border-[#171717] bg-[#fafafa]" : "border-[#ececec] bg-white"
              )}
            >
              <span
                className={cn(
                  "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                  on ? "border-[#171717] bg-[#171717] text-white" : "border-[#d4d4d4]"
                )}
              >
                {on && <Check className="h-2.5 w-2.5" strokeWidth={3} aria-hidden="true" />}
              </span>
              <span className="min-w-0 flex-1 text-[12px] leading-4">
                {ci > 0 && <span className="mr-1 text-[#a5a5a5]">or</span>}
                {od.name}
              </span>
              <span className="shrink-0 text-[12px] leading-4 tabular-nums text-[#a5a5a5]">
                {formatPortion(od, opt.units)} · {Math.round(od.perUnit.kcal * opt.units)} kcal
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
