import { describe, expect, it } from 'vitest';
import { scanDist, scanSource } from '../../scripts/check-safety';

describe('check-safety: sources', () => {
  it('allows text rendering and the JSON-LD exception', () => {
    const ok = [
      {
        path: 'src/pages/song/[id].astro',
        text: '<script type="application/ld+json" set:html={safeJsonLd(x)} />',
      },
      { path: 'src/lib/a.ts', text: 'el.textContent = line;' },
    ];
    expect(scanSource(ok)).toEqual([]);
  });

  it('flags HTML-injection APIs in src/', () => {
    const bad = [
      { path: 'src/a.astro', text: '<p set:html={song.title} />' },
      { path: 'src/b.tsx', text: '<p dangerouslySetInnerHTML={{ __html: x }} />' },
      { path: 'src/c.ts', text: 'el.innerHTML = x;\nel.insertAdjacentHTML("beforeend", x)' },
    ];
    expect(scanSource(bad).map((f) => `${f.file}:${f.line}`)).toEqual([
      'src/a.astro:1',
      'src/b.tsx:1',
      'src/c.ts:1',
      'src/c.ts:2',
    ]);
  });

  it('flags trackers and font CDNs anywhere except /admin/', () => {
    expect(
      scanSource([{ path: 'src/x.css', text: "@import url('https://fonts.googleapis.com/css2')" }]),
    ).toHaveLength(1);
    expect(
      scanSource([
        { path: 'public/x.html', text: '<script src="https://www.googletagmanager.com/gtag/js">' },
      ]),
    ).toHaveLength(1);
    expect(
      scanSource([{ path: 'public/admin/index.html', text: '<script src="https://unpkg.com/decap-cms">' }]),
    ).toEqual([]);
  });
});

describe('check-safety: built site', () => {
  it('allows same-origin assets, canonical links and Cloudflare Web Analytics', () => {
    const html =
      '<link rel="canonical" href="https://stuti.pages.dev/x/"><link rel="stylesheet" href="/_astro/a.css">' +
      '<script defer src="https://static.cloudflareinsights.com/beacon.min.js"></script>';
    expect(scanDist([{ path: 'index.html', text: html }])).toEqual([]);
  });

  it('flags any other external script, stylesheet, font or CSS import', () => {
    const files = [
      { path: 'index.html', text: '<script src="https://cdn.example.com/x.js"></script>' },
      { path: 'a.html', text: '<link rel="stylesheet" href="//fonts.example.com/a.css">' },
      { path: '_astro/a.css', text: '@font-face{src:url(https://fonts.example.com/f.woff2)}' },
      { path: 'admin/index.html', text: '<script src="https://unpkg.com/decap-cms"></script>' },
    ];
    expect(scanDist(files).map((f) => f.file)).toEqual([
      'dist/index.html',
      'dist/a.html',
      'dist/_astro/a.css',
    ]);
  });
});
