import { cn } from "@/lib/utils";
import type { DayStatus } from "./week";

const R = 13; // ring radius inside a 28 px box (stroke centre)
const C = 2 * Math.PI * R;
const INK = "#0a0a0a";
const TRACK = "#d7d7d7";

function Arc({ progress }: { progress: number }) {
  const p = Math.max(0, Math.min(1, progress));
  if (p <= 0) return null;
  return (
    <circle
      cx={14}
      cy={14}
      r={R}
      fill="none"
      stroke={INK}
      strokeWidth={2}
      strokeDasharray={`${p * C} ${C}`}
      transform="rotate(-90 14 14)"
    />
  );
}

/** The 28 px circle under each date in the week strip. `null` = a date outside the plan. */
export default function DayStatusRing({ status, className }: { status: DayStatus | null; className?: string }) {
  return (
    <svg viewBox="0 0 28 28" width={28} height={28} aria-hidden="true" className={cn("block shrink-0", className)}>
      {status === null || status.kind === "future" ? (
        // Dotted grey ring: 24 round dots.
        <circle cx={14} cy={14} r={R} fill="none" stroke="#979797" strokeWidth={1.6} strokeLinecap="round" strokeDasharray={`0.001 ${C / 24 - 0.001}`} />
      ) : status.kind === "done" ? (
        <>
          <circle cx={14} cy={14} r={R} fill="none" stroke={INK} strokeWidth={2} />
          <path d="M9.8 13.8 14 17.3l4.4-6.7" fill="none" stroke={INK} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </>
      ) : status.kind === "missed" ? (
        <>
          <circle cx={14} cy={14} r={R} fill="none" stroke={INK} strokeWidth={2} />
          <circle cx={14} cy={14} r={3.2} fill={INK} />
        </>
      ) : (
        <>
          <circle cx={14} cy={14} r={R} fill="none" stroke={TRACK} strokeWidth={2} />
          <Arc progress={status.progress} />
          {status.kind === "today" && <circle cx={14} cy={14} r={1.3} fill={INK} />}
        </>
      )}
    </svg>
  );
}
