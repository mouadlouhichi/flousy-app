import { test, expect, type Page } from '@playwright/test';

/**
 * The landing header renders two language controls: a dropdown behind the
 * "Change language" globe on desktop, and per-locale pill buttons inside the
 * full-screen hamburger menu on mobile. The helper takes whichever surface
 * the current viewport actually shows.
 */
async function switchLanguage(page: Page, localeName: string) {
  const desktopSwitcher = page.getByRole('button', { name: 'Change language' }).first();
  if (await desktopSwitcher.isVisible()) {
    await desktopSwitcher.click();
    await page.getByRole('button', { name: localeName }).first().click();
  } else {
    await page.getByRole('button', { name: 'Open menu' }).click();
    await page.getByRole('button', { name: localeName }).first().click();
  }
}

test.describe('locale switching', () => {
  test('French translation and back', async ({ page }) => {
    await page.goto('/');
    await switchLanguage(page, 'Français');
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
    await expect(page.getByText("L'app SmartJib").first()).toBeVisible();
  });

  test('Arabic flips the document to RTL', async ({ page }) => {
    await page.goto('/');
    await switchLanguage(page, 'العربية');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.getByText('تطبيق الميزانية').first()).toBeVisible();
  });
});
