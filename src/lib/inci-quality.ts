/**
 * Cosmetic ingredient (INCI) quality analysis — Yuka-style result.
 *
 * When a scanned product resolves on Open Beauty Facts we get its INCI
 * ingredient list. Every ingredient is classified into one of three tiers:
 *   concern (orange/red) — commonly associated with health concerns
 *   caution (yellow)      — to consider (irritants, hidden allergens, …)
 *   good    (green)       — no known common concern
 *
 * Matching is EXACT on normalized INCI names — INCI is an international
 * nomenclature, so "ALCOHOL" flags while "CETEARYL ALCOHOL" (a harmless
 * fatty alcohol) must not.
 *
 * `common` and `tags` are i18n keys under `barcode.quality.common.*` /
 * `barcode.quality.tags.*` — the UI resolves them through the active locale;
 * this module stays pure.
 */

export type InciTier = 'concern' | 'caution' | 'good';

export const INCI_SCORE_MAX = 20;

export interface InciKnowledge {
  /** i18n key under `barcode.quality.common` (optional). */
  common?: string;
  /** i18n keys under `barcode.quality.tags`. */
  tags: string[];
}

export interface InciIngredient {
  /** The INCI name as written in the list. */
  inci: string;
  tier: InciTier;
  /** i18n key under `barcode.quality.common`, when known. */
  common?: string;
  /** i18n keys under `barcode.quality.tags`. */
  tags: string[];
}

export interface InciClassification {
  total: number;
  /** Weighted score out of INCI_SCORE_MAX (good = full, caution = half). */
  score: number;
  counts: Record<InciTier, number>;
  ingredients: InciIngredient[];
}

/**
 * Tier-defining rules: every INCI name listed here is lifted out of the
 * default "good" tier. Names not listed (known or unknown) stay green.
 */
export const INCI_TIER_RULES: Array<{ tier: 'concern' | 'caution'; inci: string[] }> = [
  {
    tier: 'concern',
    inci: [
      'FORMALDEHYDE',
      'HYDROQUINONE',
      'METHYLISOTHIAZOLINONE',
      'METHYLCHLOROISOTHIAZOLINONE',
      'RESORCINOL',
      'OXYBENZONE',
      'OCTOCRYLENE',
      'TALC',
      'SODIUM LAURYL SULFATE',
      'SODIUM LAURETH SULFATE',
    ],
  },
  {
    tier: 'caution',
    inci: [
      // Parabens (all six common esters)
      'METHYLPARABEN',
      'ETHYLPARABEN',
      'PROPYLPARABEN',
      'BUTYLPARABEN',
      'ISOPROPYLPARABEN',
      'ISOBUTYLPARABEN',
      // Drying alcohols
      'ALCOHOL',
      'ALCOHOL DENAT.',
      'ETHYL ALCOHOL',
      'SD ALCOHOL 4',
      'SD ALCOHOL 8',
      'SD ALCOHOL 9',
      'SD ALCOHOL 40',
      // Fragrance + common fragrance allergens
      'PARFUM',
      'FRAGRANCE',
      'LIMONENE',
      'LINALOOL',
      'CITRONELLOL',
      'GERANIOL',
      'CITRAL',
      // Quaternary ammonium (quats) surfactants
      'COCAMIDOPROPYL BETAINE',
    ],
  },
];

const TIER_BY_INCI = new Map<string, 'concern' | 'caution'>();
for (const rule of INCI_TIER_RULES) {
  for (const name of rule.inci) TIER_BY_INCI.set(canonInci(name), rule.tier);
}

/**
 * Curated knowledge for common INCI names: vernacular common name and
 * functional tags. Ingredients absent from this map still classify as
 * "good" with no tags.
 */
