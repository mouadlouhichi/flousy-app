/**
 * Receipt OCR — client-side with tesseract.js (lazy-loaded, ~2 MB wasm the
 * first time, cached by the browser afterwards). The image never leaves the
 * device, which keeps the privacy promise in /privacy intact.
 *
 * `parseReceiptText` is pure so the heuristics are unit-tested without OCR.
 */

export interface ReceiptParse {
  total: number | null;
  merchant: string | null;
  date: string | null;
  /** Candidate amounts found, largest first — shown when `total` is ambiguous. */
  candidates: number[];
}

const TOTAL_KEYWORDS = [
  'total', 'montant', 'net a payer', 'net à payer', 'a payer', 'à payer', 'ttc',
  'amount', 'somme', 'المجموع', 'الاجمالي', 'الإجمالي', 'المبلغ',
];
const IGNORE_KEYWORDS = ['sous total', 'sous-total', 'subtotal', 'tva', 'tax', 'rendu', 'change', 'remise', 'discount', 'espece', 'espèce', 'cash', 'carte'];

function toNumber(raw: string): number | null {
  // Handles "1 234,50", "1.234,50", "1234.50", "1,234.50", "120,00 DH".
  let s = raw.replace(/[^\d.,]/g, '');
  if (!s) return null;
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma > lastDot) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else {
    s = s.replace(/,/g, '');
  }
  const value = Number(s);
  return Number.isFinite(value) && value > 0 && value < 1_000_000 ? Math.round(value * 100) / 100 : null;
}

function normalize(line: string): string {
  return line.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function parseReceiptText(text: string): ReceiptParse {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const amountRe = /(\d{1,3}(?:[ .]\d{3})*(?:[.,]\d{2})|\d+[.,]\d{2}|\d{2,6})/g;

  const keywordHits: number[] = [];
  const all: number[] = [];

  for (const line of lines) {
    const norm = normalize(line);
    const matches = line.match(amountRe) || [];
    const numbers = matches.map(toNumber).filter((n): n is number => n !== null);
    if (numbers.length === 0) continue;
    if (IGNORE_KEYWORDS.some((k) => norm.includes(k))) continue;
    all.push(...numbers);
    if (TOTAL_KEYWORDS.some((k) => norm.includes(k))) {
      keywordHits.push(Math.max(...numbers));
    }
  }

  const candidates = Array.from(new Set(all)).sort((a, b) => b - a).slice(0, 6);
  // Prefer the last keyword hit (receipts print the grand total last);
  // fall back to the largest number on the receipt.
  const total = keywordHits.length ? keywordHits[keywordHits.length - 1] : candidates[0] ?? null;

  // Merchant: first line with letters and without many digits.
  const merchant = lines.find((l) => /[a-zA-Z\u0600-\u06ff]{3,}/.test(l) && (l.match(/\d/g) || []).length < 3) || null;

  // Date: dd/mm/yyyy, dd-mm-yy, yyyy-mm-dd.
  let date: string | null = null;
  for (const line of lines) {
    const m1 = /(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(line);
    const m2 = /(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/.exec(line);
    if (m1) {
      date = `${m1[1]}-${m1[2].padStart(2, '0')}-${m1[3].padStart(2, '0')}`;
      break;
    }
    if (m2) {
      const year = m2[3].length === 2 ? `20${m2[3]}` : m2[3];
      date = `${year}-${m2[2].padStart(2, '0')}-${m2[1].padStart(2, '0')}`;
      break;
    }
  }

  return { total, merchant: merchant ? merchant.slice(0, 60) : null, date, candidates };
}

export type OcrProgress = (percent: number) => void;

/** Run OCR on an image (File or data URL) in the browser. */
export async function recognizeReceipt(
  image: File | string,
  language: 'en' | 'fr' | 'ar' = 'fr',
  onProgress?: OcrProgress,
): Promise<ReceiptParse> {
  const { createWorker } = await import('tesseract.js');
  // Latin receipts (FR/EN) share a model; Arabic receipts add `ara`.
  const langs = language === 'ar' ? 'ara+fra+eng' : 'fra+eng';
  const worker = await createWorker(langs, 1, {
    // Self-hosted (see scripts/copy-tesseract.mjs) so the strict CSP
    // (`worker-src 'self'`) holds; only the language models come from the
    // tessdata CDN and are cached in IndexedDB after the first scan.
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
    return parseReceiptText(data.text || '');
  } finally {
    await worker.terminate();
  }
}
