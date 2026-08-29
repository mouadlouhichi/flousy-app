'use client';

import { useEffect, useRef, useState } from 'react';
import { AppIcon } from '@/components/ui/app-icon';
import { Input } from '@/components/ui/input';
import { useLanguage } from '@/lib/i18n-context';
import { useBarcodeScanner } from '@/hooks/use-barcode-scanner';

interface CoursesScannerPanelProps {
  /** Session is active — attach the hardware-wedge listener. */
  enabled: boolean;
  onCode: (rawCode: string) => void;
}

/**
 * Camera scanner (native BarcodeDetector → zxing fallback) plus the manual
 * code field. The manual field is always available — it is also the entry
 * point when the camera is unavailable, and it catches codes the camera
 * mis-reads.
 */
export function CoursesScannerPanel({ enabled, onCode }: CoursesScannerPanelProps) {
  const { messages } = useLanguage();
  const c = messages.courses;
  const [manualCode, setManualCode] = useState('');

  const { videoRef, start, stop, running, error } = useBarcodeScanner({
    enabled,
    onCode: (code) => {
      setManualCode('');
      onCode(code);
    },
  });

  // Stop the camera when the session is gone.
  useEffect(() => {
    if (!enabled) stop();
  }, [enabled, stop]);

  const submitManual = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = manualCode.trim();
    if (!trimmed) return;
    onCode(trimmed);
    setManualCode('');
  };

  return (
    <div className="rounded-3xl border border-outline-variant bg-surface-container-low p-4 md:p-5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-headline-sm text-headline-sm text-on-surface">
          <AppIcon name="scan_barcode" className="text-[20px] text-primary" />
          {c.scanTitle}
        </h3>
        <button
          type="button"
          onClick={running ? stop : start}
          className="flex items-center gap-1.5 rounded-full border border-outline-variant bg-surface px-3 py-1.5 font-label-md text-label-md text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors"
        >
          <AppIcon name={running ? 'visibility_off' : 'video_cam'} className="text-[16px]" />
          {running ? c.cameraStop : c.cameraStart}
        </button>
      </div>

      <div className="relative mt-3 overflow-hidden rounded-2xl bg-surface-variant aspect-[4/3] md:aspect-video">
        <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
        {!running && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center px-4">
            <AppIcon name="qr_code" className="text-[40px] text-on-surface-variant/50" />
            <p className="font-body-md text-body-md text-on-surface-variant">{c.scanHint}</p>
          </div>
        )}
        {running && (
          <div className="pointer-events-none absolute inset-x-6 top-1/2 h-16 -translate-y-1/2 rounded-xl border-2 border-primary/70" />
        )}
      </div>

      {error && (
        <p className="mt-2 flex items-center gap-1.5 font-body-md text-body-md text-tertiary">
          <AppIcon name="info" className="text-[16px]" />
          {c.cameraDenied}
        </p>
      )}

      <form onSubmit={submitManual} className="mt-3 flex gap-2">
        <Input
          value={manualCode}
          onChange={(e) => setManualCode(e.target.value.replace(/[^\d\s-]/g, ''))}
          placeholder={c.manualCode}
          inputMode="numeric"
          autoComplete="off"
          aria-label={c.manualCode}
          className="flex-1 bg-surface"
        />
        <button
          type="submit"
          disabled={!manualCode.trim()}
          className="flex items-center gap-1.5 rounded-xl bg-primary px-4 font-label-md text-label-md text-on-primary hover:opacity-90 disabled:opacity-40 transition-opacity"
        >
          <AppIcon name="search" className="text-[16px]" />
          {c.lookup}
        </button>
      </form>
    </div>
  );
}
