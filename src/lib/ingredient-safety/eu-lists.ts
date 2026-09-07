/**
 * Curated EU regulatory overlay (versioned in code, refreshed by hand).
 *
 * Why this file exists: the committed CosIng inventory snapshot is from
 * 2019-03-13, so bans/restrictions adopted since (Lilial, HICC, retinol caps,
 * the 2023/1545 fragrance-allergen additions, …) are NOT visible in the raw
 * data. This overlay carries those newer rules plus label-pattern signals
 * (generic "Parfum", drying alcohols, sulfate surfactants, historical
 * comedogenicity ratings) that no regulatory column expresses directly.
 *
 * Fidelity notes
 * - Fragrance-allergen lists follow the consolidated Annex III of Regulation
 *   (EC) No 1223/2009: the 26 substances from Directive 2003/15/EC and the
 *   additional substances of Regulation (EU) 2023/1545 (labeling obligations
 *   apply to new products from 2026-07-31; existing stock until 2028-07-31).
 *   Natural-extract entries vary in how brands spell them (e.g. "… Leaf Oil"
 *   vs "… Oil"); explicit aliases cover the most common variants, unmatched
 *   spellings simply stay unrecognized (coverage drops — never a false flag).
 * - Comedogenicity entries are HISTORICAL rabbit-ear ratings (Fulton 1984)
 *   with well-documented limits (Draelos & DiNardo 2006): they only produce a
 *   mild "watch" flag in leave-on products, never a strong verdict.
 * - This is informational, not a medical or legal opinion. See
 *   docs/COSMETIC_INGREDIENT_SCORING.md for methodology + refresh procedure.
 */

import type { RiskTier, Signal } from './types';
import { normalizeInciToken } from './normalize';

interface OverlaySeed {
  names: string[];
  /** Extra normalized spellings for the same substance (leaf/part variants). */
  aliases?: string[];
  code: string;
  label: string;
  detail?: string;
  tier: Exclude<RiskTier, 'clean'>;
  leaveOnOnly?: boolean;
  evidence: string[];
}

export interface OverlayMatch {
  signal: Signal;
  /** Normalized key that triggered the match (for diagnostics). */
  key: string;
}

const seeds: OverlaySeed[] = [];

function overlay(
  seed: Omit<OverlaySeed, 'names'> & { names: OverlaySeed['names'] },
): void {
  seeds.push(seed);
}

function buildIndex(): Map<string, OverlayMatch[]> {
  const index = new Map<string, OverlayMatch[]>();
  for (const seed of seeds) {
    const signal: Signal = {
      code: seed.code,
      tier: seed.tier,
      label: seed.label,
      detail: seed.detail,
      leaveOnOnly: seed.leaveOnOnly,
      evidence: seed.evidence,
    };
    const keys = new Set<string>();
    for (const name of [...seed.names, ...(seed.aliases ?? [])]) {
      const key = normalizeInciToken(name);
      if (key) keys.add(key);
    }
    for (const key of keys) {
      const list = index.get(key) ?? [];
      list.push({ signal, key });
      index.set(key, list);
    }
  }
  return index;
}

// ---------------------------------------------------------------------------
// EU-prohibited (Annex II of Reg (EC) No 1223/2009, incl. post-2019 additions)
// ---------------------------------------------------------------------------
const EU_ANNEX_II: string[] = [
  'Reg (EC) No 1223/2009 Annex II (consolidated)',
  'EUR-Lex: 02009R1223-2025xxxx (cosmetics regulation, consolidated annexes)',
];

overlay({
  names: ['Butylphenyl Methylpropional', 'Lilial'],
  code: 'eu-prohibited',
  label: 'Prohibited in EU cosmetics',
  detail:
    'Banned from EU cosmetics since 1 March 2022 (Annex II). Often labelled "Lilial" or "BMHCA".',
  tier: 'prohibited',
  evidence: ['Reg (EU) 2021/1902 — Annex II entry 2245'],
});

overlay({
  names: ['Hydroxyisohexyl 3-Cyclohexene Carboxaldehyde'],
  aliases: ['HICC', 'Lyral'],
  code: 'eu-prohibited',
  label: 'Prohibited in EU cosmetics',
  detail: 'Fragrance allergen (Lyral) banned from EU cosmetics since 23 August 2021 (Annex II).',
  tier: 'prohibited',
  evidence: ['Reg (EU) 2020/1682 — Annex II'],
});

