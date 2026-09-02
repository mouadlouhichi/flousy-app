/** Shared Next.js config for SmartJib web. Keep vendors (Clerk, PostHog) out. */

export const FLOUSY_PACKAGES = [
  '@flousy/core',
  '@flousy/email',
  '@flousy/payments',
  '@flousy/observability',
  '@flousy/rate-limit',
];

/**
 * Security headers that do not need a per-request nonce.
 * CSP / frame-ancestors live in middleware.ts.
 */
export function securityHeaders({ isProduction = false, camera = false } = {}) {
  return [
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    ...(isProduction ? [{ key: 'X-Frame-Options', value: 'SAMEORIGIN' }] : []),
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    {
      key: 'Permissions-Policy',
      value: camera
        ? 'camera=(self), microphone=(), geolocation=()'
        : 'camera=(), microphone=(), geolocation=()',
    },
    { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
    { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
    { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
  ];
}

export function webNextConfig(overrides = {}) {
  const isProduction = process.env.NODE_ENV === 'production';
  return {
    output: 'standalone',
    reactStrictMode: true,
    poweredByHeader: false,
    transpilePackages: FLOUSY_PACKAGES,
    typescript: { ignoreBuildErrors: true },
    eslint: { ignoreDuringBuilds: true },
    async headers() {
      return [
        { source: '/(.*)', headers: securityHeaders({ isProduction, camera: true }) },
        {
          source: '/_next/static/(.*)',
          headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
        },
        {
          source: '/_next/image(.*)',
          headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
        },
      ];
    },
    ...overrides,
  };
}
