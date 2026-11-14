// Small stroke icons for the diet calendar (inherit colour and size from text).
import type { SVGProps } from "react";

const PATHS = {
  meal: "M3 2v7a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V2M7 2v20M21 15V2a5 5 0 0 0-5 5v6a2 2 0 0 0 2 2h3Zm0 0v7",
  exercise: "M22 12h-4l-3 9L9 3l-3 9H2",
  supplement: "m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7ZM8.5 8.5l7 7",
  water: "M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z",
  note: "M15.5 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8.5L15.5 3ZM15 3v6h6",
  lock: "M6 11h12a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2ZM8 11V7a4 4 0 0 1 8 0v4",
  refresh: "M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M8 16H3v5",
  plus: "M12 5v14M5 12h14",
  left: "m15 18-6-6 6-6",
  right: "m9 18 6-6-6-6",
  more: "M5 12h.01M12 12h.01M19 12h.01",
  x: "M18 6 6 18M6 6l12 12",
  download: "M12 3v12M7 10l5 5 5-5M5 21h14",
  repeat: "m17 2 4 4-4 4M3 11v-1a4 4 0 0 1 4-4h14M7 22l-4-4 4-4M21 13v1a4 4 0 0 1-4 4H3",
  copy: "M10 8h9a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2ZM4 16a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2",
  paste: "M9 4h6v3H9zM15 5h2a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, className = "h-4 w-4", ...rest }: { name: IconName } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={name === "more" ? 3 : 2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`shrink-0 ${className}`}
      {...rest}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}

/** Tailwind classes per calendar item type. */
export const KIND_STYLES = {
  meal: { block: "border-brand-200 bg-brand-50 text-brand-900", dot: "bg-brand-400", chip: "text-brand-800" },
  exercise: { block: "border-orange-200 bg-orange-50 text-orange-900", dot: "bg-orange-400", chip: "text-orange-800" },
  supplement: { block: "border-violet-200 bg-violet-50 text-violet-900", dot: "bg-violet-400", chip: "text-violet-800" },
  water: { block: "border-sky-200 bg-sky-50 text-sky-900", dot: "bg-sky-400", chip: "text-sky-800" },
  note: { block: "border-amber-200 bg-amber-50 text-amber-900", dot: "bg-amber-400", chip: "text-amber-800" },
} as const;
