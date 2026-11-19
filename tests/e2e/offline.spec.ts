import { expect, test, type Page } from '@playwright/test';
import { waitHydrated } from './helpers';

const encodeSet = (set: object) => Buffer.from(JSON.stringify(set)).toString('base64url');

test.describe('offline (F5/F14)', () => {
  test.describe.configure({ mode: 'serial' });

  async function waitForServiceWorker(page: Page) {
    await page.goto('/');
    await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.ready;
      if (!navigator.serviceWorker.controller) {
        await new Promise<void>((resolve) =>
          navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true }),
        );
      }
      return reg.active?.state;
    });
  }

  async function downloadTLBC(page: Page) {
    await page.goto('/downloads/');
    await waitHydrated(page);
    const row = page.locator('[data-book="TLBC"]');
    await row.getByRole('button', { name: 'Download' }).click();
    await expect(row.getByTestId('dl-status')).toBeVisible({ timeout: 60_000 });
  }

  test('a downloaded book works with no connection', async ({ page, context }) => {
    await waitForServiceWorker(page);
    await downloadTLBC(page);
    await context.setOffline(true);

    await page.goto('/b/tlbc/1/');
    await expect(page).toHaveURL(/\/song\/hi-aadi-aur-ant-tu-hi-hai\/(\?from=tlbc)?$/);
    await expect(page.locator('h1')).toContainText('आदि और अन्त');
    await expect(page.locator('[data-offline-badge]')).toBeVisible();

    const code = encodeSet({
      v: 1,
      t: 'Offline',
      d: '2026-11-22',
      s: [{ id: 'hi-aadi-aur-ant-tu-hi-hai', book: 'TLBC' }],
    });
    await page.goto(`/song/hi-aadi-aur-ant-tu-hi-hai/?set=${code}&i=0`);
    await expect(page.locator('.setnav')).toBeVisible();

    await page.goto('/search/?book=TLBC&n=1');
    await expect(page).toHaveURL(/\/song\/hi-aadi-aur-ant-tu-hi-hai\/(\?from=tlbc)?$/);

    await page.goto('/search/?q=' + encodeURIComponent('हिरणी'));
    await expect(page.getByTestId('results').getByRole('link').first()).toHaveAttribute(
      'href',
      '/song/hi-jaise-hirni-jal-ki-pyasi/',
    );
  });

  test('a page that was never saved shows the no-connection page', async ({ page, context }) => {
    await waitForServiceWorker(page);
    await context.setOffline(true);
    await page.goto('/books/tlbe/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('No connection');
    await expect(page.getByRole('link', { name: 'Go to downloaded books' })).toBeVisible();
  });

  test('removing a download deletes its pages', async ({ page, context }) => {
    await waitForServiceWorker(page);
    await downloadTLBC(page);
    const row = page.locator('[data-book="TLBC"]');
    await row.getByRole('button', { name: /Remove/ }).click();
    await expect(row.getByRole('button', { name: 'Download' })).toBeVisible();
    const cached = await page.evaluate(async () => {
      const c = await caches.open('stuti-pages');
      return !!(await c.match('/b/tlbc/1/'));
    });
    expect(cached).toBe(false);
    await context.setOffline(true);
    await page.goto('/b/tlbc/1/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('No connection');
  });
});
