import type { Page } from '@playwright/test';

/**
 * The proxy (src/proxy.ts) bounces cookie-less hits on /dashboard and
 * /onboarding to /login — the anonymous fast-path PR #69 added. The real app
 * sets the `smartjib_authed` cookie the moment a session (real or demo)
 * starts, via setAuthCookie() in src/lib/auth-status.ts; the demo-login
 * button and the /login redirect both carry it, which is why the
 * demo-journey specs pass.
 *
 * Specs that seed localStorage and jump straight into /dashboard bypass that
 * client flow, so they must plant the same cookie a returning visitor's
 * browser would already have — otherwise the proxy 307s them to /login and
 * the dashboard never renders.
 */
export async function establishDashboardSession(page: Page): Promise<void> {
  await page.context().addCookies([
    {
      name: 'smartjib_authed',
      value: '1',
      // Mirrors `baseURL` in playwright.config.ts (the webServer port).
      url: 'http://localhost:3100',
      sameSite: 'Lax',
    },
  ]);
}
