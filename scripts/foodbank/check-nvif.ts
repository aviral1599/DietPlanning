// Cross-checks the food bank against "Nutritive Value of Indian Foods" (NIN 1989).
//   npm run foodbank:nvif            summary
//   npm run foodbank:nvif -- --all   also list every flagged item
//
// 1. Sync: every built-in dish's nutrients and exchanges are recomputed from the ingredient table
//    and must match what the bank serves (no stale or hand-typed values).
// 2. Ingredients vs book: protein, fat, total carbohydrate, Ca, Fe, Na, K, vit C, folate.
// 3. Dishes vs book: how much each dish would change if its ingredients used book values.
// 4. Clinic exchange list vs book: portion that gives one exchange.
import { DISHES } from "../../src/lib/foodbank/dishes";
import { BUILTIN_DISHES, INGREDIENT_MAP, computeDish } from "../../src/lib/foodbank/bank";
import { EXCHANGE_UNITS, FOOD_ITEMS } from "../../src/lib/exchange-data";
import { INGREDIENT_TO_NVIF, NVIF_FOODS, type NvifFood } from "../../src/lib/nvif/data";

const ALL = process.argv.includes("--all");
const book = new Map(NVIF_FOODS.map((f) => [f.sl, f]));
const pct = (a: number, b: number) => (Math.abs(a - b) / Math.max(Math.abs(a), Math.abs(b), 1e-9)) * 100;

// ---- 1. sync ---------------------------------------------------------------
let syncErr = 0;
const served = new Map(BUILTIN_DISHES.map((d) => [d.id, d]));
for (const def of DISHES) {
  const fresh = computeDish(def);
  const s = served.get(def.id);
  if (!s) { console.log(`  missing from bank: ${def.id}`); syncErr++; continue; }
  for (const k of Object.keys(fresh.perUnit) as (keyof typeof fresh.perUnit)[]) {
    if (Math.abs(fresh.perUnit[k] - s.perUnit[k]) > 1e-6) { console.log(`  ${def.id}.${k} out of sync`); syncErr++; }
  }
  for (const g of Object.keys(fresh.exchanges)) {
    if (Math.abs((fresh.exchanges as Record<string, number>)[g] - ((s.exchanges as Record<string, number>)[g] ?? 0)) > 1e-6) syncErr++;
  }
  for (const k of Object.keys(def.ingredients)) if (!INGREDIENT_MAP[k]) { console.log(`  ${def.id}: unknown ingredient ${k}`); syncErr++; }
}
const manual = DISHES.filter((d) => d.manualPerUnit).map((d) => `${d.id} (${Object.keys(d.manualPerUnit!).join(", ")})`);
console.log(`1. SYNC  ${DISHES.length} dishes recomputed from ${Object.keys(INGREDIENT_MAP).length} ingredients — ${syncErr ? syncErr + " PROBLEMS" : "all in sync"}`);
console.log(`   exchange units: cereal ${EXCHANGE_UNITS.CEREALS.cho} g CHO · pulse/meat ${EXCHANGE_UNITS.PULSES.protein} g P · milk ${EXCHANGE_UNITS.MILK.protein} g P · fruit/root ${EXCHANGE_UNITS.FRUITS.cho} g CHO · sugar ${EXCHANGE_UNITS.SUGARS.cho} g · fat/nut ${EXCHANGE_UNITS.FATS.fat} g fat · veg 100 g`);
console.log(`   hand-set values (intentional): ${manual.join("; ") || "none"}`);

// ---- 2. ingredients vs book -----------------------------------------------
type F = { key: string; field: string; ours: number; book: number; diff: number };
const FIELDS: [string, (p: Record<string, number>) => number, (b: NvifFood) => number | undefined, number][] = [
  ["protein", (p) => p.protein, (b) => b.protein, 1.5],
  ["fat", (p) => p.fat, (b) => b.fat, 1.5],
  ["total carbs", (p) => p.carbs + p.fibre, (b) => (b.carbs == null ? undefined : b.carbs + (b.fibre ?? 0)), 4],
  ["calcium", (p) => p.calcium, (b) => b.calcium, 30],
  ["iron", (p) => p.iron, (b) => b.iron, 1.5],
  ["sodium", (p) => p.sodium, (b) => b.sodium, 30],
  ["potassium", (p) => p.potassium, (b) => b.potassium, 100],
  ["vitamin C", (p) => p.vitaminC, (b) => b.vitc, 10],
  ["folate", (p) => p.folate, (b) => b.folate_total, 20],
];
const flags: F[] = [];
let exact = 0;
for (const [key, link] of Object.entries(INGREDIENT_TO_NVIF)) {
  const ing = INGREDIENT_MAP[key];
  const b = book.get(link.sl)!;
  if (!ing || link.approx) continue;
  exact++;
  for (const [field, ours, theirs, floor] of FIELDS) {
    const o = ours(ing.per100 as unknown as Record<string, number>), t = theirs(b);
    if (t == null) continue;
    if (Math.abs(o - t) >= floor && pct(o, t) >= 30) flags.push({ key, field, ours: o, book: t, diff: pct(o, t) });
  }
}
const byField = new Map<string, number>();
flags.forEach((f) => byField.set(f.field, (byField.get(f.field) ?? 0) + 1));
console.log(`\n2. INGREDIENTS  ${Object.keys(INGREDIENT_TO_NVIF).length} linked to the book (${exact} exact, rest approximate) — differences ≥30%:`);
console.log("   " + FIELDS.map(([f]) => `${f} ${byField.get(f) ?? 0}`).join(" · "));
if (ALL) flags.forEach((f) => console.log(`   ${f.key.padEnd(18)} ${f.field.padEnd(11)} ours ${f.ours.toFixed(1).padStart(7)}  book ${f.book.toFixed(1).padStart(7)}`));

