import type { ChartTargets } from "@/lib/foodbank/engine";
import type { DayActivity } from "@/lib/foodbank/schedule";
import type { Nutrients } from "@/lib/foodbank/types";
import { cn } from "@/lib/utils";
import MacroDots from "./MacroDots";

// Dark olive at the top corners to lime at the bottom centre (fitted to the Figma card).
const GRADIENT = [
  "radial-gradient(44% 272% at 56% 110%, rgba(183,215,72,0.99) 0%, rgba(183,215,72,0.69) 25%, rgba(183,215,72,0.45) 50%, rgba(183,215,72,0.26) 75%, rgba(183,215,72,0.17) 100%)",
  "linear-gradient(180deg, #000003 0%, #000003 25%, #1a1c0e 50%, #5b6925 75%, #9fb93d 100%)",
].join(", ");

const num = (n: number) => Math.round(n).toLocaleString("en-IN");

/** Planned kcal against the target, as a ring (full ring = target reached). */
function KcalRing({ progress }: { progress: number }) {
  const r = 10;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(1, progress));
  return (
    <svg viewBox="0 0 24 24" width={44} height={44} aria-hidden="true" className="block shrink-0">
      <circle cx={12} cy={12} r={r} fill="none" stroke="#fff" strokeOpacity={0.25} strokeWidth={1} />
      {p > 0 && (
        <circle cx={12} cy={12} r={r} fill="none" stroke="#fff" strokeWidth={1} strokeDasharray={`${p * c} ${c}`} transform="rotate(-90 12 12)" />
      )}
    </svg>
  );
}

/**
 * The day's planned totals against the targets (main dishes only, same numbers
 * the old meters showed). Ticks don't change them.
 */
export default function CalorieCard({
  totals,
  targets,
  activity,
  className,
}: {
  totals: Nutrients;
  targets: ChartTargets;
  activity: DayActivity;
  className?: string;
}) {
  const macros = [
    { label: "Protein", value: totals.protein, target: targets.protein },
    { label: "Carbs", value: totals.carbs, target: targets.carbs },
    { label: "Fat", value: totals.fat, target: targets.fat },
  ];
  return (
    <section
      aria-label="Planned for this day"
      className={cn("mx-4 overflow-hidden rounded-[24px] px-6 pb-[19px] pt-[23px] text-white", className)}
      style={{ backgroundImage: GRADIENT }}
    >
      <div className="flex items-center gap-2">
        <KcalRing progress={targets.kcal > 0 ? totals.kcal / targets.kcal : 0} />
        <p className="flex min-w-0 items-baseline gap-1">
          <span className="text-[40px] font-light leading-[44px] tracking-[-0.04em]">{num(totals.kcal)}</span>
          <span className="whitespace-nowrap text-[16px] font-light leading-5 tracking-[-0.06em] text-white/90">/ {num(targets.kcal)} Kcal</span>
        </p>
      </div>
      <div className="mt-8 flex justify-between">
        {macros.map((m) => (
          <div key={m.label} className="w-[68px]">
            <MacroDots value={m.value} target={m.target} />
            <p className="mt-2 whitespace-nowrap text-[14px] font-medium leading-[18px] tracking-[-0.06em]">
              {Math.round(m.value)}g/{Math.round(m.target)}g
            </p>
            <p className="text-[12px] leading-4 text-white/90">{m.label}</p>
          </div>
        ))}
      </div>
      {(activity.burned > 0 || activity.waterMl > 0) && (
        <p className="mt-4 flex flex-wrap gap-x-3 gap-y-0.5 border-t border-white/15 pt-3 text-[12px] leading-4 text-white/75">
          {activity.burned > 0 && (
            <span>
              Exercise burns about <b className="font-medium text-white">{activity.burned} kcal</b> ({activity.exerciseMin} min)
            </span>
          )}
          {activity.waterMl > 0 && (
            <span>
              Water <b className="font-medium text-white">{(activity.waterMl / 1000).toFixed(1)} L</b>
            </span>
          )}
        </p>
      )}
    </section>
  );
}
