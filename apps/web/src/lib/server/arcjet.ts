/**
 * Optional Arcjet protection for public API routes.
 *
 * When `ARCJET_KEY` is set, requests to the routes that opt in are run
 * through Arcjet's Shield (common attack patterns: SQLi, XSS payloads, path
 * traversal, …) and bot detection. Without the key — local dev, CI, keyless
 * deploys — this module never even loads the SDK (dynamic import) and every
 * request is allowed, so the integration is entirely inert until the secret
 * exists in the hosting platform.
 *
 * Failure posture is FAIL-OPEN: an Arcjet outage or SDK error lets traffic
 * through to the route's own auth + rate limiting rather than taking the API
 * down. Arcjet is defence-in-depth here, not the only line.
 */

import type { NextRequest } from 'next/server';

export interface ArcjetVerdict {
  denied: boolean;
  /** 'bot' | 'shield' | 'rate-limit' | '' — for the route's log line. */
  reason: string;
}

const ALLOW: ArcjetVerdict = { denied: false, reason: '' };

type ArcjetLike = { protect: (req: NextRequest) => Promise<unknown> };
let instance: Promise<ArcjetLike | null> | null = null;

async function getArcjet(): Promise<ArcjetLike | null> {
  const key = process.env.ARCJET_KEY;
  if (!key) return null;
  if (!instance) {
    instance = (async () => {
      try {
        const { default: arcjet, shield, detectBot } = await import('@arcjet/next');
        return arcjet({
          key,
          rules: [
            shield({ mode: 'LIVE' }),
            // These endpoints are only ever called by the app itself from a
            // browser; no bot (including "good" crawlers) has business here.
            detectBot({ mode: 'LIVE', allow: [] }),
          ],
        }) as unknown as ArcjetLike;
      } catch {
        return null; // SDK failed to load → fail open, retry next cold start
      }
    })();
  }
  return instance;
}

/** Run one request through Arcjet; allows everything when unconfigured. */
export async function checkArcjet(request: NextRequest): Promise<ArcjetVerdict> {
  try {
    const aj = await getArcjet();
    if (!aj) return ALLOW;
    const decision = (await aj.protect(request)) as {
      isDenied?: () => boolean;
      reason?: { isBot?: () => boolean; isShield?: () => boolean; isRateLimit?: () => boolean };
    };
    if (typeof decision?.isDenied === 'function' && decision.isDenied()) {
      const reason = decision.reason?.isBot?.()
        ? 'bot'
        : decision.reason?.isRateLimit?.()
          ? 'rate-limit'
          : 'shield';
      return { denied: true, reason };
    }
    return ALLOW;
  } catch {
    return ALLOW; // fail open
  }
}
