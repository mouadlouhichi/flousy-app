/** Unicode-safe ingredient normalization and diagnostic parser. */

import type { ParserDiagnostic } from './types';

const OPEN_TO_CLOSE: Readonly<Record<string, string>> = { '(': ')', '[': ']', '{': '}' };
const CLOSE_TO_OPEN: Readonly<Record<string, string>> = { ')': '(', ']': '[', '}': '{' };

/** Convert decimal digits used by common localized keyboards to ASCII. */
export function normalizeDecimalDigits(raw: string): string {
  return String(raw ?? '').replace(/[٠-٩۰-۹०-९]/gu, (digit) => {
    const cp = digit.codePointAt(0) ?? 0;
    if (cp >= 0x0660 && cp <= 0x0669) return String(cp - 0x0660);
    if (cp >= 0x06f0 && cp <= 0x06f9) return String(cp - 0x06f0);
    if (cp >= 0x0966 && cp <= 0x096f) return String(cp - 0x0966);
    return digit;
  });
}

/**
 * Canonical identity key. It preserves letters from every script, folds
 * compatibility forms/diacritics, normalizes localized digits, and collapses
 * punctuation. Arabic aliases therefore remain matchable instead of being
 * reduced to an empty string.
 */
export function normalizeInciToken(raw: string): string {
  let s = normalizeDecimalDigits(String(raw ?? ''))
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .toUpperCase();
  s = s.replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');
  s = s.replace(/\bC I(?=\s*\d)/gu, 'CI');
  return s;
}

