import { expect, test } from '@playwright/test';

const PAGES = [
  '/',
  '/search/',
  '/set/',
  '/downloads/',
  '/settings/',
  '/about/',
  '/no-connection/',
  '/books/',
  '/books/dt/',
  '/song/ta-yesuve-en-thunai/',
  '/song/hi-yeshu-mera-sahara/',
  '/song/te-yesayya-neeve-naa-aadhaaram/',
  '/song/en-amazing-grace/',
];

// A page wider than the phone makes mobile browsers zoom out and pushes the bottom nav off screen.
test.describe('no sideways scrolling', () => {
  for (const path of PAGES) {
    test(path, async ({ page }) => {
      await page.goto(path);
      await expect(page.locator('astro-island[ssr]')).toHaveCount(0);
      const { scroll, client } = await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        client: document.documentElement.clientWidth,
      }));
      expect(scroll).toBeLessThanOrEqual(client);
    });
  }
});
