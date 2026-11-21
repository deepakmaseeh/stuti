import { expect, test, type Page } from '@playwright/test';
import { waitHydrated } from './helpers';

async function hydrated(page: Page, url: string) {
  await page.goto(url);
  await waitHydrated(page);
}

async function seedSundaySet(page: Page) {
  // Seed before any hydrate so in-memory store picks it up on first load.
  await page.goto('/sets/');
  await page.evaluate(() => {
    const id = crypto.randomUUID();
    const now = Date.now();
    const set = {
      v: 2.1,
      id,
      title: 'Sunday Morning',
      date: '2026-11-22',
      time: '10:00',
      service: 'sunday_morning',
      rows: [
        { k: 'h', id: 'h-open', label: 'Opening' },
        { k: 'h', id: 'h-praise', label: 'Praise' },
        { k: 'h', id: 'h-sermon', label: 'Sermon' },
        { k: 'h', id: 'h-close', label: 'Closing' },
      ],
      updatedAt: now,
      createdAt: now,
      source: 'mine',
    };
    localStorage.setItem('stuti:sets:v2', JSON.stringify({ v: 2.1, activeId: id, sets: [set] }));
  });
  await page.reload();
  await waitHydrated(page);
  return page.evaluate(() => {
    const raw = localStorage.getItem('stuti:sets:v2');
    return raw ? ((JSON.parse(raw) as { activeId?: string }).activeId ?? '') : '';
  });
}

test.describe('UI corrections 4d', () => {
  test('T1/T2 multi-add into target section', async ({ page }) => {
    const id = await seedSundaySet(page);
    await hydrated(page, `/sets/edit/?id=${encodeURIComponent(id)}`);
    await page.locator('.set-editor-v2__target select').selectOption({ label: 'Praise' });
    await page.getByLabel(/Add numbers/).fill('12, 46, 9999');
    await page.getByLabel(/Add numbers/).press('Enter');
    await expect(page.locator('.set-editor-v2__row')).toHaveCount(2, { timeout: 8000 });
    await expect(page.locator('#toast')).toContainText(/9999|Not found/i);
  });

  test('T9 calendar does not overflow at 390px', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await seedSundaySet(page);
    await hydrated(page, '/sets/');
    await page.getByRole('tab', { name: /Calendar/i }).click();
    const width = await page.evaluate(() => document.scrollingElement?.scrollWidth ?? 9999);
    expect(width).toBeLessThanOrEqual(390);
    await expect(page.locator('.sets-cal__grid')).toBeVisible();
  });

  test('T11 Sets nav has aria-current on /sets/', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await hydrated(page, '/sets/');
    await expect(page.locator('.topbar__nav-link[href="/sets/"]')).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  test('T12 /offline/ redirects to downloads', async ({ page }) => {
    const res = await page.goto('/offline/');
    expect(res?.status()).toBeLessThan(400);
    await expect(page).toHaveURL(/\/downloads\/?$/);
  });
});