const LABEL_KEEP = /[^\p{L}\p{M}\p{N}\s,;،؛:()\[\]{}%°+./&'’!?=\-–—]/gu;

export interface SanitizeResult {
  text: string;
  diagnostics: ParserDiagnostic[];
}

export function sanitizeLabelTextDetailed(raw: string): SanitizeResult {
  // Fold compatibility-width forms before allowlisting so full-width Latin
  // text and punctuation (for example `Aqua，Glycerin；Linalool`) retain their
  // separator semantics instead of being silently replaced with spaces.
  const input = String(raw ?? '')
    // Remove branding marks before NFKC; otherwise ™ expands to the letters
    // “TM” and becomes a phantom part of the preceding ingredient.
    .replace(/[©®™℠]/gu, ' ')
    .normalize('NFKC');
  const diagnostics: ParserDiagnostic[] = [];
  let removed = 0;
  const text = input
    .replace(LABEL_KEEP, (match, offset: number) => {
      removed += [...match].length;
      if (/\p{L}|\p{N}/u.test(match)) {
        diagnostics.push({
          code: 'alphabetic-span-removed',
          severity: 'error',
          message: 'The parser removed a letter or number span.',
          offset,
          length: match.length,
        });
      }
      return ' ';
    })
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
  if (removed > 0 && !diagnostics.some((d) => d.code === 'alphabetic-span-removed')) {
    diagnostics.push({
      code: 'unsupported-characters-removed',
      severity: 'info',
      message: `${removed} unsupported label character${removed === 1 ? '' : 's'} removed.`,
    });
  }
  return { text, diagnostics };
}

export function sanitizeLabelText(raw: string): string {
  return sanitizeLabelTextDetailed(raw).text;
}

/** Remove only balanced parenthetical groups. Unmatched openers never hide the
 * suffix; they are retained and normalized with the rest of the name. */
export function normalizeWithoutParens(raw: string): string {
  const source = String(raw ?? '');
  const pairs = balancedPairs(source).pairs;
  if (pairs.size === 0) return normalizeInciToken(source);
  let out = '';
  let skippingUntil = -1;
  for (let i = 0; i < source.length; i += 1) {
    if (i <= skippingUntil) continue;
    const end = pairs.get(i);
    if (end !== undefined) {
      skippingUntil = end;
      continue;
    }
    out += source[i];
  }
  return normalizeInciToken(out);
}

/** Arabic/common-language label aliases. Membership is identity only. */
export const INCI_ALIASES: Readonly<Record<string, string>> = {
  WATER: 'AQUA',
  EAU: 'AQUA',
  ماء: 'AQUA',
  المياه: 'AQUA',
  'ماء منقى': 'AQUA',
  GLYCERINE: 'GLYCERIN',
  GLYCEROL: 'GLYCERIN',
  جلسرين: 'GLYCERIN',
  غليسرين: 'GLYCERIN',
  FRAGRANCE: 'PARFUM',
  PERFUME: 'PARFUM',
  // Common trade/label name; identity alias only. Regulatory status still
  // comes exclusively from the dated structured annex match.
  LILIAL: 'BUTYLPHENYL METHYLPROPIONAL',
  BMHCA: 'BUTYLPHENYL METHYLPROPIONAL',
  AROMA: 'PARFUM',
  FLAVOUR: 'PARFUM',
  عطر: 'PARFUM',
  عطور: 'PARFUM',
  'COCONUT OIL': 'COCOS NUCIFERA OIL',
  'HUILE DE COCO': 'COCOS NUCIFERA OIL',
  'زيت جوز الهند': 'COCOS NUCIFERA OIL',
  'SHEA BUTTER': 'BUTYROSPERMUM PARKII BUTTER',
  'BEURRE DE KARITE': 'BUTYROSPERMUM PARKII BUTTER',
  'زبدة الشيا': 'BUTYROSPERMUM PARKII BUTTER',
  'COCOA BUTTER': 'THEOBROMA CACAO SEED BUTTER',
  'ARGAN OIL': 'ARGANIA SPINOSA KERNEL OIL',
  'HUILE D ARGAN': 'ARGANIA SPINOSA KERNEL OIL',
  'زيت الارغان': 'ARGANIA SPINOSA KERNEL OIL',
  'زيت الاركان': 'ARGANIA SPINOSA KERNEL OIL',
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
  'فيتامين ه': 'TOCOPHEROL',
  'VITAMIN C': 'ASCORBIC ACID',
  'فيتامين ج': 'ASCORBIC ACID',
  'VITAMIN B3': 'NIACINAMIDE',
  NIACINAMIDE: 'NIACINAMIDE',
  نياسيناميد: 'NIACINAMIDE',
  'VITAMIN B5': 'PANTHENOL',
  بانثينول: 'PANTHENOL',
  'VITAMIN A': 'RETINOL',
  ريتينول: 'RETINOL',
  'HYALURONIC ACID': 'HYALURONIC ACID',
  'حمض الهيالورونيك': 'HYALURONIC ACID',
  'METHYL PARABEN': 'METHYLPARABEN',
  'ETHYL PARABEN': 'ETHYLPARABEN',
  'PROPYL PARABEN': 'PROPYLPARABEN',
  'BUTYL PARABEN': 'BUTYLPARABEN',
  'كحول سيتيريل': 'CETEARYL ALCOHOL',
  // ── 2026-09 expansion: common trade names and French/Arabic label wording.
  // Identity aliases only — every target below is the official INCI name in
  // the dated glossary; safety/regulatory status never comes from this table.
  'ALOE VERA': 'ALOE BARBADENSIS LEAF JUICE',
  'ALOE VERA JUICE': 'ALOE BARBADENSIS LEAF JUICE',
  'ALOE BARBADENSIS': 'ALOE BARBADENSIS LEAF JUICE',
  'ALOE VERA EXTRACT': 'ALOE BARBADENSIS LEAF EXTRACT',
  'WITCH HAZEL': 'HAMAMELIS VIRGINIANA WATER',
  'HAMAMELIS WATER': 'HAMAMELIS VIRGINIANA WATER',
  'EAU DE ROSE': 'ROSA DAMASCENA FLOWER WATER',
  'ROSE WATER': 'ROSA DAMASCENA FLOWER WATER',
  'ماء الورد': 'ROSA DAMASCENA FLOWER WATER',
  'SESAME OIL': 'SESAMUM INDICUM SEED OIL',
  'HUILE DE SESAME': 'SESAMUM INDICUM SEED OIL',
  'زيت السمسم': 'SESAMUM INDICUM SEED OIL',
  HONEY: 'MEL',
  MIEL: 'MEL',
  عسل: 'MEL',
  'COLLOIDAL OATMEAL': 'AVENA SATIVA KERNEL EXTRACT',
  'OAT KERNEL EXTRACT': 'AVENA SATIVA KERNEL EXTRACT',
  'CUCUMBER EXTRACT': 'CUCUMIS SATIVUS FRUIT EXTRACT',
  'EXTRAIT DE CONCOMBRE': 'CUCUMIS SATIVUS FRUIT EXTRACT',
  'GREEN TEA': 'CAMELLIA SINENSIS LEAF EXTRACT',
  'GREEN TEA EXTRACT': 'CAMELLIA SINENSIS LEAF EXTRACT',
  'THE VERT': 'CAMELLIA SINENSIS LEAF EXTRACT',
  'TEA TREE OIL': 'MELALEUCA ALTERNIFOLIA LEAF OIL',
  'MELALEUCA ALTERNIFOLIA': 'MELALEUCA ALTERNIFOLIA LEAF OIL',
  'LAVENDER OIL': 'LAVANDULA ANGUSTIFOLIA OIL',
  'HUILE ESSENTIELLE DE LAVANDE': 'LAVANDULA ANGUSTIFOLIA OIL',
  LAVANDE: 'LAVANDULA ANGUSTIFOLIA OIL',
  'ROSEMARY EXTRACT': 'ROSMARINUS OFFICINALIS LEAF EXTRACT',
  ROMARIN: 'ROSMARINUS OFFICINALIS LEAF EXTRACT',
  CHAMOMILE: 'CHAMOMILLA RECUTITA FLOWER EXTRACT',
  CAMOMILLE: 'CHAMOMILLA RECUTITA FLOWER EXTRACT',
  'VITAMIN A PALMITATE': 'RETINYL PALMITATE',
  'VITAMIN E ACETATE': 'TOCOPHERYL ACETATE',
  'ACIDE HYALURONIQUE': 'HYALURONIC ACID',
  'HUILE D OLIVE': 'OLEA EUROPAEA FRUIT OIL',
  'زيت الزيتون': 'OLEA EUROPAEA FRUIT OIL',
  'BEURRE DE CACAO': 'THEOBROMA CACAO SEED BUTTER',
  'HUILE D AMANDE': 'PRUNUS AMYGDALUS DULCIS OIL',
  'زيت اللوز': 'PRUNUS AMYGDALUS DULCIS OIL',
  'HUILE DE JOJOBA': 'SIMMONDSIA CHINENSIS SEED OIL',
  'HUILE DE ROSIER MUSQUAT': 'ROSA CANINA FRUIT OIL',
  'زيت الخروع': 'RICINUS COMMUNIS SEED OIL',
  'GLYCERINE VEGETALE': 'GLYCERIN',
  'PRO VITAMIN B5': 'PANTHENOL',
  'DL PANTHENOL': 'PANTHENOL',
};

export function resolveAlias(normalized: string): string | undefined {
  return INCI_ALIASES[normalized];
}

export interface ParsedInciList {
  tokens: string[];
  diagnostics: ParserDiagnostic[];
  valid: boolean;
  sanitizedText: string;
}

interface PairResult {
  pairs: Map<number, number>;
  diagnostics: ParserDiagnostic[];
}

function balancedPairs(source: string): PairResult {
  const stack: Array<{ ch: string; offset: number }> = [];
  const pairs = new Map<number, number>();
  const diagnostics: ParserDiagnostic[] = [];
  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];
    if (OPEN_TO_CLOSE[ch]) {
      stack.push({ ch, offset: i });
      continue;
    }
    const expectedOpen = CLOSE_TO_OPEN[ch];
    if (!expectedOpen) continue;
    const top = stack.at(-1);
    if (!top || top.ch !== expectedOpen) {
      diagnostics.push({
        code: 'unmatched-closing-delimiter',
        severity: 'error',
        message: `Unmatched closing delimiter “${ch}”.`,
        offset: i,
        length: 1,
      });
      continue;
    }
    stack.pop();
    pairs.set(top.offset, i);
  }
  for (const item of stack) {
    diagnostics.push({
      code: 'unmatched-opening-delimiter',
      severity: 'error',
      message: `Unmatched opening delimiter “${item.ch}”; following ingredients were not hidden.`,
      offset: item.offset,
      length: 1,
    });
  }
  return { pairs, diagnostics };
}

