'use client';

import { useState } from 'react';
import { AppIcon } from '@/components/ui/app-icon';
import { ProductQualityPanel } from '@/components/ui/product-quality-panel';
import { useBarcodeScanner } from '@/hooks/use-barcode-scanner';
import { lookupOffProduct } from '@/lib/product-lookup';
import { useLanguage } from '@/lib/i18n-context';
import type { RemoteProductInfo } from '@/lib/course-session';

interface ExpenseBarcodeScannerProps {
  onProduct: (product: RemoteProductInfo, barcode: string) => void;
  onClose: () => void;
}

/**
 * Inline barcode scanner for the expense sheet (Pro). Reuses the courses
 * scanner hook (native BarcodeDetector → zxing → wedge) and the Open Food
 * Facts proxy; a hit fills the expense name and suggests a category. For
 * cosmetics resolved on Open Beauty Facts the INCI ingredient list is
 * analyzed and a quality summary is shown right under the viewfinder.
 */
export function ExpenseBarcodeScanner({ onProduct, onClose }: ExpenseBarcodeScannerProps) {
  const { messages: m, t } = useLanguage();
  const [lookupState, setLookupState] = useState<'idle' | 'busy' | 'missing' | 'found'>('idle');
  const [lastCode, setLastCode] = useState('');
  const [lastProduct, setLastProduct] = useState<RemoteProductInfo | null>(null);
  const qualityIngredients =
    lastProduct?.productKind === 'beauty' && lastProduct.ingredients?.length
      ? lastProduct.ingredients
      : null;

  const scanner = useBarcodeScanner({
    enabled: true,
    onCode: (code) => {
      setLastCode(code);
      setLookupState('busy');
      lookupOffProduct(code)
        .then((product) => {
          if (product) {
            setLastProduct(product);
            setLookupState('found');
            onProduct(product, code);
          } else {
            setLastProduct(null);
            setLookupState('missing');
          }
        })
        .catch(() => {
          setLastProduct(null);
          setLookupState('missing');
        });
    },
  });

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-outline-variant bg-surface-container p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-extrabold uppercase tracking-wider text-on-surface-variant">{m.barcode.title}</span>
        <button type="button" onClick={() => { scanner.stop(); onClose(); }} aria-label={m.common.close} className="tap-target rounded-lg p-1 text-on-surface-variant hover:bg-surface-variant">
          <AppIcon name="close" className="text-[18px]" />
        </button>
      </div>
      <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-black">
        <video ref={scanner.videoRef} className="h-full w-full object-cover" muted playsInline />
        {scanner.error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70 p-3 text-center text-xs font-bold text-white">
            {scanner.error === 'camera-denied' ? m.barcode.cameraDenied : m.barcode.cameraUnavailable}
          </div>
        )}
        {scanner.torchAvailable && (
          <button type="button" onClick={scanner.toggleTorch} aria-label="torch" className="absolute bottom-2 end-2 rounded-full bg-black/60 p-2 text-white">
            <AppIcon name={scanner.torchOn ? 'flashlight_on' : 'flashlight_off'} className="text-[18px]" />
          </button>
        )}
      </div>
      {qualityIngredients && <ProductQualityPanel ingredients={qualityIngredients} />}
      <p className="text-xs text-on-surface-variant">
        {lookupState === 'busy'
          ? m.barcode.lookingUp
          : lookupState === 'missing'
            ? t(m.barcode.notFound, { code: lastCode })
            : lookupState === 'found'
              ? m.barcode.filled
              : m.barcode.hint}
      </p>
    </div>
  );
}
