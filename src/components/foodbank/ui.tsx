"use client";

import { useId, type ReactNode } from "react";
import type { Dish } from "@/lib/foodbank/types";

// ---------------------------------------------------------------------------
// Chips / pills
// ---------------------------------------------------------------------------

export function Chip({
  children,
  active,
  onClick,
  onRemove,
  tone = "slate",
  size = "md",
  title,
}: {
  children: ReactNode;
  active?: boolean;
  onClick?: () => void;
  onRemove?: () => void;
  tone?: "slate" | "brand" | "amber" | "red" | "blue";
  size?: "sm" | "md";
  title?: string;
}) {
  const tones: Record<string, string> = {
    slate: active ? "border-slate-800 bg-slate-800 text-white" : "border-slate-200 bg-white text-slate-700 hover:border-slate-400",
    brand: active ? "border-brand-600 bg-brand-600 text-white" : "border-brand-200 bg-brand-50 text-brand-800 hover:border-brand-400",
    amber: active ? "border-amber-500 bg-amber-500 text-white" : "border-amber-200 bg-amber-50 text-amber-800 hover:border-amber-400",
    red: active ? "border-red-500 bg-red-500 text-white" : "border-red-200 bg-red-50 text-red-700 hover:border-red-400",
    blue: active ? "border-blue-600 bg-blue-600 text-white" : "border-blue-200 bg-blue-50 text-blue-800 hover:border-blue-400",
  };
  const sizing = size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-3 py-1 text-xs";
  const Tag = onClick ? "button" : "span";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      title={title}
      aria-pressed={onClick ? !!active : undefined}
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border font-medium transition ${sizing} ${tones[tone]}`}
    >
      {children}
      {onRemove && (
        <span
          role="button"
          tabIndex={0}
          aria-label="Remove"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              e.stopPropagation();
              onRemove();
            }
          }}
          className="-mr-1 ml-0.5 flex h-4 w-4 items-center justify-center rounded-full text-current opacity-60 hover:bg-black/10 hover:opacity-100"
        >
          ×
        </span>
      )}
    </Tag>
  );
}

/** Multi-select chip group. */
export function ChipGroup<T extends string>({
  options,
  value,
  onChange,
  tone = "brand",
  single,
}: {
  options: { value: T; label: string }[];
  value: T[];
  onChange: (v: T[]) => void;
  tone?: "slate" | "brand" | "amber" | "red" | "blue";
  single?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const on = value.includes(o.value);
        return (
          <Chip
            key={o.value}
            active={on}
            tone={tone}
            onClick={() =>
              onChange(single ? [o.value] : on ? value.filter((v) => v !== o.value) : [...value, o.value])
            }
          >
            {o.label}
          </Chip>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Indian food-label veg / non-veg / egg mark
// ---------------------------------------------------------------------------

export function DietMark({ dish, size = 12 }: { dish: Pick<Dish, "diet">; size?: number }) {
  const nonVeg = !dish.diet.eggetarian;
  const egg = dish.diet.eggetarian && !dish.diet.vegetarian;
  const color = nonVeg ? "#9a3412" : egg ? "#ca8a04" : "#15803d";
  const label = nonVeg ? "Non-vegetarian" : egg ? "Contains egg" : dish.diet.vegan ? "Vegan" : "Vegetarian";
  return (
    <span
      title={label}
      aria-label={label}
      className="inline-flex shrink-0 items-center justify-center rounded-[2px] border-[1.5px]"
      style={{ width: size, height: size, borderColor: color }}
    >
      {nonVeg ? (
        <span style={{ width: 0, height: 0, borderLeft: `${size * 0.25}px solid transparent`, borderRight: `${size * 0.25}px solid transparent`, borderBottom: `${size * 0.45}px solid ${color}` }} />
      ) : (
        <span className="rounded-full" style={{ width: size * 0.45, height: size * 0.45, background: color }} />
      )}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Nutrient meters
// ---------------------------------------------------------------------------

export function Meter({
  label,
  value,
  target,
  unit,
  mode = "range",
  compact,
}: {
  label: string;
  value: number;
  target: number;
  unit: string;
  /** range: ±10 % is ideal. min: ≥ 90 % is ideal. max: ≤ target is ideal. */
  mode?: "range" | "min" | "max";
  compact?: boolean;
}) {
  const ratio = target > 0 ? value / target : 0;
  const good =
    mode === "min" ? ratio >= 0.9 : mode === "max" ? ratio <= 1.05 : ratio >= 0.9 && ratio <= 1.1;
  const warn =
    mode === "min" ? ratio >= 0.75 : mode === "max" ? ratio <= 1.2 : ratio >= 0.8 && ratio <= 1.2;
  const color = good ? "bg-brand-500" : warn ? "bg-amber-400" : "bg-red-500";
  const text = good ? "text-brand-700" : warn ? "text-amber-700" : "text-red-600";
  return (
    <div className={compact ? "" : "min-w-[110px]"}>
      <div className="flex items-baseline justify-between gap-2">
        <span className={`${compact ? "text-[10px]" : "text-xs"} font-medium text-slate-500`}>{label}</span>
        <span className={`${compact ? "text-[10px]" : "text-xs"} font-semibold tabular-nums ${text}`}>
          {Math.round(value)}
          <span className="font-normal text-slate-400">
            /{Math.round(target)}
            {unit}
          </span>
        </span>
      </div>
      <div className={`mt-1 overflow-hidden rounded-full bg-slate-100 ${compact ? "h-1" : "h-1.5"}`}>
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(100, ratio * 100)}%` }} />
      </div>
    </div>
  );
}

export function MacroLine({ kcal, protein, carbs, fat, className = "" }: { kcal: number; protein: number; carbs?: number; fat?: number; className?: string }) {
  return (
    <span className={`tabular-nums text-slate-500 ${className}`}>
      <b className="font-semibold text-slate-700">{Math.round(kcal)}</b> kcal · P {Math.round(protein)}g
      {carbs !== undefined && <> · C {Math.round(carbs)}g</>}
      {fat !== undefined && <> · F {Math.round(fat)}g</>}
    </span>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  wide?: boolean;
  footer?: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className={`flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:rounded-2xl ${wide ? "sm:max-w-4xl" : "sm:max-w-lg"}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <div className="text-base font-semibold text-slate-900">{title}</div>
          <button onClick={onClose} className="rounded-lg p-1 text-xl leading-none text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Close">
            ×
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="border-t border-slate-100 px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: ReactNode }) {
  const id = useId();
  return (
    <label className="inline-flex cursor-pointer select-none items-center gap-2 text-sm text-slate-700">
      <span
        role="switch"
        aria-checked={checked}
        aria-labelledby={label ? id : undefined}
        tabIndex={0}
        onClick={() => onChange(!checked)}
        onKeyDown={(e) => {
          if (e.key === " " || e.key === "Enter") {
            e.preventDefault();
            onChange(!checked);
          }
        }}
        className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition ${checked ? "bg-brand-600" : "bg-slate-300"}`}
      >
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition ${checked ? "left-[18px]" : "left-0.5"}`} />
      </span>
      {label && <span id={id}>{label}</span>}
    </label>
  );
}
