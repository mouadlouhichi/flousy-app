'use client';

import { useRef, useState } from 'react';
import { AppIcon } from '@/components/ui/app-icon';
import { recognizeInciList } from '@/lib/inci-extract';
import { useLanguage } from '@/lib/i18n-context';

interface InciPhotoScannerProps {
  onIngredients: (list: string[]) => void;
}

/**
 * Fallback for products missing from every barcode database: photograph the
 * INCI list printed on the packaging and OCR it locally (same tesseract
 * worker as receipt OCR — the image never leaves the device).
 */
export function InciPhotoScanner({ onIngredients }: InciPhotoScannerProps) {
  const { messages: m, intlLocale } = useLanguage();
  const c = m.barcode.inciscan;
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<'idle' | 'reading' | 'error'>('idle');
  const [progress, setProgress] = useState(0);

  const pick = async (file: File | null) => {
    if (!file) return;
    setStatus('reading');
    setProgress(0);
    try {
      const language = intlLocale.startsWith('ar') ? 'ar' : intlLocale.startsWith('fr') ? 'fr' : 'en';
      const list = await recognizeInciList(file, language, setProgress);
      if (list.length > 0) onIngredients(list);
      else setStatus('error');
    } catch {
      setStatus('error');
    }
  };

  return (
    <div className="rounded-xl border border-dashed border-outline-variant bg-surface-container p-3">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        aria-label={c.button}
        onChange={(e) => {
          void pick(e.target.files?.[0] ?? null);
          // Reset so the same photo can be picked again after a failed read.
          e.target.value = '';
        }}
      />
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary/20 transition-colors"
        >
          <AppIcon name="add_a_photo" className="text-[16px]" />
          {c.button}
        </button>
        {status === 'reading' && (
          <span className="flex min-w-0 items-center gap-1.5 text-xs font-bold text-on-surface-variant">
            <span className="size-3 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
            {c.reading} {progress > 0 ? `(${progress}%)` : ''}
          </span>
        )}
      </div>
      <p className="mt-1.5 text-[11px] leading-relaxed text-on-surface-variant">
        {status === 'error' ? c.error : c.hint}
      </p>
    </div>
  );
}
