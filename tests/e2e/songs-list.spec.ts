import { expect, test, type Page } from '@playwright/test';
import { waitDesktopPanes, waitHydrated } from './helpers';

async function songsTab(page: Page) {
  await page.goto('/search/');
  await waitHydrated(page);
  const finder = page.locator('.finder');
  if (await finder.isVisible()) {
    await waitDesktopPanes(page);
    await finder.getByRole('tab', { name: 'Songs' }).click();
  } else {
    await page.locator('.search').getByRole('tab', { name: 'Songs' }).click();
  }
  return page.locator('.song-list-panel input[type="search"]');
}

const resultLinks = (page: Page) => page.locator('.song-list-panel .song-row');

test.describe('songs list (replaces Words)', () => {
  test('shows serial list and help', async ({ page }) => {
    await songsTab(page);
    await expect(page.getByText(/All songs in book order/)).toBeVisible();
    await expect(resultLinks(page).first()).toBeVisible({ timeout: 15_000 });
  });

  test('filter finds Amazing Grace', async ({ page }) => {
    const input = await songsTab(page);
    await input.fill('amazing');
    await expect(resultLinks(page).first()).toHaveAttribute('href', '/song/en-amazing-grace/');
  });

  test('filter by number finds TLBC 1', async ({ page }) => {
    const input = await songsTab(page);
    await input.fill('TLBC 1');
    await expect(resultLinks(page).first()).toHaveAttribute('href', '/song/hi-aadi-aur-ant-tu-hi-hai/');
  });

  test('remembers the Songs tab', async ({ page }) => {
    await songsTab(page);
    await page.goto('/search/');
    await waitHydrated(page);
    const finder = page.locator('.finder');
    if (await finder.isVisible()) {
      await waitDesktopPanes(page);
      await expect(finder.getByRole('tab', { name: 'Songs' })).toHaveAttribute('aria-selected', 'true');
    } else {
      await expect(page.locator('.search').getByRole('tab', { name: 'Songs' })).toHaveAttribute(
        'aria-selected',
        'true',
      );
    }
  });

  test('arrow keys move between tabs', async ({ page }) => {
    await page.goto('/search/');
    await waitHydrated(page);
    if (await page.locator('.finder').isVisible()) {
      test.info().annotations.push({ type: 'note', description: 'skipped on desktop Finder' });
      return;
    }
    await page.locator('.search').getByRole('tab', { name: 'Number' }).click();
    await page.locator('.search').getByRole('tab', { name: 'Number' }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('.search').getByRole('tab', { name: 'Songs' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });
});
