import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const root = new URL('..', import.meta.url);

function read(rel: string): string {
  return readFileSync(new URL(rel, root), 'utf8');
}

describe('Performance guardrails', () => {
  it('keeps the root layout static and free of Firebase', () => {
    const layout = read('src/app/layout.tsx');
    // Public pages must be prerendered at build time, not per request.
    assert.ok(
      !/export\s+const\s+dynamic\s*=\s*['"]force-dynamic['"]/.test(layout),
      'root layout must not be force-dynamic',
    );
    assert.ok(!/await\s+(headers|cookies)\(\)/.test(layout), 'root layout must not read headers/cookies');
    // No Firebase/SDK on the shared layout: only the authenticated app
    // route layouts may mount AppProviders / analytics.
    assert.ok(!layout.includes('AppProviders'), 'root layout must not mount AppProviders');
    assert.ok(!layout.includes('FirebaseAnalytics'), 'root layout must not mount Firebase analytics');
    assert.ok(!layout.includes('@/lib/firebase'), 'root layout must not import the Firebase SDK');
    // PWA wiring must remain in place.
    assert.ok(layout.includes('ServiceWorkerRegistrar'));
    assert.ok(layout.includes('InstallBanner'));
    assert.ok(layout.includes('maximumScale: 1'));
  });

  it('does not bundle French/Arabic translations on first load', () => {
    // Only English may be statically imported by the shared i18n core;
    // fr/ar must be code-split and loaded on demand.
    const core = read('src/lib/i18n-core.ts');
    assert.ok(!core.includes('messages/fr.json'));
    assert.ok(!core.includes('messages/ar.json'));

    const light = read('src/lib/i18n-light.tsx');
    assert.ok(light.includes("loadMessages"), 'public i18n provider must load locales lazily');
  });

  it('keeps the marketing site free of the Firebase auth SDK', () => {
    for (const file of [
      'src/components/landing/hero-section.tsx',
      'src/components/landing/navigation.tsx',
      'src/components/landing/cta-section.tsx',
      'src/components/landing/pricing-section.tsx',
    ]) {
      const source = read(file);
      assert.ok(
        !source.includes('auth-context'),
        `${file} must use the cookie auth-status hook, not the full Firebase SDK`,
      );
    }
    assert.ok(existsSync(new URL('src/lib/auth-status.ts', root)));
  });

  it('splits dashboard modals out of the initial page chunk', () => {
    const modals = read('src/components/dashboard/dashboard-modals.tsx');
    assert.ok(modals.includes('next/dynamic'), 'dashboard modals must be code-split');
    assert.ok(
      !modals.includes("from '@/components/modals/ExpenseModal'"),
      'modals must be imported lazily, not statically',
    );
  });

  it('caps canvas animation cost on the landing page', () => {
    const hook = read('src/components/landing/use-animated-canvas.ts');
    assert.ok(hook.includes('devicePixelRatio'), 'canvas hooks must run at capped DPR');
    assert.ok(hook.includes('prefers-reduced-motion'), 'canvas hooks must respect reduced motion');
    assert.ok(hook.includes('IntersectionObserver'), 'canvas hooks must pause off-screen');
  });

  it('serves cache and CSP headers from middleware', () => {
    const middleware = read('src/middleware.ts');
    assert.ok(middleware.includes('max-age=31536000'), 'static assets should be immutable');
    assert.ok(middleware.includes("no-store"), 'private routes should never be cached');
    assert.ok(middleware.includes('s-maxage'), 'public HTML should be CDN-cacheable');
    assert.ok(middleware.includes("'unsafe-inline'"), 'static public CSP must allow Next inline scripts');
  });

  it('keeps dashboard navigation instant (static + prefetched + no spinner)', () => {
    // Dashboard/login/onboarding must be prerendered so clicking a nav item
    // is a client-side route change with a cached RSC payload — not a
    // server round-trip.
    for (const layout of [
      'src/app/dashboard/layout.tsx',
      'src/app/login/layout.tsx',
      'src/app/onboarding/layout.tsx',
    ]) {
      assert.ok(
        !/export\s+const\s+dynamic\s*=\s*['"]force-dynamic['"]/.test(read(layout)),
        `${layout} must not be force-dynamic`,
      );
    }

    // The shell prefetches every screen once idle.
    const shell = read('src/components/dashboard/dashboard-shell.tsx');
    assert.ok(shell.includes('router.prefetch'), 'dashboard shell must prefetch screens');
    assert.ok(shell.includes('DASHBOARD_NAV_HREFS'), 'dashboard shell must prefetch all routes');

    // No navigation link may opt out of prefetching.
    for (const file of [
      'src/components/dashboard/sidebar.tsx',
      'src/components/dashboard/bottom-nav.tsx',
      'src/components/dashboard/dashboard-header.tsx',
      'src/components/dashboard/screens/profile-screen.tsx',
      'src/components/dashboard/profile/profile-subpage.tsx',
      'src/components/dashboard/profile/pro-panel.tsx',
    ]) {
      assert.ok(!read(file).includes('prefetch={false}'), `${file} must prefetch nav links`);
    }

    // A full-screen loading spinner must never replace the app shell during
    // navigation.
    for (const loading of [
      'src/app/dashboard/loading.tsx',
      'src/app/login/loading.tsx',
      'src/app/onboarding/loading.tsx',
    ]) {
      assert.ok(existsSync(new URL(loading, root)), `${loading} must exist`);
    }

    // The transition must be snappy (<= 0.25s) and still animate on click.
    assert.ok(shell.includes('0.22'), 'dashboard transition should be short (~220ms)');
    assert.ok(shell.includes('AnimatePresence'), 'dashboard must keep the horizontal animation');
  });

  it('prevents the previous-page glitch during the push transition', () => {
    const shell = read('src/components/dashboard/dashboard-shell.tsx');
    // The outgoing screen must sit BEHIND the incoming one (z-index), overlay
    // the content box exactly (inner relative wrapper + inset: 0), not move
    // back over the new screen, and never swallow clicks.
    assert.ok(shell.includes('zIndex: 1'), 'incoming screen must stack above the outgoing one');
    assert.ok(shell.includes('zIndex: 0'), 'outgoing screen must be behind the incoming one');
    assert.ok(shell.includes("inset: 0"), 'outgoing screen must overlay the content box exactly');
    assert.ok(shell.includes("pointerEvents: 'none'"), 'outgoing screen must not intercept clicks');
    assert.ok(
      shell.includes('className="relative w-full"'),
      'an inner relative wrapper must scope the exiting screen to the content box',
    );
    assert.ok(
      shell.includes("window.scrollTo({ top: 0"),
      'navigation must reset scroll so the previous screen offset never glitches',
    );
    // The old page fades in place instead of sliding/scaling back on top.
    const exitVariant = shell.match(/exit:[\s\S]*?\n  \}\),/)?.[0] ?? '';
    assert.ok(!exitVariant.includes('scale'), 'outgoing screen must not scale');
    // `\bx:` matches the motion transform key and NOT the tail of "zIndex:".
    assert.ok(!/\bx:\s/.test(exitVariant), 'outgoing screen must not slide backwards');
  });
});
