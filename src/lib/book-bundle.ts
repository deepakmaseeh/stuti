import type { Song } from './schema';

/** Compact lyric bundle for Present mode and PPT/PDF export (`/data/books/<id>.json`). */
export type BookBundleSong = {
  t: [string, string, string];
  nums: [string, string][];
  lang: string;
  chorusAfterEachVerse: boolean;
  sec: { type: string; label: string; lines: [string, string, string][] }[];
};

export type BookBundle = {
  book: string;
  version: string;
  songs: Record<string, BookBundleSong>;
};

export function songToBundleEntry(song: Song): BookBundleSong {
  return {
    t: [song.title.native, song.title.roman ?? '', song.title.en ?? ''],
    nums: song.numbers.map((n) => [n.book, n.number]),
    lang: song.lang,
    chorusAfterEachVerse: song.display.chorusAfterEachVerse,
    sec: song.sections.map((s) => ({
      type: s.type,
      label: s.label,
      lines: s.lines.map((l) => [l.n, l.r ?? '', l.e ?? ''] as [string, string, string]),
    })),
  };
}

export function buildBookBundle(bookId: string, version: string, songs: Song[]): BookBundle {
  const entries: Record<string, BookBundleSong> = {};
  for (const s of songs) entries[s.id] = songToBundleEntry(s);
  return { book: bookId, version, songs: entries };
}
