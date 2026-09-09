'use client';

import React, { useEffect, useRef, useState } from 'react';
import { AppIcon } from '@/components/ui/app-icon';
import { Input } from '@/components/ui/input';
import { useBarcodeScanner } from '@/hooks/use-barcode-scanner';
import type { BarcodeCandidate } from '@/lib/gtin';

let scanAudioCtx: AudioContext | null = null;

function getScanAudioCtx(): AudioContext | null {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;
    if (!scanAudioCtx || scanAudioCtx.state === 'closed') {
      scanAudioCtx = new AudioCtx();
    }
    if (scanAudioCtx.state === 'suspended') {
      void scanAudioCtx.resume();
    }
    return scanAudioCtx;
  } catch {
    return null;
  }
}

/**
 * Unlock Web Audio on a user gesture so later scans (including unknown
 * codes) can beep. Exported so callers that open the panel from a button
 * (expense sheet) can prime the context at the same moment.
 */
export function unlockScanAudio() {
  getScanAudioCtx();
}

/** Short POS-style beep — Web Audio so there is no extra asset to fetch. */
function playScanBeep() {
  try {
    const ctx = getScanAudioCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = 1800;
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
    osc.stop(ctx.currentTime + 0.09);
  } catch {
    /* audio blocked until a user gesture — ignore */
  }
}

export interface ScannerPanelLabels {
  title: string;
  cameraStart: string;
  cameraStop: string;
  idleHint: string;
  alignHint: string;
  scanned: string;
  zoomIn: string;
  zoomOut: string;
  torchOn: string;
  torchOff: string;
  cameraUnavailable: string;
  /** Optional, more specific camera error copy; falls back to cameraUnavailable. */
  cameraDenied?: string;
  cameraNotFound?: string;
  cameraBusy?: string;
  insecureContext?: string;
  manualPlaceholder: string;
  lookup: string;
}

interface BarcodeScannerPanelProps {
  /** Session is active — attach the hardware-wedge listener + camera. */
  enabled: boolean;
  onCode: (candidate: BarcodeCandidate) => void;
  labels: ScannerPanelLabels;
  /** Optional header control (e.g. a close button for sheet usage). */
  headerAction?: React.ReactNode;
  /** Optional content between the viewport and the manual entry (lookup status, result card). */
  status?: React.ReactNode;
  /** Render the manual code entry form (default true). */
  manualEntry?: boolean;
  className?: string;
}

/**
 * The shared camera scanner: native BarcodeDetector → zxing fallback plus the
 * manual code field. The camera auto-starts while enabled and defaults to a
 * 2× zoom so barcodes fill the frame; a torch toggle appears when the device
 * exposes one. Every captured code gives POS feedback — beep, frame flash,
 * "Scanned" chip, haptic — even when the code later turns out unknown.
 *
 * Courses and the expense barcode scan share this exact panel, so both
 * surfaces stay identical.
 */
