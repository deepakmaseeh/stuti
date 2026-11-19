import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { waitHydrated } from './helpers';

const PAGES = [
  '/',
  '/search/',
  '/search/?tab=words',
  '/song/hi-aaj-fasi-majhdhar-main/',
  '/song/en-amazing-grace/',
  '/b/tlbc/1/',
  '/set/',
  '/books/',
  '/books/tlbc/',
  '/downloads/',
  '/settings/',
  '/about/',
  '/no-connection/',
  '/404/',
];

/** Axe with every rule on; the gate is zero serious or critical violations (spec §19.2). */
async function seriousViolations(page: Page) {
  await waitHydrated(page);
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
    for (const path of ['/', '/song/hi-aadi-aur-ant-tu-hi-hai/', '/search/']) {
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
    await page.goto('/song/hi-aadi-aur-ant-tu-hi-hai/');
    await waitHydrated(page);
    await page.getByRole('link', { name: 'Report a mistake in this song' }).click();
    await expect(page.getByRole('dialog', { name: "What's wrong?" })).toBeVisible();
    expect(await seriousViolations(page)).toEqual([]);
  });
});
