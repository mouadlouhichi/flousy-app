import { test, expect } from '@playwright/test';

test.describe('locale switching', () => {
  test('French translation and back', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Change language' }).first().click();
    await page.getByRole('button', { name: 'Français' }).first().click();
    await expect(page.getByText("L'app SmartJib").first()).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  });

  test('Arabic flips the document to RTL', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Change language' }).first().click();
    await page.getByRole('button', { name: 'العربية' }).first().click();
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.getByText('تطبيق الميزانية').first()).toBeVisible();
  });
});
