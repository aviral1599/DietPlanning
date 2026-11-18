import { cn } from "@/lib/utils";

/** "Log your day" from the Figma. Look only for now: not an input, not focusable. */
export default function LogDayCard({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn("mx-4 flex h-14 select-none items-center rounded-[18px] bg-white px-4 text-[12px] font-medium leading-4 tracking-[-0.05em]", className)}>
      Log your day
    </div>
  );
}
