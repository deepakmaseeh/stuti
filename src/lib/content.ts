import { getCollection } from 'astro:content';
import { site } from '../site.config';
import type { Book, Song } from './schema';
import { isPublishable, langOf } from './songs';

let songsCache: Song[] | undefined;
let booksCache: Book[] | undefined;

/** Publishable songs only (spec §5.3), with id + lang from the file path. */
export async function getSongs(): Promise<Song[]> {
  songsCache ??= (await getCollection('songs'))
    .map((e) => ({ ...e.data, id: e.id, lang: langOf(e.id) }))
    .filter((s) => isPublishable(s, site.includeDemo))
    .sort((a, b) => a.id.localeCompare(b.id));
  return songsCache;
}

/** Books that have at least one publishable song and are not archived, sorted by `order`. */
export async function getBooks(): Promise<Book[]> {
  if (booksCache) return booksCache;
  const songs = await getSongs();
  const used = new Set(songs.flatMap((s) => s.numbers.map((n) => n.book)));
  booksCache = (await getCollection('books'))
    .map((e) => e.data)
    .filter((b) => b.status !== 'archived' && used.has(b.id))
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  return booksCache;
}

/** Natural sort for hymn numbers: 2 < 10 < 117 < 117a. */
export function compareNumbers(a: string, b: string): number {
  return a.localeCompare(b, 'en', { numeric: true, sensitivity: 'base' });
}

export async function getBookEntries(bookId: string): Promise<{ number: string; song: Song }[]> {
  const songs = await getSongs();
  return songs
    .flatMap((song) => song.numbers.filter((n) => n.book === bookId).map((n) => ({ number: n.number, song })))
    .sort((a, b) => compareNumbers(a.number, b.number));
}
