/**
 * INCI token normalization + label-list parsing.
 *
 * Label text is messy: mixed case, "(common name)" annotations, "C.I. 77491"
 * colour-index spellings, brand headings above the list. Everything is reduced
 * to a canonical uppercase key before matching against the CosIng dataset and
 * the EU overlay — the same key is used for both sides so aliases stay
 * centralized here.
 */

/** NFKC-fold, uppercase, collapse every non-alphanumeric run to a space. */
export function normalizeInciToken(raw: string): string {
  let s = String(raw ?? '').normalize('NFKC').toUpperCase();
  // First collapse punctuation: "C.I. 77491" → "C I 77491".
  s = s.replace(/[^A-Z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
  // Then merge the colour-index spelling: "C I 77491" → "CI 77491" (CosIng
  // stores "CI 77491"). Only merges when a space separates C and I.
  s = s.replace(/\bC I(?=\s*\d)/g, 'CI');
  return s;
}

/** Remove balanced parenthetical groups entirely, then normalize. */
export function normalizeWithoutParens(raw: string): string {
  let s = String(raw ?? '');
  let depth = 0;
  let out = '';
  for (const ch of s) {
    if (ch === '(' || ch === '[' || ch === '{') {
      depth += 1;
      continue;
    }
    if (ch === ')' || ch === ']' || ch === '}') {
      depth = Math.max(0, depth - 1);
      continue;
    }
    if (depth === 0) out += ch;
  }
  return normalizeInciToken(out);
}

/**
 * Label spellings → canonical normalized INCI keys. Used when a label uses the
 * common name instead of the INCI name (or when both appear with/without the
 * parenthetical annotation).
 */
export const INCI_ALIASES: Readonly<Record<string, string>> = {
  WATER: 'AQUA',
  FRAGRANCE: 'PARFUM',
  PERFUME: 'PARFUM',
  AROMA: 'PARFUM',
  FLAVOUR: 'PARFUM',
  'COCONUT OIL': 'COCOS NUCIFERA OIL',
  'SHEA BUTTER': 'BUTYROSPERMUM PARKII BUTTER',
  'COCOA BUTTER': 'THEOBROMA CACAO SEED BUTTER',
  'ARGAN OIL': 'ARGANIA SPINOSA KERNEL OIL',
  'JOJOBA OIL': 'SIMMONDSIA CHINENSIS SEED OIL',
  'JOJOBA BUTTER': 'SIMMONDSIA CHINENSIS SEED OIL',
  'ALMOND OIL': 'PRUNUS AMYGDALUS DULCIS OIL',
  'SWEET ALMOND OIL': 'PRUNUS AMYGDALUS DULCIS OIL',
  'SUNFLOWER OIL': 'HELIANTHUS ANNUUS SEED OIL',
  'OLIVE OIL': 'OLEA EUROPAEA FRUIT OIL',
  'CASTOR OIL': 'RICINUS COMMUNIS SEED OIL',
  'AVOCADO OIL': 'PERSEA GRATISSIMA OIL',
  'ROSEHIP OIL': 'ROSA CANINA FRUIT OIL',
  'VITAMIN E': 'TOCOPHEROL',
  'VITAMIN C': 'ASCORBIC ACID',
  'VITAMIN B3': 'NIACINAMIDE',
  'VITAMIN B5': 'PANTHENOL',
  'VITAMIN A': 'RETINOL',
  'METHYL PARABEN': 'METHYLPARABEN',
  'ETHYL PARABEN': 'ETHYLPARABEN',
  'PROPYL PARABEN': 'PROPYLPARABEN',
  'BUTYL PARABEN': 'BUTYLPARABEN',
  'SODIUM LAURETH SULFATE': 'SODIUM LAURETH SULFATE',
};

export function resolveAlias(normalized: string): string | undefined {
  return INCI_ALIASES[normalized];
}

/**
 * Split a full label INCI text into single-ingredient tokens.
 *
 * Handles: leading "INGREDIENTS:" headings, bullets/numbering, CRLF, and
 * parentheses that may themselves contain commas (multi-name INCI) — commas
 * inside parentheses are not treated as separators.
 */
export function splitInciList(text: string): string[] {
  if (!text) return [];
  let s = String(text).replace(/\r\n?/g, '\n');
  // Strip a leading "INGREDIENTS : / INCI / COMPOSITION :" heading once.
  s = s.replace(/^\s*(?:INGREDIENTS?|INGR[ÉE]DIENTS?|INCI|COMPOSITION|LIST(?:E)?|CONTAINS?)\s*[:.\-]\s*/i, '');
  // Bullets / numbering at the start of each line.
  s = s
    .split('\n')
    .map((line) => line.replace(/^\s*(?:[-*•·]|\d+[.)])\s*/, ''))
    .join('\n');

  const tokens: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of s) {
    if (ch === '(' || ch === '[' || ch === '{') depth += 1;
    else if (ch === ')' || ch === ']' || ch === '}') depth = Math.max(0, depth - 1);
    if ((ch === ',' || ch === ';' || ch === '\n') && depth === 0) {
      const t = cleanToken(current);
      if (t) tokens.push(t);
      current = '';
    } else {
      current += ch;
    }
  }
  const last = cleanToken(current);
  if (last) tokens.push(last);
  return tokens;
}

function cleanToken(raw: string): string | undefined {
  let t = String(raw ?? '').trim().replace(/[.]+$/, '').trim();
  if (!t) return undefined;
  // Footnote markers / trailing stray punctuation that normalize away fully.
  const normalized = normalizeInciToken(t);
  if (!normalized) return undefined;
  // Pure numbers, percentages, or "and/or" residues are not ingredients.
  if (!/[A-Z]{2,}/.test(normalized)) return undefined;
  return t;
}