export function BarcodeScannerPanel({
  enabled,
  onCode,
  labels,
  headerAction,
  status,
  manualEntry = true,
  className,
}: BarcodeScannerPanelProps) {
  const [manualCode, setManualCode] = useState('');
  const [flash, setFlash] = useState(false);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleAccepted = (candidate: BarcodeCandidate) => {
    setManualCode('');
    playScanBeep();
    setFlash(true);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(false), 700);
    try {
      navigator.vibrate?.(30);
    } catch {
      // Haptics are optional.
    }
    onCode(candidate);
  };

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
    hardwareZoomAvailable,
    torchOn,
    torchAvailable,
    toggleTorch,
  } = useBarcodeScanner({
    enabled,
    onCode: handleAccepted,
  });

  useEffect(() => {
    // Deliberately no stop() on enabled=false: the hook soft-pauses decoding
    // while keeping the camera preview live (original scanner behaviour).
    // Full camera teardown happens on unmount or the explicit stop button.
    return () => {
      if (flashTimer.current) clearTimeout(flashTimer.current);
    };
  }, [enabled]);

  const submitManual = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = manualCode.trim();
    if (!trimmed) return;
    // Deliberately no camera teardown: the viewfinder stays on (main-branch
    // behavior) — the manual lookup resolves while decoding continues.
    handleAccepted({ rawValue: trimmed, format: 'UNKNOWN', source: 'manual' });
  };

  const cameraErrorText = error === 'camera-denied'
    ? labels.cameraDenied ?? labels.cameraUnavailable
    : error === 'camera-not-found'
      ? labels.cameraNotFound ?? labels.cameraUnavailable
      : error === 'camera-busy'
        ? labels.cameraBusy ?? labels.cameraUnavailable
        : error === 'insecure-context'
          ? labels.insecureContext ?? labels.cameraUnavailable
          : labels.cameraUnavailable;

  return (
    <div className={className ?? 'rounded-3xl border border-outline-variant bg-surface-container-low p-4 md:p-5'}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-headline-sm text-headline-sm text-on-surface">
          <AppIcon name="scan_barcode" className="size-5 text-primary" />
          {labels.title}
        </h3>
        <div className="flex items-center gap-1">
          {headerAction}
          <button
            type="button"
            onClick={() => {
              unlockScanAudio();
              if (running) stop();
              else void start();
            }}
            className="flex items-center gap-1.5 rounded-full border border-outline-variant bg-surface px-3 py-1.5 font-label-md text-label-md text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors"
          >
            <AppIcon name={running ? 'visibility_off' : 'video_cam'} className="size-4" />
            {running ? labels.cameraStop : labels.cameraStart}
          </button>
        </div>
      </div>

      <div className="relative mt-3 overflow-hidden rounded-2xl bg-surface-variant aspect-[4/3] md:aspect-video">
        <video
          ref={videoRef}
          playsInline
          muted
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-200 ease-out"
          style={hardwareZoomAvailable ? undefined : { transform: `scale(${zoom})`, transformOrigin: 'center center' }}
        />
        {!running ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center px-4">
            <AppIcon name="qr_code" className="size-10 text-on-surface-variant/50" />
            <p className="font-body-md text-body-md text-on-surface-variant">{labels.idleHint}</p>
          </div>
        ) : (
          <>
            {/* Scan frame: corner brackets + sweeping line, always visible
                while the camera runs. Native decoding still crops this region;
                fallback decoders inspect the full image behind the frame. */}
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
                aria-label={torchOn ? labels.torchOff : labels.torchOn}
                className={`absolute right-3 top-3 flex size-9 items-center justify-center rounded-full border backdrop-blur transition-colors ${
                  torchOn
                    ? 'border-primary bg-primary text-on-primary'
                    : 'border-white/40 bg-black/40 text-white hover:bg-black/60'
                }`}
              >
                <AppIcon name={torchOn ? 'flashlight' : 'flashlight_off'} className="size-4" />
              </button>
            )}

            {/* Zoom — hardware zoom when the track supports it, otherwise a
                digital zoom applied to the feed. Always available. */}
            <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full border border-white/20 bg-black/50 px-1.5 py-1 backdrop-blur">
              <button
                type="button"
                onClick={zoomOut}
                disabled={!canZoomOut}
                aria-label={labels.zoomOut}
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
                aria-label={labels.zoomIn}
                className="flex size-7 items-center justify-center rounded-full text-white hover:bg-white/15 disabled:opacity-35 transition-colors"
              >
                <AppIcon name="zoom_in" className="size-4" />
              </button>
            </div>

            {flash ? (
              <div className="absolute inset-0 flex items-center justify-center bg-primary/10">
                <span className="flex items-center gap-2 rounded-full bg-primary px-3.5 py-1.5 font-label-md text-label-md text-on-primary shadow-[0_6px_18px_rgba(0,104,95,0.4)]">
                  <AppIcon name="check" className="size-4" />
                  {labels.scanned}
                </span>
              </div>
            ) : (
              <p className="pointer-events-none absolute inset-x-0 bottom-14 px-4 text-center font-label-sm text-label-sm text-white/90 drop-shadow md:bottom-16">
                {labels.alignHint}
              </p>
            )}
          </>
        )}
      </div>

      {error && (
        <p className="mt-2 flex items-center gap-1.5 font-body-md text-body-md text-tertiary">
          <AppIcon name="info" className="size-4" />
          {cameraErrorText}
        </p>
      )}

      {status}

      {manualEntry && (
        <form onSubmit={submitManual} className="mt-3 flex gap-2">
          <Input
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value.replace(/[^\p{Nd}\s-]/gu, ''))}
            placeholder={labels.manualPlaceholder}
            inputMode="numeric"
            autoComplete="off"
            aria-label={labels.manualPlaceholder}
            className="flex-1 bg-surface"
          />
          <button
            type="submit"
            disabled={!manualCode.trim()}
            className="flex items-center gap-1.5 rounded-xl bg-primary px-4 font-label-md text-label-md text-on-primary hover:opacity-90 disabled:opacity-40 transition-opacity"
          >
            <AppIcon name="search" className="size-4" />
            {labels.lookup}
          </button>
        </form>
      )}
    </div>
  );
}
