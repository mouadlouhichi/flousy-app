/**
 * Locale-tolerant parsing for user-typed money amounts.
 *
 * The 2026-09 audit found onboarding stripped everything outside ASCII
 * `[0-9.]`, which silently corrupted:
 *  - French input:      "1 234,56" became 123456 (comma removed)
 *  - Arabic input:      "١٢٣٤" became 0 (Arabic-Indic digits removed)
 *  - Grouped input:     "1.234,50" became 1.23450
 *
 * This parser normalizes Arabic-Indic and Extended Arabic-Indic digits,
 * understands both comma-decimal and dot-decimal conventions, and treats
 * grouping separators (spaces, apostrophes, U+066C) as noise.
 */

const ARABIC_INDIC_ZERO = 0x0660; // ٠..٩
const EXTENDED_ARABIC_ZERO = 0x06f0; // ۰..۹

/** Map Arabic-Indic (٠-٩) and Extended Arabic-Indic (۰-۹) digits to ASCII. */
export function normalizeDigitsToAscii(value: string): string {
  let out = '';
  for (const ch of value) {
    const code = ch.codePointAt(0)!;
    if (code >= ARABIC_INDIC_ZERO && code <= ARABIC_INDIC_ZERO + 9) {
      out += String(code - ARABIC_INDIC_ZERO);
    } else if (code >= EXTENDED_ARABIC_ZERO && code <= EXTENDED_ARABIC_ZERO + 9) {
      out += String(code - EXTENDED_ARABIC_ZERO);
    } else {
      out += ch;
    }
  }
  return out;
}

/**
 * Parse a human-typed amount in any of the app's locales (en/fr/ar).
 * Returns NaN when the input contains no usable number, so callers can
 * distinguish "empty/invalid" from a real zero.
 */
export function parseAmountInput(raw: string | number | null | undefined): number {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : NaN;
  if (raw === null || raw === undefined) return NaN;

  let s = normalizeDigitsToAscii(String(raw).trim());
  // Arabic decimal separator (٫ U+066B) → dot; Arabic thousands (٬ U+066C) → gone.
  s = s.replace(/\u066b/g, '.').replace(/\u066c/g, '');
  // Grouping spaces (regular, NBSP, thin space, narrow NBSP) and apostrophes.
  s = s.replace(/[\s\u00a0\u2009\u202f'’]/g, '');
  // Scientific notation is not a money format, and stripping the letter turns
  // it into a plausible WRONG number rather than an obvious rejection:
  // "1e5" would become "15". Refuse it instead of silently mangling it.
  if (/\d\s*[eE]\s*[+-]?\d/.test(s)) return NaN;
  // Drop currency symbols/letters; keep digits, separators and leading minus.
  s = s.replace(/[^0-9.,-]/g, '');
  if (!/[0-9]/.test(s)) return NaN;

  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');

  if (lastComma !== -1 && lastDot !== -1) {
    // Both present: the one further right is the decimal separator,
    // the other is grouping. Covers "1.234,56" and "1,234.56".
    if (lastComma > lastDot) {
      s = s.replace(/\./g, '');
      s = s.slice(0, s.lastIndexOf(',')).replace(/,/g, '') + '.' + s.slice(s.lastIndexOf(',') + 1);
    } else {
      s = s.replace(/,/g, '');
    }
  } else if (lastComma !== -1) {
    // Comma only. "1,234" / "12,345,678" look like grouping; anything else
    // ("1234,5", "0,75") is a decimal comma.
    if (/^-?\d{1,3}(,\d{3})+$/.test(s)) {
      s = s.replace(/,/g, '');
    } else {
      s = s.slice(0, lastComma).replace(/,/g, '') + '.' + s.slice(lastComma + 1);
    }
  } else if (lastDot !== -1) {
    const first = s.indexOf('.');
    if (/^-?\d{1,3}(\.\d{3})+$/.test(s) && first !== lastDot) {
      // "1.234.567" — repeated 3-digit groups are grouping, not decimals.
      s = s.replace(/\./g, '');
    } else if (first !== lastDot) {
      // Irregular multi-dot input: earlier dots were grouping, keep the last.
      s = s.slice(0, lastDot).replace(/\./g, '') + '.' + s.slice(lastDot + 1);
    }
    // Single dot stays a decimal point ("1.234" → 1.234), matching the
    // previous behaviour for dot-locales.
  }

  const value = Number.parseFloat(s);
  return Number.isFinite(value) ? value : NaN;
}
