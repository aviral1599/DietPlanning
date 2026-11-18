"use client";

import { Ellipsis, Plus } from "lucide-react";
import { formatPortion, scaled } from "@/lib/foodbank/bank";
import { mealTotals, type PlanItem } from "@/lib/foodbank/engine";
import type { Dish } from "@/lib/foodbank/types";
import { MEAL_TIME_LABELS, type MealTime } from "@/lib/types";
import { Badge } from "../ui/badge";
import { Checkbox } from "../ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../ui/dropdown-menu";
import { Separator } from "../ui/separator";
import OptionPicker from "./OptionPicker";
import PortalDietMark from "./PortalDietMark";

export default function MealCard({
  meal,
  items,
  index,
  pendingUids,
  eaten,
  onToggleEaten,
  choiceOf,
  onChoose,
  onOpen,
  onAdd,
}: {
  meal: MealTime;
  items: PlanItem[];
  index: Record<string, Dish>;
  pendingUids: Set<string | null>;
  /** The client ticked this whole meal as eaten. */
  eaten: boolean;
  onToggleEaten: () => void;
  choiceOf: (uid: string) => number | undefined;
  onChoose: (uid: string, choice: number) => void;
  onOpen: (item: PlanItem) => void;
  onAdd: () => void;
}) {
  const label = MEAL_TIME_LABELS[meal];
  const kcal = Math.round(mealTotals(items, index).kcal);
  return (
    <div className="min-w-0 flex-1 overflow-hidden rounded-[20px] bg-white">
      <div className="flex h-12 items-center gap-2 pl-3.5 pr-3">
        <h3 className="flex min-w-0 flex-1 items-baseline gap-1.5 text-[12px] leading-4">
          <span className="truncate font-medium">{label}</span>
          <span className="shrink-0 tabular-nums tracking-[-0.05em] text-[#a5a5a5]">{kcal} kcal</span>
        </h3>
        <div className="flex shrink-0 items-center gap-3">
          <Checkbox
            checked={eaten}
            onCheckedChange={onToggleEaten}
            aria-label={`${label} eaten`}
            className="h-6 w-6 rounded-md border-[#d4d4d4] shadow-none data-[state=checked]:border-[#171717] data-[state=checked]:bg-[#171717] data-[state=checked]:text-white [&_svg]:h-3.5 [&_svg]:w-3.5"
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label={`More options for ${label}`}
                className="flex h-6 w-6 items-center justify-center rounded-md bg-[#f0f0f0] text-[#0a0a0a] outline-none transition-colors hover:bg-[#e8e8e8] focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:bg-[#e8e8e8]"
              >
                <Ellipsis className="h-[13px] w-[13px]" aria-hidden="true" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[11rem] rounded-xl p-1">
              <DropdownMenuItem onSelect={onAdd} className="rounded-lg text-[13px]">
                <Plus aria-hidden="true" />
                Ask to add something
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <Separator className="bg-[#f5f5f5]" />
      <ul className="pb-2.5 pt-1">
        {items.map((it) => {
          const d = index[it.dishId];
          if (!d) return null;
          const pending = pendingUids.has(it.uid);
          return (
            <li key={it.uid}>
              <button
                type="button"
                onClick={() => onOpen(it)}
                className="flex w-full items-start gap-2.5 px-3.5 py-3 text-left outline-none transition-colors focus-visible:bg-[#fafafa] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring active:bg-[#fafafa]"
              >
                <PortalDietMark dish={d} className="mt-[3px]" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-medium leading-5 tracking-[-0.05em]">{d.name}</span>
                  <span className="mt-1 block text-[12px] leading-4 text-[#666]">
                    {formatPortion(d, it.units)}
                    {d.unit.note ? (it.units === 1 ? ` · ${d.unit.note}` : ` · ${d.unit.note} each`) : ""}
                  </span>
                </span>
                {pending ? (
                  <Badge className="mt-0.5 shrink-0 rounded-full border-transparent bg-[#fef3c7] px-2 py-0.5 text-[11px] font-medium leading-4 text-[#92400e] shadow-none hover:bg-[#fef3c7]">
                    change requested
                  </Badge>
                ) : (
                  <span className="shrink-0 text-[14px] font-medium leading-5 tracking-[-0.06em] tabular-nums">{Math.round(scaled(d.perUnit, it.units).kcal)} kcal</span>
                )}
              </button>
              {(it.alts?.length ?? 0) > 0 && (
                <OptionPicker item={it} index={index} chosen={choiceOf(it.uid)} onChoose={(c) => onChoose(it.uid, c)} />
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
