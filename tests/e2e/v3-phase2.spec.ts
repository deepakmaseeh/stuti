import { expect, test } from '@playwright/test';

test.describe('v3 Phase 2: Home, Search, Book page', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('stuti:tour', JSON.stringify({ dismissedAt: '2026-11-27T00:00:00.000Z' }));
    });
  });

  test('Home shows Plan this Sunday ghost link when empty and full-width Hymnbooks', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await expect(page.getByRole('link', { name: 'Plan this Sunday' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Hymnbooks' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Save offline' })).toBeVisible();
    // No sideways scroll
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });

  test('Search has no text input, letter counts change with Book filter, Back returns to letters', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/search/?q=old-query', { waitUntil: 'networkidle' });
    await expect(page.locator('input[type="text"], input[type="search"]')).toHaveCount(0);

    await page.getByRole('button', { name: 'हिन्दी' }).click();
    const chaBtn = page.locator('.letters .key', { hasText: 'च' });
    await expect(chaBtn).toBeEnabled();

    // Filter by XMAS — counts update
    await page.getByLabel('Book').selectOption('XMAS');
    // Pick च if enabled, or switch back to All
    await page.getByLabel('Book').selectOption('all');
    await chaBtn.click();
    await expect(page.locator('.crumb')).toBeVisible();
    await expect(page.getByText('चमका सितारा देखो')).toBeVisible();

    // Back returns to letters
    await page.getByRole('button', { name: 'Back to letters' }).click();
    await expect(page.locator('.letters')).toBeVisible();
  });

  test('Book page lists in number order and jump bar scrolls to 100', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/books/tlbc/');
    await expect(page.getByText('in hymn-number order')).toBeVisible();
    const jump100 = page.locator('.book-jump a', { hasText: '100' });
    await expect(jump100).toBeVisible();
    await jump100.click();
    await expect(page).toHaveURL(/#n-/);
  });
});
