import { expect, test } from '@playwright/test';

test.describe('v3 Phase 6: Admin UI', () => {
  test('Admin dashboard and Add song paste-splitter work on desktop and phone', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/admin/v3/', { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByText('Needs attention')).toBeVisible();

    await page.getByRole('button', { name: 'Paste a song' }).click();
    await expect(page.getByRole('heading', { name: 'Add song' })).toBeVisible();
    await expect(page.getByText('Split result (3 stanzas)')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});
