import { expect, type Page } from '@playwright/test';

/**
 * Wait until islands that should hydrate on this viewport have done so.
 * `client:media` islands (desktop-only SongSidePanel) keep `ssr` on phone/tablet on purpose.
 */
export async function waitHydrated(page: Page) {
  await expect(page.locator('astro-island[ssr]:not([client="media"])')).toHaveCount(0);
}

/** Desktop Finder/SetPanel use client:only — wait until they mount at ≥900px. */
export async function waitDesktopPanes(page: Page) {
  await waitHydrated(page);
  await expect(page.locator('.finder')).toBeVisible({ timeout: 15_000 });
}
