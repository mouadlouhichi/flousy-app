import { test, expect } from '@playwright/test';

test('close month lives in Profile settings and keeps the confirmation and reopen flow', async ({ page }) => {
  await page.goto('/login');
  await page.evaluate(() => {
    localStorage.setItem('flousy_demo_mode', 'true');
    localStorage.setItem('flousy_onboarding_done', 'true');
  });
  await page.goto('/dashboard');
  await expect(page.getByRole('banner').getByRole('button', { name: 'Previous month' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Close month/ })).toHaveCount(0);

  // Both the desktop sidebar footer and mobile avatar lead to this hub.
  await page.locator('a[href="/dashboard/profile"]:visible').click();
  await expect(page).toHaveURL(/\/dashboard\/profile$/);
  const settings = page.getByRole('main').locator('section').filter({
    has: page.getByRole('heading', { name: 'Settings', exact: true }),
  });
  const closeMonth = settings.getByRole('button', { name: /Close month/ });
  // The routed pages briefly overlap while the navigation animation finishes.
  await expect(closeMonth).toHaveCount(1);
  await expect(closeMonth).toBeEnabled();
  await expect(closeMonth).toContainText('Make the selected month read-only');
  await expect(page.getByRole('banner').getByRole('button', { name: /Close month/ })).toHaveCount(0);

  await closeMonth.click();
  const confirmation = page.getByRole('dialog', { name: 'Close month', exact: true });
  await expect(confirmation).toContainText('read-only until you reopen it');
  await confirmation.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(confirmation).not.toBeVisible();
  await expect(closeMonth).toBeEnabled();
  await expect(page.getByText('Month closed', { exact: true })).toHaveCount(0);

  await closeMonth.click();
  await confirmation.getByRole('button', { name: 'Close month', exact: true }).click();
  await expect(page.getByText('Month closed', { exact: true })).toBeVisible();
  await expect(closeMonth).toHaveCount(0);

  // The action still closes the selected period, not every month.
  await page.getByRole('button', { name: 'Previous month', exact: true }).click();
  await expect(closeMonth).toBeEnabled();
  await expect(page.getByText('Month closed', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Next month', exact: true }).click();
  await expect(page.getByText('Month closed', { exact: true })).toBeVisible();
  await expect(closeMonth).toHaveCount(0);

  // The existing global banner remains the way to reopen a closed month.
  await page.getByRole('button', { name: 'Reopen month', exact: true }).click();
  const reopenConfirmation = page.getByRole('dialog', { name: 'Reopen month', exact: true });
  await reopenConfirmation.getByRole('button', { name: 'Reopen month', exact: true }).click();
  await expect(page.getByText('Month closed', { exact: true })).toHaveCount(0);
  await expect(closeMonth).toBeEnabled();
});
