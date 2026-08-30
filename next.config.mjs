/** @type {import('next').NextConfig} */
// Frame blocking is owned by the CSP `frame-ancestors` directive in
// src/middleware.ts (applied per request, always fail closed). The legacy
// X-Frame-Options header is dropped off-production so `next dev` can be shown
// inside a preview pane / device frame; `next build` and `next start` both set
// NODE_ENV=production, so deployed builds keep it.
const isProduction = process.env.NODE_ENV === 'production';

const nextConfig = {
  output: 'standalone',
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
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          // CSP now lives in src/middleware.ts (needs a fresh nonce per
          // request on private routes). Needed alongside COOP so Firebase's
          // signInWithPopup() can still talk back to the opener window.
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
          { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
        ],
      },
      // Next.js builds hashed, content-addressed assets in /_next/static —
      // cache them permanently so repeat navigations never re-download them.
      {
        source: '/_next/static/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source: '/_next/image(.*)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
    ];
  },
};

export default nextConfig;