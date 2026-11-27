import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

test.describe('v3 Phase 7: Guide screenshots & page', () => {
  test('generate public/guide screenshots and verify /guide/', async ({ page }) => {
    const outDir = join(process.cwd(), 'public', 'guide');
    mkdirSync(outDir, { recursive: true });

    await page.addInitScript(() => {
      localStorage.setItem('stuti:tour', JSON.stringify({ dismissedAt: '2026-11-27T00:00:00.000Z' }));
    });
    await page.setViewportSize({ width: 390, height: 844 });

    // 1. Search
    await page.goto('/search/', { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'हिन्दी' }).click();
    await page.screenshot({ path: join(outDir, 'find.png'), clip: { x: 0, y: 0, width: 390, height: 520 } });

    // 2. Book page
    await page.goto('/books/tlbc/', { waitUntil: 'networkidle' });
    await page.screenshot({ path: join(outDir, 'number.png'), clip: { x: 0, y: 0, width: 390, height: 520 } });

    // 3. Song page
    await page.goto('/song/hi-aao-pyaaron-sharan-masih-ki/', { waitUntil: 'networkidle' });
    await page.screenshot({ path: join(outDir, 'read.png'), clip: { x: 0, y: 0, width: 390, height: 520 } });

    // 4. Sets
    await page.goto('/sets/', { waitUntil: 'networkidle' });
    await page.screenshot({ path: join(outDir, 'plan.png'), clip: { x: 0, y: 0, width: 390, height: 520 } });

    // Verify /guide/
    await page.goto('/guide/', { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: 'About & Guide' })).toBeVisible();
    await expect(page.locator('.toc a')).toHaveCount(9);
  });
});