const HEADING = /(?:^|\n)\s*(?:INGREDIENTS?|INGR[ÉE]DIENTS?|INCI|COMPOSITION|LISTE\s+D['’]?INGR[ÉE]DIENTS?|المكونات|مكونات)\s*[:.\-–—]?\s*/iu;
const TERMINAL_SECTION = /^\s*(?:DIRECTIONS?|HOW TO USE|WARNINGS?|CAUTION|NET(?:\s+WT)?|POIDS NET|MODE D['’]EMPLOI|تحذير|طريقة الاستعمال|الوزن الصافي)\b/iu;
const CONTINUATION_WORDS = new Set([
  'ACID', 'ALCOHOL', 'BUTTER', 'CHLORIDE', 'COPOLYMER', 'ESTER', 'EXTRACT', 'GLUCOSIDE',
  'GLYCOL', 'HYDROXIDE', 'OIL', 'OLEATE', 'PALMITATE', 'PHOSPHATE', 'POWDER', 'ROOT',
  'SEED', 'SODIUM', 'SORBATE', 'STEARATE', 'SULFATE', 'SULPHATE', 'WATER',
]);

function prepareLines(source: string, diagnostics: ParserDiagnostic[]): string {
  let s = source.replace(/\r\n?/g, '\n');
  const heading = HEADING.exec(s);
  if (heading) {
    const start = (heading.index ?? 0) + heading[0].length;
    if ((heading.index ?? 0) > 0 && /\p{L}/u.test(s.slice(0, heading.index))) {
      diagnostics.push({
        code: 'text-before-ingredients-heading',
        severity: 'warning',
        message: 'Text before the ingredients heading was excluded from parsing.',
        offset: 0,
        length: heading.index,
      });
    }
    s = s.slice(start);
  }

  const rawLines = s.split('\n');
  const lines: string[] = [];
  for (const rawLine of rawLines) {
    let line = rawLine.replace(/^\s*(?:[-*•·▪◦]|\d+[.)])\s*/u, '').trim();
    if (!line) continue;
    if (TERMINAL_SECTION.test(line)) {
      diagnostics.push({
        code: 'non-ingredient-section-excluded',
        severity: 'warning',
        message: `A non-ingredient section beginning “${line.slice(0, 32)}” was excluded.`,
      });
      break;
    }
    const prior = lines.at(-1);
    const firstWord = normalizeInciToken(line).split(' ')[0] ?? '';
    const priorWords = prior ? normalizeInciToken(prior).split(' ') : [];
    const likelyWrapped = Boolean(
      prior &&
      !/[,;:]\s*$/u.test(prior) &&
      (/[\-–—/]\s*$/u.test(prior) ||
        (priorWords.length <= 4 && CONTINUATION_WORDS.has(firstWord))),
    );
    if (likelyWrapped && prior) {
      lines[lines.length - 1] = `${prior.replace(/[\-–—]\s*$/u, '')} ${line}`.trim();
      diagnostics.push({
        code: 'wrapped-line-joined',
        severity: 'info',
        message: 'A likely wrapped ingredient line was joined before parsing.',
      });
    } else {
      lines.push(line);
    }
  }
  return lines.join('\n');
}

function cleanToken(raw: string): string | undefined {
  const token = String(raw ?? '').trim().replace(/[.]+$/u, '').trim();
  if (!token) return undefined;
  const normalized = normalizeInciToken(token);
  if (!normalized || !/\p{L}{2,}/u.test(normalized)) return undefined;
  return token;
}

function splitAtTopLevel(source: string, pairs: Map<number, number>): string[] {
  const tokens: string[] = [];
  let current = '';
  const closeOffsets = new Set<number>(pairs.values());
  let depth = 0;
  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];
    if (pairs.has(i)) depth += 1;
    const separator = (ch === ',' || ch === ';' || ch === '\n' || ch === '،' || ch === '؛') && depth === 0;
    if (separator) {
      const token = cleanToken(current);
      if (token) tokens.push(token);
      current = '';
    } else {
      current += ch;
    }
    if (closeOffsets.has(i)) depth = Math.max(0, depth - 1);
  }
  const last = cleanToken(current);
  if (last) tokens.push(last);
  return tokens;
}

/** Expand comma/semicolon-separated parenthetical ingredient sub-lists while
 * retaining the meaningful outer token. This catches `Parfum (Limonene,
 * Linalool)` without splitting ordinary botanical annotations. */
function expandNestedLists(token: string, diagnostics: ParserDiagnostic[]): string[] {
  const { pairs } = balancedPairs(token);
  const nested: string[] = [];
  let outer = token;
  const allPairs = [...pairs.entries()];
  // Recurse from outermost sibling groups only. Processing both an outer pair
  // and its nested pairs in the same pass would duplicate nested ingredients.
  const ordered = allPairs
    .filter(([start, end]) => !allPairs.some(([parentStart, parentEnd]) =>
      parentStart < start && parentEnd > end))
    .sort((a, b) => b[0] - a[0]);
  for (const [start, end] of ordered) {
    const inner = token.slice(start + 1, end);
    if (!/[,;،؛\n]/u.test(inner)) continue;
    const innerPairs = balancedPairs(inner).pairs;
    const parts = splitAtTopLevel(inner, innerPairs).flatMap((part) => expandNestedLists(part, diagnostics));
    if (parts.length < 2) continue;
    nested.unshift(...parts);
    outer = `${outer.slice(0, start)} ${outer.slice(end + 1)}`;
    diagnostics.push({
      code: 'nested-ingredient-list-expanded',
      severity: 'warning',
      message: `Expanded ${parts.length} ingredients from a nested label group. Review the parsed rows.`,
    });
  }
  const cleanedOuter = cleanToken(outer);
  return [...(cleanedOuter ? [cleanedOuter] : []), ...nested];
}

export function parseInciList(text: string): ParsedInciList {
  if (!text) return { tokens: [], diagnostics: [], valid: true, sanitizedText: '' };
  const sanitized = sanitizeLabelTextDetailed(text);
  const diagnostics = [...sanitized.diagnostics];
  const prepared = prepareLines(sanitized.text, diagnostics);
  const delimiters = balancedPairs(prepared);
  diagnostics.push(...delimiters.diagnostics);
  const topLevel = splitAtTopLevel(prepared, delimiters.pairs);
  const tokens = topLevel.flatMap((token) => expandNestedLists(token, diagnostics));
  if (tokens.length === 0 && /\p{L}/u.test(prepared)) {
    diagnostics.push({
      code: 'no-ingredient-tokens',
      severity: 'error',
      message: 'No ingredient tokens could be parsed from the label text.',
    });
  }
  return {
    tokens,
    diagnostics,
    valid: !diagnostics.some((d) => d.severity === 'error'),
    sanitizedText: prepared,
  };
}

/** Compatibility wrapper. Call parseInciList when diagnostics affect scoring. */
export function splitInciList(text: string): string[] {
  return parseInciList(text).tokens;
}
