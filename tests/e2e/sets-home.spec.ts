import { expect, test } from '@playwright/test';
import { waitHydrated } from './helpers';

test.describe('sets home', () => {
  test('creates a set from New set dialog', async ({ page }) => {
    await page.goto('/sets/');
    await waitHydrated(page);
    await page.getByRole('button', { name: /\+ New set/ }).click();
    await expect(page.getByRole('dialog', { name: 'New set' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create set' })).toBeVisible();
    await page.getByRole('button', { name: 'Create set' }).click();
    await expect(page).toHaveURL(/\/sets\/edit\/\?id=/);
    await waitHydrated(page);
    await expect(page.locator('.set-editor-v2__title-input')).toBeVisible();
  });

  test('calendar tab shows month grid', async ({ page }) => {
    await page.goto('/sets/');
    await waitHydrated(page);
    await page.getByRole('tab', { name: 'Calendar' }).click();
    await expect(page.locator('.sets-cal__grid')).toBeVisible();
  });
});
