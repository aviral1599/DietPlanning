import { Salad } from "lucide-react";
import { Button } from "../ui/button";

/** Shown on every tab except Profile until the nutritionist shares a plan. */
export default function PlanPending({ coachName, onViewProfile }: { coachName: string; onViewProfile: () => void }) {
  return (
    <div className="mx-4 mt-4 rounded-[20px] bg-white p-8 text-center tracking-[-0.02em]">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#e7fd99] text-[#7b9029]">
        <Salad className="h-6 w-6" aria-hidden="true" />
      </span>
      <h2 className="mt-3 text-[16px] font-medium leading-6">Your plan is being prepared</h2>
      <p className="mt-1 text-[13px] leading-5 text-[#666]">
        {coachName} is putting together your personalised diet chart. You’ll see it here as soon as it’s shared.
      </p>
      <Button variant="outline" className="mt-4 shadow-none" onClick={onViewProfile}>
        View my profile
      </Button>
    </div>
  );
}
