'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Camera + hardware scanner input for course sessions.
 *
 * Decoding strategy (auto-detected):
 *   1. native  — `navigator.mediaDevices` + `BarcodeDetector` (Chrome/Android)
 *   2. zxing   — `@zxing/browser` JS decoder (iOS Safari, Firefox; lazy-loaded)
 *   3. wedge   — hardware USB/Bluetooth scanners that type digits + Enter
 *                (always active while `enabled`, regardless of camera)
 *
 * Identical codes seen within `debounceMs` are dropped (camera re-detect).
 */

export type ScanMethod = 'native' | 'zxing' | 'none';
export type ScanError = 'camera-unavailable' | 'camera-denied' | 'decode-unavailable' | null;

interface UseBarcodeScannerOptions {
  /** Attach listeners / allow starting. Turn off to tear everything down. */
  enabled: boolean;
  /** Fires with the raw scanned code (after the dedupe window). */
  onCode: (code: string) => void;
  /** Ignore an identical code seen within this window (ms). */
  debounceMs?: number;
}

interface NativeBarcodeDetector {
  detect(source: HTMLVideoElement): Promise<{ rawValue: string }[]>;
}

export function useBarcodeScanner({ enabled, onCode, debounceMs = 1500 }: UseBarcodeScannerOptions) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const zxingControlsRef = useRef<{ stop: () => void } | null>(null);
  const lastCodeRef = useRef<{ code: string; at: number } | null>(null);
  const onCodeRef = useRef(onCode);
  onCodeRef.current = onCode;

  const [running, setRunning] = useState(false);
  const [error, setError] = useState<ScanError>(null);
  const [method, setMethod] = useState<ScanMethod>('none');

  const stop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (zxingControlsRef.current) {
      zxingControlsRef.current.stop();
      zxingControlsRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setRunning(false);
  }, []);

  const emit = useCallback(
    (code: string) => {
      const now = Date.now();
      const last = lastCodeRef.current;
      if (last && last.code === code && now - last.at < debounceMs) return;
      lastCodeRef.current = { code, at: now };
      onCodeRef.current(code);
    },
    [debounceMs],
  );

  const start = useCallback(async () => {
    if (running || !enabled) return;
    setError(null);
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setError('camera-unavailable');
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
    } catch {
      setError('camera-denied');
      return;
    }
    streamRef.current = stream;

    const video = videoRef.current;
    if (!video) {
      stream.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setError('camera-unavailable');
      return;
    }
    video.srcObject = stream;
    try {
      await video.play();
    } catch {
      /* autoplay policy — the frame will still be produced */
    }
    setRunning(true);

    if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
      setMethod('native');
      const Ctor = (window as unknown as { BarcodeDetector: new (opts?: { formats: string[] }) => NativeBarcodeDetector }).BarcodeDetector;
      const detector = new Ctor({
        formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'],
      });
      const tick = async () => {
        if (!streamRef.current) return;
        try {
          const codes = await detector.detect(video);
          for (const detected of codes) {
            if (detected.rawValue) emit(detected.rawValue);
          }
        } catch {
          /* frame not ready yet */
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } else {
      setMethod('zxing');
      try {
        const { BrowserMultiFormatReader } = await import('@zxing/browser');
        const reader = new BrowserMultiFormatReader();
        zxingControlsRef.current = await reader.decodeFromVideoDevice(undefined, video, (result) => {
          if (result && result.getText()) emit(result.getText());
        });
      } catch {
        stop();
        setError('decode-unavailable');
      }
    }
  }, [running, enabled, emit, stop]);

  // Keyboard wedge: hardware scanners type a burst of digits (fast) and
  // finish with Enter. Human typing is slower than the inter-key budget, so
  // it can never trigger a scan.
  useEffect(() => {
    if (!enabled) return;
    let buffer = '';
    let lastKeyAt = 0;
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
        buffer = '';
        return; // focused fields handle their own Enter (manual entry)
      }
      const now = Date.now();
      if (now - lastKeyAt > 100) buffer = '';
      lastKeyAt = now;
      if (/^[0-9]$/.test(event.key)) {
        buffer += event.key;
        return;
      }
      if (event.key === 'Enter' && buffer.length >= 8 && buffer.length <= 13) {
        event.preventDefault();
        emit(buffer);
        buffer = '';
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled, emit]);

  // Tear down camera on unmount.
  useEffect(() => () => stop(), [stop]);

  return { videoRef, start, stop, running, error, method };
}
