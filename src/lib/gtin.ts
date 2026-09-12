/** Strict, shared GS1 GTIN normalization and validation. */

import { normalizeDecimalDigits } from './ingredient-safety/normalize';

export type BarcodeSymbology =
  | 'EAN_8'
  | 'EAN_13'
  | 'UPC_A'
  | 'UPC_E'
  | 'ITF_14'
  | 'GS1_128'
  | 'CODE_128'
  | 'UNKNOWN';

export type BarcodeCaptureSource =
  | 'camera-native'
  | 'camera-zxing'
  | 'wedge'
  | 'manual'
  | 'api'
  | 'import';

export interface BarcodeCandidate {
  rawValue: string;
  format?: BarcodeSymbology | string;
  source: BarcodeCaptureSource;
}

export type GtinErrorCode =
  | 'empty'
  | 'invalid-character'
  | 'unsupported-symbology'
  | 'unsupported-length'
  | 'format-length-mismatch'
  | 'bad-checksum'
  | 'invalid-upce';

export interface CanonicalGtin {
  /** Validated native GTIN. UPC-E is expanded to GTIN-12 here. */
  gtin: string;
  /** Zero-filled canonical identity used for equality/persistence keys. */
  gtin14: string;
  /** Best code to send to product databases (8/12/13/14). */
  lookupCode: string;
  displayValue: string;
  format: 'GTIN_8' | 'GTIN_12' | 'GTIN_13' | 'GTIN_14';
  source: BarcodeCaptureSource;
  rawValue: string;
  verified: true;
  originalSymbology?: BarcodeSymbology;
  expandedFromUpce?: string;
}

export type ParseGtinResult =
  | { ok: true; value: CanonicalGtin }
  | { ok: false; error: GtinErrorCode; normalized?: string };

const EXPLICIT_SEPARATORS = /[\s-]/gu;
const ALLOWED_WITH_SEPARATORS = /^[\p{Nd}\s-]+$/u;

export function normalizeBarcodeFormat(format: string | undefined): BarcodeSymbology {
  const normalized = (format ?? '').trim().toUpperCase().replace(/[\s-]+/g, '_');
  const aliases: Readonly<Record<string, BarcodeSymbology>> = {
    EAN8: 'EAN_8',
    EAN_8: 'EAN_8',
    EAN13: 'EAN_13',
    EAN_13: 'EAN_13',
    UPCA: 'UPC_A',
    UPC_A: 'UPC_A',
    UPCE: 'UPC_E',
    UPC_E: 'UPC_E',
    ITF: 'ITF_14',
    ITF14: 'ITF_14',
    ITF_14: 'ITF_14',
    GS1_128: 'GS1_128',
    CODE128: 'CODE_128',
    CODE_128: 'CODE_128',
  };
  return aliases[normalized] ?? 'UNKNOWN';
}

/** Right-aligned GS1 Mod-10. Supports GTIN-8, 12, 13, and 14. */
export function isValidGtin(digits: string): boolean {
  if (!/^\d+$/.test(digits) || ![8, 12, 13, 14].includes(digits.length)) return false;
  let sum = 0;
  for (let i = digits.length - 1, position = 0; i >= 0; i -= 1, position += 1) {
    sum += Number(digits[i]) * (position % 2 === 0 ? 1 : 3);
  }
  return sum % 10 === 0;
}

export function calculateGtinCheckDigit(payload: string): string | null {
  if (!/^\d+$/.test(payload) || ![7, 11, 12, 13].includes(payload.length)) return null;
  let sum = 0;
  for (let i = payload.length - 1, position = 1; i >= 0; i -= 1, position += 1) {
    // The first payload digit from the right occupies position 1 to the left
    // of the check digit and therefore receives weight 3.
    sum += Number(payload[i]) * (position % 2 === 1 ? 3 : 1);
  }
  return String((10 - (sum % 10)) % 10);
}

/** Expand an 8-digit UPC-E (number system + six digits + check) to UPC-A. */
export function expandUpce(upce: string): string | null {
  if (!/^\d{8}$/.test(upce)) return null;
  const numberSystem = upce[0];
  if (numberSystem !== '0' && numberSystem !== '1') return null;
  const [a, b, c, d, e, mode] = upce.slice(1, 7).split('');
  let manufacturer: string;
  let product: string;
  if (mode === '0' || mode === '1' || mode === '2') {
    manufacturer = `${a}${b}${mode}00`;
    product = `00${c}${d}${e}`;
  } else if (mode === '3') {
    manufacturer = `${a}${b}${c}00`;
    product = `000${d}${e}`;
  } else if (mode === '4') {
    manufacturer = `${a}${b}${c}${d}0`;
    product = `0000${e}`;
  } else {
    manufacturer = `${a}${b}${c}${d}${e}`;
    product = `0000${mode}`;
  }
  const expanded = `${numberSystem}${manufacturer}${product}${upce[7]}`;
  return isValidGtin(expanded) ? expanded : null;
}

