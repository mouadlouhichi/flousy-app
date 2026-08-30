'use client';

import { useEffect, useState } from 'react';

/**
 * Lightweight sign-in status for PUBLIC pages.
 *
 * This intentionally does NOT import Firebase: the marketing site must stay
 * free of the Firebase SDK (tens of KB + hydration cost on every landing
 * visit). Instead, the authenticated app sets a tiny `flousy_authed` cookie
 * (see AuthProvider in ./auth-context), which we read here for CTA copy.
 *
 * The cookie is set client-side only, so a returning visitor sees the
 * authenticated CTA as soon as the cookie is present — no network call, no
 * SDK download.
 */
export const AUTH_COOKIE = 'flousy_authed';

const AUTH_COOKIE_RE = /(?:^|;\s*)flousy_authed=1/;

export function readAuthCookie(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    return AUTH_COOKIE_RE.test(document.cookie);
  } catch {
    return false;
  }
}

export function setAuthCookie(signedIn: boolean): void {
  if (typeof document === 'undefined') return;
  try {
    if (signedIn) {
      document.cookie = `${AUTH_COOKIE}=1;path=/;max-age=31536000;SameSite=Lax`;
    } else {
      document.cookie = `${AUTH_COOKIE}=;path=/;max-age=0;SameSite=Lax`;
    }
  } catch {
    /* ignore */
  }
}

export function useAuthStatus(): { signedIn: boolean; ready: boolean } {
  // Never read document.cookie during the initial render — SSR and the first
  // hydration pass must agree (no hydration mismatch). The cookie is read
  // once after mount; the CTA simply refreshes on the next render.
  const [signedIn, setSignedIn] = useState<boolean>(false);
  const [ready, setReady] = useState<boolean>(false);

  useEffect(() => {
    setSignedIn(readAuthCookie());
    setReady(true);
    // Re-check after hydration resolves in case a tab restored a session
    // (e.g. the user signed in in another tab).
    const check = () => setSignedIn(readAuthCookie());
    window.addEventListener('storage', check);
    return () => window.removeEventListener('storage', check);
  }, []);

  return { signedIn, ready };
}
