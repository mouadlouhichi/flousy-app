/**
 * Inline barcode scanner for the expense sheet (Pro). Renders the same
 * scanner UI as the courses feature (frame, scan line, torch, zoom,
 * flash + beep + haptics, manual code entry); a hit fills the expense
 * name, and for cosmetics resolved on Open Beauty Facts the INCI list is
 * analyzed into a quality panel right under the viewfinder.
 */
'use client';

import { useState } from 'react';
import { AppIcon } from '@/components/ui/app-icon';
import { CoursesScannerPanel } from '@/components/dashboard/courses/courses-scanner-panel';
import { InciPhotoScanner } from '@/components/ui/inci-photo-scanner';
import { ProductQualityPanel } from '@/components/ui/product-quality-panel';
import { lookupOffProduct } from '@/lib/product-lookup';
import { useLanguage } from '@/lib/i18n-context';
import type { RemoteProductInfo } from '@/lib/course-session';

interface ExpenseBarcodeScannerProps {
  onProduct: (product: RemoteProductInfo, barcode: string) => void;
  onClose: () => void;
}

export function ExpenseBarcodeScanner({ onProduct, onClose }: ExpenseBarcodeScannerProps) {
  const { messages: m, t } = useLanguage();
  const [lookupState, setLookupState] = useState<'idle' | 'busy' | 'missing' | 'found'>('idle');
  const [lastCode, setLastCode] = useState('');
  const [lastProduct, setLastProduct] = useState<RemoteProductInfo | null>(null);
  /** INCI list read from a packaging photo when the barcode misses. */
  const [photoIngredients, setPhotoIngredients] = useState<string[] | null>(null);
  const productIngredients =
    lastProduct?.productKind === 'beauty' && lastProduct.ingredients?.length
      ? lastProduct.ingredients
      : null;
  const qualityIngredients = productIngredients ?? photoIngredients;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-extrabold uppercase tracking-wider text-on-surface-variant">
          {m.barcode.title}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label={m.common.close}
          className="tap-target rounded-lg p-1 text-on-surface-variant hover:bg-surface-variant"
        >
          <AppIcon name="close" className="text-[18px]" />
        </button>
      </div>

      <CoursesScannerPanel
        enabled
        onCode={(code) => {
          setLastCode(code);
          setLookupState('busy');
          setPhotoIngredients(null);
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
        }}
      />

      {qualityIngredients ? (
        <ProductQualityPanel
          ingredients={qualityIngredients}
          source={productIngredients ? 'openbeauty' : 'photo'}
          productName={productIngredients ? lastProduct?.name : undefined}
          productBrand={productIngredients ? lastProduct?.brand : undefined}
          productImage={productIngredients ? lastProduct?.imageUrl : undefined}
        />
      ) : (
        <InciPhotoScanner onIngredients={setPhotoIngredients} />
      )}

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
