import { looksLikeImageFile, sourceFromFile } from './profile-avatar';

/**
 * Receipt images are stored inline on the expense document (a data URL), which
 * keeps the app offline-first — an attached photo must still be visible on a
 * flight. The cost is that the bytes live inside the Firestore document, and an
 * unprocessed phone photo (3-8 MB, ~10 MB as base64) makes the write fail with a
 * size error the user cannot act on.
 *
 * So the image is rescaled here, keeping its aspect ratio because a receipt is a
 * document rather than an avatar, and re-encoded until it fits the app's field
 * budget at well under a Firestore document's maximum size. Firestore Rules can
 * bound list cardinality but cannot iterate arbitrary list entries, so receipt
 * attachment processing owns this per-field limit.
 */
const MAX_RECEIPT_CHARS = 100_000;
const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
/** Longest edge; enough to read line items on a phone screen at 2x. */
const MAX_EDGE = 1100;

function encode(image: CanvasImageSource, width: number, height: number, maxEdge: number, quality: number): string {
  if (!width || !height) throw new Error('receipt_image_unusable');
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  const targetWidth = Math.max(1, Math.round(width * scale));
  const targetHeight = Math.max(1, Math.round(height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('receipt_image_unavailable');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, targetWidth, targetHeight);
  context.drawImage(image, 0, 0, width, height, 0, 0, targetWidth, targetHeight);
  return canvas.toDataURL('image/jpeg', quality);
}

/**
 * @returns a JPEG data URL small enough to persist with the expense.
 * @throws with a message key the UI can show; the caller must never let this
 * reject the surrounding save, since the expense itself is already valid.
 */
export async function createReceiptDataUrl(file: File): Promise<string> {
  if (!looksLikeImageFile(file)) throw new Error('receipt_image_type');
  if (file.size > MAX_UPLOAD_BYTES) throw new Error('receipt_image_too_large');
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    throw new Error('receipt_image_browser_only');
  }

  const { image, width, height } = await sourceFromFile(file);
  const attempts: Array<[maxEdge: number, quality: number]> = [
    [MAX_EDGE, 0.72],
    [900, 0.62],
    [760, 0.55],
    [640, 0.48],
    [520, 0.42],
  ];
  for (const [maxEdge, quality] of attempts) {
    const dataUrl = encode(image, width, height, maxEdge, quality);
    if (dataUrl.length <= MAX_RECEIPT_CHARS) return dataUrl;
  }
  throw new Error('receipt_image_too_large');
}

/** Human-readable failure for a message key the catalogs already hold. */
export function receiptErrorMessage(code: unknown, fallback: string): string {
  if (typeof code !== 'string') return fallback;
  if (code === 'receipt_image_type') return 'Choose a JPG, PNG, WebP, or HEIC image.';
  if (code === 'receipt_image_too_large') return fallback;
  return fallback;
}
