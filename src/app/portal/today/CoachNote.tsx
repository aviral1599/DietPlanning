import { cn } from "@/lib/utils";

/** The nutritionist's note on the plan (chart.notes). */
export default function CoachNote({ coachName, notes, className }: { coachName: string; notes: string; className?: string }) {
  return (
    <section className={cn("mx-4 rounded-[20px] bg-white p-4", className)}>
      <h2 className="text-[12px] leading-4 text-[#666]">Note from {coachName}</h2>
      <p className="mt-1.5 whitespace-pre-line text-[14px] leading-5">{notes}</p>
    </section>
  );
}
