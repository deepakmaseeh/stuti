import { expect, test, type Page } from '@playwright/test';
import { waitHydrated } from './helpers';

async function openSearch(page: Page, url = '/search/') {
  await page.goto(url);
  await waitHydrated(page);
}

/** Mobile SearchTabs keypad, or desktop Finder keypad. */
const panel = (page: Page) => page.locator('#panel-number .keypad-panel, .finder .keypad-panel').first();

const tap = async (page: Page, digits: string) => {
  for (const d of digits)
    await panel(page).locator('.keypad').getByRole('button', { name: d, exact: true }).click();
};

test.describe('number search (F1)', () => {
  test('Home → Search → 1 → Open shows TLBC 1', async ({ page }) => {
    await page.goto('/');
    const searchNav = page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Search' });
    if (await searchNav.isVisible()) await searchNav.click();
    else await page.goto('/search/');
    await waitHydrated(page);
    await expect(panel(page).getByRole('button', { name: 'TLBC', exact: true })).toBeVisible({
      timeout: 15_000,
    });
    await panel(page).getByRole('button', { name: 'TLBC', exact: true }).click();
    await tap(page, '1');
    await expect(panel(page).getByTestId('number-status')).toContainText('आदि और अन्त');
    const started = Date.now();
    await panel(page).getByRole('button', { name: 'Open' }).click();
    await expect(page).toHaveURL(/\/song\/hi-aadi-aur-ant-tu-hi-hai\/\?from=tlbc$/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('आदि और अन्त');
    expect(Date.now() - started).toBeLessThan(1000);
    await expect(page.locator('.badge--header')).toHaveAttribute('aria-label', 'TLBC 1');
  });

  test('wrong number shows the no-match message and Open stays disabled', async ({ page }) => {
    await openSearch(page);
    await panel(page).getByRole('button', { name: 'TLBC', exact: true }).click();
    await tap(page, '9999');
    await expect(panel(page).getByTestId('number-status')).toHaveText('No song with this number in TLBC');
    await expect(panel(page).getByRole('button', { name: 'Open' })).toBeDisabled();
  });

  test('physical keyboard: digits, Backspace and Enter', async ({ page }) => {
    await openSearch(page);
    await panel(page).getByRole('button', { name: 'TLBC', exact: true }).click();
    await page.locator('body').click({ position: { x: 5, y: 300 } });
    await page.keyboard.type('19');
    await expect(panel(page).getByTestId('number-status')).toHaveText('No song with this number in TLBC');
    await page.keyboard.press('Backspace');
    await expect(panel(page).getByTestId('number-status')).toContainText('आदि और अन्त');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/song\/hi-aadi-aur-ant-tu-hi-hai\/\?from=tlbc$/);
  });

  test('max 4 digits', async ({ page }) => {
    await openSearch(page);
    await tap(page, '123456');
    await expect(panel(page).locator('.num-display__digits')).toHaveText('1234');
  });

  test('remembers the last used book and puts it first', async ({ page }) => {
    await openSearch(page);
    await panel(page).getByRole('button', { name: 'TLBE', exact: true }).click();
    await openSearch(page);
    await expect(panel(page).getByRole('button', { name: 'TLBE', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(panel(page).locator('.book-chips .chip').first()).toHaveText('TLBE');
  });

  test('deep link ?book=&n= opens the song', async ({ page }) => {
    await page.goto('/search/?book=TLBC&n=1');
    await expect(page).toHaveURL(/\/song\/hi-aadi-aur-ant-tu-hi-hai\/\?from=tlbc$/);
  });

  test('deep link to a missing number stays on the keypad with it typed', async ({ page }) => {
    await openSearch(page, '/search/?book=TLBE&n=77');
    await expect(panel(page).getByRole('button', { name: 'TLBE', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(panel(page).getByTestId('number-status')).toHaveText('No song with this number in TLBE');
  });

  test('works offline once the number data is loaded', async ({ page, context }) => {
    const loaded = Promise.all([
      page.waitForResponse((r) => r.url().endsWith('/search/numbers.json')),
      page.waitForResponse((r) => r.url().endsWith('/search/meta.json')),
    ]);
    await openSearch(page);
    await loaded;
    await context.setOffline(true);
    await panel(page).getByRole('button', { name: 'TLBC', exact: true }).click();
    await tap(page, '1');
    await expect(panel(page).getByTestId('number-status')).toContainText('आदि और अन्त');
  });
});
