'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { BarcodeCandidate, BarcodeSymbology } from '@/lib/gtin';
import {
  KeyboardWedgeCollector,
  armScannerGeneration,
  claimScannerCandidate,
  createScannerAcceptanceState,
  invalidateScannerGeneration,
} from '@/lib/scanner-lifecycle';

export type ScanMethod = 'native' | 'zxing' | 'none';
export type ScannerState = 'idle' | 'acquiring' | 'ready' | 'accepted' | 'paused' | 'error';
export type ScanError =
  | 'camera-unavailable'
  | 'camera-denied'
  | 'camera-not-found'
  | 'camera-busy'
  | 'camera-constraints'
  | 'insecure-context'
  | 'camera-ended'
  | 'decode-unavailable'
  | null;

interface UseBarcodeScannerOptions {
  enabled: boolean;
  onCode: (candidate: BarcodeCandidate) => void;
  autoStart?: boolean;
  initialZoom?: number;
  deviceId?: string;
}

interface NativeDetectedBarcode {
  rawValue: string;
  format?: string;
}

interface NativeBarcodeDetector {
  detect(source: CanvasImageSource): Promise<NativeDetectedBarcode[]>;
}

interface NumericCapability {
  min?: number;
  max?: number;
  step?: number;
}

interface VideoCapabilities extends MediaTrackCapabilities {
  torch?: boolean;
  zoom?: NumericCapability | number;
}

interface VideoSettings extends MediaTrackSettings {
  zoom?: number;
}

const DECODE_INTERVAL_MS = 70;
const ROI_WIDTH_RATIO = 0.82;
const ROI_HEIGHT_RATIO = 0.38;

function nativeFormat(value: string | undefined): BarcodeSymbology {
  const normalized = (value ?? '').toLowerCase();
  if (normalized === 'ean_8') return 'EAN_8';
  if (normalized === 'ean_13') return 'EAN_13';
  if (normalized === 'upc_a') return 'UPC_A';
  if (normalized === 'upc_e') return 'UPC_E';
  if (normalized === 'itf') return 'ITF_14';
  if (normalized === 'code_128') return 'CODE_128';
  return 'UNKNOWN';
}

function classifyMediaError(error: unknown): Exclude<ScanError, null> {
  if (typeof window !== 'undefined' && !window.isSecureContext) return 'insecure-context';
  const name = error instanceof DOMException
    ? error.name
    : typeof error === 'object' && error && 'name' in error
      ? String((error as { name?: unknown }).name)
      : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'camera-denied';
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') return 'camera-not-found';
  if (name === 'NotReadableError' || name === 'TrackStartError') return 'camera-busy';
  if (name === 'OverconstrainedError' || name === 'ConstraintNotSatisfiedError') return 'camera-constraints';
  return 'camera-unavailable';
}

