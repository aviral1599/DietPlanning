import { DISHES } from "../../src/lib/foodbank/dishes";
import { BUILTIN_DISHES, INGREDIENT_MAP, scaled } from "../../src/lib/foodbank/bank";

const errors: string[] = [];
const ids = new Set<string>();
for (const d of DISHES) {
  if (ids.has(d.id)) errors.push(`duplicate id ${d.id}`);
  ids.add(d.id);
  for (const k of Object.keys(d.ingredients)) if (!INGREDIENT_MAP[k]) errors.push(`${d.id}: unknown ingredient '${k}'`);
  const u = d.unit;
  if (!(u.min <= u.default && u.default <= u.max) || u.step <= 0) errors.push(`${d.id}: bad unit ${JSON.stringify(u)}`);
  if (!d.slots.length) errors.push(`${d.id}: no slots`);
}
for (const d of DISHES) for (const c of d.companions ?? []) if (!ids.has(c)) errors.push(`${d.id}: companion '${c}' missing`);

console.log(`dishes: ${DISHES.length}   ingredients: ${Object.keys(INGREDIENT_MAP).length}`);
console.log(errors.length ? "ERRORS:\n  " + errors.join("\n  ") : "no structural errors");

const byRole: Record<string, number> = {};
const byCuisine: Record<string, number> = {};
for (const d of BUILTIN_DISHES) {
  byRole[d.role] = (byRole[d.role] ?? 0) + 1;
  byCuisine[d.cuisine] = (byCuisine[d.cuisine] ?? 0) + 1;
}
console.log("by role:", byRole);
console.log("by cuisine:", byCuisine);
const prefs = ["vegetarian", "eggetarian", "non-vegetarian", "vegan", "jain"] as const;
for (const p of prefs) {
  const ok = BUILTIN_DISHES.filter((d) =>
    p === "vegan" ? d.diet.vegan : p === "jain" ? d.diet.jain : p === "vegetarian" ? d.diet.vegetarian : p === "eggetarian" ? d.diet.eggetarian : true
  );
  const roles: Record<string, number> = {};
  ok.forEach((d) => (roles[d.role] = (roles[d.role] ?? 0) + 1));
  console.log(`${p.padEnd(15)} ${String(ok.length).padStart(3)} dishes  breakfast=${roles.breakfast ?? 0} staple=${roles.staple ?? 0} dal=${roles.dal ?? 0} protein=${roles.protein ?? 0} sabzi=${roles.sabzi ?? 0} snack=${roles.snack ?? 0} raita=${roles.raita ?? 0}`);
}

console.log("\n--- default-portion nutrition (sample per role) ---");
const pick = ["kanda-poha", "idli", "plain-dosa", "aloo-paratha", "besan-chilla", "oats-porridge", "egg-bhurji-toast", "phulka", "steamed-rice", "jowar-bhakri",
  "dal-tadka", "sambar", "rajma-masala", "palak-paneer", "chicken-curry", "macher-jhol", "bhindi-sabzi", "aloo-gobi", "kachumber", "cucumber-raita",
  "moong-khichdi", "chicken-biryani", "roasted-chana", "masala-chai", "haldi-doodh", "fruit-apple", "coconut-chutney", "rice-kheer", "sprouts-salad", "soya-chunk-curry"];
for (const id of pick) {
  const d = BUILTIN_DISHES.find((x) => x.id === id)!;
  const n = scaled(d.perUnit, d.unit.default);
  const ex = Object.entries(d.exchanges).map(([g, v]) => `${g}:${v!.toFixed(1)}`).join(" ");
  console.log(`${d.name.slice(0, 28).padEnd(28)} ${String(d.unit.default).padStart(3)} ${d.unit.plural.padEnd(9)} ${n.kcal.toFixed(0).padStart(4)} kcal P${n.protein.toFixed(1).padStart(5)} F${n.fat.toFixed(1).padStart(5)} C${n.carbs.toFixed(1).padStart(5)} Fib${n.fibre.toFixed(1).padStart(5)} Na${n.sodium.toFixed(0).padStart(5)}  [${d.allTags.filter(t=>["high-protein","high-fibre","iron-rich","calcium-rich","low-cal"].includes(t)).join(",")}] ${ex}`);
}
