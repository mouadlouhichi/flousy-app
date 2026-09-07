'use client';

import { useRef, useState } from 'react';
import { AppIcon } from '@/components/ui/app-icon';
import { useLanguage } from '@/lib/i18n-context';
import { recognizeLabelText } from '@/lib/label-ocr';

/**
 * "Scan the label" button shown when a scanned product is missing its
 * ingredient list. Opens the device camera/photo picker, runs OCR fully
 * on-device (tesseract.js — the photo never leaves the device) and hands the
 * recognised text to `onText`. Shows its own busy progress + error states.
 */
interface LabelOcrButtonProps {
  onText: (text: string) => void;
  disabled?: boolean;
}

export function LabelOcrButton({ onText, disabled }: LabelOcrButtonProps) {
  const { messages, t, intlLocale } = useLanguage();
  const g = messages.labelOcr;
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<null | 'preparing' | number>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (file: File | undefined) => {
    if (!file || busy !== null) return;
    setError(null);
    setBusy('preparing');
    const lang = intlLocale.startsWith('ar') ? 'ar' : intlLocale.startsWith('fr') ? 'fr' : 'en';
    try {
      const text = await recognizeLabelText(file, lang, (p) =>
        setBusy(p === null ? 'preparing' : p),
      );
      if (text.length < 2) {
        setError(g.empty);
        return;
      }
      onText(text);
    } catch {
      setError(g.failed);
    } finally {
      setBusy(null);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
        onChange={(e) => {
          void run(e.target.files?.[0]);
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled || busy !== null}
        className="inline-flex items-center gap-1.5 rounded-full border border-outline-variant bg-surface px-3.5 py-1.5 font-label-md text-label-md text-primary transition-colors hover:bg-surface-container-high disabled:opacity-60"
      >
        {busy !== null ? (
          <>
            <AppIcon name="hourglass_top" className="size-4 animate-spin" />
            {busy === 'preparing' ? g.preparing : t(g.scanning, { percent: busy })}
          </>
        ) : (
          <>
            <AppIcon name="add_a_photo" className="size-4" />
            {g.cta}
          </>
        )}
      </button>
      {error && (
        <p role="alert" className="font-label-sm text-label-sm text-rose-600 dark:text-rose-400">
          {error}
        </p>
      )}
    </span>
  );
}
