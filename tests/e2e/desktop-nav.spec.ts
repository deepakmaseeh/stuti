import { expect, test } from '@playwright/test';
import { waitDesktopPanes, waitHydrated } from './helpers';

test.describe('desktop nav + set mode (B1/B9/B10)', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('top bar links to Sets and Offline', async ({ page }) => {
    await page.goto('/');
    await waitHydrated(page);
    await expect(page.locator('.topbar__nav a[href="/sets/"]')).toBeVisible();
    await expect(page.locator('.topbar__nav a[href="/downloads/"]')).toBeVisible();
  });

  test('set mode shows setnav on desktop', async ({ page }) => {
    await page.goto('/song/en-amazing-grace/');
    await waitHydrated(page);
    await page.getByRole('button', { name: 'Add set' }).click();
    await page.goto('/song/hi-aadi-aur-ant-tu-hi-hai/');
    await waitHydrated(page);
    await page.getByRole('button', { name: 'Add set' }).click();

    const startHref = await page.evaluate(() => {
      const raw = localStorage.getItem('stuti:sets:v2');
      if (!raw) return '';
      const store = JSON.parse(raw) as {
        activeId?: string;
        sets: Array<{ id: string; items: Array<{ kind: string; songId?: string }> }>;
      };
      const set = store.sets.find((s) => s.id === store.activeId);
      const songs = set?.items.filter((i) => i.kind === 'song') ?? [];
      if (!set || !songs[0]?.songId) return '';
      return `/song/${songs[0].songId}/?set=${set.id}&i=0`;
    });
    expect(startHref).toBeTruthy();
    await page.goto(startHref);
    await waitHydrated(page);
    await expect(page.locator('.setnav')).toBeVisible();
    await expect(page.locator('.toolbar')).toBeVisible();
  });

  test('home does not show duplicate Browse/Number/Songs under desktop', async ({ page }) => {
    await page.goto('/');
    await waitDesktopPanes(page);
    await expect(page.locator('html')).toHaveAttribute('data-desktop', /^(wide|split)?$/);
    await expect(page.locator('.home-search')).toBeHidden();
  });
});
