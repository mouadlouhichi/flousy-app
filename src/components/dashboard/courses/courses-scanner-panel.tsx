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
 * code field. The camera auto-starts while the session is active and defaults
 * to a 2× zoom so barcodes fill the frame; a torch toggle appears when the
 * device exposes one. The manual field is always available — it is also the
 * entry point when the camera is unavailable, and it catches codes the camera
 * mis-reads.
 */
export function CoursesScannerPanel({ enabled, onCode }: CoursesScannerPanelProps) {
  const { messages } = useLanguage();
  const c = messages.courses;
  const [manualCode, setManualCode] = useState('');
  const [flash, setFlash] = useState(false);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    videoRef,
    start,
    stop,
    running,
    error,
    zoom,
    zoomIn,
    zoomOut,
    canZoomIn,
    canZoomOut,
    torchOn,
    torchAvailable,
    toggleTorch,
  } = useBarcodeScanner({
    enabled,
    onCode: (code) => {
      setManualCode('');
      // Captured feedback: brief frame flash + "Scanned" chip + haptic tick.
      setFlash(true);
      if (flashTimer.current) clearTimeout(flashTimer.current);
      flashTimer.current = setTimeout(() => setFlash(false), 700);
      try {
        navigator.vibrate?.(30);
      } catch {
        /* haptics unsupported */
      }
      onCode(code);
    },
  });

  useEffect(() => {
    if (!enabled) stop();
    return () => {
      if (flashTimer.current) clearTimeout(flashTimer.current);
    };
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
          <AppIcon name="scan_barcode" className="size-5 text-primary" />
          {c.scanTitle}
        </h3>
        <button
          type="button"
          onClick={running ? stop : start}
          className="flex items-center gap-1.5 rounded-full border border-outline-variant bg-surface px-3 py-1.5 font-label-md text-label-md text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors"
        >
          <AppIcon name={running ? 'visibility_off' : 'video_cam'} className="size-4" />
          {running ? c.cameraStop : c.cameraStart}
        </button>
      </div>

      <div className="relative mt-3 overflow-hidden rounded-2xl bg-surface-variant aspect-[4/3] md:aspect-video">
        <video
          ref={videoRef}
          playsInline
          muted
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-200 ease-out"
          style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}
        />
        {!running ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center px-4">
            <AppIcon name="qr_code" className="size-10 text-on-surface-variant/50" />
            <p className="font-body-md text-body-md text-on-surface-variant">{c.scanHint}</p>
          </div>
        ) : (
          <>
            {/* Scan frame: corner brackets + sweeping line */}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="relative h-20 w-[78%] max-w-md md:h-24">
                <span className="absolute left-0 top-0 h-7 w-7 rounded-tl-xl border-l-[3px] border-t-[3px] border-primary" />
                <span className="absolute right-0 top-0 h-7 w-7 rounded-tr-xl border-r-[3px] border-t-[3px] border-primary" />
                <span className="absolute bottom-0 left-0 h-7 w-7 rounded-bl-xl border-b-[3px] border-l-[3px] border-primary" />
                <span className="absolute bottom-0 right-0 h-7 w-7 rounded-br-xl border-b-[3px] border-r-[3px] border-primary" />
                <span className="animate-scan-line absolute inset-x-2 top-0 h-0.5 rounded-full bg-primary shadow-[0_0_10px_1px_rgba(0,104,95,0.7)]" />
              </div>
            </div>

            {/* Torch */}
            {torchAvailable && (
              <button
                type="button"
                onClick={toggleTorch}
                aria-label={torchOn ? c.torchOff : c.torchOn}
                className={`absolute right-3 top-3 flex size-9 items-center justify-center rounded-full border backdrop-blur transition-colors ${
                  torchOn
                    ? 'border-primary bg-primary text-on-primary'
                    : 'border-white/40 bg-black/40 text-white hover:bg-black/60'
                }`}
              >
                <AppIcon name={torchOn ? 'flashlight' : 'flashlight_off'} className="size-4" />
              </button>
            )}

            {/* Zoom */}
            <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full border border-white/20 bg-black/50 px-1.5 py-1 backdrop-blur">
              <button
                type="button"
                onClick={zoomOut}
                disabled={!canZoomOut}
                aria-label={c.zoomOut}
                className="flex size-7 items-center justify-center rounded-full text-white hover:bg-white/15 disabled:opacity-35 transition-colors"
              >
                <AppIcon name="zoom_out" className="size-4" />
              </button>
              <span className="min-w-12 select-none text-center font-label-sm text-label-sm text-white tabular-nums">
                {zoom.toFixed(1)}×
              </span>
              <button
                type="button"
                onClick={zoomIn}
                disabled={!canZoomIn}
                aria-label={c.zoomIn}
                className="flex size-7 items-center justify-center rounded-full text-white hover:bg-white/15 disabled:opacity-35 transition-colors"
              >
                <AppIcon name="zoom_in" className="size-4" />
              </button>
            </div>

            {flash ? (
              <div className="absolute inset-0 flex items-center justify-center bg-primary/10">
                <span className="flex items-center gap-2 rounded-full bg-primary px-3.5 py-1.5 font-label-md text-label-md text-on-primary shadow-[0_6px_18px_rgba(0,104,95,0.4)]">
                  <AppIcon name="check" className="size-4" />
                  {c.scanned}
                </span>
              </div>
            ) : (
              <p className="pointer-events-none absolute inset-x-0 bottom-14 px-4 text-center font-label-sm text-label-sm text-white/90 drop-shadow md:bottom-16">
                {c.alignHint}
              </p>
            )}
          </>
        )}
      </div>

      {error && (
        <p className="mt-2 flex items-center gap-1.5 font-body-md text-body-md text-tertiary">
          <AppIcon name="info" className="size-4" />
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
          <AppIcon name="search" className="size-4" />
          {c.lookup}
        </button>
      </form>
    </div>
  );
}
