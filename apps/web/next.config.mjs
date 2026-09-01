/** @type {import('next').NextConfig} */
// Frame blocking is owned by the CSP `frame-ancestors` directive in
// src/middleware.ts (applied per request, always fail closed). The legacy
// X-Frame-Options header is dropped off-production so `next dev` can be shown
// inside a preview pane / device frame; `next build` and `next start` both set
// NODE_ENV=production, so deployed builds keep it.
const isProduction = process.env.NODE_ENV === 'production';

// NOTE: `output: 'standalone'` was removed deliberately. It changes the
// production server contract (`node .next/standalone/server.js`) and makes
// `next start` warn/mislead, while Vercel — the actual deployment target —
// ignores it. Re-add it together with a Dockerfile if the app is ever
// self-hosted.
const nextConfig = {
  transpilePackages: ['@flousy/core'],
  reactStrictMode: true,
  poweredByHeader: false, // stop advertising "X-Powered-By: Next.js"
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          ...(isProduction ? [{ key: 'X-Frame-Options', value: 'SAMEORIGIN' }] : []),
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // `camera=(self)` — NOT `camera=()`. An empty allow-list disables the
          // camera for this origin too, which made `getUserMedia` reject with
          // NotAllowedError before any prompt and killed the barcode scanner
          // (both the native BarcodeDetector path and the @zxing fallback need
          // the media stream). Microphone and geolocation are genuinely unused.
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          // CSP now lives in src/middleware.ts (single source of truth for every
          // route, including /api). Needed alongside COOP so Firebase's
          // signInWithPopup() can still talk back to the opener window.
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
        ],
      },
      // CORP stays same-origin (XS-Leaks defence) for the app, but the assets
      // other sites legitimately embed — the social preview image and the app
      // icons — must be fetchable cross-origin or link previews lose them.
      {
        source: '/((?!opengraph-image|icon|favicon|logo|apple-touch-icon|apple-icon|web-app-manifest).*)',
        headers: [{ key: 'Cross-Origin-Resource-Policy', value: 'same-origin' }],
      },
      // Next.js builds hashed, content-addressed assets in /_next/static —
      // cache them permanently so repeat navigations never re-download them.
      {
        source: '/_next/static/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      // `/_next/image` URLs are keyed by their `?url=` query, so the same URL
      // is reused when a source image is replaced under an unchanged path.
      // `immutable` there pinned stale images in every CDN for a year, so the
      // optimizer's own max-age is left to govern (it is content-hashed per
      // source + width by Next).
      {
        source: '/_next/image(.*)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=604800' },
        ],
      },
    ];
  },
};

export default nextConfig;
