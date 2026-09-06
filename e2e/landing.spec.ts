import { test, expect } from '@playwright/test';

test.describe('landing and static pages', () => {
  test('home page renders with skip link and main landmark', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/SmartJib/i);
    await expect(page.locator('#main-content')).toBeVisible();
    // The skip link is the first thing keyboard users reach.
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Skip to main content' })).toBeFocused();
  });

  test('pricing surfaces advertise the 90-day trial, not stale beta wording', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('90-day Pro trial').first()).toBeVisible();
    await expect(page.getByText('included in the beta')).toHaveCount(0);

    const llms = await page.request.get('/llms.txt');
    expect(llms.ok()).toBeTruthy();
    const body = await llms.text();
    expect(body).toContain('90-day Pro trial');
    expect(body).not.toContain('beta');
  });

  test('static pages respond and carry their headings', async ({ page }) => {
    await page.goto('/help');
    await expect(page.getByRole('heading', { name: 'Questions, answered.' })).toBeVisible();

    await page.goto('/privacy');
    await expect(page.getByRole('heading', { name: 'Privacy Policy' })).toBeVisible();
    // Reconciled copy: household sharing is disclosed.
    await expect(page.getByText('household workspace', { exact: false }).first()).toBeVisible();

    await page.goto('/terms');
    await expect(page.getByRole('main')).toBeVisible();
  });

  test('security headers reach the browser', async ({ page }) => {
    const response = await page.goto('/');
    const csp = response?.headers()['content-security-policy'] ?? '';
    expect(csp).toContain("script-src-attr 'none'");
    expect(csp).toContain("object-src 'none'");
  });
});
