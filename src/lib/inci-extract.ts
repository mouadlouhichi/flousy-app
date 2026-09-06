/**
 * INCI ingredient-list extraction from OCR text of a product's packaging.
 *
 * When a barcode isn't in any database (Yuka has ~1M products, Open Beauty
 * Facts far fewer), the INCI list is still readable — it is legally printed
 * on every cosmetic package. Photograph it, OCR it client-side (same
 * self-hosted tesseract worker as receipt OCR — the image never leaves the
 * device), and the same quality analysis applies.
 *
 * `extractInciList` is pure so the heuristics are unit-tested without OCR.
 */

/** Section headers that introduce the INCI list, in several languages. */
const INCI_START_MARKERS: RegExp[] = [
  /\bINCI\b/,
  /\bINGREDIENTS?\b/,
  /\bINGR[ÉE]DIENTS?\b/,
  /\bINHALTSSTOFFE\b/,
  /\bCOMPOSIC[ÓO]N\b/,
  /المكونات/,
  /مكوّنات/,
];

/** Text that marks the end of the INCI list (manufacturing info, barcode…). */
const INCI_END_MARKERS: RegExp[] = [
  /\bMADE IN\b/i,
  /\bMANUFACTURED IN\b/i,
  /\bLOT\b/,
  /\bEXP(?:IRED?)?\b/i,
  /\bMFG\b/i,
  /\bBATCH\b/i,
  /\bBEST\s?BEFORE\b/i,
  /\bDLC\b/i,
  /\bAVANT\s?FIN\b/i,
  /\bCODE.{0,6}BARRE\b/i,
  /\bEAN\b/i,
  /\bREG\.?\s?SAN\b/i,
  /\bNº?\s?L\b/i,
  /\bKEEP AWAY\b/i,
  /صنع\s?في/, // Arabic "made in …" ends the list
  /\d{8,}/, // long digit runs = barcodes / reference numbers
];

/**
 * Extract the INCI ingredient names from OCR'd packaging text.
 * Returns [] when no recognizable INCI section is found.
 */
export function extractInciList(ocrText: string): string[] {
  const text = (ocrText || '').replace(/\r/g, '');

  // 1) Keep everything AFTER the earliest start marker.
  let bestStart = -1;
  let bestEnd = -1;
  for (const marker of INCI_START_MARKERS) {
    marker.lastIndex = 0;
    const match = marker.exec(text);
    if (match && (bestStart === -1 || match.index < bestStart)) {
      bestStart = match.index;
      bestEnd = match.index + match[0].length;
    }
  }
  if (bestStart === -1) return [];
  // Drop the header's trailing colon/dash ("INGREDIENTS : …").
  let section = text.slice(bestEnd).replace(/^[\s:;–\-—]+/, '');

  // 2) Cut at the earliest end marker inside the section.
  let cut = section.length;
  for (const marker of INCI_END_MARKERS) {
    marker.lastIndex = 0;
    const match = marker.exec(section);
    if (match && match.index < cut) cut = match.index;
  }
  section = section.slice(0, cut);

  // 3) Split into tokens (commas dominate; line breaks separate wrapped names).
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of section.split(/[,;\n]+/)) {
    let token = raw.trim();
    if (!token) continue;
    // Drop percentage qualifiers: "SODIUM LAURYL SULFATE (5%)" → name only.
    token = token.replace(/\(\s*[\d.,]+\s*%\s*\)/g, '').trim();
    token = token.replace(/\s+/g, ' ');
    // Skip pure numbers / symbols / tiny OCR noise.
    if (token.length < 2) continue;
    const letters = token.replace(/[^A-Za-z\u0600-\u06FF]/g, '');
    // No real INCI name is shorter than three letters — this drops "400ml",
    // "24h", unit leftovers and other OCR noise.
    if (letters.length < 3) continue;
    const upper = token.toUpperCase();
    if (seen.has(upper)) continue;
    seen.add(upper);
    result.push(upper);
  }
  return result;
}

export type OcrProgress = (percent: number) => void;

/**
 * OCR an image of the packaging and extract the INCI list.
 * Returns [] when no INCI section could be read (caller shows a retry hint).
 */
export async function recognizeInciList(
  image: File | string,
  language: 'en' | 'fr' | 'ar' = 'fr',
  onProgress?: OcrProgress,
): Promise<string[]> {
  const { createWorker } = await import('tesseract.js');
  const langs = language === 'ar' ? 'ara+fra+eng' : 'fra+eng';
  const worker = await createWorker(langs, 1, {
    // Self-hosted (see scripts/copy-tesseract.mjs) for the strict CSP;
    // language models come from the tessdata CDN and are cached after the
    // first scan.
    workerPath: '/tesseract/worker.min.js',
    corePath: '/tesseract/',
    workerBlobURL: false,
    logger: (msg: { status?: string; progress?: number }) => {
      if (msg.status === 'recognizing text' && typeof msg.progress === 'number') {
        onProgress?.(Math.round(msg.progress * 100));
      }
    },
  });
  try {
    const { data } = await worker.recognize(image);
    return extractInciList(data.text || '');
  } finally {
    await worker.terminate();
  }
}
