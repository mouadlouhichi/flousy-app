/**
 * Cosmetic ingredient (INCI) quality analysis.
 *
 * When a scanned product resolves on Open Beauty Facts we get its INCI
 * ingredient list. This module flags entries that are commonly associated
 * with consumer health concerns, using EXACT matches against normalized INCI
 * names — INCI is an international nomenclature, so "ALCOHOL" must flag while
 * "CETEARYL ALCOHOL" (a harmless fatty alcohol) must not.
 *
 * The flag labels are i18n keys under `barcode.quality.flags.*` — the UI
 * resolves them through the active locale, this module stays pure.
 */

export type InciFlagSeverity = 'high' | 'medium';

export interface InciFlagRule {
  /** i18n key under `barcode.quality.flags`. */
  key: string;
  severity: InciFlagSeverity;
  /** INCI names (uppercase, space-collapsed) that trigger this rule. */
  inci: string[];
}

export interface InciFlag {
  /** The INCI name as written in the list. */
  inci: string;
  /** i18n key under `barcode.quality.flags`. */
  key: string;
  severity: InciFlagSeverity;
}

export interface InciQuality {
  total: number;
  /** 'concern' = at least one high-severity flag, 'caution' = medium only. */
  status: 'clean' | 'caution' | 'concern';
  flags: InciFlag[];
}

export const INCI_FLAG_RULES: InciFlagRule[] = [
  // ── High severity ──
  {
    key: 'formaldehyde',
    severity: 'high',
    inci: ['FORMALDEHYDE'],
  },
  {
    key: 'hydroquinone',
    severity: 'high',
    inci: ['HYDROQUINONE'],
  },
  {
    key: 'mit',
    severity: 'high',
    inci: ['METHYLISOTHIAZOLINONE', 'METHYLCHLOROISOTHIAZOLINONE'],
  },
  {
    key: 'resorcinol',
    severity: 'high',
    inci: ['RESORCINOL'],
  },
  {
    key: 'uvFilter',
    severity: 'high',
    inci: ['OXYBENZONE', 'OCTOCRYLENE'],
  },
  {
    key: 'talc',
    severity: 'high',
    inci: ['TALC'],
  },
  // ── Medium severity ──
  {
    key: 'paraben',
    severity: 'medium',
    inci: [
      'METHYLPARABEN',
      'ETHYLPARABEN',
      'PROPYLPARABEN',
      'BUTYLPARABEN',
      'ISOPROPYLPARABEN',
      'ISOBUTYLPARABEN',
    ],
  },
  {
    key: 'sulfate',
    severity: 'medium',
    inci: ['SODIUM LAURYL SULFATE', 'SODIUM LAURETH SULFATE'],
  },
  {
    key: 'alcohol',
    severity: 'medium',
    inci: [
      'ALCOHOL',
      'ALCOHOL DENAT.',
      'ETHYL ALCOHOL',
      'SD ALCOHOL 4',
      'SD ALCOHOL 8',
      'SD ALCOHOL 9',
      'SD ALCOHOL 40',
    ],
  },
  {
    key: 'fragrance',
    severity: 'medium',
    inci: ['PARFUM', 'FRAGRANCE'],
  },
  {
    key: 'fragranceAllergen',
    severity: 'medium',
    inci: ['LIMONENE', 'LINALOOL', 'CITRONELLOL', 'GERANIOL', 'CITRAL'],
  },
];

function normalizeInci(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, ' ');
}

/**
 * Analyze an INCI ingredient list. `ingredients` are the raw entries as
 * returned by Open Beauty Facts (already split). Duplicates are collapsed —
 * an ingredient flagged twice is still one ingredient.
 */
export function analyzeInci(ingredients: string[]): InciQuality {
  const normalized = new Map<string, string>(); // normalized → original spelling
  for (const raw of ingredients) {
    const key = normalizeInci(raw);
    if (key && !normalized.has(key)) normalized.set(key, raw.trim());
  }

  const ruleByInci = new Map<string, InciFlagRule>();
  for (const rule of INCI_FLAG_RULES) {
    for (const name of rule.inci) ruleByInci.set(name, rule);
  }

  const flags: InciFlag[] = [];
  for (const [name, original] of normalized) {
    const rule = ruleByInci.get(name);
    if (rule) flags.push({ inci: original, key: rule.key, severity: rule.severity });
  }

  const status: InciQuality['status'] = flags.some((f) => f.severity === 'high')
    ? 'concern'
    : flags.length > 0
      ? 'caution'
      : 'clean';

  return { total: normalized.size, status, flags };
}

/**
 * Group the flat flag list by rule key (display order = rule priority).
 * Returns at most one entry per rule, in INCI_FLAG_RULES order.
 */
export function groupInciFlags(flags: InciFlag[]): Array<{ key: string; severity: InciFlagSeverity; incis: string[] }> {
  const byKey = new Map<string, InciFlag[]>();
  for (const flag of flags) {
    const list = byKey.get(flag.key);
    if (list) list.push(flag);
    else byKey.set(flag.key, [flag]);
  }
  return INCI_FLAG_RULES.filter((rule) => byKey.has(rule.key)).map((rule) => ({
    key: rule.key,
    severity: rule.severity,
    incis: byKey.get(rule.key)!.map((f) => f.inci),
  }));
}
