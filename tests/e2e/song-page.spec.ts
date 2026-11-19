import { expect, test, type Page } from '@playwright/test';
import { waitHydrated } from './helpers';

const HI = '/song/hi-yeshu-mera-sahara/';

/** Astro removes the `ssr` attribute from an island once it has hydrated. */
async function gotoHydrated(page: Page, url: string) {
  await page.goto(url);
  await waitHydrated(page);
}

async function expectNoOverlapOrHScroll(page: Page) {
  const result = await page.evaluate(() => {
    const visible = (el: Element) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    };
    const spans = [...document.querySelectorAll('.lyrics .line > span')].filter(visible);
    const overlaps: string[] = [];
    for (let i = 0; i < spans.length - 1; i++) {
      const a = spans[i]!.getBoundingClientRect();
      const b = spans[i + 1]!.getBoundingClientRect();
      // Next visible line must start at or below the previous one's bottom (1px rounding slack).
      if (b.top < a.bottom - 1) overlaps.push(`${spans[i]!.textContent} / ${spans[i + 1]!.textContent}`);
    }
    const doc = document.documentElement;
    return { overlaps, hScroll: doc.scrollWidth - doc.clientWidth };
  });
  expect(result.overlaps).toEqual([]);
  expect(result.hScroll).toBeLessThanOrEqual(1);
}

test.describe('song page', () => {
  test('renders all layers, lang attributes and the chorus marker', async ({ page }) => {
    await page.goto(HI);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('यीशु मेरा सहारा');
    await expect(page.locator('.line .n[lang="hi"]').first()).toBeVisible();
    await expect(page.locator('.line .r[lang="hi-Latn"]').first()).toBeVisible();
    await expect(page.locator('.chorus-marker').first()).toBeVisible();
    await expect(page.locator('.sec--chorus')).toHaveCount(1);
  });

  test('layer toggles persist across reload', async ({ page }) => {
    await gotoHydrated(page, HI);
    const tools = page.locator('.toolbar');
    const roman = tools.getByRole('button', { name: 'Roman' });
    const english = tools.getByRole('button', { name: /^English/ });
    await expect(roman).toHaveAttribute('aria-pressed', 'true');
    await expect(english).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('.line .e').first()).toBeHidden();

    await english.click();
    await roman.click();
    await expect(page.locator('.line .e').first()).toBeVisible();
    await expect(page.locator('.line .r').first()).toBeHidden();

    await page.reload();
    // Inline head script applies prefs before paint, so the state is right on first frame.
    await expect(page.locator('html')).toHaveAttribute('data-layers', 'n e');
    await expect(page.locator('.line .e').first()).toBeVisible();
    await expect(page.locator('.line .r').first()).toBeHidden();
    await expect(tools.getByRole('button', { name: /^English/ })).toHaveAttribute('aria-pressed', 'true');
  });

  test('at least one layer always stays on', async ({ page }) => {
    await gotoHydrated(page, HI);
    const tools = page.locator('.toolbar');
    const roman = tools.getByRole('button', { name: 'Roman' });
    await roman.click();
    await expect(roman).toHaveAttribute('aria-pressed', 'false');
    const native = tools.getByRole('button', { name: 'हिन्दी' });
    await native.click();
    await expect(native).toHaveAttribute('aria-pressed', 'true');
  });

  test('A+ to the maximum size: no overlapping lines, no horizontal scroll', async ({ page }) => {
    await gotoHydrated(page, HI);
    await page.locator('.toolbar').getByRole('button', { name: /^English/ }).click();
    const larger = page.getByRole('button', { name: 'Larger text' });
    while (await larger.isEnabled()) await larger.click();
    await expect(page.locator('html')).toHaveAttribute('data-size', '5');
    await expectNoOverlapOrHScroll(page);
  });

  test('size 5 with the root font size at 200%', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        'stuti:prefs',
        JSON.stringify({ layers: { n: true, r: true, e: true }, size: 5, theme: 'system' }),
      );
    });
    await page.goto(HI);
    await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
    await expectNoOverlapOrHScroll(page);
  });

  test('works with JavaScript disabled', async ({ browser }) => {
    const ctx = await browser.newContext({ javaScriptEnabled: false });
    const page = await ctx.newPage();
    await page.goto(HI);
    await expect(page.locator('.line .n').first()).toBeVisible();
    await expect(page.locator('.line .r').first()).toBeVisible();
    await expect(page.locator('.line .e').first()).toBeVisible();
    await ctx.close();
  });

  test('number permalink redirects to the song', async ({ page }) => {
    await page.goto('/b/dh/12/');
    await expect(page).toHaveURL(/\/song\/hi-yeshu-mera-sahara\/\?from=dh$/);
  });
});
