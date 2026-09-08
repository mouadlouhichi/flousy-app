/**
 * Label OCR — client-side with tesseract.js, self-hosted engine assets, so a
 * photo of an ingredient label never leaves the device (same privacy posture
 * and worker setup as receipt OCR, src/lib/receipt-ocr.ts). Only the
 * recognised plain text is returned; the caller analyses it locally.
 */

export type OcrProgress = (percent: number | null) => void;

/**
 * Run OCR on a label photo (File or data URL) and return the raw text.
 * Language models come from the tessdata CDN and are cached in IndexedDB
 * after the first scan (see scripts/copy-tesseract.mjs for the self-hosted
 * worker/core assets that keep the strict CSP).
 *
 * Progress reporting: `onProgress` receives `null` while the engine/language
 * models load (the first run downloads several MB — several seconds) and a
 * number only once tesseract is actually reading the image, so callers never
 * show a misleading "0%".
 */
export async function recognizeLabelText(
  image: File | string,
  language: 'en' | 'fr' | 'ar' = 'fr',
  onProgress?: OcrProgress,
): Promise<string> {
  const { createWorker } = await import('tesseract.js');
  // Latin labels (FR/EN/imported EU products) share a model; Arabic labels
  // add `ara`.
  const langs = language === 'ar' ? 'ara+fra+eng' : 'fra+eng';
  const worker = await createWorker(langs, 1, {
    workerPath: '/tesseract/worker.min.js',
    corePath: '/tesseract/',
    workerBlobURL: false,
    logger: (msg: { status?: string; progress?: number }) => {
      if (msg.status === 'recognizing text' && typeof msg.progress === 'number') {
        onProgress?.(Math.round(msg.progress * 100));
      } else {
        // Engine/language-model loading phases — indeterminate.
        onProgress?.(null);
      }
    },
  });
  try {
    const { data } = await worker.recognize(image);
    return (data.text || '').trim();
  } finally {
    await worker.terminate();
  }
}
