'use client';

import { useEffect, useRef, useState } from 'react';
import { AppIcon } from '@/components/ui/app-icon';
import { BarcodeScannerPanel, unlockScanAudio } from '@/components/ui/barcode-scanner-panel';
import { RankingChip } from '@/components/ui/ranking-chip';
import { ScanLookupCard } from '@/components/ui/scan-lookup-card';
import { useLanguage } from '@/lib/i18n-context';
import type { BarcodeCandidate } from '@/lib/gtin';
import type { ResolvedProduct } from '@/lib/scan-resolution';
import { useCourseSession } from '@/hooks/use-course-session';
import { useDashboard } from '@/components/dashboard/dashboard-provider';

type LookupState =
  | { kind: 'idle' }
  | { kind: 'busy'; code: string }
  | { kind: 'missing'; code: string }
  | { kind: 'lookup-failed'; code: string }
  | { kind: 'found'; product: ResolvedProduct; code: string };

interface ExpenseBarcodeScannerProps {
  onProduct: (product: ResolvedProduct) => void;
  onClose: () => void;
}

/**
 * Inline barcode scanner for the expense sheet (Pro). Reuses the exact
 * courses scanner panel (camera feed, scan frame, torch, zoom, beep/flash/
 * haptic feedback, manual entry) and the Open Food Facts lookup. A hit no
 * longer fills the form blindly: the product result is shown with image,
 * brand, category, pack size and — when the source provides one — the
 * Nutri-Score ranking chip; the user confirms with "Use this product".
 */