export function useBarcodeScanner({
  enabled,
  onCode,
  autoStart = true,
  initialZoom = 1,
  deviceId,
}: UseBarcodeScannerOptions) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const zxingControlsRef = useRef<{ stop: () => void } | null>(null);
  const acceptanceRef = useRef(createScannerAcceptanceState());
  const activeRef = useRef(false);
  const enabledRef = useRef(enabled);
  const onCodeRef = useRef(onCode);
  const torchOnRef = useRef(false);
  const lastCameraCodeRef = useRef<string | null>(null);
  const clearFramesRef = useRef(0);
  const pauseReasonRef = useRef<'visibility' | 'accepted' | null>(null);

  enabledRef.current = enabled;
  onCodeRef.current = onCode;

  const [state, setState] = useState<ScannerState>('idle');
  const [error, setError] = useState<ScanError>(null);
  const [method, setMethod] = useState<ScanMethod>('none');
  const [zoom, setZoomState] = useState(1);
  const [zoomRange, setZoomRange] = useState<{ min: number; max: number; step: number } | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [roiActive, setRoiActive] = useState(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);

  const tearDown = useCallback(() => {
    invalidateScannerGeneration(acceptanceRef.current);
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    try {
      zxingControlsRef.current?.stop();
    } catch {
      // Decoder may already be stopped.
    }
    zxingControlsRef.current = null;
    const stream = streamRef.current;
    streamRef.current = null;
    activeRef.current = false;
    stream?.getTracks().forEach((track) => {
      track.onended = null;
      track.stop();
    });
    if (videoRef.current) videoRef.current.srcObject = null;
    torchOnRef.current = false;
    setTorchOn(false);
    setTorchAvailable(false);
    setZoomRange(null);
    setZoomState(1);
    setRoiActive(false);
    setMethod('none');
  }, []);

  const stop = useCallback(() => {
    acceptanceRef.current.armed = false;
    pauseReasonRef.current = null;
    tearDown();
    setState('idle');
  }, [tearDown]);

  /** Synchronously locks acceptance, then stops every decoder/track before the
   * consumer callback or feedback runs. */
  const accept = useCallback((candidate: BarcodeCandidate, generation: number) => {
    if (!claimScannerCandidate(acceptanceRef.current, generation, enabledRef.current)) return false;
    pauseReasonRef.current = 'accepted';
    if (candidate.source === 'camera-native' || candidate.source === 'camera-zxing') {
      lastCameraCodeRef.current = candidate.rawValue;
    }
    tearDown();
    setState('accepted');
    onCodeRef.current(candidate);
    return true;
  }, [tearDown]);

  const getVideoTrack = useCallback(() => streamRef.current?.getVideoTracks()[0] ?? null, []);

  const refreshCapabilities = useCallback(async () => {
    const track = getVideoTrack();
    if (!track) return;
    const capabilities = (track.getCapabilities?.() ?? {}) as VideoCapabilities;
    setTorchAvailable(capabilities.torch === true);
    const rawZoom = capabilities.zoom;
    if (rawZoom && typeof rawZoom === 'object') {
      const min = Number(rawZoom.min ?? 1);
      const max = Number(rawZoom.max ?? min);
      const step = Math.max(0.1, Number(rawZoom.step ?? 0.1));
      if (Number.isFinite(min) && Number.isFinite(max) && max > min) {
        setZoomRange({ min, max, step });
        const desired = Math.min(max, Math.max(min, initialZoom));
        try {
          await track.applyConstraints({ advanced: [{ zoom: desired } as MediaTrackConstraintSet] });
          setZoomState(desired);
        } catch {
          setZoomState(Number((track.getSettings() as VideoSettings).zoom ?? min));
        }
      }
    }
  }, [getVideoTrack, initialZoom]);

  const setZoom = useCallback(async (next: number) => {
    const track = getVideoTrack();
    if (!track || !zoomRange) return false;
    const clamped = Math.min(zoomRange.max, Math.max(zoomRange.min, next));
    try {
      await track.applyConstraints({ advanced: [{ zoom: clamped } as MediaTrackConstraintSet] });
      setZoomState(Number((track.getSettings() as VideoSettings).zoom ?? clamped));
      return true;
    } catch {
      return false;
    }
  }, [getVideoTrack, zoomRange]);

  const zoomIn = useCallback(() => {
    if (zoomRange) void setZoom(zoom + zoomRange.step);
  }, [setZoom, zoom, zoomRange]);
  const zoomOut = useCallback(() => {
    if (zoomRange) void setZoom(zoom - zoomRange.step);
  }, [setZoom, zoom, zoomRange]);

  const setTorch = useCallback(async (on: boolean) => {
    const track = getVideoTrack();
    if (!track) return false;
    try {
      await track.applyConstraints({ advanced: [{ torch: on } as MediaTrackConstraintSet] });
      torchOnRef.current = on;
      setTorchOn(on);
      return true;
    } catch {
      return false;
    }
  }, [getVideoTrack]);

  const toggleTorch = useCallback(async () => {
    await setTorch(!torchOnRef.current);
  }, [setTorch]);

  const startZxing = useCallback(async (generation: number) => {
    const stream = streamRef.current;
    const video = videoRef.current;
    if (!stream || !video || generation !== acceptanceRef.current.generation) return;
    setMethod('zxing');
    setRoiActive(false);
    try {
      const { BrowserMultiFormatReader, BarcodeFormat } = await import('@zxing/browser');
      if (generation !== acceptanceRef.current.generation || !acceptanceRef.current.armed) return;
      const reader = new BrowserMultiFormatReader(undefined, { delayBetweenScanAttempts: 70 });
      reader.possibleFormats = [
        BarcodeFormat.EAN_13,
        BarcodeFormat.EAN_8,
        BarcodeFormat.UPC_A,
        BarcodeFormat.UPC_E,
      ];
      const controls = await reader.decodeFromStream(stream, video, (result) => {
        if (!result || generation !== acceptanceRef.current.generation || !acceptanceRef.current.armed) return;
        const rawValue = result.getText();
        if (!rawValue) return;
        const formatName = BarcodeFormat[result.getBarcodeFormat()] as string | undefined;
        accept({ rawValue, format: nativeFormat(formatName), source: 'camera-zxing' }, generation);
      });
      if (generation !== acceptanceRef.current.generation || !acceptanceRef.current.armed) {
        controls.stop();
        return;
      }
      zxingControlsRef.current = controls;
    } catch {
      if (generation !== acceptanceRef.current.generation) return;
      tearDown();
      setError('decode-unavailable');
      setState('error');
    }
  }, [accept, tearDown]);

  const startNative = useCallback((generation: number) => {
    const video = videoRef.current;
    if (!video || generation !== acceptanceRef.current.generation) return;
    setMethod('native');
    setRoiActive(true);
    const Constructor = (window as unknown as {
      BarcodeDetector: new (options?: { formats: string[] }) => NativeBarcodeDetector;
    }).BarcodeDetector;
    let detector: NativeBarcodeDetector;
    try {
      detector = new Constructor({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'itf'] });
    } catch {
      void startZxing(generation);
      return;
    }
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) {
      void startZxing(generation);
      return;
    }
    let detecting = false;
    let lastDecodeAt = 0;
    const tick = async (now: number) => {
      if (generation !== acceptanceRef.current.generation || !acceptanceRef.current.armed || !streamRef.current) return;
      const currentVideo = videoRef.current;
      if (!detecting && currentVideo && currentVideo.videoWidth > 0 && currentVideo.videoHeight > 0 && now - lastDecodeAt >= DECODE_INTERVAL_MS) {
        detecting = true;
        lastDecodeAt = now;
        const sourceWidth = Math.round(currentVideo.videoWidth * ROI_WIDTH_RATIO);
        const sourceHeight = Math.round(currentVideo.videoHeight * ROI_HEIGHT_RATIO);
        const sourceX = Math.round((currentVideo.videoWidth - sourceWidth) / 2);
        const sourceY = Math.round((currentVideo.videoHeight - sourceHeight) / 2);
        canvas.width = sourceWidth;
        canvas.height = sourceHeight;
        context.drawImage(currentVideo, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, sourceWidth, sourceHeight);
        try {
          const codes = await detector.detect(canvas);
          if (generation !== acceptanceRef.current.generation || !acceptanceRef.current.armed) return;
          if (codes.length === 0) {
            clearFramesRef.current += 1;
            if (clearFramesRef.current >= 3) lastCameraCodeRef.current = null;
          } else {
            clearFramesRef.current = 0;
            const detected = codes.find((code) => code.rawValue && code.rawValue !== lastCameraCodeRef.current);
            if (detected) {
              accept({
                rawValue: detected.rawValue,
                format: nativeFormat(detected.format),
                source: 'camera-native',
              }, generation);
              return;
            }
          }
        } catch {
          // A transient frame/decode error does not invalidate the camera.
        } finally {
          detecting = false;
        }
      }
      if (generation === acceptanceRef.current.generation && acceptanceRef.current.armed) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [accept, startZxing]);

  const start = useCallback(async (requestedDeviceId?: string) => {
    if (!enabledRef.current || activeRef.current) return;
    tearDown();
    const generation = armScannerGeneration(acceptanceRef.current);
    activeRef.current = true;
    pauseReasonRef.current = null;
    setError(null);
    setState('acquiring');

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      activeRef.current = false;
      acceptanceRef.current.armed = false;
      setError(typeof window !== 'undefined' && !window.isSecureContext ? 'insecure-context' : 'camera-unavailable');
      setState('error');
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          ...(requestedDeviceId || deviceId
            ? { deviceId: { exact: requestedDeviceId || deviceId } }
            : { facingMode: { ideal: 'environment' } }),
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
    } catch (caught) {
      if (generation === acceptanceRef.current.generation) {
        activeRef.current = false;
        acceptanceRef.current.armed = false;
        setError(classifyMediaError(caught));
        setState('error');
      }
      return;
    }

    if (generation !== acceptanceRef.current.generation || !enabledRef.current || !acceptanceRef.current.armed) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }
    streamRef.current = stream;
    const track = stream.getVideoTracks()[0];
    if (track) {
      track.onended = () => {
        if (generation !== acceptanceRef.current.generation || !acceptanceRef.current.armed) return;
        acceptanceRef.current.armed = false;
        tearDown();
        setError('camera-ended');
        setState('error');
      };
    }

    const video = videoRef.current;
    if (!video) {
      tearDown();
      setError('camera-unavailable');
      setState('error');
      return;
    }
    video.srcObject = stream;
    try {
      await video.play();
    } catch {
      // Some browsers start rendering after the first user gesture.
    }
    if (generation !== acceptanceRef.current.generation || !acceptanceRef.current.armed) return;

    setState('ready');
    void refreshCapabilities();
    try {
      const found = await navigator.mediaDevices.enumerateDevices();
      if (generation === acceptanceRef.current.generation) setDevices(found.filter((item) => item.kind === 'videoinput'));
    } catch {
      // Device enumeration is optional.
    }
    if (typeof window !== 'undefined' && 'BarcodeDetector' in window) startNative(generation);
    else void startZxing(generation);
  }, [deviceId, refreshCapabilities, startNative, startZxing, tearDown]);

  const rearm = useCallback((options?: { allowSameCameraCode?: boolean }) => {
    if (options?.allowSameCameraCode) lastCameraCodeRef.current = null;
    if (!enabledRef.current) return;
    setState('paused');
    void start();
  }, [start]);

  const startedForEnableRef = useRef(false);
  useEffect(() => {
    if (!enabled) {
      startedForEnableRef.current = false;
      stop();
      return;
    }
    if (autoStart && !startedForEnableRef.current) {
      startedForEnableRef.current = true;
      void start();
    }
  }, [enabled, autoStart, start, stop]);

  // A keyboard wedge represents an explicit hardware trigger. It shares the
  // same synchronous acceptance mutex and supports every GTIN length.
  useEffect(() => {
    if (!enabled) return;
    const collector = new KeyboardWedgeCollector();
    const onKeyDown = (event: KeyboardEvent) => {
      if (!acceptanceRef.current.armed) return;
      const target = event.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) {
        collector.reset();
        return;
      }
      const value = collector.push(event.key);
      if (value !== null) {
        event.preventDefault();
        accept(
          { rawValue: value, format: 'UNKNOWN', source: 'wedge' },
          acceptanceRef.current.generation,
        );
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [accept, enabled]);

  useEffect(() => {
    if (!enabled) return;
    const onVisibility = () => {
      if (document.hidden && (state === 'ready' || state === 'acquiring')) {
        acceptanceRef.current.armed = false;
        pauseReasonRef.current = 'visibility';
        tearDown();
        setState('paused');
      } else if (!document.hidden && pauseReasonRef.current === 'visibility') {
        pauseReasonRef.current = null;
        void start();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [enabled, start, state, tearDown]);

  useEffect(() => () => stop(), [stop]);

  return {
    videoRef,
    start,
    stop,
    rearm,
    state,
    running: state === 'acquiring' || state === 'ready',
    error,
    method,
    zoom,
    setZoom,
    zoomIn,
    zoomOut,
    canZoomIn: Boolean(zoomRange && zoom < zoomRange.max),
    canZoomOut: Boolean(zoomRange && zoom > zoomRange.min),
    hardwareZoomAvailable: Boolean(zoomRange),
    torchOn,
    torchAvailable,
    toggleTorch,
    roiActive,
    devices,
  };
}
