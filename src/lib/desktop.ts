import { site } from '../site.config';

export type SongPreviewLine = { n: string; r: string; e: string; nLang?: string; rLang?: string };
export type SongPreviewSection = { label: string; chorus: boolean; lines: SongPreviewLine[] };
export type SongPreview = {
  title: string;
  titleLang?: string;
  subtitle: string;
  url: string;
  sections: SongPreviewSection[];
};

/** True when Finder / Set panes are shown (≥900px per desktop add-on). */
export function isDesktopViewport(width = typeof window !== 'undefined' ? window.innerWidth : 0): boolean {
  return width >= site.layout.desktopMin;
}

/** True for the three-pane wide layout (≥1280px). */
export function isWideViewport(width = typeof window !== 'undefined' ? window.innerWidth : 0): boolean {
  return width >= site.layout.wideMin;
}

/** Pull title + lyric text out of a built song page. Used so the preview can re-render as text (no HTML injection). */
export function parseSongHtml(html: string, url: string): SongPreview | null {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const main = doc.querySelector('main.song, main#main.song, .song');
  if (!main) return null;
  const titleEl = main.querySelector('.song__title');
  const title = titleEl?.textContent?.trim() ?? '';
  if (!title) return null;
  const sections: SongPreviewSection[] = [...main.querySelectorAll('.sec')].map((sec) => ({
    label: sec.querySelector('.sec__label')?.textContent?.trim() ?? '',
    chorus: sec.classList.contains('sec--chorus'),
    lines: [...sec.querySelectorAll('.line')].map((line) => {
      const n = line.querySelector('.n');
      const r = line.querySelector('.r');
      const e = line.querySelector('.e');
      return {
        n: n?.textContent?.trim() ?? '',
        r: r?.textContent?.trim() ?? '',
        e: e?.textContent?.trim() ?? '',
        ...(n?.getAttribute('lang') ? { nLang: n.getAttribute('lang')! } : {}),
        ...(r?.getAttribute('lang') ? { rLang: r.getAttribute('lang')! } : {}),
      };
    }),
  }));
  return {
    title,
    titleLang: titleEl?.getAttribute('lang') ?? undefined,
    subtitle: main.querySelector('.song__subtitle')?.textContent?.trim() ?? '',
    url,
    sections,
  };
}
