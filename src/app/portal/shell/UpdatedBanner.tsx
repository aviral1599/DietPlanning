import { Sparkles } from "lucide-react";
import { Button } from "../ui/button";

/** "{coach} has updated your plan", shown when the plan version is newer than this device last saw. */
export default function UpdatedBanner({ coachName, onDismiss }: { coachName: string; onDismiss: () => void }) {
  return (
    <div role="status" className="mx-4 mt-4 flex items-center gap-3 rounded-[18px] bg-white py-2.5 pl-2.5 pr-3 tracking-[-0.02em]">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#e7fd99] text-[#7b9029]">
        <Sparkles className="h-4 w-4" aria-hidden="true" />
      </span>
      <p className="min-w-0 flex-1 text-[12px] leading-4">{coachName} has updated your plan.</p>
      <Button variant="secondary" size="sm" onClick={onDismiss} className="h-7 rounded-md bg-[#f0f0f0] px-2.5 text-[12px] shadow-none hover:bg-[#e8e8e8]">
        Got it
      </Button>
    </div>
  );
}
