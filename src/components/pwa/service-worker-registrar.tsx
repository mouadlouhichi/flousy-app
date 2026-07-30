'use client';

import { useEffect } from 'react';

/**
 * Registers the service worker. Without a registered, activated service worker
 * that has a fetch handler, Chrome/Edge never fire `beforeinstallprompt`, so
 * the app can't be installed at all.
 *
 * Registration is skipped in development so a cached bundle can't be served
 * over a fresh one while iterating.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    let cancelled = false;

    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
        if (cancelled) return;

        // Activate an updated worker as soon as it's ready.
        registration.addEventListener('updatefound', () => {
          const installing = registration.installing;
          if (!installing) return;
          installing.addEventListener('statechange', () => {
            if (installing.state === 'installed' && navigator.serviceWorker.controller) {
              installing.postMessage('SKIP_WAITING');
            }
          });
        });
      } catch (error) {
        console.error('[pwa] Service worker registration failed:', error);
      }
    };

    // Wait for load so registration never competes with first paint.
    if (document.readyState === 'complete') {
      void register();
    } else {
      window.addEventListener('load', register, { once: true });
    }

    return () => {
      cancelled = true;
      window.removeEventListener('load', register);
    };
  }, []);

  return null;
}