function expectedLength(symbology: BarcodeSymbology): number | null {
  switch (symbology) {
    case 'EAN_8': return 8;
    case 'EAN_13': return 13;
    case 'UPC_A': return 12;
    case 'UPC_E': return 8;
    case 'ITF_14': return 14;
    default: return null;
  }
}

function inferFormat(length: number): CanonicalGtin['format'] | null {
  if (length === 8) return 'GTIN_8';
  if (length === 12) return 'GTIN_12';
  if (length === 13) return 'GTIN_13';
  if (length === 14) return 'GTIN_14';
  return null;
}

function formatFromSymbology(symbology: BarcodeSymbology, length: number): CanonicalGtin['format'] | null {
  if (symbology === 'EAN_8') return 'GTIN_8';
  if (symbology === 'EAN_13') return 'GTIN_13';
  if (symbology === 'UPC_A') return 'GTIN_12';
  if (symbology === 'ITF_14') return 'GTIN_14';
  return inferFormat(length);
}

/**
 * Strictly parse one candidate. Only whitespace/hyphen human-readable
 * separators are removed. Localized decimal digits are accepted only for
 * manual/wedge entry, never silently transformed in decoder/API payloads.
 */
export function parseGtin(candidate: BarcodeCandidate): ParseGtinResult {
  const rawValue = String(candidate.rawValue ?? '').trim();
  if (!rawValue) return { ok: false, error: 'empty' };
  if (!ALLOWED_WITH_SEPARATORS.test(rawValue)) return { ok: false, error: 'invalid-character' };

  const localizedAllowed = candidate.source === 'manual' || candidate.source === 'wedge';
  const digitNormalized = localizedAllowed ? normalizeDecimalDigits(rawValue) : rawValue;
  if (!/^[0-9\s-]+$/.test(digitNormalized)) return { ok: false, error: 'invalid-character' };
  const digits = digitNormalized.replace(EXPLICIT_SEPARATORS, '');
  if (!digits) return { ok: false, error: 'empty' };

  const symbology = normalizeBarcodeFormat(candidate.format);
  if (symbology === 'GS1_128' || symbology === 'CODE_128') {
    // GS1-128 requires Application Identifier parsing and is not a bare GTIN.
    // Reject rather than extracting an arbitrary digit run.
    return { ok: false, error: 'unsupported-symbology', normalized: digits };
  }
  const length = expectedLength(symbology);
  if (length !== null && digits.length !== length) {
    return { ok: false, error: 'format-length-mismatch', normalized: digits };
  }

  let gtin = digits;
  let expandedFromUpce: string | undefined;
  if (symbology === 'UPC_E') {
    const expanded = expandUpce(digits);
    if (!expanded) return { ok: false, error: 'invalid-upce', normalized: digits };
    gtin = expanded;
    expandedFromUpce = digits;
  } else if (!inferFormat(digits.length)) {
    return { ok: false, error: 'unsupported-length', normalized: digits };
  } else if (!isValidGtin(digits)) {
    return { ok: false, error: 'bad-checksum', normalized: digits };
  }

  const format = formatFromSymbology(symbology, gtin.length);
  if (!format) return { ok: false, error: 'unsupported-length', normalized: gtin };
  return {
    ok: true,
    value: {
      gtin,
      gtin14: gtin.padStart(14, '0'),
      lookupCode: gtin,
      displayValue: expandedFromUpce ?? gtin,
      format,
      source: candidate.source,
      rawValue: candidate.rawValue,
      verified: true,
      ...(symbology !== 'UNKNOWN' ? { originalSymbology: symbology } : {}),
      ...(expandedFromUpce ? { expandedFromUpce } : {}),
    },
  };
}

export interface UnverifiedBarcode {
  value: string;
  source: 'manual';
  verified: false;
  reason: GtinErrorCode;
}

/** Explicit manual override. It remains visibly unverified and must not be used
 * as a canonical GTIN/catalog key without separate confirmation. */
export function createUnverifiedManualBarcode(
  raw: string,
  reason: GtinErrorCode,
): UnverifiedBarcode | null {
  const normalized = normalizeDecimalDigits(String(raw ?? '').trim());
  if (!/^[0-9\s-]{4,40}$/.test(normalized)) return null;
  const value = normalized.replace(EXPLICIT_SEPARATORS, '');
  return value.length >= 4 && value.length <= 32
    ? { value, source: 'manual', verified: false, reason }
    : null;
}

export function gtinIdentity(value: string): string | null {
  const parsed = parseGtin({ rawValue: value, source: 'import' });
  return parsed.ok ? parsed.value.gtin14 : null;
}

/** Prefix 611 identifies allocation through GS1 Morocco, not manufacture. */
export function isAllocatedByGs1Morocco(gtin: string): boolean {
  const parsed = parseGtin({ rawValue: gtin, source: 'import' });
  if (!parsed.ok) return false;
  return parsed.value.gtin14.slice(-13).startsWith('611');
}
