'use client';

import { useState } from 'react';
import { AppIcon } from '@/components/ui/app-icon';
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
 * Facts proxy; a hit fills the expense name and suggests a category.
 */
export function ExpenseBarcodeScanner({ onProduct, onClose }: ExpenseBarcodeScannerProps) {
  const { messages: m, t } = useLanguage();
  const [lookupState, setLookupState] = useState<'idle' | 'busy' | 'missing'>('idle');
  const [lastCode, setLastCode] = useState('');

  const scanner = useBarcodeScanner({
    enabled: true,
    onCode: (code) => {
      setLastCode(code);
      setLookupState('busy');
      lookupOffProduct(code)
        .then((product) => {
          if (product) {
            onProduct(product, code);
          } else {
            setLookupState('missing');
          }
        })
        .catch(() => setLookupState('missing'));
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
      <p className="text-xs text-on-surface-variant">
        {lookupState === 'busy'
          ? m.barcode.lookingUp
          : lookupState === 'missing'
            ? t(m.barcode.notFound, { code: lastCode })
            : m.barcode.hint}
      </p>
    </div>
  );
}
