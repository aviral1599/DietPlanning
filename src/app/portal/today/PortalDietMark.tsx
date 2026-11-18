import type { Dish } from "@/lib/foodbank/types";
import { cn } from "@/lib/utils";

/**
 * Veg / non-veg / egg mark in the portal style (rounded square with a dot).
 * Same rules as the shared DietMark: non-veg gets a triangle, egg is amber.
 */
export default function PortalDietMark({ dish, className }: { dish: Pick<Dish, "diet">; className?: string }) {
  const nonVeg = !dish.diet.eggetarian;
  const egg = dish.diet.eggetarian && !dish.diet.vegetarian;
  const color = nonVeg ? "#9a3412" : egg ? "#ca8a04" : "#3a7f53";
  const label = nonVeg ? "Non-vegetarian" : egg ? "Contains egg" : dish.diet.vegan ? "Vegan" : "Vegetarian";
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={cn("flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[3px] border-[1.5px]", className)}
      style={{ borderColor: color }}
    >
      {nonVeg ? (
        <span className="h-0 w-0 border-x-[3px] border-b-[5px] border-x-transparent" style={{ borderBottomColor: color }} />
      ) : (
        <span className="h-[3px] w-[3px] rounded-full" style={{ background: color }} />
      )}
    </span>
  );
}
