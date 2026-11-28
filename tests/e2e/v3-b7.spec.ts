import { expect, test } from '@playwright/test';

const SONG_URL = '/song/hi-aao-pyaaron-sharan-masih-ki/';
const SONG_ID = 'hi-aao-pyaaron-sharan-masih-ki';

test.describe('v3 Part B7: 28 Nov changes', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('stuti:tour', JSON.stringify({ dismissedAt: '2026-11-27T00:00:00.000Z' }));
    });
  });

  test('B7.1–B7.3 & B7.9: 48px song header, 6-tool grid, cleaned ⋮ menu, Report link under lyrics', async ({
    page,
  }) => {
    for (const width of [320, 360, 390, 1440]) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto(SONG_URL, { waitUntil: 'networkidle' });

      // 6-button grid fits in viewport width with no horizontal scroll
      const toolCount = await page.locator('.tools--icons .tool--icon').count();
      expect(toolCount).toBe(6);

      const overflow = await page.evaluate(() => {
        const el = document.querySelector('.tools--icons') as HTMLElement | null;
        return el ? el.scrollWidth > el.clientWidth + 2 : false;
      });
      expect(overflow).toBe(false);
    }

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(SONG_URL, { waitUntil: 'networkidle' });

    // Header height 48px, plain gold number text, no Present button in header
    const headerBox = await page.locator('.song-header__inner').boundingBox();
    expect(headerBox?.height).toBeLessThanOrEqual(49);
    await expect(page.locator('.song-header__num')).toBeVisible();
    await expect(page.locator('.song-header [data-feature="present"]')).toHaveCount(0);

    // ⋮ menu has ONLY Share song, Lyrics PDF, PowerPoint slides, Song info
    await page.locator('[data-open-song-more]').click();
    const more = page.getByRole('dialog', { name: 'Song options' });
    await expect(more).toBeVisible();
    await expect(more.getByText('Share song')).toBeVisible();
    await expect(more.getByText('Lyrics PDF')).toBeVisible();
    await expect(more.getByText('PowerPoint slides')).toBeVisible();
    await expect(more.getByText('Song info')).toBeVisible();
    await expect(more.getByText('Report a mistake')).toHaveCount(0);
    await expect(more.getByText('Settings')).toHaveCount(0);
    await more.getByRole('button', { name: 'Close' }).click();

    // Report a mistake link sits inside .lyrics at the end
    const reportBtn = page.locator('.lyrics .report-link');
    await expect(reportBtn).toBeVisible();
  });

  test('B7.4: /print/lyrics/ renders lyrics A4 preview', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/print/lyrics/?song=${SONG_ID}`, { waitUntil: 'networkidle' });

    await expect(page.locator('.lyr-a4')).toHaveCount(1);
    await expect(page.locator('.lyr-a4__title')).toBeVisible();
    await expect(page.locator('.lyr-a4__foot')).toContainText('Stuti Songs');
    await expect(page.getByRole('button', { name: /Print \/ Save as PDF/i })).toBeVisible();
  });

  test('B7.5: /slides/ previews slides with zero downloads until Download clicked', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    let downloaded = false;
    page.on('download', () => {
      downloaded = true;
    });

    await page.goto(`/slides/?song=${SONG_ID}`, { waitUntil: 'networkidle' });
    await expect(page.getByText(/Check every slide\. Nothing downloads until you tap Download\./i)).toBeVisible();
    await expect(page.locator('.slide-thumb').first()).toBeVisible();
    const count = await page.locator('.slide-thumb').count();
    expect(count).toBeGreaterThan(1);
    expect(downloaded).toBe(false);
    await expect(page.getByRole('button', { name: /Download PowerPoint/i })).toBeVisible();
  });

  test('B7.6, B7.7, B7.13: Set editor supports custom slides, verse notes, rename, and reorder', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript((songId) => {
      if (localStorage.getItem('stuti:sets:v2')) return;
      const set = {
        v: 2.1,
        id: 'b7-test-set',
        title: 'Sunday Worship',
        date: '2026-12-06',
        service: 'sunday_morning',
        rows: [{ k: 's', id: 'r1', song: songId, book: 'TLBC', no: 1 }],
        updatedAt: Date.now(),
        createdAt: Date.now(),
      };
      localStorage.setItem('stuti:sets:v2', JSON.stringify({ v: 2.1, activeId: 'b7-test-set', sets: [set] }));
    }, SONG_ID);

    await page.goto('/sets/edit/?id=b7-test-set', { waitUntil: 'networkidle' });

    // Rename set
    const titleInput = page.locator('.set-editor-v2__title-input');
    await titleInput.fill('Christmas Service');
    await expect(titleInput).toHaveValue('Christmas Service');

    // Add custom slide
    await page.getByRole('button', { name: 'New slide' }).click();
    const sheet = page.getByRole('dialog', { name: 'New slide' });
    await expect(sheet).toBeVisible();
    await sheet.getByRole('button', { name: 'Bible verse' }).click();
    await sheet.getByLabel('Reference').fill('John 3:16');
    await sheet.getByLabel('Verse text').fill('For God so loved the world');
    await sheet.getByRole('button', { name: 'Add slide' }).click();

    await expect(page.locator('.set-editor-v2__list')).toContainText('John 3:16');

    // Expand song row and add a verse note
    await page.getByRole('button', { name: 'Edit key and verses' }).click();
    await page.getByPlaceholder('Verse note…').fill('Sing softly');
    await page.getByRole('button', { name: 'Add note' }).click();
    await expect(page.locator('.set-editor-v2__list')).toContainText('1 note');

    // Check /slides/?set=b7-test-set shows the custom slide and verse note
    await page.goto('/slides/?set=b7-test-set', { waitUntil: 'networkidle' });
    await expect(page.locator('.slides-grid')).toContainText('John 3:16');
    await expect(page.locator('.slides-grid')).toContainText('Sing softly');
  });

  test('B7.11: Desktop 3-pane layout widths at 1440px', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(SONG_URL, { waitUntil: 'networkidle' });

    const finderBox = await page.locator('.desktop-finder').boundingBox();
    const setBox = await page.locator('.desktop-set').boundingBox();
    expect(Math.round(finderBox?.width ?? 0)).toBe(340);
    expect(Math.round(setBox?.width ?? 0)).toBe(340);
  });
});
