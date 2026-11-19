import { expect, test, type Page } from '@playwright/test';
import { waitHydrated } from './helpers';

async function openSearch(page: Page, url = '/search/') {
  await page.goto(url);
  await waitHydrated(page);
}

const tap = async (page: Page, digits: string) => {
  for (const d of digits) await page.locator('.keypad').getByRole('button', { name: d, exact: true }).click();
};

test.describe('number search (F1)', () => {
  test('Home → Search → 117 → Open shows DT 117', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Search' }).click();
    await waitHydrated(page);
    await page.getByRole('button', { name: 'DT', exact: true }).click();
    await tap(page, '117');
    await expect(page.getByTestId('number-status')).toHaveText('இயேசுவே என் துணை');
    const started = Date.now();
    await page.getByRole('button', { name: 'Open' }).click();
    await expect(page).toHaveURL(/\/song\/ta-yesuve-en-thunai\/\?from=dt$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('இயேசுவே என் துணை');
    expect(Date.now() - started).toBeLessThan(1000);
    await expect(page.locator('.badge--header')).toHaveAttribute('aria-label', 'DT 117');
  });

  test('wrong number shows the no-match message and Open stays disabled', async ({ page }) => {
    await openSearch(page);
    await page.getByRole('button', { name: 'DT', exact: true }).click();
    await tap(page, '999');
    await expect(page.getByTestId('number-status')).toHaveText('No song with this number in DT');
    await expect(page.getByRole('button', { name: 'Open' })).toBeDisabled();
  });

  test('physical keyboard: digits, Backspace and Enter', async ({ page }) => {
    await openSearch(page);
    await page.getByRole('button', { name: 'DH', exact: true }).click();
    await page.locator('body').click({ position: { x: 5, y: 300 } });
    await page.keyboard.type('125');
    await expect(page.getByTestId('number-status')).toHaveText('No song with this number in DH');
    await page.keyboard.press('Backspace');
    await expect(page.getByTestId('number-status')).toHaveText('यीशु मेरा सहारा');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/song\/hi-yeshu-mera-sahara\/\?from=dh$/);
  });

  test('max 4 digits', async ({ page }) => {
    await openSearch(page);
    await tap(page, '123456');
    await expect(page.locator('.num-display__digits')).toHaveText('1234');
  });

  test('remembers the last used book and puts it first', async ({ page }) => {
    await openSearch(page);
    await page.getByRole('button', { name: 'DTe', exact: true }).click();
    await openSearch(page);
    await expect(page.getByRole('button', { name: 'DTe', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(page.locator('.book-chips .chip').first()).toHaveText('DTe');
  });

  test('deep link ?book=&n= opens the song', async ({ page }) => {
    await page.goto('/search/?book=DT&n=117');
    await expect(page).toHaveURL(/\/song\/ta-yesuve-en-thunai\/\?from=dt$/);
  });

  test('deep link to a missing number stays on the keypad with it typed', async ({ page }) => {
    await openSearch(page, '/search/?book=EH&n=77');
    await expect(page.getByRole('button', { name: 'EH', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(page.getByTestId('number-status')).toHaveText('No song with this number in EH');
  });

  test('works offline once the number data is loaded', async ({ page, context }) => {
    // numbers.json + meta.json are fetched on mount; the PWA precache (Phase 5) covers cold offline starts.
    const loaded = Promise.all([
      page.waitForResponse((r) => r.url().endsWith('/search/numbers.json')),
      page.waitForResponse((r) => r.url().endsWith('/search/meta.json')),
    ]);
    await openSearch(page);
    await loaded;
    await context.setOffline(true);
    await page.getByRole('button', { name: 'DT', exact: true }).click();
    await tap(page, '117');
    await expect(page.getByTestId('number-status')).toHaveText('இயேசுவே என் துணை');
    await context.setOffline(false);
  });
});
