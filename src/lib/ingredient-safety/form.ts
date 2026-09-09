/** Client-safe cosmetic product-form inference. Explicit user choice wins. */

import type { ProductForm } from './types';

const LEAVE_ON_PATTERNS = [
  /\bleave[ -]?in\b/iu,
  /\bafter[ -]?shave\b/iu,
  /\bsans rincage\b/iu,
  /\bcreme\b/iu,
  /\bcream\b/iu,
  /\blotion\b/iu,
  /\bserum\b/iu,
  /\bmoistur/iu,
  /\bsunscreens?\b|\bspf\b|\bsun protection\b/iu,
  /\bdeodorant\b|\bantiperspirant\b/iu,
  /\bfoundation\b|\bmakeup\b|\blip(?:stick| balm)\b|\bprimer\b|\btoner\b/iu,
  /\bperfume\b|\beau de\b|\bbalm\b|\bointment\b|\bstick\b|\bbutter\b/iu,
  /كريم|مرطب|مصل|واقي شمس|مزيل العرق|بلسم شفاه/u,
];

const RINSE_OFF_PATTERNS = [
  /\bshampoo(?:ing|s)?\b/iu,
  /\bshower\b|\bbody wash(?:es)?\b|\bface wash(?:es)?\b/iu,
  /\bsoap\b|\bsavons?\b/iu,
  /\bcleanser\b|\bcleansing\b|\bnettoyant\b/iu,
  /\bbath\b|\bdouche\b|\bscrub\b|\bexfoliat/iu,
  /\btoothpaste\b|\bdentifrice\b/iu,
  /\bhair conditioner\b|\bapres[- ]shampooing\b/iu,
  /\brinse[ -]?off\b|\ba rincer\b/iu,
  /شامبو|صابون|غسول|منظف|معجون اسنان|يشطف/u,
];

export function inferProductForm(category?: string, name?: string): ProductForm {
  const haystack = `${category ?? ''} ${name ?? ''}`
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase();
  // Explicit leave-on phrases must outrank generic words such as conditioner
  // and shave ("leave-in conditioner", "after-shave balm").
  if (LEAVE_ON_PATTERNS.some((pattern) => pattern.test(haystack))) return 'leave-on';
  if (RINSE_OFF_PATTERNS.some((pattern) => pattern.test(haystack))) return 'rinse-off';
  return 'unknown';
}
