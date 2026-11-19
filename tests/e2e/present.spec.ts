import { expect, test } from '@playwright/test';
import { waitHydrated } from './helpers';

test.describe('present mode', () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test('opens a song, advances, blanks, toggles layers, exits', async ({ page }) => {
    await page.goto('/present/?song=hi-aadi-aur-ant-tu-hi-hai');
    await expect(page.locator('.present__stage')).toBeVisible({ timeout: 15_000 });
    const first = await page.locator('.present__sec').textContent();
    await page.keyboard.press('PageDown');
    await expect.poll(async () => page.locator('.present__sec').textContent()).not.toBe(first);
    await page.keyboard.press('b');
    await expect(page.locator('.present.is-blank')).toBeVisible();
    await page.keyboard.press('b');
    await page.keyboard.press('n');
    await page.keyboard.press('Escape');
    await expect(page).not.toHaveURL(/\/present\//);
  });

  test('Present from song header', async ({ page }) => {
    await page.goto('/song/hi-aadi-aur-ant-tu-hi-hai/');
    await waitHydrated(page);
    await page.locator('.song-present').click();
    await expect(page).toHaveURL(/\/present\/\?song=hi-aadi-aur-ant-tu-hi-hai/);
    await expect(page.locator('.present__stage')).toBeVisible({ timeout: 15_000 });
  });
});
