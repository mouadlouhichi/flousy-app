'use client';

import { useState } from 'react';
import { AppIcon } from '@/components/ui/app-icon';
import { BarcodeScannerPanel, unlockScanAudio } from '@/components/ui/barcode-scanner-panel';
import { RankingChip } from '@/components/ui/ranking-chip';
import { lookupOffProduct } from '@/lib/product-lookup';
import { useLanguage } from '@/lib/i18n-context';
import type { RemoteProductInfo } from '@/lib/course-session';

type LookupState =
  | { kind: 'idle' }
  | { kind: 'busy' }
  | { kind: 'missing'; code: string }
  | { kind: 'lookup-failed'; code: string }
  | { kind: 'found'; product: RemoteProductInfo; code: string };

interface ExpenseBarcodeScannerProps {
  onProduct: (product: RemoteProductInfo, barcode: string) => void;
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
  const { messages: m, t } = useLanguage();
  const [lookup, setLookup] = useState<LookupState>({ kind: 'idle' });

  const handleCode = (code: string) => {
    setLookup({ kind: 'busy' });
    lookupOffProduct(code)
      .then((outcome) => {
        if (outcome.kind === 'found') setLookup({ kind: 'found', product: outcome.product, code });
        // `error` (network/timeout/upstream) is retry-able and must NOT be
        // dressed up as "the product doesn't exist".
        else if (outcome.kind === 'not-found') setLookup({ kind: 'missing', code });
        else setLookup({ kind: 'lookup-failed', code });
      })
      .catch(() => setLookup({ kind: 'lookup-failed', code }));
  };

  // Holds the whole narrowed state so `code` and `product` stay accessible.
  const found = lookup.kind === 'found' ? lookup : null;

  return (
    <BarcodeScannerPanel
      enabled
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
          <div className="mt-3 flex items-center gap-2.5 rounded-2xl border border-outline-variant bg-surface-container px-4 py-3 font-body-md text-body-md text-on-surface-variant">
            <AppIcon name="search" className="animate-pulse size-5 text-primary" />
            {m.barcode.lookingUp}
          </div>
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
                onClick={() => setLookup({ kind: 'idle' })}
                className="rounded-full border border-outline-variant px-4 py-2 font-label-md text-label-md text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors"
              >
                {m.barcode.scanAnother}
              </button>
              <button
                type="button"
                onClick={() => {
                  onProduct(found.product, found.code);
                  onClose();
                }}
                className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 font-label-md text-label-md text-on-primary hover:bg-accent-foreground shadow-xs transition-colors"
              >
                <AppIcon name="check" className="size-4" />
                {m.barcode.useProduct}
              </button>
            </div>
          </div>
        ) : lookup.kind === 'missing' ? (
          <div className="mt-3 flex items-center gap-2.5 rounded-2xl border border-outline-variant bg-surface-container px-4 py-3 font-body-md text-body-md text-on-surface-variant">
            <AppIcon name="info" className="size-5 shrink-0 text-tertiary" />
            <span>{t(m.barcode.notFound, { code: lookup.code })}</span>
          </div>
        ) : lookup.kind === 'lookup-failed' ? (
          <div className="mt-3 flex items-center gap-2.5 rounded-2xl border border-tertiary/40 bg-tertiary-container/30 px-4 py-3 font-body-md text-body-md text-on-surface">
            <AppIcon name="cloud_off" className="size-5 shrink-0 text-tertiary" />
            <span className="min-w-0 flex-1">{m.courses.lookupFailed}</span>
            <button
              type="button"
              onClick={() => handleCode(lookup.code)}
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
