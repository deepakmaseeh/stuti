import { expect, test } from '@playwright/test';
import { waitHydrated } from './helpers';
import JSZip from 'jszip';

test.describe('export', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('print media hides panes and toolbar', async ({ page }) => {
    await page.goto('/song/ta-yesuve-en-thunai/');
    await waitHydrated(page);
    await page.emulateMedia({ media: 'print' });
    await expect(page.locator('.topbar')).toBeHidden();
    await expect(page.locator('.desktop-finder')).toBeHidden();
    await expect(page.locator('.toolbar')).toBeHidden();
    await expect(page.locator('.print-footer')).toBeVisible();
  });

  test('PPT button downloads a .pptx with slides', async ({ page }) => {
    await page.goto('/song/ta-yesuve-en-thunai/');
    await waitHydrated(page);
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 60_000 }),
      page.getByRole('button', { name: 'PPT' }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/^Stuti-.*\.pptx$/);
    const path = await download.path();
    expect(path).toBeTruthy();
    const buf = await download.createReadStream().then(async (stream) => {
      const chunks: Buffer[] = [];
      for await (const c of stream!) chunks.push(Buffer.from(c));
      return Buffer.concat(chunks);
    });
    const zip = await JSZip.loadAsync(buf);
    const slides = Object.keys(zip.files).filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n));
    expect(slides.length).toBeGreaterThan(1);
  });
});
