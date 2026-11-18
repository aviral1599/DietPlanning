"use client";

import { useState } from "react";
import DishDetail from "@/components/foodbank/DishDetail";
import { fmtDate } from "@/lib/foodbank/client";
import type { ChartDay, PlanItem } from "@/lib/foodbank/engine";
import type { Dish } from "@/lib/foodbank/types";
import { MEAL_TIME_LABELS, type MealTime } from "@/lib/types";
import { Button } from "../ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "../ui/sheet";

export interface DishSheetTarget {
  item: PlanItem;
  meal: MealTime;
  day: ChartDay;
}

/** Bottom sheet with a dish's portion, nutrition and recipe, plus "Request a change". */
export default function DishSheet({
  target,
  index,
  canRequest,
  pendingUids,
  onClose,
  onRequest,
}: {
  target: DishSheetTarget | null;
  index: Record<string, Dish>;
  canRequest: boolean;
  pendingUids: Set<string | null>;
  onClose: () => void;
  onRequest: (target: DishSheetTarget) => void;
}) {
  // Keep showing the last dish while the sheet slides away.
  const [shown, setShown] = useState<DishSheetTarget | null>(target);
  if (target && target !== shown) setShown(target);
  const dish = shown ? index[shown.item.dishId] : undefined;
  const open = !!target && !!index[target.item.dishId];
  const pending = !!shown && pendingUids.has(shown.item.uid);

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      {shown && dish && (
        <SheetContent
          side="bottom"
          className="mx-auto flex max-h-[88dvh] w-full max-w-[430px] flex-col gap-0 rounded-t-[24px] border-0 p-0 pb-[env(safe-area-inset-bottom)] tracking-[-0.01em]"
          overlayClassName="bg-black/40"
        >
          <SheetHeader className="space-y-1 px-5 pb-3 pt-5 text-left sm:text-left">
            <SheetTitle className="pr-8 text-[16px] font-medium leading-6">{dish.name}</SheetTitle>
            <SheetDescription className="text-[12px] leading-4 text-[#666]">
              {MEAL_TIME_LABELS[shown.meal]} · {fmtDate(shown.day.date, { weekday: "long", day: "numeric", month: "long" })}
            </SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4">
            <DishDetail dish={dish} units={shown.item.units} showSources={false} />
          </div>
          {canRequest && (
            <div className="border-t border-[#f0f0f0] px-5 py-3">
              <Button className="h-11 w-full rounded-xl text-[14px] shadow-none" disabled={pending} onClick={() => onRequest(shown)}>
                {pending ? "Change already requested" : "Request a change"}
              </Button>
            </div>
          )}
        </SheetContent>
      )}
    </Sheet>
  );
}
