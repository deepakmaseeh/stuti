import { expect, test } from '@playwright/test';
import { waitDesktopPanes } from './helpers';

test.describe('desktop finder', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('keyboard digits open a song; Finder stays mounted', async ({ page }) => {
    await page.goto('/');
    await waitDesktopPanes(page);
    // Wait until number index has loaded (Open becomes available for a match).
    await expect(page.locator('.keypad-panel .chip').first()).toBeVisible();
    await page.waitForResponse((r) => r.url().includes('/search/numbers.json') && r.ok()).catch(() => {});
    await page.keyboard.type('1');
    await expect(page.locator('.num-display__match.is-match')).toBeVisible({ timeout: 10_000 });
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/song\/hi-aadi-aur-ant-tu-hi-hai\//, { timeout: 15_000 });
    await expect(page.locator('.finder')).toBeVisible();
  });

  test('language filter and Browse letter work', async ({ page }) => {
    await page.goto('/song/hi-aadi-aur-ant-tu-hi-hai/');
    await waitDesktopPanes(page);
    await page.locator('.finder [role="tab"]').nth(2).click();
    await expect(page.locator('.finder-browse')).toBeVisible({ timeout: 10_000 });
    await page.locator('[data-lang-filter] [data-lang="hi"]').click();
    await expect(page.getByText(/Pick a letter/i)).toBeVisible();
    await page.locator('.finder-letter').filter({ hasText: 'अ' }).click();
    const countText = await page.locator('.finder-browse .finder-label').last().textContent();
    expect(countText).toMatch(/song/i);
  });
});
