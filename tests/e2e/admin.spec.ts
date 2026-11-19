import { expect, test, type Page } from '@playwright/test';
import { waitHydrated } from './helpers';

// Runs in the "headers" project against `wrangler pages dev dist`, which applies public/_headers
// exactly like Cloudflare Pages does (every matching rule, `!` removes inherited headers).

function collectCspErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => {
    const text = m.text();
    // `local_backend: true` makes Decap probe the decap-server proxy, but only when the page is on localhost.
    if (text.includes('http://localhost:8081/api/v1')) return;
    if (
      m.type() === 'error' &&
      /Content Security Policy|Refused to (load|execute|apply|connect|frame)/i.test(text)
    )
      errors.push(text);
  });
  return errors;
}

test.describe('admin (Decap CMS) under the real _headers', () => {
  test('/admin/ gets one relaxed CSP, no site-wide CSP or DENY framing', async ({ request }) => {
    const res = await request.get('/admin/');
    expect(res.status()).toBe(200);
    const csp = res.headers()['content-security-policy'];
    expect(csp).toContain('https://unpkg.com');
    expect(csp).toContain('https://api.github.com');
    expect(csp).not.toContain('frame-ancestors');
    expect(csp).not.toContain(',');
    expect(res.headers()['x-frame-options']).toBe('SAMEORIGIN');
    expect(res.headers()['x-robots-tag']).toBe('noindex');
  });

  test('Decap loads and shows the GitHub login with no CSP errors', async ({ page }) => {
    const errors = collectCspErrors(page);
    await page.goto('/admin/');
    await expect(page.getByRole('button', { name: /Login with GitHub/i })).toBeVisible({ timeout: 30_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('site pages under the strict CSP', () => {
  for (const path of ['/', '/song/hi-aadi-aur-ant-tu-hi-hai/', '/search/', '/set/', '/settings/']) {
    test(`${path} works with no CSP errors`, async ({ page }) => {
      const errors = collectCspErrors(page);
      const res = await page.goto(path);
      const csp = res!.headers()['content-security-policy'];
      expect(csp).toContain("frame-ancestors 'none'");
      expect(csp).not.toContain('unpkg.com');
      expect(res!.headers()['x-frame-options']).toBe('DENY');
      await waitHydrated(page);
      expect(errors).toEqual([]);
    });
  }

  test('service worker registers under the CSP', async ({ page }) => {
    await page.goto('/');
    const scope = await page.evaluate(async () => (await navigator.serviceWorker.ready).scope);
    expect(new URL(scope).pathname).toBe('/');
  });

  test('cache headers', async ({ request, page }) => {
    await page.goto('/');
    const asset = await page.evaluate(() =>
      document
        .querySelector<HTMLLinkElement>('link[rel="stylesheet"][href^="/_astro/"]')!
        .getAttribute('href')!,
    );
    expect((await request.get(asset)).headers()['cache-control']).toBe('public, max-age=31536000, immutable');
    expect((await request.get('/sw.js')).headers()['cache-control']).toBe('no-cache');
    expect((await request.get('/dl/fonts.json')).headers()['cache-control']).toBe('no-cache');
  });

  test('robots.txt blocks /admin/ and points at the sitemap', async ({ request }) => {
    const body = await (await request.get('/robots.txt')).text();
    expect(body).toContain('Disallow: /admin/');
    expect(body).toMatch(/^Sitemap: https:\/\/.+\/sitemap-index\.xml$/m);
  });
});
