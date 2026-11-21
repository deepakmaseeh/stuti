import { expect, test } from '@playwright/test';
import { waitDesktopPanes } from './helpers';

test.describe('desktop finder', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('keyboard digits open a song; Finder stays mounted', async ({ page }) => {
    await page.goto('/');
    await waitDesktopPanes(page);
    await page.locator('.finder [role="tab"]', { hasText: 'Number' }).click();
    const keypad = page.locator('.finder .keypad-panel');
    await expect(keypad.locator('.chip').first()).toBeVisible({ timeout: 15_000 });
    await keypad.getByRole('button', { name: '1', exact: true }).click();
    await expect(keypad.locator('.num-display__match.is-match')).toBeVisible({ timeout: 15_000 });
    await keypad.getByRole('button', { name: 'Open' }).click();
    await expect(page).toHaveURL(/\/song\/hi-aadi-aur-ant-tu-hi-hai\//, { timeout: 15_000 });
    await expect(page.locator('.finder')).toBeVisible();
  });

  test('Browse हिन्दी / letter works on desktop', async ({ page }) => {
    await page.goto('/song/hi-aadi-aur-ant-tu-hi-hai/');
    await waitDesktopPanes(page);
    await page.locator('.finder [role="tab"]', { hasText: 'Browse' }).click();
    const browse = page.locator('.finder .browse-panel');
    await expect(browse).toBeVisible({ timeout: 10_000 });
    await browse.getByRole('button', { name: 'हिन्दी', exact: true }).click();
    await expect(browse.locator('.browse-letters')).toBeVisible();
    await browse.locator('.browse-letter').filter({ hasText: 'अ' }).first().click();
    await expect(browse.locator('.browse-list .song-row').first()).toBeVisible({ timeout: 15_000 });
  });
});
