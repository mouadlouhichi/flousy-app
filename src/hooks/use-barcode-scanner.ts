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
 * The camera feed is digitally zoomed by default (2×) so distant barcodes
 * fill the frame and are easier to line up; a torch toggle appears whenever
 * the device exposes one. The camera auto-starts once `enabled` so the scan
 * view is ready without an extra tap.
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
  /** Start the camera automatically once `enabled` (default true). */
  autoStart?: boolean;
  /** Initial digital zoom, 1 = none (default 2×). */
  initialZoom?: number;
}

interface NativeBarcodeDetector {
  detect(source: HTMLVideoElement): Promise<{ rawValue: string }[]>;
}

const MIN_ZOOM = 1;
const MAX_ZOOM = 8;
const ZOOM_STEP = 0.5;
/** Roughly how often the native decoder samples the feed (ms). */
const DECODE_INTERVAL_MS = 120;

export function useBarcodeScanner({
  enabled,
  onCode,
  debounceMs = 1500,
  autoStart = true,
  initialZoom = 2,
}: UseBarcodeScannerOptions) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const zxingControlsRef = useRef<{ stop: () => void } | null>(null);
  const lastCodeRef = useRef<{ code: string; at: number } | null>(null);
  const runningRef = useRef(false);
  const enabledRef = useRef(enabled);
  const torchOnRef = useRef(false);
  /** Incremented on every stop/start so a superseded `getUserMedia` is discarded. */
  const startTokenRef = useRef(0);
  const zoomRef = useRef(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, initialZoom)));
  const onCodeRef = useRef(onCode);
  onCodeRef.current = onCode;
  enabledRef.current = enabled;

  const [running, setRunning] = useState(false);
  const [error, setError] = useState<ScanError>(null);
  const [method, setMethod] = useState<ScanMethod>('none');
  const [zoom, setZoomState] = useState(zoomRef.current);
  const [torchOn, setTorchOn] = useState(false);
  const [torchAvailable, setTorchAvailable] = useState(false);

  const stop = useCallback(() => {
    startTokenRef.current += 1; // invalidate any in-flight start
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (zxingControlsRef.current) {
      try {
        zxingControlsRef.current.stop();
      } catch {
        /* already stopped */
      }
      zxingControlsRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    runningRef.current = false;
    torchOnRef.current = false;
    setRunning(false);
    setTorchOn(false);
    setMethod('none');
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

  const getVideoTrack = useCallback(() => streamRef.current?.getVideoTracks()[0] ?? null, []);

  const refreshTorchSupport = useCallback(() => {
    const track = getVideoTrack();
    const capabilities = (track?.getCapabilities?.() ?? {}) as MediaTrackCapabilities & {
      torch?: boolean;
    };
    setTorchAvailable(capabilities.torch === true);
  }, [getVideoTrack]);

  const toggleTorch = useCallback(async () => {
    const track = getVideoTrack();
    if (!track) return;
    const next = !torchOnRef.current;
    try {
      await track.applyConstraints({
        advanced: [{ torch: next } as unknown as MediaTrackConstraintSet],
      });
      torchOnRef.current = next;
      setTorchOn(next);
    } catch {
      /* torch unsupported on this device — ignore */
    }
  }, [getVideoTrack]);

  const setZoom = useCallback((next: number) => {
    const clamped = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(next * 10) / 10));
    zoomRef.current = clamped;
    setZoomState(clamped);
  }, []);

  const zoomIn = useCallback(() => setZoom(zoomRef.current + ZOOM_STEP), [setZoom]);
  const zoomOut = useCallback(() => setZoom(zoomRef.current - ZOOM_STEP), [setZoom]);

  /** JS fallback decoder. Reuses the stream we already own (no second getUserMedia). */
  const startZxing = useCallback(async () => {
    const stream = streamRef.current;
    const video = videoRef.current;
    if (!stream || !video) return;
    setMethod('zxing');
    try {
      const { BrowserMultiFormatReader, BarcodeFormat } = await import('@zxing/browser');
      const reader = new BrowserMultiFormatReader(undefined, {
        delayBetweenScanAttempts: 200,
      });
      // Restrict to the grocery codes the native detector also targets — this
      // trims false positives and makes the JS decoder measurably snappier.
      reader.possibleFormats = [
        BarcodeFormat.EAN_13,
        BarcodeFormat.EAN_8,
        BarcodeFormat.UPC_A,
        BarcodeFormat.UPC_E,
        BarcodeFormat.CODE_128,
      ];
      zxingControlsRef.current = await reader.decodeFromStream(stream, video, (result) => {
        if (result && result.getText()) emit(result.getText());
      });
    } catch {
      stop();
      setError('decode-unavailable');
    }
  }, [emit, stop]);

  /** Native BarcodeDetector loop (GPU-accelerated where available). */
  const startNative = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    setMethod('native');

    const Ctor = (window as unknown as {
      BarcodeDetector: new (opts?: { formats: string[] }) => NativeBarcodeDetector;
    }).BarcodeDetector;

    let detector: NativeBarcodeDetector;
    try {
      detector = new Ctor({
        formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'],
      });
    } catch {
      // Formats unsupported on this build — fall back to the JS decoder.
      void startZxing();
      return;
    }

    let lastDecodeAt = 0;
    const tick = async () => {
      if (!streamRef.current) return;
      const v = videoRef.current;
      const now = performance.now();
      // Wait for real frames and throttle so we don't hammer the detector.
      if (v && v.videoWidth > 0 && v.videoHeight > 0 && now - lastDecodeAt >= DECODE_INTERVAL_MS) {
        lastDecodeAt = now;
        try {
          const codes = await detector.detect(v);
          for (const detected of codes) {
            if (detected.rawValue) emit(detected.rawValue);
          }
        } catch {
          /* frame not ready yet — keep polling */
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [emit, startZxing]);

  const start = useCallback(async () => {
    if (runningRef.current || !enabledRef.current) return;
    const token = ++startTokenRef.current;
    runningRef.current = true;
    setError(null);

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      runningRef.current = false;
      setError('camera-unavailable');
      return;
    }

    // Ask for more pixels when the native detector is available (it is
    // GPU-accelerated and reads better from a higher-res feed); the JS decoder
    // prefers a lighter 720p feed so CPU decode stays smooth.
    const useNative = typeof window !== 'undefined' && 'BarcodeDetector' in window;

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          ...(useNative
            ? { width: { ideal: 1920 }, height: { ideal: 1080 } }
            : { width: { ideal: 1280 }, height: { ideal: 720 } }),
        },
        audio: false,
      });
    } catch {
      if (token === startTokenRef.current) {
        runningRef.current = false;
        setError('camera-denied');
      }
      return;
    }

    // Superseded (e.g. StrictMode remount or a stop during the prompt) — drop
    // the stream instead of leaking a second camera.
    if (token !== startTokenRef.current) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }
    streamRef.current = stream;

    const video = videoRef.current;
    if (!video) {
      stream.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      if (token === startTokenRef.current) {
        runningRef.current = false;
        setError('camera-unavailable');
      }
      return;
    }
    video.srcObject = stream;
    try {
      await video.play();
    } catch {
      /* autoplay policy — the frame still renders */
    }

    if (token !== startTokenRef.current) return; // superseded mid-play

    setRunning(true);

    if (useNative) {
      startNative();
    } else {
      await startZxing();
    }
    refreshTorchSupport();
  }, [startNative, startZxing, refreshTorchSupport]);

  // Auto-start / auto-stop the camera with the session lifecycle.
  useEffect(() => {
    if (!enabled) {
      stop();
      return;
    }
    if (autoStart) void start();
  }, [enabled, autoStart, start, stop]);

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

  return {
    videoRef,
    start,
    stop,
    running,
    error,
    method,
    zoom,
    setZoom,
    zoomIn,
    zoomOut,
    canZoomIn: zoom < MAX_ZOOM,
    canZoomOut: zoom > MIN_ZOOM,
    torchOn,
    torchAvailable,
    toggleTorch,
  };
}
