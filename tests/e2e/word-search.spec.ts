import { expect, test, type Page } from '@playwright/test';
import { waitDesktopPanes, waitHydrated } from './helpers';

/** Open the Words UI: Finder on desktop, SearchTabs on phone. */
async function wordsTab(page: Page) {
  await page.goto('/search/');
  await waitHydrated(page);
  const finder = page.locator('.finder');
  if (await finder.isVisible()) {
    await waitDesktopPanes(page);
    await finder.getByRole('tab', { name: 'Words' }).click();
  } else {
    await page.locator('.search').getByRole('tab', { name: 'Words' }).click();
  }
  return page.getByRole('searchbox', { name: 'Words' });
}

const resultLinks = (page: Page) => page.getByTestId('results').getByRole('link');

test.describe('word search (F2)', () => {
  test('empty state hint', async ({ page }) => {
    await wordsTab(page);
    await expect(page.getByText('Type a title or any line. Try: yeshu, thunai, grace')).toBeVisible();
  });

  for (const q of ['yeshu', 'yesu', 'yisu']) {
    test(`"${q}" finds the Hindi and Punjabi demo songs`, async ({ page }) => {
      const input = await wordsTab(page);
      await input.fill(q);
      await expect(resultLinks(page).filter({ hasText: 'यीशु मेरा सहारा' })).toHaveCount(1);
      await expect(resultLinks(page).filter({ hasText: 'ਯਿਸੂ ਮੇਰਾ ਸਹਾਰਾ' })).toHaveCount(1);
    });
  }

  for (const q of ['thunai', 'tunai']) {
    test(`"${q}" finds DT 117 first`, async ({ page }) => {
      const input = await wordsTab(page);
      await input.fill(q);
      await expect(resultLinks(page).first()).toHaveAttribute('href', '/song/ta-yesuve-en-thunai/');
    });
  }

  test('Telugu script query finds DTe 45', async ({ page }) => {
    const input = await wordsTab(page);
    await input.fill('వెలుగు');
    await expect(resultLinks(page).first()).toHaveAttribute('href', '/song/te-yesayya-neeve-naa-aadhaaram/');
  });

  test('"grace" finds EH 1', async ({ page }) => {
    const input = await wordsTab(page);
    await input.fill('grace');
    await expect(resultLinks(page).first()).toHaveAttribute('href', '/song/en-amazing-grace/');
  });

  test('"dt117" pins the number match first', async ({ page }) => {
    const input = await wordsTab(page);
    await input.fill('dt117');
    await expect(resultLinks(page).first()).toHaveAttribute('href', '/song/ta-yesuve-en-thunai/');
  });

  test('no result shows "No match" and the report link', async ({ page }) => {
    const input = await wordsTab(page);
    await input.fill('zzqqxx');
    await expect(page.getByText('No match')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Report a missing song' })).toBeVisible();
  });

  test('loads only the language shards it needs, lazily', async ({ page }) => {
    const shards: string[] = [];
    page.on('request', (r) => {
      if (/\/search\/idx-/.test(r.url())) shards.push(r.url());
    });
    await wordsTab(page);
    expect(shards).toEqual([]);
    await page.getByRole('searchbox', { name: 'Words' }).fill('grace');
    await expect(resultLinks(page).first()).toBeVisible();
    expect(shards.length).toBeGreaterThan(0);
  });

  test('remembers the Words tab', async ({ page }) => {
    await wordsTab(page);
    await page.goto('/search/');
    await waitHydrated(page);
    const finder = page.locator('.finder');
    if (await finder.isVisible()) {
      await waitDesktopPanes(page);
      await expect(finder.getByRole('tab', { name: 'Words' })).toHaveAttribute('aria-selected', 'true');
    } else {
      await expect(page.locator('.search').getByRole('tab', { name: 'Words' })).toHaveAttribute(
        'aria-selected',
        'true',
      );
    }
  });

  test('supports ?q= deep links', async ({ page }) => {
    await page.goto('/search/?q=grace');
    await waitHydrated(page);
    if (await page.locator('.finder').isVisible()) await waitDesktopPanes(page);
    await expect(resultLinks(page).first()).toHaveAttribute('href', '/song/en-amazing-grace/', {
      timeout: 20_000,
    });
  });

  test('arrow keys move between tabs', async ({ page }) => {
    await page.goto('/search/');
    await waitHydrated(page);
    // Finder uses segment buttons without arrow-key roving; this is SearchTabs-only.
    if (await page.locator('.finder').isVisible()) {
      test.info().annotations.push({ type: 'note', description: 'skipped on desktop Finder' });
      return;
    }
    await page.locator('.search').getByRole('tab', { name: 'Number' }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('.search').getByRole('tab', { name: 'Words' })).toBeFocused();
    await expect(page.locator('.search').getByRole('tab', { name: 'Words' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });
});
