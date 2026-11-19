import { expect, test, type Page } from '@playwright/test';
import { waitHydrated } from './helpers';

// Same format as encodeSet() in src/lib/setlist.ts (which needs Astro's env, so it can't be imported here).
const encodeSet = (set: object) => Buffer.from(JSON.stringify(set)).toString('base64url');

// The service worker only exists in the production build (`astro preview`), which is what Playwright serves.
test.describe('offline (F5/F14)', () => {
  test.describe.configure({ mode: 'serial' });

  async function waitForServiceWorker(page: Page) {
    await page.goto('/');
    await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.ready;
      // The first load is not controlled yet; wait so later fetches go through the worker.
      if (!navigator.serviceWorker.controller) {
        await new Promise<void>((resolve) =>
          navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true }),
        );
      }
      return reg.active?.state;
    });
  }

  async function downloadDT(page: Page) {
    await page.goto('/downloads/');
    await waitHydrated(page);
    const row = page.locator('[data-book="DT"]');
    await row.getByRole('button', { name: 'Download' }).click();
    await expect(row.getByTestId('dl-status')).toBeVisible({ timeout: 15_000 });
  }

  test('a downloaded book works with no connection', async ({ page, context }) => {
    await waitForServiceWorker(page);
    await downloadDT(page);
    await context.setOffline(true);

    // Permalink → song page
    await page.goto('/b/dt/117/');
    await expect(page).toHaveURL(/\/song\/ta-yesuve-en-thunai\/(\?from=dt)?$/);
    await expect(page.locator('h1')).toContainText('இயேசுவே');
    await expect(page.locator('[data-offline-badge]')).toBeVisible();

    // The Tamil font was saved with the book.
    const tamilFont = await page.evaluate(async () => {
      await document.fonts.ready;
      return [...document.fonts].some((f) => /Tamil/i.test(f.family) && f.status === 'loaded');
    });
    expect(tamilFont).toBe(true);

    // Song inside a shared set: set bar still shows.
    const code = encodeSet({
      v: 1,
      t: 'Offline',
      d: '2026-11-22',
      s: [{ id: 'ta-yesuve-en-thunai', book: 'DT' }],
    });
    await page.goto(`/song/ta-yesuve-en-thunai/?set=${code}&i=0`);
    await expect(page.locator('.setnav')).toBeVisible();

    // Number search
    await page.goto('/search/?book=DT&n=117');
    await expect(page).toHaveURL(/\/song\/ta-yesuve-en-thunai\/(\?from=dt)?$/);

    // Word search uses the saved Tamil index; other languages are simply skipped.
    await page.goto('/search/?q=thunai');
    await expect(page.getByTestId('results').getByRole('link').first()).toHaveAttribute(
      'href',
      '/song/ta-yesuve-en-thunai/',
    );
  });

  test('a page that was never saved shows the no-connection page', async ({ page, context }) => {
    await waitForServiceWorker(page);
    await context.setOffline(true);
    await page.goto('/books/eh/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('No connection');
    await expect(page.getByRole('link', { name: 'Go to downloaded books' })).toBeVisible();
  });

  test('removing a download deletes its pages', async ({ page, context }) => {
    await waitForServiceWorker(page);
    await downloadDT(page);
    const row = page.locator('[data-book="DT"]');
    await row.getByRole('button', { name: /Remove/ }).click();
    await expect(row.getByRole('button', { name: 'Download' })).toBeVisible();
    const cached = await page.evaluate(async () => {
      const c = await caches.open('stuti-pages');
      return !!(await c.match('/b/dt/117/'));
    });
    expect(cached).toBe(false);
    await context.setOffline(true);
    await page.goto('/b/dt/117/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('No connection');
  });
});
