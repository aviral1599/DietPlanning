// ---------------------------------------------------------------------------
// Approximate cooked weight for ingredients that are boiled in water.
// Recipes and nutrition stay on RAW weight (IFCT values are per 100 g raw);
// this is only shown alongside so coaches and clients can picture the portion.
//
// Factor = cooked weight ÷ dry weight, from USDA raw vs boiled energy density
// (e.g. chickpeas 378 → 164 kcal/100 g ≈ ×2.3). Split dals are taken as
// soft-cooked (not watery) dal. Flours, poha, oats and suji are left out
// because their cooked weight depends too much on the preparation.
// ---------------------------------------------------------------------------

export const COOKED_YIELD: Record<string, number> = {
  // pulses & legumes
  kala_chana: 2.3,
  kabuli_chana: 2.3,
  rajma: 2.6,
  lobia: 2.9,
  moth: 2.8,
  kulthi: 2.5,
  soybean: 2.6,
  peas_dry: 3.1,
  moong_whole: 3.3,
  masoor_whole: 3.0,
  urad_whole: 3.0,
  moong_dal: 3.0,
  masoor_dal: 3.0,
  toor_dal: 3.0,
  chana_dal: 2.8,
  urad_dal: 3.0,
  soya_chunks: 3.0,
  // rice, millets & grains
  rice: 2.8,
  rice_brown: 3.0,
  rice_parboiled: 3.0,
  little_millet: 3.0,
  kodo_millet: 3.0,
  quinoa: 3.1,
  barley: 2.9,
  daliya: 3.5,
  pasta_ww: 2.4,
};

/** "≈ 70 g cooked" for boiled ingredients, else null. */
export function cookedNote(key: string, rawGrams: number): string | null {
  const f = COOKED_YIELD[key];
  if (!f || !(rawGrams > 0)) return null;
  const g = rawGrams * f;
  return `≈ ${g >= 20 ? Math.round(g / 5) * 5 : Math.round(g)} g cooked`;
}
