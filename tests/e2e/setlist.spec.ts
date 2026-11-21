import { expect, test, type Page } from '@playwright/test';
import { waitHydrated } from './helpers';

async function hydrated(page: Page, url: string) {
  await page.goto(url);
  await waitHydrated(page);
}

async function addToSet(page: Page, songUrl: string) {
  await hydrated(page, songUrl);
  await page.getByRole('button', { name: 'Add set' }).click();
  await expect(page.getByRole('button', { name: 'In set' })).toBeVisible();
}

const SONGS = [
  '/song/hi-aadi-aur-ant-tu-hi-hai/',
  '/song/hi-aaj-fasi-majhdhar-main/',
  '/song/en-amazing-grace/',
];

test.describe('set list 2.0 (F6)', () => {
  test('add songs → edit → share → open shared → Start → Next/Prev', async ({ page, browser }) => {
    for (const url of SONGS) await addToSet(page, url);

    await hydrated(page, '/set/');
    await expect(page).toHaveURL(/\/sets\/edit\/\?id=/);
    await waitHydrated(page);

    const rows = page.locator('.set-editor-v2__row');
    await expect(rows).toHaveCount(3);

    await page.getByRole('button', { name: 'Share', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Share this set' });
    await expect(dialog).toBeVisible();
    const shareUrl = (await dialog.getByTestId('share-url').textContent())!.trim();
    expect(shareUrl).toMatch(/\/sets\/view\/#s=[A-Za-z0-9_-]+$/);
    await page.keyboard.press('Escape');

    const ctx = await browser.newContext();
    const other = await ctx.newPage();
    await other.goto(shareUrl.replace(/^https?:\/\/[^/]+/, 'http://localhost:4321'));
    await waitHydrated(other);
    await expect(other.getByText(/Shared set:/)).toBeVisible();
    await expect(other.locator('.sets-view__list a')).toHaveCount(3);

    await other.getByRole('link', { name: /Start singing/ }).click();
    await expect(other).toHaveURL(/\/song\/.+\?shared=.+&i=0/);
    const nav = other.locator('.setnav');
    await expect(nav).toContainText('1 of 3 in set');
    await nav.getByRole('link', { name: /Next/ }).click();
    await expect(other).toHaveURL(/i=1/);
    await expect(other.locator('.setnav')).toContainText('2 of 3 in set');
    await other.locator('.setnav').getByRole('link', { name: /Prev/ }).click();
    await expect(other).toHaveURL(/i=0/);

    await other.goto(shareUrl.replace(/^https?:\/\/[^/]+/, 'http://localhost:4321'));
    await other.getByRole('button', { name: 'Save a copy' }).click();
    await expect(other).toHaveURL(/\/sets\/edit\/\?id=/);
    await ctx.close();
  });

  test('quick note and remove on editor', async ({ page }) => {
    await addToSet(page, SONGS[0]!);
    const id = await page.evaluate(() => {
      const raw = localStorage.getItem('stuti:sets:v2');
      return raw ? (JSON.parse(raw) as { activeId?: string }).activeId ?? '' : '';
    });
    expect(id).toBeTruthy();
    await hydrated(page, `/sets/edit/?id=${encodeURIComponent(id)}`);
    await page.locator('.set-editor-v2__fields .field__input').first().fill('key of G');
    await page.locator('.set-editor-v2__row').getByRole('button', { name: 'Remove' }).click();
    await expect(page.getByText('Add songs with + Set on any song page.')).toBeVisible();
  });

  test('/set/#s= redirects to /sets/view/', async ({ page }) => {
    await page.goto('/set/#s=garbage');
    await expect(page).toHaveURL(/\/sets\/view\/#s=garbage/);
    await waitHydrated(page);
    await expect(page.getByText('This set link is broken or incomplete.')).toBeVisible();
  });
});

test.describe('report a mistake (F8)', () => {
  test('sheet opens, lists lines, builds a prefilled link and returns focus', async ({ page }) => {
    await hydrated(page, '/song/hi-aadi-aur-ant-tu-hi-hai/');
    const trigger = page.getByRole('link', { name: 'Report a mistake in this song' });
    await trigger.click();
    const dialog = page.getByRole('dialog', { name: "What's wrong?" });
    await expect(dialog).toBeVisible();
    const select = dialog.getByRole('combobox', { name: 'Line' });
    await expect(select.locator('option').first()).toContainText('Verse 1:');
    await select.selectOption({ index: 2 });
    await dialog.getByRole('textbox', { name: 'Correction' }).fill('typo & missing word');
    const popup = page.waitForEvent('popup');
    await dialog.getByRole('button', { name: 'Send to editors' }).click();
    const opened = new URL((await popup).url());
    const url = new URL(opened.searchParams.get('return_to') ?? opened.href);
    expect(url.searchParams.get('song')).toBe('hi-aadi-aur-ant-tu-hi-hai');
    expect(url.searchParams.get('correction')).toBe('typo & missing word');
    expect(url.searchParams.get('line')).toBeTruthy();
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test('offline: Send disabled, Copy offered', async ({ page, context }) => {
    await hydrated(page, '/song/hi-aadi-aur-ant-tu-hi-hai/');
    await context.setOffline(true);
    await page.getByRole('link', { name: 'Report a mistake in this song' }).click();
    const dialog = page.getByRole('dialog', { name: "What's wrong?" });
    await dialog.getByRole('textbox', { name: 'Correction' }).fill('x');
    await expect(dialog.getByText("You're offline. Copy your correction and send it later.")).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Send to editors' })).toBeDisabled();
    await expect(dialog.getByRole('button', { name: 'Copy correction' })).toBeEnabled();
    await context.setOffline(false);
  });
});

test.describe('home, settings, 404', () => {
  test('home shows Continue, favourites and the Sunday count from storage', async ({ page }) => {
    await hydrated(page, '/song/hi-aaj-fasi-majhdhar-main/');
    await page.getByRole('button', { name: 'Add to favourites' }).click();
    await page.getByRole('button', { name: 'Add set' }).click();
    await hydrated(page, '/');
    await expect(page.locator('.continue-card')).toContainText('आज फँसी मजधार');
    await expect(page.locator('.sunday-card')).toContainText('1 song in your set');
    await expect(page.getByRole('region', { name: 'Favourites' }).getByRole('link')).toHaveCount(1);
  });

  test('home: first visit has the empty states', async ({ page }) => {
    await hydrated(page, '/');
    await expect(page.locator('.continue-card')).toHaveCount(0);
    await expect(page.locator('.sunday-card')).toContainText("Plan Sunday's songs");
    await expect(page.getByText('Tap ☆ on any song to keep it here.')).toBeVisible();
  });

  test('settings: theme and clear data with confirm', async ({ page }) => {
    await hydrated(page, '/settings/');
    await page.getByRole('radio', { name: 'High contrast' }).check();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'contrast');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'contrast');
    await waitHydrated(page);
    await page.getByRole('button', { name: 'Clear my data' }).click();
    const dialog = page.getByRole('dialog', { name: 'Clear my data' });
    await dialog.getByRole('button', { name: 'Clear my data' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'system');
    expect(
      await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('stuti:'))),
    ).toEqual([]);
  });

  test('404 page offers search', async ({ page }) => {
    const res = await page.goto('/no-such-page/');
    expect(res?.status()).toBe(404);
    await page.getByRole('searchbox').fill('grace');
    await page.getByRole('button', { name: 'Search' }).click();
    await expect(page).toHaveURL(/\/search\/\?q=grace/);
    await expect(page.getByTestId('results').getByRole('link').first()).toHaveAttribute(
      'href',
      '/song/en-amazing-grace/',
    );
  });
});