overlay({
  names: ['Atranol', 'Chloroatranol'],
  code: 'eu-prohibited',
  label: 'Prohibited in EU cosmetics',
  detail: 'Oak/treemoss constituents (atranol, chloroatranol) banned from EU cosmetics.',
  tier: 'prohibited',
  evidence: EU_ANNEX_II,
});

overlay({
  names: ['Triclosan', 'Triclocarban'],
  code: 'eu-prohibited',
  label: 'Prohibited in EU cosmetics',
  detail: 'No longer permitted in cosmetic products in the EU.',
  tier: 'prohibited',
  evidence: ['Reg (EU) No 358/2014 — removal from Annex V / Annex II'],
});

overlay({
  names: [
    'Isopropylparaben',
    'Isobutylparaben',
    'Phenylparaben',
    'Benzylparaben',
    'Pentylparaben',
  ],
  code: 'eu-prohibited',
  label: 'Prohibited in EU cosmetics',
  detail: 'Long-chain parabens banned from EU cosmetics (Annex II).',
  tier: 'prohibited',
  evidence: ['Reg (EU) No 1004/2014 — Annex II'],
});

overlay({
  names: [
    'Dibutyl Phthalate',
    'Diethylhexyl Phthalate',
    'Benzyl Butyl Phthalate',
    'Diisobutyl Phthalate',
    'Diisononyl Phthalate',
  ],
  code: 'eu-prohibited',
  label: 'Prohibited in EU cosmetics',
  detail: 'Phthalates are banned from EU cosmetics (Annex II).',
  tier: 'prohibited',
  evidence: EU_ANNEX_II,
});

overlay({
  names: ['Bithionol', 'Chloroform', 'Vinyl Chloride'],
  code: 'eu-prohibited',
  label: 'Prohibited in EU cosmetics',
  detail: 'Substance banned from EU cosmetics (Annex II).',
  tier: 'prohibited',
  evidence: EU_ANNEX_II,
});

// ---------------------------------------------------------------------------
// EU-restricted (Annex III / Annex V entries with use conditions)
// ---------------------------------------------------------------------------
overlay({
  names: ['Methylisothiazolinone'],
  aliases: ['MIT'],
  code: 'eu-restricted',
  label: 'EU-restricted preservative',
  detail:
    'Not permitted in leave-on products; rinse-off only up to 0.0015% (EU Annex V/57). Flagged when the product is leave-on or unknown.',
  tier: 'restricted',
  evidence: ['Reg (EC) No 1223/2009 Annex V entry 57'],
});

overlay({
  names: ['Methylchloroisothiazolinone'],
  aliases: ['5-Chloro-2-methyl-4-isothiazolin-3-one', 'MCI', 'Kathon CG'],
  code: 'eu-restricted',
  label: 'EU-restricted preservative',
  detail:
    'MCI/MIT mixture: rinse-off only, up to 0.0015% (EU Annex V/39). Leave-on use not permitted.',
  tier: 'restricted',
  evidence: ['Reg (EC) No 1223/2009 Annex V entry 39'],
});

overlay({
  names: ['Retinol', 'Retinyl Acetate', 'Retinyl Palmitate'],
  aliases: ['Vitamin A', 'Retinyl Acetat'],
  code: 'eu-restricted',
  label: 'EU-restricted (leave-on concentration caps)',
  detail:
    'Retinol/retinyl esters are restricted in leave-on products (Annex III as amended by Reg (EU) 2024/996 — applies from 1 Nov 2025).',
  tier: 'restricted',
  evidence: ['Reg (EU) 2024/996 — Annex III (vitamin A)'],
});

