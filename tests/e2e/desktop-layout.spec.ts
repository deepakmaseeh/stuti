import { expect, test } from '@playwright/test';
import { waitDesktopPanes, waitHydrated } from './helpers';

test.describe('desktop layout 1440', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('three panes visible; no horizontal scroll', async ({ page }) => {
    await page.goto('/song/hi-aadi-aur-ant-tu-hi-hai/');
    await waitDesktopPanes(page);
    await expect(page.locator('html')).toHaveAttribute('data-desktop', 'wide');
    await expect(page.locator('.desktop-finder')).toBeVisible();
    await expect(page.locator('.desktop-set .set-panel')).toBeVisible();
    await expect(page.locator('.bottom-nav')).toBeHidden();
    const { scroll, client } = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      client: document.documentElement.clientWidth,
    }));
    expect(scroll).toBeLessThanOrEqual(client);
  });
});

test.describe('desktop layout 1024', () => {
  test.use({ viewport: { width: 1024, height: 768 } });

  test('Finder + Song; Set drawer opens and closes', async ({ page }) => {
    await page.goto('/');
    await waitHydrated(page);
    await expect(page.locator('html')).toHaveAttribute('data-desktop', 'split');
    await expect(page.locator('.desktop-finder')).toBeVisible();
    await page.getByRole('button', { name: /Set list/ }).click();
    await expect(page.locator('.desktop-set.is-open')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('.desktop-set.is-open')).toHaveCount(0);
  });

  test('main content is wider than the mobile 480px column', async ({ page }) => {
    await page.goto('/');
    await waitHydrated(page);
    const width = await page.locator('.desktop-main > .app-main-inner').evaluate((el) => el.getBoundingClientRect().width);
    expect(width).toBeGreaterThan(480);
  });
});

test.describe('desktop layout 390', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('mobile keeps bottom nav; no desktop panes', async ({ page }) => {
    await page.goto('/');
    await waitHydrated(page);
    await expect(page.locator('.bottom-nav')).toBeVisible();
    await expect(page.locator('.desktop-finder')).toBeHidden();
    await expect(page.locator('.desktop-set')).toBeHidden();
    await expect(page.locator('.topbar')).toBeHidden();
  });
});
