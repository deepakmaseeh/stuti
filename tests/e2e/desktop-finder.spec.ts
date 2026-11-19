import { expect, test } from '@playwright/test';
import { waitDesktopPanes } from './helpers';

test.describe('desktop finder', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('keyboard digits open a song; Finder stays mounted', async ({ page }) => {
    await page.goto('/');
    await waitDesktopPanes(page);
    await page.keyboard.type('117');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/song\/ta-yesuve-en-thunai\//, { timeout: 15_000 });
    await expect(page.locator('.finder')).toBeVisible();
  });

  test('language filter and Browse letter work', async ({ page }) => {
    await page.goto('/song/ta-yesuve-en-thunai/');
    await waitDesktopPanes(page);
    await page.locator('.finder [role="tab"]').nth(2).click();
    await expect(page.locator('.finder-browse')).toBeVisible({ timeout: 10_000 });
    await page.locator('[data-lang-filter] [data-lang="hi"]').click();
    const countText = await page.locator('.finder-browse .finder-label').last().textContent();
    expect(countText).toMatch(/song/i);
  });
});