// ---------------------------------------------------------------------------
// Formaldehyde releasers (Annex V allowed at low caps; SCCS-reviewed)
// ---------------------------------------------------------------------------
const FORMALDEHYDE_RELEASER = {
  code: 'formaldehyde-releaser',
  label: 'Formaldehyde releaser',
  tier: 'caution' as const,
  evidence: ['Reg (EC) No 1223/2009 Annex V', 'SCCS opinions on formaldehyde releasers'],
};
overlay({
  names: ['DMDM Hydantoin', 'Diazolidinyl Urea', 'Imidazolidinyl Urea', 'Quaternium-15'],
  code: FORMALDEHYDE_RELEASER.code,
  label: FORMALDEHYDE_RELEASER.label,
  detail:
    'Preservatives that can release traces of formaldehyde over time; EU caps their concentrations and some are banned in aerosols. Relevant mainly for sensitive skin.',
  tier: FORMALDEHYDE_RELEASER.tier,
  evidence: FORMALDEHYDE_RELEASER.evidence,
});
overlay({
  names: ['2-Bromo-2-nitropropane-1,3-diol'],
  aliases: ['Bronopol'],
  code: FORMALDEHYDE_RELEASER.code,
  label: FORMALDEHYDE_RELEASER.label,
  detail:
    'Formaldehyde releaser; nitrosamine formation possible with amines. EU-restricted (rinse-off, max 0.1%).',
  tier: FORMALDEHYDE_RELEASER.tier,
  evidence: FORMALDEHYDE_RELEASER.evidence,
});

// ---------------------------------------------------------------------------
// Generic fragrance / parfum
// ---------------------------------------------------------------------------
overlay({
  names: ['Parfum', 'Fragrance', 'Perfume', 'Aroma'],
  aliases: ['Fragrance (Parfum)', 'Parfum (Fragrance)'],
  code: 'fragrance-generic',
  label: 'Fragrance (composition not declared)',
  detail:
    '"Parfum" is an umbrella term: the individual fragrance substances do not have to be listed, only EU-declarable allergens. Common trigger for sensitive/contact-allergic skin; not itself a hazard verdict.',
  tier: 'caution',
  evidence: ['Reg (EC) No 1223/2009 art. 19(1)(g) labelling', 'contact-dermatitis literature'],
});

// ---------------------------------------------------------------------------
// Drying alcohols — mainly a leave-on / high-in-list concern
// ---------------------------------------------------------------------------
overlay({
  names: ['Alcohol Denat.', 'Alcohol', 'Isopropyl Alcohol', 'SD Alcohol 40', 'SD Alcohol 40-B'],
  aliases: ['Ethanol', 'Ethyl Alcohol', 'Denatured Alcohol', 'SD Alcohol 40B'],
  code: 'drying-alcohol',
  label: 'Drying / stinging potential',
  detail:
    'Fast-evaporating alcohol can dry or sting, mainly for leave-on products and sensitive skin, and mostly when high on the list. EU-allowed; tolerance varies widely.',
  tier: 'watch',
  leaveOnOnly: true,
  evidence: ['consensus irritancy (clinical convention)'],
});

// ---------------------------------------------------------------------------
// Sulfate surfactants — mainly a leave-on concern
// ---------------------------------------------------------------------------
overlay({
  names: [
    'Sodium Lauryl Sulfate',
    'Sodium Laureth Sulfate',
    'Ammonium Lauryl Sulfate',
    'Ammonium Laureth Sulfate',
  ],
  aliases: ['SLS', 'SLES'],
  code: 'sulfate-surfactant',
  label: 'Strong anionic surfactant',
  detail:
    'Efficient cleansers that can be drying/irritating at high concentration; EU-allowed. Mainly relevant for leave-on products or very high list positions.',
  tier: 'watch',
  leaveOnOnly: true,
  evidence: ['consensus irritancy (clinical convention)'],
});

// ---------------------------------------------------------------------------
// Historical comedogenicity ratings — watch-level only, leave-on only
// ---------------------------------------------------------------------------
function comedogenic(names: string[], rating: number): void {
  overlay({
    names,
    code: 'comedogenic-history',
    label: `Historically rated comedogenic (${rating}/5)`,
    detail:
      `Classic rabbit-ear comedogenicity rating of ${rating}/5 (Fulton). Published limits of the method ` +
      '(dilution, formulation, human variation — Draelos & DiNardo 2006) mean this is a mild watch flag for acne-prone / leave-on use, not a verdict.',
    tier: 'watch',
    leaveOnOnly: true,
    evidence: ['Fulton et al. 1984 rabbit-ear assay', 'Draelos & DiNardo 2006 (context)'],
  });
}
comedogenic(['Isopropyl Myristate'], 5);
comedogenic(['Isopropyl Palmitate'], 4);
comedogenic(['Isopropyl Isostearate'], 4);
comedogenic(['Myristyl Myristate'], 5);
comedogenic(['Cocos Nucifera Oil'], 4);
comedogenic(['Theobroma Cacao Seed Butter'], 4);
comedogenic(['Triticum Vulgare Germ Oil'], 5);
comedogenic(['Laureth-4'], 5);