// ---- 3. dishes vs book -----------------------------------------------------
const dishDelta: { id: string; kcal: number; protein: number; ours: number; theirs: number }[] = [];
for (const d of BUILTIN_DISHES) {
  if (d.manualPerUnit) continue;
  let kO = 0, kB = 0, pO = 0, pB = 0;
  for (const [key, g] of Object.entries(d.ingredients)) {
    const ing = INGREDIENT_MAP[key]; if (!ing) continue;
    const link = INGREDIENT_TO_NVIF[key];
    const b = link && !link.approx ? book.get(link.sl) : undefined;
    kO += (ing.per100.kcal * g) / 100; pO += (ing.per100.protein * g) / 100;
    kB += (((b?.kcal ?? ing.per100.kcal)) * g) / 100; pB += (((b?.protein ?? ing.per100.protein)) * g) / 100;
  }
  dishDelta.push({ id: d.id, kcal: kO ? ((kB - kO) / kO) * 100 : 0, protein: pO > 1 ? ((pB - pO) / pO) * 100 : 0, ours: kO, theirs: kB });
}
const big = dishDelta.filter((x) => Math.abs(x.kcal) > 10 || Math.abs(x.protein) > 15);
const med = (a: number[]) => a.sort((x, y) => x - y)[Math.floor(a.length / 2)];
console.log(`\n3. DISHES  ${dishDelta.length} compared · median energy change with book values ${med(dishDelta.map((x) => x.kcal)).toFixed(1)}% · ${big.length} dishes shift >10% kcal or >15% protein`);
if (ALL) big.sort((a, b) => Math.abs(b.kcal) - Math.abs(a.kcal)).forEach((x) => console.log(`   ${x.id.padEnd(30)} kcal ${x.kcal >= 0 ? "+" : ""}${x.kcal.toFixed(0)}%  protein ${x.protein >= 0 ? "+" : ""}${x.protein.toFixed(0)}%`));

// ---- 4. clinic exchange list vs book --------------------------------------
const EX_MAP: Record<string, number> = {
  "Milk, whole, buffalo": 419, "Milk, whole, cow": 420, "Skim milk, liquid": 425, "Skim milk powder": 432, "Whole milk powder": 433,
  Paneer: 426, Khoa: 429, Cheese: 428, Curds: 423, "Egg, poultry, whole raw": 402, Hilsa: 341, "Chicken, breast skinless": 405,
  "Goat legs": 406, Sardines: 364, "Goat liver": 408, "Sheep liver": 409, "Katla (fish)": 347, "Pomfret, white": 370, "Prawn, big": 371,
  "Rohu (fish)": 377, Crab: 334, "Bengal gram dal": 29, "Bengal gram whole": 28, "Black gram dal": 31, "Cow pea, brown": 32,
  "Green gram dal": 35, "Green gram whole": 34, "Horse gram, whole": 36, "Lentil dal": 38, "Moth beans": 39, "Peas, dry": 41,
  "Rajmah, red": 43, "Red gram dal": 44, "Soyabean, white": 46, Bajra: 1, Barley: 2, Jowar: 4, "Maize, dry": 5, Ragi: 8,
  "Rice (raw milled)": 12, "Rice flakes (poha)": 14, "Rice puffed (murmura)": 15, "Semolina (suji)": 24, Vermicelli: 25,
  "Wheat flour (atta)": 21, "Wheat flour, refined (maida)": 22, "Bread, brown": 26, "Bread, white": 27, "Sago (sabudana)": 446,
  Sugar: 439, "Jaggery (gur)": 441, Honey: 440, "Cooking oil": 438, Ghee: 435, Butter: 434, Almonds: 189, Cashewnuts: 192,
  Walnuts: 212, Groundnuts: 202, "Gingelly seeds (til), fresh": 201, "Coconut, dry": 194, "Coconut, fresh": 195,
};
const ANCHOR: Record<string, ["protein" | "fat" | "carbs", number]> = {
  MILK: ["protein", EXCHANGE_UNITS.MILK.protein], MEAT: ["protein", EXCHANGE_UNITS.MEAT.protein], PULSES: ["protein", EXCHANGE_UNITS.PULSES.protein],
  CEREALS: ["carbs", EXCHANGE_UNITS.CEREALS.cho], SUGARS: ["carbs", EXCHANGE_UNITS.SUGARS.cho], FATS: ["fat", EXCHANGE_UNITS.FATS.fat], NUTS: ["fat", EXCHANGE_UNITS.NUTS.fat],
};
console.log(`\n4. EXCHANGE LIST  portion giving one exchange — clinic list vs book (fruits/roots skipped: book carbs include fibre)`);
for (const group of Object.keys(ANCHOR)) {
  const [field, target] = ANCHOR[group];
  const devs: number[] = [];
  const out: string[] = [];
  for (const it of FOOD_ITEMS.filter((x) => x.group === group)) {
    const sl = EX_MAP[it.name]; const b = sl ? book.get(sl) : undefined; const per = b?.[field];
    if (!per) continue;
    const implied = (target / per) * 100; const dev = ((it.amountG - implied) / implied) * 100;
    devs.push(dev);
    if (Math.abs(dev) >= 15) out.push(`${it.name} ${it.amountG} g vs book ${implied.toFixed(0)} g (${dev >= 0 ? "+" : ""}${dev.toFixed(0)}%)`);
  }
  if (!devs.length) continue;
  console.log(`   ${group.padEnd(8)} ${field} ${target} g · ${devs.length} items · median ${med(devs).toFixed(0)}%${out.length ? " · ≥15%: " + out.join("; ") : ""}`);
}
if (syncErr) process.exit(1);
