import { LANGS, type Lang } from './langs';
import type { SongData } from './schema';

type SongLike = Pick<SongData, 'publish' | 'rights' | 'sections' | 'numbers'>;

/** Song language = the part of the id before the first `-` (ids come from `songs/<lang>/<slug>.json`). */
export function langOf(id: string): Lang {
  const lang = id.split('-')[0] as Lang;
  if (!LANGS.includes(lang)) throw new Error(`Song id "${id}" does not start with a known language`);
  return lang;
}

/** Published in production only if `publish` and rights are public_domain/licensed (demo only when allowed). */
export function isPublishable(song: Pick<SongLike, 'publish' | 'rights'>, includeDemo: boolean): boolean {
  if (!song.publish) return false;
  const s = song.rights.status;
  return s === 'public_domain' || s === 'licensed' || (s === 'demo' && includeDemo);
}

export function firstLine(song: Pick<SongLike, 'sections'>): { n: string; r: string; e: string } {
  const line = song.sections[0]?.lines[0];
  return { n: line?.n ?? '', r: line?.r ?? '', e: line?.e ?? '' };
}

export const songUrl = (id: string): string => `/song/${id}/`;

/** Number permalink: book code lowercased in the URL (`/b/dt/117/`). */
export const numberUrl = (book: string, number: string): string =>
  `/b/${book.toLowerCase()}/${encodeURIComponent(number.toLowerCase())}/`;

/** The number to show on the badge: the book the user came from if the song is in it, else the first entry. */
export function primaryNumber(
  song: Pick<SongLike, 'numbers'>,
  preferredBook?: string | null,
): { book: string; number: string } {
  const pref = preferredBook?.toLowerCase();
  const hit = pref ? song.numbers.find((n) => n.book.toLowerCase() === pref) : undefined;
  const first = song.numbers[0];
  if (!first) throw new Error('Song has no numbers');
  return hit ?? first;
}

export const badgeText = (n: { book: string; number: string }): string => `${n.book} ${n.number}`;