// ---------------------------------------------------------------------------
// Fragrance allergens — the two EU labelling generations
// ---------------------------------------------------------------------------
const ALLERGEN_EVIDENCE_2003 = [
  'Reg (EC) No 1223/2009 Annex III — fragrance allergens (from Directive 2003/15/EC)',
];
const ALLERGEN_EVIDENCE_2023 = [
  'Reg (EU) 2023/1545 — Annex III fragrance allergens (labelling from 2026-07-31 for new products)',
];

function allergens(list: string[], evidence: string[], generation: string): void {
  for (const name of list) {
    overlay({
      names: [name],
      code: 'eu-fragrance-allergen',
      label: 'EU-declarable fragrance allergen',
      detail:
        `Declarable fragrance allergen (${generation}). Contact allergen — significance depends on ` +
        'individual sensitivity; EU requires individual declaration above 0.001% leave-on / 0.01% rinse-off.',
      tier: 'caution',
      evidence,
    });
  }
}

const ALLERGENS_2003 = [
  'Amyl Cinnamal',
  'Amylcinnamyl Alcohol',
  'Anise Alcohol',
  'Benzyl Alcohol',
  'Benzyl Benzoate',
  'Benzyl Cinnamate',
  'Benzyl Salicylate',
  'Cinnamal',
  'Cinnamyl Alcohol',
  'Citral',
  'Citronellol',
  'Coumarin',
  'Eugenol',
  'Evernia Prunastri Extract', // oak moss
  'Evernia Furfuracea Extract', // tree moss
  'Farnesol',
  'Geraniol',
  'Hexyl Cinnamal',
  'Hydroxycitronellal',
  'Hydroxyisohexyl 3-Cyclohexene Carboxaldehyde', // HICC — banned, handled above
  'Isoeugenol',
  'Limonene',
  'Linalool',
  'Methyl 2-Octynoate',
  'Methyl Heptine Carbonate',
  'Alpha-Isomethyl Ionone',
];
allergens(ALLERGENS_2003, ALLERGEN_EVIDENCE_2003, '2003/15/EC list');

