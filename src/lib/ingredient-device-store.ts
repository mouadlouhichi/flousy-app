/**
 * Per-device INCI memory for scanned cosmetics (localStorage only).
 *
 * A manual "paste from label" ingredient list is remembered per barcode on
 * this device so the next scan of the same product auto-analyzes without
 * re-pasting. The store is intentionally device-scoped — the account-scoped
 * copy lives in the product catalog (users/{uid}/products/{barcode},
 * `ingredientsText`), which is what crosses devices via Firestore.
 */

const OVERLAY_KEY = 'smartjib_inci_overlay';
const OVERLAY_MAX_ENTRIES = 300;

type OverlayMap = Record<string, string>;

export function readInciOverlay(): OverlayMap {
  try {
    const raw =
      typeof window === 'undefined' ? null : window.localStorage.getItem(OVERLAY_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' ? (parsed as OverlayMap) : {};
  } catch {
    return {};
  }
}

export function readInciOverlayEntry(barcode: string): string | undefined {
  const value = readInciOverlay()[barcode];
  return value?.trim() ? value.trim() : undefined;
}

export function writeInciOverlayEntry(barcode: string, text: string): void {
  try {
    const map = readInciOverlay();
    map[barcode] = text;
    // Keep the map bounded (a shopping catalog, not a data lake).
    const entries = Object.entries(map);
    if (entries.length > OVERLAY_MAX_ENTRIES) {
      for (const [key] of entries.slice(0, entries.length - OVERLAY_MAX_ENTRIES)) {
        delete map[key];
      }
    }
    window.localStorage.setItem(OVERLAY_KEY, JSON.stringify(map));
  } catch {
    /* storage blocked/full — the analysis still works for this scan */
  }
}

export function removeInciOverlayEntry(barcode: string): void {
  try {
    const map = readInciOverlay();
    if (!(barcode in map)) return;
    delete map[barcode];
    window.localStorage.setItem(OVERLAY_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}
