'use client';

import * as React from 'react';

/**
 * The `beforeinstallprompt` event isn't in TypeScript's DOM lib yet.
 */
export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt(): Promise<void>;
}

const DISMISS_KEY = 'flousy:install-dismissed-at';
// Re-surface the prompt after two weeks if the user dismissed it.
const DISMISS_TTL_MS = 14 * 24 * 60 * 60 * 1000;

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    window.matchMedia('(display-mode: minimal-ui)').matches ||
    // iOS Safari
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true ||
    document.referrer.startsWith('android-app://')
  );
}

function isIosSafari(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent;
  const isIosDevice =
    /iPad|iPhone|iPod/.test(ua) ||
    // iPadOS 13+ reports as a Mac but has touch points.
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (!isIosDevice) return false;
  // Chrome/Firefox/Edge on iOS can't install PWAs; only Safari can.
  return !/CriOS|FxiOS|EdgiOS|OPiOS|mercury/i.test(ua);
}

function wasRecentlyDismissed(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = window.localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const at = Number(raw);
    if (!Number.isFinite(at)) return false;
    return Date.now() - at < DISMISS_TTL_MS;
  } catch {
    return false;
  }
}

export interface UsePwaInstall {
  /** True once the browser has offered us an installable prompt. */
  canInstall: boolean;
  /** True when the app is already running as an installed PWA. */
  isInstalled: boolean;
  /** iOS Safari never fires `beforeinstallprompt` — show manual instructions. */
  isIos: boolean;
  /** True while the native prompt is open. */
  isPrompting: boolean;
  /** Whether the user recently dismissed our own UI. */
  isDismissed: boolean;
  /** Triggers the native install prompt. Resolves to the user's choice. */
  promptInstall: () => Promise<'accepted' | 'dismissed' | 'unavailable'>;
  /** Hides our install UI and remembers the choice. */
  dismiss: () => void;
}

/**
 * Captures the `beforeinstallprompt` event so the app can offer its own
 * "Install" affordance. The event fires very early — often before React has
 * hydrated — so `PwaProvider` stashes it on `window` and we read it back here.
 */
export function usePwaInstall(): UsePwaInstall {
  const [deferredPrompt, setDeferredPrompt] = React.useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = React.useState(false);
  const [isIos, setIsIos] = React.useState(false);
  const [isPrompting, setIsPrompting] = React.useState(false);
  const [isDismissed, setIsDismissed] = React.useState(false);

  React.useEffect(() => {
    setIsInstalled(isStandalone());
    setIsIos(isIosSafari());
    setIsDismissed(wasRecentlyDismissed());

    // The event may have fired before this component mounted.
    const early = window.__flousyInstallPrompt;
    if (early) {
      setDeferredPrompt(early);
    }

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      window.__flousyInstallPrompt = event as BeforeInstallPromptEvent;
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    const onInstalled = () => {
      window.__flousyInstallPrompt = null;
      setDeferredPrompt(null);
      setIsInstalled(true);
    };

    // Custom event so components mounted later still learn about the prompt.
    const onCaptured = () => {
      if (window.__flousyInstallPrompt) {
        setDeferredPrompt(window.__flousyInstallPrompt);
      }
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onInstalled);
    window.addEventListener('flousy:installprompt', onCaptured);

    const displayModeQuery = window.matchMedia('(display-mode: standalone)');
    const onDisplayModeChange = (event: MediaQueryListEvent) => {
      if (event.matches) setIsInstalled(true);
    };
    displayModeQuery.addEventListener('change', onDisplayModeChange);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onInstalled);
      window.removeEventListener('flousy:installprompt', onCaptured);
      displayModeQuery.removeEventListener('change', onDisplayModeChange);
    };
  }, []);

  const promptInstall = React.useCallback(async () => {
    if (!deferredPrompt) return 'unavailable' as const;

    setIsPrompting(true);
    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;

      // A prompt can only be used once.
      window.__flousyInstallPrompt = null;
      setDeferredPrompt(null);

      if (outcome === 'dismissed') {
        try {
          window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
        } catch {
          /* storage unavailable — non-fatal */
        }
        setIsDismissed(true);
      }
      return outcome;
    } catch {
      return 'unavailable' as const;
    } finally {
      setIsPrompting(false);
    }
  }, [deferredPrompt]);

  const dismiss = React.useCallback(() => {
    try {
      window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* storage unavailable — non-fatal */
    }
    setIsDismissed(true);
  }, []);

  return {
    canInstall: Boolean(deferredPrompt) && !isInstalled,
    isInstalled,
    isIos: isIos && !isInstalled,
    isPrompting,
    isDismissed,
    promptInstall,
    dismiss,
  };
}
