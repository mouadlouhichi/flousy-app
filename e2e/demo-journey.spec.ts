import { test, expect } from '@playwright/test';

/**
 * Demo mode is the one full journey that needs no Firebase project: /login
 * offers it whenever NEXT_PUBLIC_FIREBASE_* is absent (the CI environment).
 */
test.describe('demo mode journey', () => {
  test('entering demo mode lands in onboarding', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: 'Continue in Demo Mode' }).click();
    await page.waitForURL('**/onboarding');
    await expect(page.getByRole('main')).toBeVisible();
  });

  test('a returning demo session with finished onboarding goes to the dashboard', async ({ page }) => {
    // Seed the flags demo mode writes once onboarding completed.
    await page.goto('/login');
    await page.evaluate(() => {
      localStorage.setItem('flousy_demo_mode', 'true');
      localStorage.setItem('flousy_onboarding_done', 'true');
    });
    await page.goto('/login');
    await page.getByRole('button', { name: 'Continue to dashboard' }).click();
    await page.waitForURL('**/dashboard**');
  });
});