// Regulation (EU) 2023/1545 additions (substances + natural extracts).
const ALLERGENS_2023 = [
  'Pinus Mugo',
  'Pinus Pumila',
  'Cedrus Atlantica Oil',
  'Cedrus Atlantica Extract',
  'Turpentine',
  'Alpha-Terpinene',
  'Terpinolene',
  'Myroxylon Pereirae Oil',
  'Rose Ketones',
  '3-Propylidenephthalide',
  'Lippia Citriodora Absolute',
  'Methyl Salicylate',
  'Acetyl Cedrene',
  'Amyl Salicylate',
  'Anethole',
  'Benzaldehyde',
  'Camphor',
  'Beta-Caryophyllene',
  'Carvone',
  'Dimethyl Phenethyl Acetate',
  'Hexadecanolactone',
  'Hexamethylindanopyran',
  'Linalyl Acetate',
  'Menthol',
  'Trimethylcyclopentenyl Methylisopentenol',
  'Salicylaldehyde',
  'Santalol',
  'Sclareol',
  'Terpineol',
  'Tetramethyl Acetyloctahydronaphthalenes',
  'Trimethylbenzenepropanol',
  'Vanillin',
  'Cananga Odorata Oil',
  'Cinnamomum Cassia Leaf Oil',
  'Cinnamomum Zeylanicum Bark Oil',
  'Citrus Aurantium Flower Oil',
  'Citrus Aurantium Peel Oil',
  'Citrus Aurantium Bergamia Peel Oil',
  'Citrus Limon Peel Oil',
  'Cymbopogon Schoenanthus Oil',
  'Eucalyptus Globulus Oil',
  'Eugenia Caryophyllus Oil',
  'Jasminum Officinale Oil',
  'Juniperus Virginiana Oil',
  'Laurus Nobilis Leaf Oil',
  'Lavandula Angustifolia Oil',
  'Mentha Piperita Oil',
  'Mentha Viridis Leaf Oil',
  'Narcissus Extract',
  'Pelargonium Graveolens Flower Oil',
  'Pogostemon Cablin Oil',
  'Rosa Damascena Flower Oil',
  'Santalum Album Oil',
  'Eugenyl Acetate',
  'Geranyl Acetate',
  'Isoeugenyl Acetate',
  'Pinene',
];
// Explicit variants for the extracts whose labels usually include plant parts.
const ALLERGEN_2023_ALIASES: Record<string, string[]> = {
  'Cedrus Atlantica Oil': ['Cedrus Atlantica Bark Oil', 'Cedrus Atlantica Wood Oil'],
  'Cananga Odorata Oil': ['Cananga Odorata Flower Oil', 'Ylang Ylang Oil'],
  'Eucalyptus Globulus Oil': ['Eucalyptus Globulus Leaf Oil'],
  'Eugenia Caryophyllus Oil': ['Eugenia Caryophyllus Flower Oil', 'Eugenia Caryophyllus Leaf Oil', 'Clove Oil'],
  'Jasminum Officinale Oil': ['Jasmine Oil', 'Jasminum Officinale Extract'],
  'Lavandula Angustifolia Oil': ['Lavandula Oil', 'Lavender Oil', 'Lavandula Angustifolia Flower Oil'],
  'Mentha Piperita Oil': ['Peppermint Oil', 'Mentha Piperita Leaf Oil'],
  'Mentha Viridis Leaf Oil': ['Spearmint Oil'],
  'Pelargonium Graveolens Flower Oil': ['Pelargonium Graveolens Oil'],
  'Rosa Damascena Flower Oil': ['Rose Flower Oil', 'Rosa Damascena Oil'],
  'Laurus Nobilis Leaf Oil': ['Laurus Nobilis Oil', 'Bay Laurel Oil'],
  'Cinnamomum Zeylanicum Bark Oil': ['Cinnamomum Zeylanicum Oil', 'Cinnamon Bark Oil'],
  'Cinnamomum Cassia Leaf Oil': ['Cinnamomum Cassia Oil', 'Cassia Oil'],
  'Citrus Aurantium Bergamia Peel Oil': ['Citrus Aurantium Bergamia Oil', 'Bergamot Oil'],
  'Citrus Limon Peel Oil': ['Citrus Limon Oil', 'Lemon Peel Oil', 'Lemon Oil'],
  'Cymbopogon Schoenanthus Oil': ['Cymbopogon Citratus Oil', 'Lemongrass Oil'],
  'Narcissus Extract': ['Narcissus Poeticus Extract'],
  'Methyl Salicylate': ['Wintergreen Oil'],
};
for (const name of ALLERGENS_2023) {
  overlay({
    names: [name],
    aliases: ALLERGEN_2023_ALIASES[name],
    code: 'eu-fragrance-allergen',
    label: 'EU-declarable fragrance allergen',
    detail:
      'Declarable fragrance allergen (Reg (EU) 2023/1545). Contact allergen — significance depends on ' +
      'individual sensitivity; EU requires individual declaration above 0.001% leave-on / 0.01% rinse-off.',
    tier: 'caution',
    evidence: ALLERGEN_EVIDENCE_2023,
  });
}

// ---------------------------------------------------------------------------

const OVERLAY_INDEX: Map<string, OverlayMatch[]> = buildIndex();

/**
 * Return every overlay signal attached to a normalized ingredient key.
 * Several signals can match one name (e.g. an allergen that is also a
 * preservative) — the caller combines tiers and dedupes.
 */
export function lookupOverlay(normalized: string): OverlayMatch[] {
  return OVERLAY_INDEX.get(normalized) ?? [];
}

/** Count of overlay signals loaded (exposed for tests/diagnostics). */
export function overlaySignalCount(): number {
  return OVERLAY_INDEX.size;
}
