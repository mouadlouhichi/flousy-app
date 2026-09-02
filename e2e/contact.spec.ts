import { test, expect } from '@playwright/test';

test.describe('contact form', () => {
  test('requires the mandatory fields before submitting', async ({ page }) => {
    await page.goto('/contact');
    await page.getByRole('button', { name: 'Send message' }).click();
    // Native validation blocks the submit; the form is still on screen and no
    // success panel appeared.
    await expect(page.getByLabel('Your name')).toBeVisible();
    await expect(page.getByText('Message sent')).toHaveCount(0);
  });

  test('degrades truthfully when email is not configured (CI has no key)', async ({ page }) => {
    await page.goto('/contact');
    await page.getByLabel('Your name').fill('E2E Robot');
    await page.getByLabel('Email address').fill('e2e@example.com');
    await page.getByLabel('Message').fill('Checking the honest fallback path.');
    await page.getByRole('button', { name: 'Send message' }).click();
    // No RESEND_API_KEY/CONTACT_TO_EMAIL in CI => 503 => support address shown,
    // and no fake "Message sent" screen.
    await expect(page.getByRole('alert')).toContainText('hello@flousy.app');
    await expect(page.getByText('Message sent')).toHaveCount(0);
  });
});
