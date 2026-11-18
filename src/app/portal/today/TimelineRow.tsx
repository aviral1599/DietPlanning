import type { ReactNode } from "react";
import { Activity, Droplet, PersonStanding, Pill, StickyNote, type LucideIcon } from "lucide-react";
import type { EventKind } from "@/lib/foodbank/engine";
import { toHM, toMin } from "@/lib/foodbank/schedule";
import { cn } from "@/lib/utils";

export type TimelineKind = "meal" | EventKind;

/** Left-column circle per item type: meals use the Figma's lime figure, events their own tint. */
const KINDS: Record<TimelineKind, { Icon: LucideIcon; circle: string }> = {
  meal: { Icon: PersonStanding, circle: "bg-[#e7fd99] text-[#7b9029]" },
  exercise: { Icon: Activity, circle: "bg-[#fdefd3] text-[#b45309]" },
  supplement: { Icon: Pill, circle: "bg-[#ede9fe] text-[#7c3aed]" },
  water: { Icon: Droplet, circle: "bg-[#e0f2fe] text-[#0284c7]" },
  note: { Icon: StickyNote, circle: "bg-[#ececec] text-[#525252]" },
};

/** One timeline entry: icon circle and 24-hour time on the left, the card on the right. */
export default function TimelineRow({ kind, time, children }: { kind: TimelineKind; time: string; children: ReactNode }) {
  const { Icon, circle } = KINDS[kind];
  const hm = toHM(toMin(time));
  return (
    <li className="flex items-start gap-4">
      <div className="flex w-[37px] shrink-0 flex-col items-center pt-[10px]">
        <span className={cn("flex h-[37px] w-[37px] items-center justify-center rounded-full", circle)}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <time dateTime={hm} className="mt-2 text-[12px] font-medium leading-4 tracking-[-0.05em] tabular-nums">
          {hm}
        </time>
      </div>
      {children}
    </li>
  );
}
