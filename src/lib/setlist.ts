import { site } from '../site.config';
import { MAX_SET_SONGS, MAX_SETS, storage, type SavedSet, type SetItem, type SetList } from './storage';

export type { SetItem, SetList, SavedSet };

/** Share links longer than this may break in some chat apps and QR scanners. */
export const MAX_SHARE_URL = 1800;
const MAX_NOTE = 200;
const MAX_TITLE = 80;
const ID_RE = /^(en|hi|ta|te|pa)-[a-z0-9-]+$/;
const BOOK_RE = /^[A-Za-z]{1,6}$/;

export function encodeSet(set: SetList): string {
  const bytes = new TextEncoder().encode(JSON.stringify(set));
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Parse a share code. Anything untrusted is dropped or trimmed; null when the code is not a set. */
export function decodeSet(code: string): SetList | null {
  try {
    const b64 = code.replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '==='.slice((b64.length + 3) % 4);
    const bin = atob(padded);
    const obj: unknown = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))));
    if (!obj || typeof obj !== 'object') return null;
    const o = obj as { v?: unknown; t?: unknown; d?: unknown; s?: unknown };
    if (o.v !== 1 || !Array.isArray(o.s) || typeof o.t !== 'string') return null;
    const items: SetItem[] = (o.s as unknown[])
      .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
      .filter((x) => typeof x.id === 'string' && ID_RE.test(x.id))
      .slice(0, MAX_SET_SONGS)
      .map((x) => ({
        id: x.id as string,
        ...(typeof x.note === 'string' && x.note ? { note: x.note.slice(0, MAX_NOTE) } : {}),
        ...(typeof x.book === 'string' && BOOK_RE.test(x.book) ? { book: x.book } : {}),
      }));
    return {
      v: 1,
      t: o.t.slice(0, MAX_TITLE),
      ...(typeof o.d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(o.d) ? { d: o.d } : {}),
      s: items,
    };
  } catch {
    return null;
  }
}

const origin = () => (typeof location !== 'undefined' ? location.origin : site.url);

export const setShareUrl = (code: string): string => `${origin()}/set/#s=${code}`;

export function songInSetUrl(set: SetList, code: string, i: number): string {
  const item = set.s[i];
  if (!item) return '/set/';
  const from = item.book ? `&from=${item.book.toLowerCase()}` : '';
  return `/song/${item.id}/?set=${code}&i=${i}${from}`;
}

/** The coming Sunday (today if it is Sunday) as YYYY-MM-DD in local time. */
export function nextSunday(today = new Date()): string {
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + ((7 - today.getDay()) % 7));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function formatSetDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(
    new Date(y!, m! - 1, d!),
  );
}

export function newDraft(today = new Date()): SetList {
  const d = nextSunday(today);
  return { v: 1, t: `Sunday, ${formatSetDate(d)}`, d, s: [] };
}

/* ---------- Draft set (the one "+ Set" adds to) ---------- */

export const getDraft = (): SetList => storage.draftSet.get() ?? newDraft();

export function saveDraft(set: SetList): SetList {
  const clean = { ...set, t: set.t.slice(0, MAX_TITLE), s: set.s.slice(0, MAX_SET_SONGS) };
  storage.draftSet.set(clean);
  return clean;
}

export const isInDraft = (id: string): boolean => !!storage.draftSet.get()?.s.some((x) => x.id === id);

/** Adds a song to the draft. Returns false when the set is already full. */
export function addToDraft(item: SetItem): boolean {
  const set = getDraft();
  if (set.s.some((x) => x.id === item.id)) return true;
  if (set.s.length >= MAX_SET_SONGS) return false;
  saveDraft({ ...set, s: [...set.s, item] });
  return true;
}

export function removeFromDraft(id: string): void {
  const set = getDraft();
  saveDraft({ ...set, s: set.s.filter((x) => x.id !== id) });
}

/** Pure reorder helper: move item at `from` to `to`. */
export function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || from >= list.length || to < 0 || to >= list.length) return list;
  const next = [...list];
  const [x] = next.splice(from, 1);
  next.splice(to, 0, x!);
  return next;
}

/* ---------- Saved sets ("My sets") ---------- */

export const getSavedSets = (): SavedSet[] =>
  [...storage.sets.get().items].sort((a, b) => b.savedAt.localeCompare(a.savedAt));

export function saveSet(set: SetList): SavedSet {
  const code = encodeSet(set);
  const saved: SavedSet = { ...set, code, savedAt: new Date().toISOString() };
  const rest = storage.sets.get().items.filter((x) => x.code !== code);
  storage.sets.set({ v: 1, items: [saved, ...rest].slice(0, MAX_SETS) });
  return saved;
}

export function deleteSavedSet(code: string): SavedSet | undefined {
  const items = storage.sets.get().items;
  const gone = items.find((x) => x.code === code);
  storage.sets.set({ v: 1, items: items.filter((x) => x.code !== code) });
  return gone;
}

export function restoreSavedSet(set: SavedSet): void {
  const items = storage.sets.get().items.filter((x) => x.code !== set.code);
  storage.sets.set({ v: 1, items: [set, ...items].slice(0, MAX_SETS) });
}

export const isSavedCode = (code: string): boolean => storage.sets.get().items.some((x) => x.code === code);