export const INCI_KNOWLEDGE: Record<string, InciKnowledge> = {
  // ── Concern tier ──
  FORMALDEHYDE: { tags: ['preservative'] },
  HYDROQUINONE: { tags: [] },
  METHYLISOTHIAZOLINONE: { tags: ['preservative'] },
  METHYLCHLOROISOTHIAZOLINONE: { tags: ['preservative'] },
  RESORCINOL: { tags: ['preservative'] },
  OXYBENZONE: { tags: ['uvFilter'] },
  OCTOCRYLENE: { tags: ['uvFilter'] },
  TALC: { tags: [] },
  'SODIUM LAURYL SULFATE': { tags: ['sulfate', 'anionicSurfactant'] },
  'SODIUM LAURETH SULFATE': { tags: ['sulfate', 'anionicSurfactant'] },
  // ── Caution tier ──
  METHYLPARABEN: { tags: ['paraben', 'preservative'] },
  ETHYLPARABEN: { tags: ['paraben', 'preservative'] },
  PROPYLPARABEN: { tags: ['paraben', 'preservative'] },
  BUTYLPARABEN: { tags: ['paraben', 'preservative'] },
  ISOPROPYLPARABEN: { tags: ['paraben', 'preservative'] },
  ISOBUTYLPARABEN: { tags: ['paraben', 'preservative'] },
  ALCOHOL: { tags: ['alcohol', 'solvent'] },
  'ALCOHOL DENAT.': { tags: ['alcohol', 'solvent'] },
  'ETHYL ALCOHOL': { tags: ['alcohol', 'solvent'] },
  'SD ALCOHOL 4': { tags: ['alcohol', 'solvent'] },
  'SD ALCOHOL 8': { tags: ['alcohol', 'solvent'] },
  'SD ALCOHOL 9': { tags: ['alcohol', 'solvent'] },
  'SD ALCOHOL 40': { tags: ['alcohol', 'solvent'] },
  PARFUM: { tags: ['fragrance'] },
  FRAGRANCE: { tags: ['fragrance'] },
  LIMONENE: { tags: ['fragranceAllergen'] },
  LINALOOL: { tags: ['fragranceAllergen'] },
  CITRONELLOL: { tags: ['fragranceAllergen'] },
  GERANIOL: { tags: ['fragranceAllergen'] },
  CITRAL: { tags: ['fragranceAllergen'] },
  'COCAMIDOPROPYL BETAINE': {
    common: 'cocamidopropylBetaine',
    tags: ['quaternaryAmmonium', 'amphotericSurfactant'],
  },
  // ── Good tier: common names + functions ──
  AQUA: { common: 'water', tags: ['solvent'] },
  WATER: { common: 'water', tags: ['solvent'] },
  'AQUA/WATER': { common: 'water', tags: ['solvent'] },
  GLYCERIN: { common: 'glycerin', tags: ['humectant'] },
  'SODIUM CHLORIDE': { common: 'salt', tags: ['phAdjuster'] },
  'ALOE BARBADENSIS LEAF JUICE': { common: 'aloe', tags: ['humectant'] },
  TOCOPHEROL: { common: 'vitaminE', tags: ['antioxidant'] },
  'SODIUM HYALURONATE': { common: 'hyaluronic', tags: ['humectant'] },
  NIACINAMIDE: { common: 'niacinamide', tags: [] },
  'HELIANTHUS ANNUUS SEED OIL': { common: 'sunflowerOil', tags: ['oil', 'emollient'] },
  'SUNFLOWER SEED OIL': { common: 'sunflowerOil', tags: ['oil', 'emollient'] },
  'COCOS NUCIFERA OIL': { common: 'coconutOil', tags: ['oil', 'emollient'] },
  'COCONUT OIL': { common: 'coconutOil', tags: ['oil', 'emollient'] },
  'OLEA EUROPAEA OIL': { common: 'oliveOil', tags: ['oil', 'emollient'] },
  'OLIVE OIL': { common: 'oliveOil', tags: ['oil', 'emollient'] },
  'BUTYROSPERMUM PARKII BUTTER': { common: 'sheaButter', tags: ['oil', 'emollient'] },
  'SHEA BUTTER': { common: 'sheaButter', tags: ['oil', 'emollient'] },
  'PARAFFINUM LIQUIDUM': { common: 'mineralOil', tags: ['mineralOil', 'emollient'] },
  'MINERAL OIL': { common: 'mineralOil', tags: ['mineralOil', 'emollient'] },
  PETROLATUM: { common: 'petrolatum', tags: ['mineralOil', 'emollient'] },
  VASELINUM: { common: 'petrolatum', tags: ['mineralOil', 'emollient'] },
  DIMETHICONE: { common: 'silicone', tags: ['silicone'] },
  'CAPRYLIC/CAPRIC TRIGLYCERIDE': { common: 'caprylicTriglyceride', tags: ['oil', 'emollient'] },
  PHENOXYETHANOL: { tags: ['preservative'] },
  'PROPYLENE GLYCOL': { tags: ['humectant', 'solvent'] },
  'BUTYLENE GLYCOL': { tags: ['humectant', 'solvent'] },
  PROPANEDIOL: { tags: ['humectant', 'solvent'] },
  'CETEARYL ALCOHOL': { tags: ['emulsifier', 'emollient'] },
  'CETEARETH-20': { tags: ['emulsifier'] },
  'GLYCERETH-26': { tags: ['emulsifier', 'humectant'] },
  'GLYCERIL STEARATE': { tags: ['emulsifier', 'emollient'] },
  'STEARIC ACID': { tags: ['emollient', 'thickener'] },
  'BEHENYL ALCOHOL': { tags: ['emollient', 'thickener'] },
  CARBOMER: { tags: ['thickener'] },
  'XANTHAN GUM': { tags: ['thickener'] },
  'ACRYLATES/C10-30 ALKYL ACRYLATE CROSSPOLYMER': { tags: ['thickener'] },
  HYDROXYETHYLCELLULOSE: { tags: ['thickener'] },
  'DISODIUM EDTA': { tags: ['chelating'] },
  'TETRASODIUM EDTA': { tags: ['chelating'] },
  'CITRIC ACID': { tags: ['phAdjuster'] },
  'LACTIC ACID': { tags: ['phAdjuster'] },
  'SODIUM HYDROXIDE': { tags: ['phAdjuster'] },
  'SODIUM CITRATE': { tags: ['phAdjuster', 'chelating'] },
  PANTHENOL: { tags: ['humectant'] },
  UREA: { tags: ['humectant'] },
  'SODIUM PCA': { tags: ['humectant'] },
  'ETHYLHEXYLGLYCERIN': { tags: ['humectant', 'preservative'] },
  '1,2-HEXANEDIOL': { tags: ['humectant', 'preservative'] },
  'CAPRYLYL GLYCOL': { tags: ['humectant', 'preservative'] },
  'SODIUM BENZOATE': { tags: ['preservative'] },
  'POTASSIUM SORBATE': { tags: ['preservative'] },
  CHLORPHENESIN: { tags: ['preservative'] },
  'BENZYL ALCOHOL': { tags: ['preservative', 'solvent'] },
  LECITHIN: { tags: ['emulsifier'] },
  'PEG-40 HYDROGENATED CASTOR OIL': { tags: ['emulsifier', 'solvent'] },
  'POLYSORBATE 60': { tags: ['emulsifier', 'surfactant'] },
  'POLYSORBATE 80': { tags: ['emulsifier', 'surfactant'] },
  'TITANIUM DIOXIDE': { tags: ['uvFilter'] },
  'ZINC OXIDE': { tags: ['uvFilter'] },
  SQUALANE: { tags: ['oil', 'emollient'] },
  'DECYL GLUCOSIDE': { tags: ['surfactant'] },
  'SODIUM COCOYL ISETHIONATE': { tags: ['anionicSurfactant'] },
  'COCO-GLUCOSIDE': { tags: ['surfactant'] },
};

