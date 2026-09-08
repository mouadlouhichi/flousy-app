/** Account-scoped, bounded local INCI overlays. */

import { MAX_INGREDIENT_TEXT_LENGTH } from './ingredient-safety/types';
import { gtinIdentity } from './gtin';

const LEGACY_OVERLAY_KEY = 'smartjib_inci_overlay';
const OVERLAY_MAX_ENTRIES = 300;

export interface InciOverlayEntry {
  text: string;
  source: 'manual' | 'ocr';
  reviewed: boolean;
  updatedAt: string;
}

export type InciOverlayMap = Record<string, InciOverlayEntry>;

function scope(uid: string | null | undefined): string {
  return uid ? `account:${uid}` : 'guest';
}

function overlayKey(uid: string | null | undefined): string {
  return `smartjib_inci_overlay:v2:${encodeURIComponent(scope(uid))}`;
}

/** Listen for another tab changing this account's overlay map. The browser does
 * not fire `storage` in the tab that performed the write; local callers already
 * update their own component state, while this closes the cross-tab gap. */
export function subscribeInciOverlay(
  uid: string | null | undefined,
  onChange: () => void,
): () => void {
  if (typeof window === 'undefined') return () => {};
  const key = overlayKey(uid);
  const handleStorage = (event: StorageEvent) => {
    if (event.key === key) onChange();
  };
  window.addEventListener('storage', handleStorage);
  return () => window.removeEventListener('storage', handleStorage);
}

function identity(barcode: string): string {
  return gtinIdentity(barcode) ?? barcode.trim();
}

/**
 * Legacy unscoped entries are deliberately quarantined rather than assigned
 * to the next account that signs in. `clearLegacyInciOverlay` is the explicit
 * migration policy, preventing cross-account disclosure on shared devices.
 */
export function hasLegacyInciOverlay(): boolean {
  try {
    return typeof window !== 'undefined' && Boolean(localStorage.getItem(LEGACY_OVERLAY_KEY));
  } catch {
    return false;
  }
}

export function clearLegacyInciOverlay(): void {
  try {
    localStorage.removeItem(LEGACY_OVERLAY_KEY);
  } catch {
    // Storage can be unavailable; nothing else should fail.
  }
}

export function readInciOverlay(uid?: string | null): InciOverlayMap {
  try {
    const raw = typeof window === 'undefined' ? null : localStorage.getItem(overlayKey(uid));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const valid: InciOverlayMap = {};
    const entries = Object.entries(parsed as Record<string, unknown>).slice(-OVERLAY_MAX_ENTRIES);
    for (const [key, value] of entries) {
      if (!value || typeof value !== 'object' || key.length > 200) continue;
      const item = value as Partial<InciOverlayEntry>;
      if (typeof item.text !== 'string' || !item.text.trim() || item.text.length > MAX_INGREDIENT_TEXT_LENGTH) continue;
      if (item.source !== 'manual' && item.source !== 'ocr') continue;
      valid[key] = {
        text: item.text.trim(),
        source: item.source,
        reviewed: item.reviewed === true,
        updatedAt: typeof item.updatedAt === 'string' ? item.updatedAt : new Date(0).toISOString(),
      };
    }
    return valid;
  } catch {
    return {};
  }
}

export function readInciOverlayEntry(barcode: string, uid?: string | null): InciOverlayEntry | undefined {
  return readInciOverlay(uid)[identity(barcode)];
}

export function writeInciOverlayEntry(
  barcode: string,
  text: string,
  uid?: string | null,
  metadata: { source?: 'manual' | 'ocr'; reviewed?: boolean } = {},
): boolean {
  try {
    const normalizedText = text.trim();
    const key = identity(barcode);
    if (!key || key.length > 200 || !normalizedText || normalizedText.length > MAX_INGREDIENT_TEXT_LENGTH) return false;
    const map = readInciOverlay(uid);
    map[key] = {
      text: normalizedText,
      source: metadata.source ?? 'manual',
      reviewed: metadata.reviewed ?? metadata.source !== 'ocr',
      updatedAt: new Date().toISOString(),
    };
    const entries = Object.entries(map).sort((a, b) => a[1].updatedAt.localeCompare(b[1].updatedAt));
    for (const [oldest] of entries.slice(0, Math.max(0, entries.length - OVERLAY_MAX_ENTRIES))) {
      delete map[oldest];
    }
    localStorage.setItem(overlayKey(uid), JSON.stringify(map));
    return true;
  } catch {
    return false;
  }
}

export function removeInciOverlayEntry(barcode: string, uid?: string | null): void {
  try {
    const map = readInciOverlay(uid);
    const key = identity(barcode);
    if (!(key in map)) return;
    delete map[key];
    localStorage.setItem(overlayKey(uid), JSON.stringify(map));
  } catch {
    // Ignore blocked/full storage.
  }
}

export function clearInciOverlay(uid?: string | null): void {
  try {
    localStorage.removeItem(overlayKey(uid));
  } catch {
    // Ignore blocked storage.
  }
}
