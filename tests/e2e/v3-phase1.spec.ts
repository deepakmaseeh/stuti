import { expect, test } from '@playwright/test';

test.describe('v3 Phase 1: Shell, tokens, Settings sheet', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('stuti:tour', JSON.stringify({ dismissedAt: '2026-11-27T00:00:00.000Z' }));
    });
  });

  test('Settings sheet opens on phone and dark theme persists across 3 navigations', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    // Top bar has Stuti Songs + Info + Settings
    await expect(page.locator('.app-header__name')).toHaveText('Stuti Songs');
    await expect(page.locator('.app-header a[href="/guide/"]')).toBeVisible();
    const gear = page.locator('.app-header [data-open-settings]');
    await expect(gear).toBeVisible();

    // Open Settings sheet
    await gear.click();
    const dialog = page.getByRole('dialog', { name: 'Settings' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Our church uses')).toBeVisible();
    await expect(dialog.getByText('Show Roman lyrics')).toBeVisible();
    await expect(dialog.getByText('Show key for musicians')).toBeVisible();
    await expect(dialog.getByText('About & Guide')).toBeVisible();
    // Visible while FLAGS.admin === true
    await expect(dialog.getByRole('link', { name: /Editor sign-in|Open admin/i })).toBeVisible();

    // Switch to Dark
    await dialog.getByRole('button', { name: 'Dark' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-scheme', 'dark');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    // Close sheet
    await dialog.getByRole('button', { name: 'Close settings' }).click();
    await expect(dialog).toHaveCount(0);

    // Persist across 3 page navigations
    await page.locator('.bottom-nav a[href="/sets/"]').click();
    await expect(page).toHaveURL(/\/sets\//);
    await expect(page.locator('html')).toHaveAttribute('data-scheme', 'dark');

    await page.locator('.bottom-nav a[href="/downloads/"]').click();
    await expect(page).toHaveURL(/\/downloads\//);
    await expect(page.locator('html')).toHaveAttribute('data-scheme', 'dark');

    await page.goto('/books/tlbc/');
    await expect(page.locator('html')).toHaveAttribute('data-scheme', 'dark');
    // Book page counts as Home in bottom tab bar
    await expect(page.locator('.bottom-nav a[href="/"]')).toHaveAttribute('aria-current', 'page');

    // Reload stays dark
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-scheme', 'dark');
  });

  test('Desktop settings opens as right drawer 400px with no sideways scroll', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await page.locator('.topbar [data-open-settings]').click();
    const dialog = page.getByRole('dialog', { name: 'Settings' });
    await expect(dialog).toBeVisible();
    const box = await dialog.boundingBox();
    expect(box?.width).toBeCloseTo(400, 0);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(overflow).toBe(false);
  });
});
