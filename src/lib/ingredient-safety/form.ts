/** Client-safe cosmetic product-form inference. Explicit user choice wins. */

import type { ProductForm } from './types';

/**
 * Exposure context decides whether a leave-on allergen/preservative matters,
 * so the inference must be conservative but not useless: an unknown form
 * withholds the numeric index, so over-caution here silently disables the
 * feature for common supermarket wording.
 *
 * Order matters. Strong rinse-off wording is checked FIRST so that "face wash",
 * "cleansing milk" and "body wash" are not captured by the broad leave-on words
 * ("face", "body", "milk") that follow.
 */
const RINSE_OFF_STRONG = [
  /\b(?:shampo\w*|shampooing)\b/iu,
  /\b(?:shower|douche)\b/iu,
  /\b(?:body|face|hand)\s+wash(?:es)?\b/iu,
  /\b(?:cleanser|cleansing|nettoyant|demaquillant|make-?up\s+remover)\b/iu,
  /\b(?:soaps?|savons?)\b/iu,
  /\b(?:toothpaste|dentifrice|mouthwash|bain\s+de\s+bouche)\b/iu,
  /\b(?:scrub|exfoliat\w*|gommage|peeling)\b/iu,
  /\b(?:rinse[ -]?off|à rincer|a rincer)\b/iu,
  /شامبو|صابون|غسول|منظف|مقشر|معجون اسنان|معجون الأسنان|يشطف/u,
];

const LEAVE_ON_PATTERNS = [
  /\bleave[ -]?in\b/iu,
  /\bafter[ -]?shave\b/iu,
  /\bsans rincage\b/iu,
  /\bcreme\b/iu,
  /\bcream\b/iu,
  /\blotion\b/iu,
  /\bserum\b/iu,
  /\bmoistur/iu,
  /\bhydrat\w*\b/iu,
  /\bsunscreens?\b|\bspf\b|\bsun protection\b|\bsolaire\b/iu,
  /\bdeodorant\b|\bantiperspirant\b|\bdeo\b/iu,
  /\bfoundation\b|\bmakeup\b|\bmake[- ]up\b|\blip(?:stick| balm)\b|\bprimer\b|\btoner\b|\bmascara\b/iu,
  /\bperfume\b|\beau de\b|\bbalm\b|\bointment\b|\bstick\b|\bbutter\b/iu,
  /\b(?:face|body|hand|eye)\s+(?:cream|milk|butter|oil|lotion|balm)\b/iu,
  /\bsoin\b|\bsoins\b|\bvisage\b|\bcrème\b|\bcreme\b|\bbaume\b/iu,
  /\bhair\s+(?:oil|mask|serum|cream)\b/iu,
  /\bnuit\b|\bnight\b|\bday cream\b/iu,
  /كريم|مرطب|مصل|واقي شمس|واقي من الشمس|مزيل العرق|بلسم شفاه|زيت|عطر/u,
];

/** Weaker rinse-off wording, only consulted when nothing above matched. */
const RINSE_OFF_WEAK = [
  /\bhair conditioner\b|\bapres[- ]shampooing\b|\baprès[- ]shampooing\b/iu,
  /\bbath\b|\b bain\b/iu,
  /\bmasque\b|\bmask\b/iu,
  /\bshaving\b|\bmousse à raser\b/iu,
  /بلسم|قناع/u,
];

export function inferProductForm(category?: string, name?: string): ProductForm {
  const haystack = `${category ?? ''} ${name ?? ''}`
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase();
  if (!haystack.trim()) return 'unknown';
  // Explicit leave-on phrases must outrank generic words such as conditioner
  // and shave ("leave-in conditioner", "after-shave balm").
  if (/\bleave[ -]?in\b/iu.test(haystack) || /\bafter[ -]?shave\b/iu.test(haystack)) {
    return 'leave-on';
  }
  if (RINSE_OFF_STRONG.some((pattern) => pattern.test(haystack))) return 'rinse-off';
  if (LEAVE_ON_PATTERNS.some((pattern) => pattern.test(haystack))) return 'leave-on';
  if (RINSE_OFF_WEAK.some((pattern) => pattern.test(haystack))) return 'rinse-off';
  return 'unknown';
}
