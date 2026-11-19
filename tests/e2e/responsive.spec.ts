import { expect, test } from '@playwright/test';
import { waitHydrated } from './helpers';

const VIEWPORTS = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'tablet', width: 1024, height: 768 },
  { name: 'desktop', width: 1440, height: 900 },
] as const;

for (const vp of VIEWPORTS) {
  test.describe(`responsive ${vp.name} (${vp.width}×${vp.height})`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test('home: nav placement and no sideways scroll', async ({ page }) => {
      await page.goto('/');
      await waitHydrated(page);
      const nav = page.locator('.bottom-nav');
      await expect(nav).toBeVisible();
      const box = await nav.boundingBox();
      expect(box).toBeTruthy();
      if (vp.width < 768) {
        // Phone: nav docked to the bottom.
        expect(box!.y).toBeGreaterThan(vp.height / 2);
      } else {
        // Tablet/desktop: nav is a top bar.
        expect(box!.y).toBeLessThan(80);
      }
      const { scroll, client } = await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        client: document.documentElement.clientWidth,
      }));
      expect(scroll).toBeLessThanOrEqual(client);
    });

    test('song page stays readable', async ({ page }) => {
      await page.goto('/song/ta-yesuve-en-thunai/');
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expect(page.locator('.lyrics .line').first()).toBeVisible();
      if (vp.width >= 1200) {
        await expect(page.locator('.shell__side')).toBeVisible();
        await expect(page.getByRole('button', { name: /Stacked|Columns/ })).toBeVisible();
      } else {
        await expect(page.locator('.shell__side')).toBeHidden();
      }
    });

    if (vp.width >= 1200) {
      test('search opens a song in the right pane without leaving the list', async ({ page }) => {
        await page.goto('/search/');
        await waitHydrated(page);
        await expect(page.locator('[data-song-preview]')).toBeVisible();
        await expect(page.getByText('Select a song to read it here')).toBeVisible();

        // Word-search hit opens in the right pane; keypad "Open" still goes to the full song page.
        await page.getByRole('tab', { name: 'Words' }).click();
        await page.locator('[data-word-search]').fill('thunai');
        const hit = page.getByTestId('results').getByRole('link').first();
        await expect(hit).toBeVisible({ timeout: 10_000 });
        await hit.click();

        await expect(page.locator('[data-song-preview] .shell__preview-title')).toBeVisible({
          timeout: 10_000,
        });
        expect(page.url()).toMatch(/\/song\//);
        // Left pane (search) is still on the page.
        await expect(page.getByRole('tab', { name: 'Words' })).toBeVisible();
      });
    }
  });
}