/** Knowledge indexed by canonical name (see canonInci). */
const KNOWLEDGE_BY_INCI = new Map<string, InciKnowledge>();
for (const [name, entry] of Object.entries(INCI_KNOWLEDGE)) {
  KNOWLEDGE_BY_INCI.set(canonInci(name), entry);
}

function normalizeInci(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, ' ');
}

/**
 * Canonical form for rule/knowledge lookup: OCR often misreads slashes and
 * hyphens ("AQUA WATER" for AQUA/WATER, "SODIUM-LAURYL-SULFATE" for
 * SODIUM LAURYL SULFATE), so both sides of the comparison fold `/` and `-`
 * into spaces. Display keeps the original spelling.
 */
function canonInci(normalized: string): string {
  return normalized.replace(/[/-]/g, ' ').replace(/\s+/g, ' ');
}

/**
 * Classify an INCI ingredient list. `ingredients` are the raw entries as
 * returned by Open Beauty Facts (already split). Duplicates collapse — an
 * ingredient listed twice is counted once.
 */
export function classifyInci(ingredients: string[]): InciClassification {
  const seen = new Map<string, string>(); // normalized → original spelling
  for (const raw of ingredients) {
    const key = normalizeInci(raw);
    if (key && !seen.has(key)) seen.set(key, raw.trim());
  }

  const counts: Record<InciTier, number> = { concern: 0, caution: 0, good: 0 };
  const classified: InciIngredient[] = [];

  for (const [name, original] of seen) {
    const canonical = canonInci(name);
    const tier: InciTier = TIER_BY_INCI.get(canonical) ?? 'good';
    const knowledge = KNOWLEDGE_BY_INCI.get(canonical);
    counts[tier] += 1;
    classified.push({
      inci: original,
      tier,
      ...(knowledge?.common ? { common: knowledge.common } : {}),
      tags: knowledge?.tags ?? [],
    });
  }

  const total = seen.size;
  // Weighted score: green ingredients count fully, yellow half, red nothing.
  const score =
    total === 0
      ? INCI_SCORE_MAX
      : Math.round(((counts.good + 0.5 * counts.caution) / total) * INCI_SCORE_MAX * 10) / 10;

  return { total, score, counts, ingredients: classified };
}