export function ExpenseBarcodeScanner({ onProduct, onClose }: ExpenseBarcodeScannerProps) {
  const { messages: m, t, language } = useLanguage();
  const { user } = useDashboard();
  const courseStore = useCourseSession(user?.uid ?? null);
  const [lookup, setLookup] = useState<LookupState>({ kind: 'idle' });
  const requestIdRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const handleCode = async (candidate: BarcodeCandidate) => {
    const requestId = ++requestIdRef.current;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLookup({ kind: 'busy', code: candidate.rawValue });
    const result = await courseStore.resolveBarcode(candidate, {
      lang: language,
      signal: controller.signal,
    });
    if (requestId !== requestIdRef.current || controller.signal.aborted) return;
    if (result.kind === 'invalid') {
      setLookup({ kind: 'lookup-failed', code: candidate.rawValue });
    } else if (result.kind === 'found') {
      setLookup({ kind: 'found', product: result.product, code: result.canonical.gtin });
      if (result.revalidate) {
        const refreshed = await result.revalidate.catch(() => null);
        if (refreshed && requestId === requestIdRef.current && !controller.signal.aborted) {
          setLookup({ kind: 'found', product: refreshed, code: result.canonical.gtin });
        }
      }
    } else if (result.kind === 'not-found' && result.reason === 'not-found') {
      setLookup({ kind: 'missing', code: result.canonical.gtin });
    } else {
      setLookup({ kind: 'lookup-failed', code: result.canonical.gtin });
    }
  };

  // Holds the whole narrowed state so `code` and `product` stay accessible.
  const found = lookup.kind === 'found' ? lookup : null;

  return (
    <BarcodeScannerPanel
      enabled={lookup.kind === 'idle'}
      onCode={handleCode}
      className="rounded-2xl border border-outline-variant bg-surface-container p-3.5 md:p-4"
      labels={{
        title: m.barcode.title,
        cameraStart: m.courses.cameraStart,
        cameraStop: m.courses.cameraStop,
        idleHint: m.barcode.hint,
        alignHint: m.courses.alignHint,
        scanned: m.courses.scanned,
        zoomIn: m.courses.zoomIn,
        zoomOut: m.courses.zoomOut,
        torchOn: m.courses.torchOn,
        torchOff: m.courses.torchOff,
        cameraUnavailable: m.barcode.cameraUnavailable,
        manualPlaceholder: m.courses.manualCode,
        lookup: m.courses.lookup,
      }}
      headerAction={
        <button
          type="button"
          onClick={onClose}
          aria-label={m.common.close}
          className="tap-target rounded-lg p-1.5 text-on-surface-variant hover:bg-surface-variant"
        >
          <AppIcon name="close" className="text-[18px]" />
        </button>
      }
      status={
        lookup.kind === 'busy' ? (
          <ScanLookupCard
            className="mt-3"
            code={lookup.code}
            labels={{
              searching: m.barcode.lookingUp,
              slowHint: m.courses.lookupSlowHint,
              verySlowHint: m.courses.lookupVerySlowHint,
            }}
          />
        ) : found ? (
          <div className="mt-3 rounded-2xl border border-primary/30 bg-primary/5 p-3.5">
            <div className="flex items-start gap-3">
              {found.product.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={found.product.imageUrl}
                  alt=""
                  className="h-14 w-14 shrink-0 rounded-xl object-cover bg-surface"
                />
              ) : (
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-surface">
                  <AppIcon name="inventory_2" className="size-6 text-primary" />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="flex min-w-0 items-center gap-1.5 font-headline-sm text-headline-sm text-on-surface">
                  <span className="min-w-0 truncate">{found.product.name}</span>
                  <RankingChip ranking={found.product.ranking} />
                </p>
                <p className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 font-label-sm text-label-sm text-on-surface-variant">
                  {found.product.brand && <span className="min-w-0 truncate">{found.product.brand}</span>}
                  {found.product.category && <span className="min-w-0 truncate">{found.product.category}</span>}
                  {found.product.quantity && <span dir="ltr">{found.product.quantity}</span>}
                  <span dir="ltr" className="font-mono">{found.code}</span>
                </p>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  abortRef.current?.abort();
                  requestIdRef.current += 1;
                  setLookup({ kind: 'idle' });
                }}
                className="rounded-full border border-outline-variant px-4 py-2 font-label-md text-label-md text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors"
              >
                {m.barcode.scanAnother}
              </button>
              <button
                type="button"
                onClick={() => {
                  onProduct(found.product);
                  onClose();
                }}
                className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 font-label-md text-label-md text-on-primary hover:bg-primary-hover shadow-xs transition-colors"
              >
                <AppIcon name="check" className="size-4" />
                {m.barcode.useProduct}
              </button>
            </div>
          </div>
        ) : lookup.kind === 'missing' ? (
          <div className="mt-3 flex items-center gap-2.5 rounded-2xl border border-outline-variant bg-surface-container px-4 py-3 font-body-md text-body-md text-on-surface-variant">
            <AppIcon name="info" className="size-5 shrink-0 text-tertiary" />
            <span className="min-w-0 flex-1">{t(m.barcode.notFound, { code: lookup.code })}</span>
            <button
              type="button"
              onClick={() => setLookup({ kind: 'idle' })}
              className="shrink-0 rounded-full border border-outline-variant px-3 py-1.5 font-label-sm text-label-sm"
            >
              {m.barcode.scanAnother}
            </button>
          </div>
        ) : lookup.kind === 'lookup-failed' ? (
          <div className="mt-3 flex items-center gap-2.5 rounded-2xl border border-tertiary/40 bg-tertiary-container/30 px-4 py-3 font-body-md text-body-md text-on-surface">
            <AppIcon name="cloud_off" className="size-5 shrink-0 text-tertiary" />
            <span className="min-w-0 flex-1">{m.courses.lookupFailed}</span>
            <button
              type="button"
              onClick={() => void handleCode({ rawValue: lookup.code, source: 'manual' })}
              className="tap-target shrink-0 rounded-full border border-outline-variant px-3.5 py-1.5 font-label-md text-label-md font-bold text-on-surface hover:bg-surface-variant transition-colors"
            >
              {m.common.retry}
            </button>
          </div>
        ) : null
      }
    />
  );
}
