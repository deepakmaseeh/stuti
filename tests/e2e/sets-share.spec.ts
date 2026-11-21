import { expect, test } from '@playwright/test';
import { waitHydrated } from './helpers';

test.describe('sets share + print', () => {
  test('print page renders order of service for active set', async ({ page }) => {
    await page.goto('/song/en-amazing-grace/');
    await waitHydrated(page);
    await page.getByRole('button', { name: 'Add set' }).click();
    const id = await page.evaluate(() => {
      const raw = localStorage.getItem('stuti:sets:v2');
      if (!raw) return '';
      const store = JSON.parse(raw) as { activeId?: string };
      return store.activeId ?? '';
    });
    expect(id).toBeTruthy();
    await page.goto(`/sets/print/?id=${encodeURIComponent(id)}`);
    await waitHydrated(page);
    await expect(page.locator('.sets-print h1')).toBeVisible();
    await expect(page.locator('.sets-print__list')).toContainText('Amazing Grace');
  });
});
