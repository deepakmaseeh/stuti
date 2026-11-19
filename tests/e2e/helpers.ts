import { expect, type Page } from '@playwright/test';

/**
 * Wait until islands that should hydrate on this viewport have done so.
 * `client:media` islands (desktop-only SongSidePanel) keep `ssr` on phone/tablet on purpose.
 */
export async function waitHydrated(page: Page) {
  await expect(page.locator('astro-island[ssr]:not([client="media"])')).toHaveCount(0);
}
