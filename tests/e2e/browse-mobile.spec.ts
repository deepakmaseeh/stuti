import { expect, test } from '@playwright/test';
import { waitHydrated } from './helpers';

test.describe('mobile browse by letter', () => {
  test('हिन्दी alphabet expands, letter lists songs, then collapses', async ({ page }) => {
    await page.goto('/search/?tab=browse');
    await waitHydrated(page);

    const hi = page.getByRole('button', { name: 'हिन्दी', exact: true });
    await expect(hi).toBeVisible();
    await hi.click();
    await expect(hi).toHaveAttribute('aria-expanded', 'true');

    const letters = page.locator('.browse-letters');
    await expect(letters).toBeVisible();
    const first = letters.getByRole('button').first();
    const label = (await first.textContent())?.trim() ?? '';
    expect(label.length).toBeGreaterThan(0);
    await first.click();

    await expect(letters).toBeHidden();
    await expect(page.locator('.browse-list .song-row').first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: label, exact: true }).first()).toBeVisible();
  });

  test('header search icon opens Number / Songs / Browse links', async ({ page }) => {
    await page.goto('/');
    await waitHydrated(page);
    const menu = page.locator('.app-header .search-menu').first();
    await menu.locator('summary').click();
    await expect(menu.getByRole('menuitem', { name: 'Browse' })).toBeVisible();
    await menu.getByRole('menuitem', { name: 'Browse' }).click();
    await expect(page).toHaveURL(/tab=browse/);
  });
});
