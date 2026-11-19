/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it } from 'vitest';
import { isDesktopViewport, parseSongHtml } from '../../src/lib/desktop';
import { site } from '../../src/site.config';

describe('isDesktopViewport', () => {
  it('is false below the desktop breakpoint and true at or above it', () => {
    expect(isDesktopViewport(site.layout.desktopMin - 1)).toBe(false);
    expect(isDesktopViewport(site.layout.desktopMin)).toBe(true);
  });
});

describe('parseSongHtml', () => {
  const html = `<!doctype html><html><body>
    <main id="main" class="app-column song">
      <h1 class="song__title" lang="ta">இயேசுவே என் துணை</h1>
      <p class="song__subtitle">Yesuve En Thunai</p>
      <div class="lyrics">
        <section class="sec" aria-label="Verse 1">
          <h2 class="sec__label">Verse 1</h2>
          <p class="line">
            <span class="n" lang="ta">வரி</span>
            <span class="r" lang="ta-Latn">vari</span>
            <span class="e" lang="en">line</span>
          </p>
        </section>
        <section class="sec sec--chorus" aria-label="Chorus">
          <h2 class="sec__label">Chorus</h2>
          <p class="line"><span class="n" lang="ta">கோரஸ்</span></p>
        </section>
      </div>
    </main>
  </body></html>`;

  it('extracts title, subtitle and lyric lines as text', () => {
    const song = parseSongHtml(html, '/song/ta-yesuve-en-thunai/');
    expect(song).toMatchObject({
      title: 'இயேசுவே என் துணை',
      titleLang: 'ta',
      subtitle: 'Yesuve En Thunai',
      url: '/song/ta-yesuve-en-thunai/',
    });
    expect(song!.sections).toHaveLength(2);
    expect(song!.sections[0]).toMatchObject({
      label: 'Verse 1',
      chorus: false,
      lines: [{ n: 'வரி', r: 'vari', e: 'line', nLang: 'ta', rLang: 'ta-Latn' }],
    });
    expect(song!.sections[1]?.chorus).toBe(true);
  });

  it('returns null when the page is not a song', () => {
    expect(parseSongHtml('<main id="main">Hello</main>', '/')).toBeNull();
  });
});
