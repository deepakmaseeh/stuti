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
      if (vp.width < 900) {
        await expect(nav).toBeVisible();
        const box = await nav.boundingBox();
        expect(box).toBeTruthy();
        // Phone: nav docked to the bottom.
        expect(box!.y).toBeGreaterThan(vp.height / 2);
      } else {
        // Desktop add-on: bottom nav hidden; top bar is used instead.
        await expect(nav).toBeHidden();
        await expect(page.locator('.topbar')).toBeVisible();
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
      if (vp.width >= 900) {
        await expect(page.locator('.desktop-finder')).toBeVisible();
        await expect(page.getByRole('button', { name: /Stacked|Columns/ })).toBeVisible();
      } else {
        await expect(page.locator('.desktop-finder')).toBeHidden();
      }
    });

    if (vp.width >= 1280) {
      test('wide layout shows Finder, song and Set panel', async ({ page }) => {
        await page.goto('/song/ta-yesuve-en-thunai/');
        await waitHydrated(page);
        await expect(page.locator('.desktop-finder')).toBeVisible();
        await expect(page.locator('.desktop-set')).toBeVisible();
        await expect(page.locator('html')).toHaveAttribute('data-desktop', 'wide');
      });
    }

    if (vp.width >= 900 && vp.width < 1280) {
      test('split layout opens the Set drawer', async ({ page }) => {
        await page.goto('/');
        await waitHydrated(page);
        await expect(page.locator('html')).toHaveAttribute('data-desktop', 'split');
        await page.getByRole('button', { name: /Set list/ }).click();
        await expect(page.locator('.desktop-set.is-open')).toBeVisible();
      });
    }
  });
}
