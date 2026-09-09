import { defineConfig, devices } from '@playwright/test';

/**
 * Browser E2E suite.
 *
 * NOT runnable in the development sandbox (the Playwright browser CDN is
 * unreachable there) — it targets CI and release machines:
 *
 *   npx playwright install chromium --with-deps
 *   npm run test:e2e
 *
 * The specs are written to need no Firebase project: without
 * NEXT_PUBLIC_FIREBASE_* variables the app offers demo mode, which is exactly
 * the environment CI provides. See e2e/README.md.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:3100',
    trace: 'on-first-retry',
  },
  projects: [
    // `PLAYWRIGHT_CHANNEL` is set by CI only when cdn.playwright.dev is down
    // and the pinned chromium build could not be downloaded: the run then
    // drives the runner image's preinstalled Google Chrome instead of
    // skipping the whole suite.
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}),
      },
    },
    // Budgeting on the phone is the primary use case.
    {
      name: 'mobile',
      use: {
        ...devices['Pixel 7'],
        ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}),
      },
    },
  ],
  webServer: {
    command: 'npm run build && npx next start -p 3100',
    url: 'http://localhost:3100',
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
  },
});
