import { NextRequest, NextResponse } from 'next/server';

/**
 * Security & caching policy.
 *
 * All pages — public AND private app routes — are now statically generated
 * (the app shell contains no per-user data; user data is fetched client-side
 * after hydration). This is what makes in-app navigation instant: clicking a
 * nav link is a pure client-side route change with a cached RSC payload, no
 * server round-trip, no loading spinner.
 *
 * Because the HTML is prerendered, a per-request CSP nonce can never match
 * (a nonce requires per-request rendering). We therefore use one strict
 * origin-based CSP for every route: `script-src 'self' 'unsafe-inline'` only
 * (Google auth/analytics domains allow-listed), everything else locked down.
 *
 * Cache policy (explicit so any CDN — Vercel, Cloudflare, Netlify… — honors it):
 * - API routes:            no-store (they proxy third-party data per request)
 * - private app routes:    private, no-store (never cached by browser or CDN)
 * - public HTML:           public, s-maxage=300, stale-while-revalidate=86400
 * - hashed assets:         public, immutable (one year)
 * - robots/sitemap/manifest/llms: 1 day
 * - sw.js:                 must-revalidate (updates must be picked up)
 */
const PRIVATE_PREFIXES = ['/dashboard', '/login', '/onboarding'];

function isPrivatePath(pathname: string): boolean {
  return PRIVATE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

const IMMUTABLE_ASSET_RE =
  /\.(?:png|jpe?g|webp|gif|svg|ico|woff2?|ttf|otf|css|js|map|json|webmanifest)$/i;
const SHORT_LIVED_PUBLIC = new Set([
  '/manifest.json',
  '/manifest-fr.json',
  '/manifest-ar.json',
  '/site.webmanifest',
  '/offline.html',
  '/robots.txt',
  '/sitemap.xml',
  '/llms.txt',
]);

/**
 * Every origin the browser is allowed to talk to.
 *
 * `*.openfoodfacts.org` is required: src/lib/product-lookup.ts calls the Open
 * Food Facts API directly from the browser (world + Morocco instances) before
 * falling back to /api/barcode/lookup. Without it the CSP silently blocked
 * every direct lookup, so each scan paid an extra same-origin round-trip and
 * the proxy carried 100% of traffic.
 */
const CONNECT_SOURCES = [
  "'self'",
  'https://*.googleapis.com',
  'https://*.firebaseio.com',
  'https://*.firebaseapp.com',
  'https://*.firebasestorage.app',
  'wss://*.firebaseio.com',
  'https://*.google-analytics.com',
  'https://*.analytics.google.com',
  'https://*.googletagmanager.com',
  'https://*.openfoodfacts.org',
];

function buildCsp(isDev: boolean, authDomain?: string): string {
  const scriptSrc = isDev
    ? `script-src 'self' 'unsafe-eval' 'unsafe-inline' https://apis.google.com https://www.gstatic.com https://www.googletagmanager.com`
    : `script-src 'self' 'unsafe-inline' https://apis.google.com https://www.gstatic.com https://www.googletagmanager.com`;

  const connect = authDomain ? [...CONNECT_SOURCES, `https://${authDomain}`] : CONNECT_SOURCES;

  return [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self'",
    "img-src 'self' data: https:",
    `connect-src ${connect.join(' ')}`,
    // Scoped to the origins that actually frame us for sign-in. The previous
    // wildcard `https://*.google.com` also allow-listed every other Google
    // property (including attacker-reachable user content on googleusercontent
    // redirects) for no benefit.
    `frame-src 'self' https://accounts.google.com https://*.firebaseapp.com${authDomain ? ` https://${authDomain}` : ''}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    // `next dev` can be shown inside a preview pane / device frame; any real
    // deployment stays sealed (fail closed whenever NODE_ENV is unknown).
    isDev ? 'frame-ancestors *' : "frame-ancestors 'none'",
    'upgrade-insecure-requests',
  ]
    .filter(Boolean)
    .join('; ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function middleware(request: NextRequest) {
  const isDev = process.env.NODE_ENV === 'development';
  const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
  const { pathname } = request.nextUrl;
  const privateRoute = isPrivatePath(pathname);
  const apiRoute = pathname === '/api' || pathname.startsWith('/api/');
  const csp = buildCsp(isDev, authDomain);

  const response = NextResponse.next();
  // Applied to every route including /api — API handlers used to be excluded
  // from the matcher, so JSON responses were the one place with no CSP.
  response.headers.set('Content-Security-Policy', csp);

  if (apiRoute) {
    // Responses are per-request (and proxy third-party lookups); never cache
    // them at an edge that would then serve one user's data to another.
    response.headers.set('Cache-Control', 'no-store, max-age=0');
    return response;
  }

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
    // Run on every page and API request to attach CSP + cache headers; skip
    // static assets and images (covered by next.config).
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
