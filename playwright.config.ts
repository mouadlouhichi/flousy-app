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
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    // Budgeting on the phone is the primary use case.
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'npm run build && npx next start -p 3100',
    url: 'http://localhost:3100',
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
  },
});
