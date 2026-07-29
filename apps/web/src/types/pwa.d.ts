import type { BeforeInstallPromptEvent } from '../hooks/use-pwa-install';

declare global {
  interface Window {
    /**
     * Stash for the `beforeinstallprompt` event. The browser fires it once,
     * very early in page life, so it's captured in a top-level script and
     * replayed to React components that mount afterwards.
     */
    __flousyInstallPrompt: BeforeInstallPromptEvent | null;
  }

  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
    appinstalled: Event;
    'flousy:installprompt': Event;
  }
}

export {};
