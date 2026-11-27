import { expect, test } from '@playwright/test';

test.describe('v3 Phase 4: Sets, Set editor, Share sheet', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('stuti:tour', JSON.stringify({ dismissedAt: '2026-11-27T00:00:00.000Z' }));
    });
  });

  test('Create set, add "12, 46", rows start collapsed without key chips, Share sheet has 8+ tiles', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/sets/');
    await page.getByRole('button', { name: 'New set' }).click();
    await page.getByRole('button', { name: /Create/i }).click();
    await expect(page).toHaveURL(/\/sets\/edit\/\?id=/);

    // Add "12, 46"
    const quick = page.locator('.set-editor-v2__quick input');
    await quick.fill('12, 46');
    await quick.press('Enter');

    await expect(page.locator('.srow')).toHaveCount(2);
    // Collapsed by default: no .exp visible
    await expect(page.locator('.exp')).toHaveCount(0);

    // Tap first row expand button; musician is false by default so no key chips
    await page.getByRole('button', { name: 'Edit key and verses' }).first().click();
    await expect(page.locator('.exp')).toHaveCount(1);
    await expect(page.getByRole('group', { name: 'Key' })).toHaveCount(0);

    // Open Share sheet
    await page.getByRole('button', { name: 'Share' }).click();
    const share = page.getByRole('dialog', { name: /Share/i });
    await expect(share).toBeVisible();
    await expect(share.getByText('PowerPoint')).toBeVisible();
    await expect(share.getByText('Order of service')).toBeVisible();
  });
});
