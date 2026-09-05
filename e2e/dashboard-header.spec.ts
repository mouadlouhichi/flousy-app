import { test, expect } from '@playwright/test';
import en from '../messages/en.json' with { type: 'json' };
import fr from '../messages/fr.json' with { type: 'json' };
import ar from '../messages/ar.json' with { type: 'json' };

const locales = [
  { language: 'en', intlLocale: 'en-US', name: 'English', messages: en },
  { language: 'fr', intlLocale: 'fr-FR', name: 'French', messages: fr },
  { language: 'ar', intlLocale: 'ar-MA', name: 'Arabic', messages: ar },
] as const;

for (const { language, intlLocale, name, messages } of locales) {
  test(`custom budget-period label stays aligned in ${name}`, async ({ page, viewport }) => {
    await page.clock.setFixedTime(new Date('2026-08-30T12:00:00Z'));
    await page.addInitScript((locale) => {
      localStorage.setItem('flousy_demo_mode', 'true');
      localStorage.setItem('flousy_onboarding_done', 'true');
      localStorage.setItem('flousy_language', locale);
      localStorage.setItem('flousy_current_month', '2026-08');
      localStorage.setItem('flousy_month_2026-08', JSON.stringify({
        totalBudget: 0,
        periodKey: '2026-08',
        periodStartDay: 25,
      }));
    }, language);
    await page.goto('/dashboard');

    const selector = page.getByRole('banner')
      .getByRole('button', { name: messages.navigation.previousMonth, exact: true })
      .locator('..');
    const startMonth = new Date(2026, 7, 1).toLocaleDateString(intlLocale, { month: 'short' });
    const endMonth = new Date(2026, 8, 1).toLocaleDateString(intlLocale, { month: 'short' });
    const number = new Intl.NumberFormat(intlLocale);
    const expected = (viewport?.width ?? 1280) < 640
      ? `${endMonth} ${number.format(24)}`
      : `${startMonth} ${number.format(25)} → ${endMonth} ${number.format(24)}`;
    await expect.poll(async () => (await selector.innerText()).replace(/\s+/g, ' ').trim()).toBe(expected.toLocaleUpperCase(intlLocale));
    await page.evaluate(() => document.fonts.ready);

    // Measure the actual visible text, not its parent: an inline badge can
    // shift its baseline even when the selector itself is vertically centered.
    const centers = await selector.evaluate((element) => {
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      const values: number[] = [];
      let node: Node | null;
      while ((node = walker.nextNode())) {
        if (!node.textContent?.trim()) continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        const rect = range.getBoundingClientRect();
        if (rect.width && rect.height) values.push(rect.top + rect.height / 2);
      }
      return values;
    });
    expect(centers.length).toBeGreaterThanOrEqual(2);
    expect(Math.max(...centers) - Math.min(...centers)).toBeLessThanOrEqual(1);
  });
}
