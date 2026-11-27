import { site } from '../site.config';
import { applyPrefs } from './prefs';

export type Theme = 'system' | 'light' | 'dark';
/** Song layer arrangement on wide screens; stacked is always used below desktop. */
export type LyricLayout = 'stacked' | 'columns';
export type Prefs = {
  v: 1;
  layers: { n: boolean; r: boolean; e: boolean };
  size: number;
  theme: Theme;
  /** Side-by-side layers on ≥1200px; ignored on phone/tablet. */
  layout: LyricLayout;
  keepAwake: boolean;
  lastBookId: string;
  lastTab: 'number' | 'words' | 'browse' | 'songs';
  /** Desktop TopBar language filter: all languages or one code. */
  langFilter: 'all' | string;
  searchLangs: string[];
  musician?: boolean;
  churchName?: string;
  serviceTime?: string;
  persist?: boolean;
};
export type SongSnapshot = { id: string; title: string; lang: string; badge: string };
export type RecentItem = SongSnapshot & { at: string };
export type RecentLetter = { script: string; letter: string; at: string };
export type SetItem = { id: string; note?: string; book?: string };
export type SetList = { v: 1; t: string; d?: string; s: SetItem[] };
export type SavedSet = SetList & { code: string; savedAt: string };
export type DownloadRecord = { version: string; updated: string; bytes: number; at: string; urls: string[] };

export const MAX_FAVS = 500;
export const MAX_RECENT = 10;
export const MAX_RECENT_LETTERS = 8;
export const MAX_SETS = 20;
export const MAX_SET_SONGS = 30;
export const SIZE_STEPS = 6;

export const DEFAULT_PREFS: Prefs = {
  v: 1,
  layers: { n: true, r: true, e: false },
  size: 2,
  theme: 'system',
  layout: 'stacked',
  keepAwake: false,
  lastBookId: site.defaultBookId,
  lastTab: 'browse',
  langFilter: 'all',
  searchLangs: [...site.languages],
};

function read<T>(key: string, fallback: T, isValid: (x: unknown) => boolean): T {
  try {
    const raw = localStorage.getItem(`stuti:${key}`);
    if (!raw) return fallback;
    const parsed: unknown = JSON.parse(raw);
    return isValid(parsed) ? (parsed as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(`stuti:${key}`, JSON.stringify(value));
  } catch {
    // private mode or quota: keep working without persistence
  }
}

const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const isV1 = (x: unknown) => isObj(x) && x.v === 1;
const isV1List = (x: unknown) => isV1(x) && Array.isArray((x as { items?: unknown }).items);

function slot<T>(key: string, fallback: () => T, isValid: (x: unknown) => boolean) {
  return {
    get: (): T => read(key, fallback(), isValid),
    set: (value: T): void => write(key, value),
  };
}

const prefsSlot = slot<Prefs>('prefs', () => DEFAULT_PREFS, isObj);
const favsSlot = slot<{ v: 1; items: SongSnapshot[] }>('favs', () => ({ v: 1, items: [] }), isV1List);
const recentSlot = slot<{ v: 1; items: RecentItem[] }>('recent', () => ({ v: 1, items: [] }), isV1List);
const recentLettersSlot = slot<{ v: 1; items: RecentLetter[] }>(
  'recentLetters',
  () => ({ v: 1, items: [] }),
  isV1List,
);
const setsSlot = slot<{ v: 1; items: SavedSet[] }>('sets', () => ({ v: 1, items: [] }), isV1List);

export const storage = {
  prefs: {
    /** Merges stored prefs over defaults so new fields get default values. */
    get: (): Prefs => {
      const p = prefsSlot.get();
      const theme = (p.theme as string) === 'contrast' ? 'dark' : p.theme;
      return {
        ...DEFAULT_PREFS,
        ...p,
        theme: theme ?? DEFAULT_PREFS.theme,
        layers: { ...DEFAULT_PREFS.layers, ...(p.layers ?? {}) },
        v: 1,
      };
    },
    set: prefsSlot.set,
  },
  favs: favsSlot,
  recent: recentSlot,
  recentLetters: recentLettersSlot,
  draftSet: slot<SetList | null>(
    'draftSet',
    () => null,
    (x) => isV1(x) && Array.isArray((x as SetList).s),
  ),
  sets: setsSlot,
  downloads: slot<Record<string, DownloadRecord>>('downloads', () => ({}), isObj),
  installNudge: slot<{ dismissedAt?: string; songOpens: number }>(
    'installNudge',
    () => ({ songOpens: 0 }),
    isObj,
  ),
  tour: slot<{ dismissedAt?: string }>('tour', () => ({}), isObj),
};

export function updatePrefs(patch: Partial<Prefs>): Prefs {
  const next = { ...storage.prefs.get(), ...patch };
  storage.prefs.set(next);
  if (typeof document !== 'undefined') {
    applyPrefs(document.documentElement, next);
    dispatchEvent(new CustomEvent('stuti:prefs', { detail: next }));
  }
  return next;
}

export function isFavourite(id: string): boolean {
  return storage.favs.get().items.some((f) => f.id === id);
}

export function toggleFavourite(snap: SongSnapshot): boolean {
  const favs = storage.favs.get();
  const has = favs.items.some((f) => f.id === snap.id);
  const items = has ? favs.items.filter((f) => f.id !== snap.id) : [snap, ...favs.items].slice(0, MAX_FAVS);
  storage.favs.set({ v: 1, items });
  return !has;
}

export function pushRecent(snap: SongSnapshot): void {
  const items = [
    { ...snap, at: new Date().toISOString() },
    ...storage.recent.get().items.filter((r) => r.id !== snap.id),
  ];
  storage.recent.set({ v: 1, items: items.slice(0, MAX_RECENT) });
}

export function pushRecentLetter(script: string, letter: string): void {
  const items = [
    { script, letter, at: new Date().toISOString() },
    ...storage.recentLetters.get().items.filter((r) => !(r.script === script && r.letter === letter)),
  ];
  storage.recentLetters.set({ v: 1, items: items.slice(0, MAX_RECENT_LETTERS) });
}

export function clearAllData(): void {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith('stuti:'))
      .forEach((k) => localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}
