import { expect, test } from '@playwright/test';

test.describe('v3 Phase 5: Videos', () => {
  test('Song with no video renders disabled "No video yet" button and makes zero YouTube requests', async ({
    page,
  }) => {
    const ytRequests: string[] = [];
    page.on('request', (req) => {
      if (req.url().includes('youtube') || req.url().includes('ytimg')) ytRequests.push(req.url());
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/song/hi-aao-pyaaron-sharan-masih-ki/');

    const videoBtn = page.getByRole('button', { name: 'No video yet' });
    await expect(videoBtn).toBeVisible();
    await expect(videoBtn).toBeDisabled();
    await expect(videoBtn).toHaveAttribute('aria-disabled', 'true');
    expect(ytRequests).toEqual([]);
  });
});
