/**
 * Cosmetic ingredient (INCI) quality analysis — Yuka-style result.
 *
 * When a scanned product resolves on Open Beauty Facts we get its INCI
 * ingredient list. Every ingredient is classified into one of three tiers:
 *   concern (orange/red) — commonly associated with health concerns
 *   caution (yellow)      — to consider (irritants, hidden allergens, …)
 *   good    (green)       — no known common concern
 *
 * Tiering combines two sources:
 *   1. `INCI_TIER_RULES` — our curated exact-name rules (highest priority).
 *   2. The EU CosIng regulatory index (cosing.ts, optional): Annex II
 *      (prohibited in the EU) lifts an ingredient to *concern*, Annex III
 *      (restricted) to *caution*. CosIng also supplies official function
 *      names, mapped onto the tag chips, so even unknown ingredients get
 *      an informative tag instead of a blank row.
 *
 * Matching is EXACT on normalized INCI names — INCI is an international
 * nomenclature, so "ALCOHOL" flags while "CETEARYL ALCOHOL" (a harmless
 * fatty alcohol) must not.
 *
 * `common` and `tags` are i18n keys under `barcode.quality.common.*` /
 * `barcode.quality.tags.*` — the UI resolves them through the active locale;
 * this module stays pure.
 */

import { COSING_BITS, lookupCosing, type CosingIndex } from '@/lib/cosing';

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

export interface QualitySummary {
  /** Weighted score out of INCI_SCORE_MAX. */
  score: number;
  good: number;
  caution: number;
  concern: number;
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
 * Printed synonyms that must resolve to our canonical rule names (the
 * official CosIng inventory records the INN instead).
 */
const INCI_SYNONYMS: Record<string, string> = {
  'BENZOPHENONE 3': 'OXYBENZONE',
};

/**
 * Official CosIng function name → i18n tag key (keys under
 * `barcode.quality.tags`). Only specific functions are mapped; generic
 * ones ("SKIN CONDITIONING" — half the database) would tag every row with
 * noise, and niche ones are not worth a translation.
 */
const COSING_FUNCTION_TAG: Record<string, string> = {
  HUMECTANT: 'humectant',
  EMOLLIENT: 'emollient',
  SOLVENT: 'solvent',
  ANTIOXIDANT: 'antioxidant',
  SURFACTANT: 'surfactant',
  CLEANSING: 'surfactant',
  FOAMING: 'surfactant',
  'FOAM BOOSTING': 'surfactant',
  EMULSIFYING: 'emulsifier',
  'EMULSION STABILISING': 'emulsifier',
  'VISCOSITY CONTROLLING': 'thickener',
  THICKENING: 'thickener',
  PRESERVATIVE: 'preservative',
  PERFUMING: 'fragrance',
  FRAGRANCE: 'fragrance',
  'UV ABSORBER': 'uvFilter',
  'UV FILTER': 'uvFilter',
  'PH ADJUSTING': 'phAdjuster',
  CHELATING: 'chelating',
  ANTIMICROBIAL: 'antimicrobial',
  ASTRINGENT: 'astringent',
  OPACIFYING: 'opacifier',
  'FILM FORMING': 'filmFormer',
  'COSMETIC COLORANT': 'colorant',
  'HAIR DYEING': 'colorant',
};

/** Maximum tag chips per ingredient row (keeps the list readable). */
const MAX_TAGS_PER_ROW = 3;

function cosingTagsFor(bits: number, functions: string[]): string[] {
  const tags: string[] = [];
  if (bits & COSING_BITS.BANNED) tags.push('bannedInEu');
  if (bits & COSING_BITS.RESTRICTED) tags.push('restrictedInEu');
  if (bits & COSING_BITS.PRESERVATIVE) tags.push('preservative');
  if (bits & COSING_BITS.UV_FILTER) tags.push('uvFilter');
  if (bits & COSING_BITS.COLORANT) tags.push('colorant');
  for (const fn of functions) {
    const tag = COSING_FUNCTION_TAG[fn];
    if (tag) tags.push(tag);
  }
  return tags;
}

/**
 * Classify an INCI ingredient list. `ingredients` are the raw entries as
 * returned by Open Beauty Facts (already split) or read from a packaging
 * photo. Duplicates collapse — an ingredient listed twice is counted
 * once. Pass the EU CosIng index when available: it lifts Annex II
 * (prohibited) ingredients to concern, Annex III (restricted) to caution,
 * and tags rows with official functions — curated rules always win.
 */
export function classifyInci(
  ingredients: string[],
  cosing?: CosingIndex | null,
): InciClassification {
  const seen = new Map<string, string>(); // normalized → original spelling
  for (const raw of ingredients) {
    const key = normalizeInci(raw);
    if (key && !seen.has(key)) seen.set(key, raw.trim());
  }

  const counts: Record<InciTier, number> = { concern: 0, caution: 0, good: 0 };
  const classified: InciIngredient[] = [];

  for (const [name, original] of seen) {
    const rawCanonical = canonInci(name);
    const canonical = INCI_SYNONYMS[rawCanonical] ?? rawCanonical;
    let tier: InciTier = TIER_BY_INCI.get(canonical) ?? 'good';
    const knowledge = KNOWLEDGE_BY_INCI.get(canonical);
    // Curated tags first, then CosIng annex/function tags (deduped, capped).
    const tags = new Set<string>(knowledge?.tags ?? []);
    const hit = cosing ? lookupCosing(cosing, name) : undefined;
    if (hit) {
      if (hit.bits & COSING_BITS.BANNED && tier === 'good') tier = 'concern';
      else if (hit.bits & COSING_BITS.RESTRICTED && tier === 'good') tier = 'caution';
      for (const tag of cosingTagsFor(hit.bits, hit.functions)) tags.add(tag);
    }
    counts[tier] += 1;
    classified.push({
      inci: original,
      tier,
      ...(knowledge?.common ? { common: knowledge.common } : {}),
      tags: [...tags].slice(0, MAX_TAGS_PER_ROW),
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

/**
 * Compact quality summary (score + tier counts) — small enough to persist on
 * a course line so the score can be shown without re-classifying.
 */
export function summarizeQuality(
  ingredients: string[],
  cosing?: CosingIndex | null,
): QualitySummary {
  const result = classifyInci(ingredients, cosing);
  return {
    score: result.score,
    good: result.counts.good,
    caution: result.counts.caution,
    concern: result.counts.concern,
  };
}
