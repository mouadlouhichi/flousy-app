import { NextRequest, NextResponse } from 'next/server';

/**
 * Two-tier security & caching policy:
 *
 * 1. PRIVATE routes (/dashboard, /login, /onboarding) — rendered per request
 *    (`force-dynamic` is set in their layouts) so the fresh per-request
 *    nonce can be matched to Next.js's inline hydration scripts. They keep a
 *    strict nonce-based CSP and are marked `private, no-store`.
 *
 * 2. PUBLIC routes (home, blog, legal pages…) — statically generated at
 *    build time and CDN-cached. Those HTML documents cannot carry a
 *    per-request nonce, so the CSP intentionally uses `'unsafe-inline'` for
 *    scripts only (all other directives stay strict); the page ships from
 *    the CDN without a server round-trip, which is what PageSpeed measures.
 */
const PRIVATE_PREFIXES = ['/dashboard', '/login', '/onboarding'];

function isPrivatePath(pathname: string): boolean {
  return PRIVATE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

const IMMUTABLE_ASSET_RE =
  /\.(?:png|jpe?g|webp|gif|svg|ico|woff2?|ttf|otf|css|js|map|json|webmanifest)$/i;
const SHORT_LIVED_PUBLIC = new Set([
  '/manifest.json',
  '/site.webmanifest',
  '/offline.html',
  '/robots.txt',
  '/sitemap.xml',
  '/llms.txt',
]);

function buildCsp(nonce: string | null, isDev: boolean, authDomain?: string): string {
  const scriptSrc = nonce
    ? `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://apis.google.com https://www.gstatic.com https://www.googletagmanager.com`
    : isDev
      ? `script-src 'self' 'unsafe-eval' 'unsafe-inline' https://apis.google.com https://www.gstatic.com https://www.googletagmanager.com`
      : `script-src 'self' 'unsafe-inline' https://apis.google.com https://www.gstatic.com https://www.googletagmanager.com`;

  return [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self'",
    "img-src 'self' data: https:",
    `connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://*.firebaseapp.com https://*.firebasestorage.app wss://*.firebaseio.com https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com${authDomain ? ` https://${authDomain}` : ''}`,
    `frame-src https://accounts.google.com https://*.firebaseapp.com https://*.google.com${authDomain ? ` https://${authDomain}` : ''}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    'upgrade-insecure-requests',
  ]
    .join('; ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function middleware(request: NextRequest) {
  const isDev = process.env.NODE_ENV === 'development';
  const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
  const { pathname } = request.nextUrl;
  const privateRoute = isPrivatePath(pathname);

  // Per-request nonce only for private routes (see header comment). Public
  // static pages are served from the CDN and cannot carry a matching nonce.
  const nonce = privateRoute ? Buffer.from(crypto.randomUUID()).toString('base64') : null;
  const csp = buildCsp(nonce, isDev, authDomain);

  const requestHeaders = new Headers(request.headers);
  if (nonce) {
    requestHeaders.set('x-nonce', nonce);
    requestHeaders.set('Content-Security-Policy', csp);
  }

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  response.headers.set('Content-Security-Policy', csp);

  // Order matters: robots/sitemap/manifest are NOT content-hashed, so they
  // must never be marked immutable even though they end in .txt/.json/...
  if (pathname === '/sw.js') {
    // Service worker updates must always be picked up.
    response.headers.set('Cache-Control', 'public, max-age=0, must-revalidate');
  } else if (SHORT_LIVED_PUBLIC.has(pathname)) {
    response.headers.set('Cache-Control', 'public, max-age=86400');
  } else if (privateRoute) {
    response.headers.set('Cache-Control', 'private, no-store, max-age=0');
  } else if (IMMUTABLE_ASSET_RE.test(pathname)) {
    // Content-hashed/versioned assets never change within a deploy → safe to
    // cache forever.
    response.headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  } else {
    // Public HTML: allow the CDN to hold it briefly, revalidate in background.
    response.headers.set(
      'Cache-Control',
      'public, max-age=0, s-maxage=300, stale-while-revalidate=86400',
    );
  }

  return response;
}

export const config = {
  matcher: [
    // Run on every page request so Next.js's hydration scripts get a
    // nonce; skip static assets, images, and API routes.
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
