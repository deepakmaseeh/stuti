import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const PAGES = [
  '/',
  '/search/',
  '/search/?tab=words',
  '/song/ta-yesuve-en-thunai/',
  '/song/en-amazing-grace/',
  '/b/dt/117/',
  '/set/',
  '/books/',
  '/books/dt/',
  '/downloads/',
  '/settings/',
  '/about/',
  '/no-connection/',
  '/404/',
];

/** Axe with every rule on; the gate is zero serious or critical violations (spec §19.2). */
async function seriousViolations(page: Page) {
  await expect(page.locator('astro-island[ssr]')).toHaveCount(0);
  const { violations } = await new AxeBuilder({ page }).analyze();
  return violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => ({
      rule: v.id,
      impact: v.impact,
      help: v.help,
      nodes: v.nodes.slice(0, 3).map((n) => n.target.join(' ')),
    }));
}

test.describe('accessibility (axe)', () => {
  for (const path of PAGES) {
    test(path, async ({ page }) => {
      await page.goto(path);
      expect(await seriousViolations(page)).toEqual([]);
    });
  }

  for (const theme of ['dark', 'contrast'] as const) {
    for (const path of ['/', '/song/ta-yesuve-en-thunai/', '/search/']) {
      test(`${theme} theme ${path}`, async ({ page }) => {
        await page.addInitScript(
          (t) => localStorage.setItem('stuti:prefs', JSON.stringify({ theme: t })),
          theme,
        );
        await page.goto(path);
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
        expect(await seriousViolations(page)).toEqual([]);
      });
    }
  }

  test('report sheet open', async ({ page }) => {
    await page.goto('/song/ta-yesuve-en-thunai/');
    await expect(page.locator('astro-island[ssr]')).toHaveCount(0);
    await page.getByRole('link', { name: 'Report a mistake in this song' }).click();
    await expect(page.getByRole('dialog', { name: "What's wrong?" })).toBeVisible();
    expect(await seriousViolations(page)).toEqual([]);
  });
});
