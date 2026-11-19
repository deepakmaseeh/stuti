import { expect, test } from '@playwright/test';
import { waitHydrated } from './helpers';

test.describe('columns layout', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('Columns mode aligns native/roman/english on one row', async ({ page }) => {
    await page.goto('/song/hi-aadi-aur-ant-tu-hi-hai/');
    await waitHydrated(page);
    // Turn English on so three cells are visible for the alignment check.
    const enChip = page.locator('.toolbar').getByRole('button', { name: /^English/ });
    if ((await enChip.getAttribute('aria-pressed')) !== 'true') await enChip.click();
    const toggle = page.locator('.toolbar').getByRole('button', { name: /Stacked|Columns/ });
    await expect(toggle).toBeVisible();
    if ((await toggle.getAttribute('aria-pressed')) !== 'true') await toggle.click();
    await expect(page.locator('html')).toHaveAttribute('data-layout', 'columns');
    const line = page.locator('.lyrics .line').first();
    const tops = await line.evaluate((el) => {
      const n = el.querySelector('.n')!.getBoundingClientRect().top;
      const r = el.querySelector('.r')!.getBoundingClientRect().top;
      const e = el.querySelector('.e')!.getBoundingClientRect().top;
      return { n, r, e };
    });
    expect(Math.abs(tops.n - tops.r)).toBeLessThanOrEqual(8);
    expect(Math.abs(tops.n - tops.e)).toBeLessThanOrEqual(8);

    await toggle.click();
    await expect(page.locator('html')).toHaveAttribute('data-layout', 'stacked');
  });
});
