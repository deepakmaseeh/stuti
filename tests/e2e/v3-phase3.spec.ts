import { expect, test } from '@playwright/test';

test.describe('v3 Phase 3: Song page', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('stuti:tour', JSON.stringify({ dismissedAt: '2026-11-27T00:00:00.000Z' }));
    });
  });

  test('Song page hides author/licence below lyrics, opens Song info via ⋮, and submits report via /api/report', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/song/hi-aao-pyaaron-sharan-masih-ki/', { waitUntil: 'networkidle' });

    // Author/licence block removed from below lyrics
    await expect(page.locator('.song-meta')).toHaveCount(0);

    // ×2 chip rendered
    await expect(page.locator('.lyrics .repeat').first()).toBeVisible();

    // ⋮ More menu opens Song info
    await page.locator('[data-open-song-more]').click();
    const more = page.getByRole('dialog', { name: 'Song options' });
    await expect(more).toBeVisible();
    await more.getByRole('button', { name: 'Song info' }).click();

    const info = page.getByRole('dialog', { name: 'Song info' });
    await expect(info).toBeVisible();
    await expect(info.getByText('Rights')).toBeVisible();
    await info.getByRole('button', { name: 'Close' }).click();

    // Open Report via link under lyrics (B7.9)
    await page.route('**/api/report', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
    });
    await page.locator('.lyrics .report-link').click();

    const report = page.getByRole('dialog', { name: "What's wrong?" });
    await expect(report).toBeVisible();
    await report.locator('textarea').first().fill('Corrected lyric line');
    const reqPromise = page.waitForRequest('**/api/report');
    await report.getByRole('button', { name: 'Send' }).click();
    await reqPromise;
    await expect(page).not.toHaveURL(/github\.com/);
  });

  test('Desktop song page keeps lyrics <= 760px and no sideways scroll', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/song/hi-aao-pyaaron-sharan-masih-ki/');
    const box = await page.locator('.lyrics').boundingBox();
    expect(box?.width).toBeLessThanOrEqual(760);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});
