import { expect, test, type Page } from '@playwright/test';
import { waitHydrated } from './helpers';

async function hydrated(page: Page, url: string) {
  await page.goto(url);
  await waitHydrated(page);
}

async function addToSet(page: Page, songUrl: string) {
  await hydrated(page, songUrl);
  await page.getByRole('button', { name: '+ Set' }).click();
  await expect(page.getByRole('button', { name: '✓ In set' })).toBeVisible();
}

const SONGS = [
  '/song/hi-aadi-aur-ant-tu-hi-hai/',
  '/song/hi-aaj-fasi-majhdhar-main/',
  '/song/en-amazing-grace/',
];

test.describe('set list (F6)', () => {
  test('add 3 → share → open in a new browser → same order → Start → Next/Prev', async ({
    page,
    browser,
  }) => {
    for (const url of SONGS) await addToSet(page, url);

    await hydrated(page, '/set/');
    const rows = page.getByTestId('set-rows').getByRole('link');
    await expect(rows).toHaveCount(3);

    // Reorder with the accessible buttons: move Amazing Grace to the top.
    await page.getByRole('button', { name: 'Move up: Amazing Grace' }).click();
    await page.getByRole('button', { name: 'Move up: Amazing Grace' }).click();
    await expect(rows.first()).toContainText('Amazing Grace');

    await page.getByRole('button', { name: 'Share', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Share this set' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('img', { name: 'QR code for the set link' })).toBeVisible();
    const shareUrl = (await dialog.getByTestId('share-url').textContent())!.trim();
    expect(shareUrl).toMatch(/\/set\/#s=[A-Za-z0-9_-]+$/);
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();

    // Fresh profile: nothing in storage.
    const ctx = await browser.newContext();
    const other = await ctx.newPage();
    await other.goto(shareUrl.replace(/^https?:\/\/[^/]+/, 'http://localhost:4321'));
    await waitHydrated(other);
    await expect(other.getByText(/^Shared set:/)).toBeVisible();
    const shared = other.getByTestId('set-rows').getByRole('link');
    await expect(shared).toHaveCount(3);
    await expect(shared.nth(0)).toContainText('Amazing Grace');
    await expect(shared.nth(1)).toContainText('आदि और अन्त');
    await expect(shared.nth(2)).toContainText('आज फँसी मजधार');

    await other.getByRole('link', { name: 'Start singing' }).click();
    await expect(other).toHaveURL(/\/song\/en-amazing-grace\/\?set=.+&i=0/);
    const nav = other.locator('.setnav');
    await expect(nav).toContainText('1 of 3 in set');
    await nav.getByRole('link', { name: /Next/ }).click();
    await expect(other).toHaveURL(/\/song\/hi-aadi-aur-ant-tu-hi-hai\/\?set=.+&i=1/);
    await expect(other.locator('.setnav')).toContainText('2 of 3 in set');
    await other.locator('.setnav').getByRole('link', { name: /Prev/ }).click();
    await expect(other).toHaveURL(/\/song\/en-amazing-grace\/\?set=.+&i=0/);

    // Save the shared set in the other browser.
    await other.goto(shareUrl.replace(/^https?:\/\/[^/]+/, 'http://localhost:4321'));
    await other.getByRole('button', { name: 'Save to my sets' }).first().click();
    await expect(other.locator('.my-set')).toHaveCount(1);
    await ctx.close();
  });

  test('notes, remove and the empty state', async ({ page }) => {
    await addToSet(page, SONGS[0]!);
    await hydrated(page, '/set/');
    await page.getByRole('button', { name: 'Add a note (key, verses…)' }).click();
    await page.getByRole('textbox', { name: 'Note' }).fill('key of G');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: 'key of G' })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('button', { name: 'key of G' })).toBeVisible();
    await page.getByRole('button', { name: /^Remove:/ }).click();
    await expect(page.getByText('Add songs with + Set on any song page.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Search songs' })).toBeVisible();
  });

  test('my sets: save, delete with undo', async ({ page }) => {
    await addToSet(page, SONGS[1]!);
    await hydrated(page, '/set/');
    await page.getByRole('button', { name: 'Save to my sets' }).click();
    await expect(page.locator('.my-set')).toHaveCount(1);
    await page.getByRole('button', { name: /^Delete:/ }).click();
    await expect(page.locator('.my-set')).toHaveCount(0);
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(page.locator('.my-set')).toHaveCount(1);
  });

  test('a broken set link shows a message', async ({ page }) => {
    await hydrated(page, '/set/#s=garbage!!');
    await expect(page.getByRole('alert')).toHaveText('This set link is broken or incomplete.');
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
    await expect(select.locator('option').first()).toContainText('Chorus:');
    await select.selectOption({ index: 2 });
    await dialog.getByRole('textbox', { name: 'Correction' }).fill('typo & missing word');
    const popup = page.waitForEvent('popup');
    await dialog.getByRole('button', { name: 'Send to editors' }).click();
    // GitHub may bounce anonymous users to /login?return_to=… — read params from the issue URL either way.
    const opened = new URL((await popup).url());
    const url = new URL(opened.searchParams.get('return_to') ?? opened.href);
    expect(url.searchParams.get('song')).toBe('hi-aadi-aur-ant-tu-hi-hai');
    expect(url.searchParams.get('correction')).toBe('typo & missing word');
    expect(url.searchParams.get('line')).toMatch(/^Verse 1: /);
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
    await page.getByRole('button', { name: '+ Set' }).click();
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
