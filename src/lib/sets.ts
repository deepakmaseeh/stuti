/**
 * Set Lists 2.0 — single localStorage store for worship sets.
 * @see STUTI_SETLISTS_AND_FIXES.md §2, docs/adr/0008-setlists-v2.md
 */
import { signal } from '@preact/signals';
import { site } from '../site.config';
import { decodeSet as decodeV1Set, encodeSet as encodeV1Set, formatSetDate, nextSunday } from './setlist';
import type { SetList } from './storage';

export const MAX_SET_ITEMS = 60;
export const MAX_WORSHIP_SETS = 200;
export const SETS_KEY = 'stuti:sets:v2';
export const SETS_V1_BACKUP = 'stuti:sets:v1-backup';

export type ServiceType =
  | 'sunday_morning'
  | 'sunday_evening'
  | 'prayer'
  | 'youth'
  | 'christmas'
  | 'easter'
  | 'good_friday'
  | 'wedding'
  | 'funeral'
  | 'other';

export type SetSongItem = {
  kind: 'song';
  uid: string;
  songId: string;
  book?: string;
  key?: string;
  note?: string;
  verses?: number[];
  repeatChorus?: boolean;
};

export type SetHeadingItem = { kind: 'heading'; uid: string; text: string };

export type WorshipSetItem = SetSongItem | SetHeadingItem;

export type WorshipSet = {
  v: 2;
  id: string;
  title: string;
  date: string;
  time?: string;
  service: ServiceType;
  leader?: string;
  notes?: string;
  items: WorshipSetItem[];
  createdAt: string;
  updatedAt: string;
  source?: 'mine' | 'shared';
  sharedFrom?: string;
};

export type SetsStore = {
  v: 2;
  activeId?: string;
  sets: WorshipSet[];
};

const SERVICE_LABELS: Record<ServiceType, string> = {
  sunday_morning: 'Sunday Morning',
  sunday_evening: 'Sunday Evening',
  prayer: 'Prayer',
  youth: 'Youth',
  christmas: 'Christmas',
  easter: 'Easter',
  good_friday: 'Good Friday',
  wedding: 'Wedding',
  funeral: 'Funeral',
  other: 'Service',
};

export const serviceLabel = (s: ServiceType): string => SERVICE_LABELS[s] ?? 'Service';

export function uid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Coming Christmas (25 Dec this year, or next if past). */
export function nextChristmas(today = new Date()): string {
  const y = today.getFullYear();
  const thisX = new Date(y, 11, 25);
  const d = today > thisX ? new Date(y + 1, 11, 25) : thisX;
  return isoDate(d);
}

/** Anonymous Gregorian Easter Sunday for year y. */
export function easterSunday(year: number): string {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return isoDate(new Date(year, month - 1, day));
}

export function nextEaster(today = new Date()): string {
  const y = today.getFullYear();
  const thisE = easterSunday(y);
  const [yy, mm, dd] = thisE.split('-').map(Number);
  const d = new Date(yy!, mm! - 1, dd!);
  if (today > d) return easterSunday(y + 1);
  return thisE;
}

export function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function defaultTitle(service: ServiceType, date: string): string {
  return `${serviceLabel(service)} · ${formatSetDate(date)}`;
}

export function defaultDateForService(service: ServiceType, today = new Date()): string {
  if (service === 'christmas') return nextChristmas(today);
  if (service === 'easter') return nextEaster(today);
  return nextSunday(today);
}

export function emptyStore(): SetsStore {
  return { v: 2, sets: [] };
}

function readRaw(): SetsStore | null {
  try {
    const raw = localStorage.getItem(SETS_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const o = parsed as SetsStore;
    if (o.v !== 2 || !Array.isArray(o.sets)) return null;
    return o;
  } catch {
    return null;
  }
}

type SetsListener = () => void;
const setsListeners = new Set<SetsListener>();
let setsChannel: BroadcastChannel | undefined;

function ensureSetsChannel(): BroadcastChannel | undefined {
  if (setsChannel || typeof BroadcastChannel === 'undefined') return setsChannel;
  try {
    setsChannel = new BroadcastChannel('stuti-sets');
    // Own posts are not delivered to this port; other tabs/ports are.
    setsChannel.onmessage = () => {
      for (const l of setsListeners) l();
    };
  } catch {
    setsChannel = undefined;
  }
  return setsChannel;
}

function writeStore(store: SetsStore): void {
  try {
    localStorage.setItem(SETS_KEY, JSON.stringify(store));
  } catch {
    /* quota / private */
  }
  broadcast();
}

function broadcast(): void {
  try {
    dispatchEvent(new Event('stuti:set-changed'));
  } catch {
    /* SSR */
  }
  try {
    ensureSetsChannel()?.postMessage({ type: 'changed' });
  } catch {
    /* unsupported */
  }
}

/** Convert a v1 SetList into a WorshipSet. */
export function v1ToWorshipSet(list: SetList, id = uid()): WorshipSet {
  const now = new Date().toISOString();
  const date = list.d && /^\d{4}-\d{2}-\d{2}$/.test(list.d) ? list.d : nextSunday();
  return {
    v: 2,
    id,
    title: list.t || defaultTitle('other', date),
    date,
    service: 'other',
    items: list.s.map((s) => ({
      kind: 'song' as const,
      uid: uid(),
      songId: s.id,
      ...(s.book ? { book: s.book } : {}),
      ...(s.note ? { note: s.note } : {}),
    })),
    createdAt: now,
    updatedAt: now,
    source: 'mine',
  };
}

export function migrateFromV1(): SetsStore {
  const existing = readRaw();
  if (existing && existing.sets.length) return existing;

  const sets: WorshipSet[] = [];
  try {
    const draftRaw = localStorage.getItem('stuti:draftSet');
    const setsRaw = localStorage.getItem('stuti:sets');
    try {
      localStorage.setItem(
        SETS_V1_BACKUP,
        JSON.stringify({ draft: draftRaw, sets: setsRaw, at: new Date().toISOString() }),
      );
    } catch {
      /* ignore */
    }

    if (draftRaw) {
      const draft = JSON.parse(draftRaw) as SetList;
      if (draft?.v === 1 && Array.isArray(draft.s) && (draft.s.length > 0 || draft.t)) {
        sets.push(v1ToWorshipSet(draft));
      }
    }
    if (setsRaw) {
      const bag = JSON.parse(setsRaw) as { v?: number; items?: Array<SetList & { code?: string }> };
      if (Array.isArray(bag.items)) {
        for (const item of bag.items) {
          if (item?.v === 1 && Array.isArray(item.s)) {
            const w = v1ToWorshipSet(item);
            if (!sets.some((s) => s.title === w.title && s.date === w.date && s.items.length === w.items.length)) {
              sets.push(w);
            }
          }
        }
      }
    }
  } catch {
    /* corrupt v1 */
  }

  const store: SetsStore = {
    v: 2,
    sets: sets.slice(0, MAX_WORSHIP_SETS),
    ...(sets[0] ? { activeId: sets[0].id } : {}),
  };
  writeStore(store);
  return store;
}

export function loadStore(): SetsStore {
  const raw = readRaw();
  if (raw) return raw;
  return migrateFromV1();
}

/** Reactive snapshot — components should subscribe via useSetsStore() or effects. */
export const setsSignal = signal<SetsStore>(emptyStore());

let hydrated = false;

export function hydrateSets(): SetsStore {
  if (typeof localStorage === 'undefined') return emptyStore();
  const store = loadStore();
  setsSignal.value = store;
  hydrated = true;
  return store;
}

function ensureHydrated(): SetsStore {
  if (!hydrated && typeof localStorage !== 'undefined') return hydrateSets();
  return setsSignal.value;
}

function commit(store: SetsStore): SetsStore {
  const next = {
    ...store,
    sets: store.sets.slice(0, MAX_WORSHIP_SETS),
  };
  setsSignal.value = next;
  writeStore(next);
  return next;
}

export function getSets(): WorshipSet[] {
  return ensureHydrated().sets;
}

export function getSet(id: string): WorshipSet | undefined {
  return ensureHydrated().sets.find((s) => s.id === id);
}

export function getActiveSet(): WorshipSet | undefined {
  const store = ensureHydrated();
  if (store.activeId) {
    const hit = store.sets.find((s) => s.id === store.activeId);
    if (hit) return hit;
  }
  const upcoming = [...store.sets]
    .filter((s) => s.date >= isoDate(new Date()))
    .sort((a, b) => a.date.localeCompare(b.date));
  return upcoming[0] ?? store.sets[0];
}

export function setActive(id: string | undefined): void {
  const store = ensureHydrated();
  commit({ ...store, activeId: id });
}

export function createSet(partial: {
  title?: string;
  date?: string;
  time?: string;
  service?: ServiceType;
  leader?: string;
  notes?: string;
  items?: WorshipSetItem[];
  source?: 'mine' | 'shared';
  sharedFrom?: string;
  makeActive?: boolean;
}): WorshipSet {
  const store = ensureHydrated();
  const service = partial.service ?? 'sunday_morning';
  const date = partial.date ?? defaultDateForService(service);
  const now = new Date().toISOString();
  const set: WorshipSet = {
    v: 2,
    id: uid(),
    title: partial.title ?? defaultTitle(service, date),
    date,
    ...(partial.time ? { time: partial.time } : {}),
    service,
    ...(partial.leader ? { leader: partial.leader } : {}),
    ...(partial.notes ? { notes: partial.notes } : {}),
    items: (partial.items ?? []).slice(0, MAX_SET_ITEMS),
    createdAt: now,
    updatedAt: now,
    source: partial.source ?? 'mine',
    ...(partial.sharedFrom ? { sharedFrom: partial.sharedFrom } : {}),
  };
  commit({
    ...store,
    sets: [set, ...store.sets],
    activeId: partial.makeActive === false ? store.activeId : set.id,
  });
  return set;
}

export function updateSet(id: string, patch: Partial<Omit<WorshipSet, 'v' | 'id' | 'createdAt'>>): WorshipSet | undefined {
  const store = ensureHydrated();
  const i = store.sets.findIndex((s) => s.id === id);
  if (i < 0) return undefined;
  const prev = store.sets[i]!;
  const next: WorshipSet = {
    ...prev,
    ...patch,
    items: (patch.items ?? prev.items).slice(0, MAX_SET_ITEMS),
    updatedAt: new Date().toISOString(),
    v: 2,
    id: prev.id,
    createdAt: prev.createdAt,
  };
  const sets = [...store.sets];
  sets[i] = next;
  commit({ ...store, sets });
  return next;
}

export function addSongToSet(
  setId: string,
  song: { songId: string; book?: string; note?: string; key?: string },
): boolean {
  const set = getSet(setId);
  if (!set) return false;
  if (set.items.some((x) => x.kind === 'song' && x.songId === song.songId)) return true;
  if (set.items.length >= MAX_SET_ITEMS) return false;
  const item: SetSongItem = {
    kind: 'song',
    uid: uid(),
    songId: song.songId,
    ...(song.book ? { book: song.book } : {}),
    ...(song.note ? { note: song.note } : {}),
    ...(song.key ? { key: song.key } : {}),
  };
  updateSet(setId, { items: [...set.items, item] });
  return true;
}

export function addSongToActive(song: { songId: string; book?: string }): boolean {
  let active = getActiveSet();
  if (!active) {
    active = createSet({ makeActive: true });
  }
  return addSongToSet(active.id, song);
}

export function removeItem(setId: string, itemUid: string): void {
  const set = getSet(setId);
  if (!set) return;
  updateSet(setId, { items: set.items.filter((x) => x.uid !== itemUid) });
}

export function moveItemInSet(setId: string, from: number, to: number): void {
  const set = getSet(setId);
  if (!set) return;
  if (from === to || from < 0 || to < 0 || from >= set.items.length || to >= set.items.length) return;
  const items = [...set.items];
  const [x] = items.splice(from, 1);
  items.splice(to, 0, x!);
  updateSet(setId, { items });
}

export function addHeading(setId: string, text: string): void {
  const set = getSet(setId);
  if (!set || set.items.length >= MAX_SET_ITEMS) return;
  updateSet(setId, {
    items: [...set.items, { kind: 'heading', uid: uid(), text: text.slice(0, 80) }],
  });
}

export function duplicateSet(id: string, date?: string): WorshipSet | undefined {
  const src = getSet(id);
  if (!src) return undefined;
  const newDate = date ?? nextSunday();
  return createSet({
    title: defaultTitle(src.service, newDate),
    date: newDate,
    time: src.time,
    service: src.service,
    leader: src.leader,
    notes: src.notes,
    items: src.items.map((it) =>
      it.kind === 'song'
        ? { ...it, uid: uid() }
        : { kind: 'heading', uid: uid(), text: it.text },
    ),
    makeActive: true,
  });
}

let lastDeleted: WorshipSet | undefined;

export function deleteSet(id: string): WorshipSet | undefined {
  const store = ensureHydrated();
  const gone = store.sets.find((s) => s.id === id);
  if (!gone) return undefined;
  lastDeleted = gone;
  commit({
    ...store,
    sets: store.sets.filter((s) => s.id !== id),
    activeId: store.activeId === id ? store.sets.find((s) => s.id !== id)?.id : store.activeId,
  });
  return gone;
}

export function undoDeleteSet(): WorshipSet | undefined {
  if (!lastDeleted) return undefined;
  const store = ensureHydrated();
  const restored = lastDeleted;
  lastDeleted = undefined;
  commit({ ...store, sets: [restored, ...store.sets] });
  return restored;
}

export function songItems(set: WorshipSet): SetSongItem[] {
  return set.items.filter((x): x is SetSongItem => x.kind === 'song');
}

export function songInWorshipSetUrl(set: WorshipSet, i: number, sharedCode?: string): string {
  const songs = songItems(set);
  const item = songs[i];
  if (!item) return '/sets/';
  const from = item.book ? `&from=${item.book.toLowerCase()}` : '';
  if (sharedCode) return `/song/${item.songId}/?shared=${encodeURIComponent(sharedCode)}&i=${i}${from}`;
  return `/song/${item.songId}/?set=${set.id}&i=${i}${from}`;
}

export function isSongInActive(songId: string): boolean {
  const active = getActiveSet();
  return !!active?.items.some((x) => x.kind === 'song' && x.songId === songId);
}

export function removeSongFromActive(songId: string): void {
  const active = getActiveSet();
  if (!active) return;
  updateSet(active.id, {
    items: active.items.filter((x) => !(x.kind === 'song' && x.songId === songId)),
  });
}

export function upcomingSets(today = isoDate(new Date())): WorshipSet[] {
  return [...getSets()].filter((s) => s.date >= today).sort((a, b) => a.date.localeCompare(b.date));
}

export function pastSets(today = isoDate(new Date())): WorshipSet[] {
  return [...getSets()].filter((s) => s.date < today).sort((a, b) => b.date.localeCompare(a.date));
}

export function templateHeadings(kind: 'sunday_morning' | 'communion' | 'christmas' | 'wedding' | 'funeral'): WorshipSetItem[] {
  const texts: Record<string, string[]> = {
    sunday_morning: ['Opening', 'Praise', 'Sermon', 'Closing'],
    communion: ['Opening', 'Communion', 'Closing'],
    christmas: ['Carols', 'Reading', 'Closing'],
    wedding: ['Entrance', 'Worship', 'Closing'],
    funeral: ['Opening', 'Tribute', 'Closing'],
  };
  return (texts[kind] ?? []).map((text) => ({ kind: 'heading' as const, uid: uid(), text }));
}

/* ---------- Share codec (v2) ---------- */

/** Chat apps / QR scanners often break past ~1800 characters. */
export const MAX_SHARE_URL = 1800;

type ShareV2 = {
  v: 2;
  t: string;
  d: string;
  svc?: ServiceType;
  i: Array<[string, string?, string?, number[]?] | ['#', string]>;
};

function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(code: string): Uint8Array {
  const b64 = code.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '==='.slice((b64.length + 3) % 4);
  const bin = atob(padded);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

export function encodeWorshipSet(set: WorshipSet): string {
  const payload: ShareV2 = {
    v: 2,
    t: set.title.slice(0, 80),
    d: set.date,
    ...(set.service && set.service !== 'other' ? { svc: set.service } : {}),
    i: set.items.slice(0, MAX_SET_ITEMS).map((it) => {
      if (it.kind === 'heading') return ['#', it.text.slice(0, 80)] as ['#', string];
      const row: [string, string?, string?, number[]?] = [it.songId];
      if (it.key) row[1] = it.key.slice(0, 8);
      if (it.note) {
        if (!row[1]) row[1] = '';
        row[2] = it.note.slice(0, 120);
      }
      if (it.verses?.length) {
        if (!row[1]) row[1] = '';
        if (row[2] === undefined) row[2] = '';
        row[3] = it.verses;
      }
      return row;
    }),
  };
  // Compact JSON (no spaces) + omit empty optionals keeps links shorter offline.
  return bytesToBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
}

export function decodeWorshipSet(code: string): WorshipSet | null {
  try {
    let obj: unknown;
    try {
      obj = JSON.parse(new TextDecoder().decode(base64UrlToBytes(code)));
    } catch {
      const v1 = decodeV1Set(code);
      return v1 ? v1ToWorshipSet(v1) : null;
    }
    if (!obj || typeof obj !== 'object') return null;
    const o = obj as { v?: unknown };

    if (o.v === 1) {
      const v1 = decodeV1Set(code);
      return v1 ? v1ToWorshipSet(v1) : null;
    }
    if (o.v !== 2) return null;
    const s = o as ShareV2;
    if (typeof s.t !== 'string' || typeof s.d !== 'string' || !Array.isArray(s.i)) return null;
    const now = new Date().toISOString();
    const items: WorshipSetItem[] = [];
    for (const row of s.i.slice(0, MAX_SET_ITEMS)) {
      if (!Array.isArray(row) || row.length < 1) continue;
      if (row[0] === '#') {
        items.push({ kind: 'heading', uid: uid(), text: String(row[1] ?? 'Section').slice(0, 80) });
        continue;
      }
      const songId = String(row[0]);
      if (!/^(en|hi|ta|te|pa)-[a-z0-9-]+$/.test(songId)) continue;
      items.push({
        kind: 'song',
        uid: uid(),
        songId,
        ...(typeof row[1] === 'string' && row[1] ? { key: row[1].slice(0, 8) } : {}),
        ...(typeof row[2] === 'string' && row[2] ? { note: row[2].slice(0, 200) } : {}),
        ...(Array.isArray(row[3]) ? { verses: row[3].filter((n) => Number.isInteger(n)) } : {}),
      });
    }
    return {
      v: 2,
      id: uid(),
      title: s.t.slice(0, 80),
      date: /^\d{4}-\d{2}-\d{2}$/.test(s.d) ? s.d : nextSunday(),
      service: (s.svc as ServiceType) || 'other',
      items,
      createdAt: now,
      updatedAt: now,
      source: 'shared',
      sharedFrom: code.slice(0, 32),
    };
  } catch {
    return null;
  }
}

export function setShareUrl(code: string): string {
  const origin = typeof location !== 'undefined' ? location.origin : site.url;
  return `${origin}/sets/view/#s=${code}`;
}

/** Short label for UI (full URL still copied/shared). */
export function truncateShareUrl(url: string, max = 56): string {
  if (url.length <= max) return url;
  const keep = Math.max(12, Math.floor((max - 3) / 2));
  return `${url.slice(0, keep)}…${url.slice(-keep)}`;
}

/** Legacy Present/print helpers: compress worship set songs to v1 SetList. */
export function worshipSetToV1(set: WorshipSet): SetList {
  return {
    v: 1,
    t: set.title,
    d: set.date,
    s: songItems(set).map((it) => ({
      id: it.songId,
      ...(it.book ? { book: it.book } : {}),
      ...(it.note ? { note: it.note } : {}),
    })),
  };
}

export function encodeForPresent(set: WorshipSet): string {
  return encodeV1Set(worshipSetToV1(set));
}

export function listenSetsChanged(cb: () => void): () => void {
  ensureSetsChannel();
  setsListeners.add(cb);
  const onEvt = () => cb();
  addEventListener('stuti:set-changed', onEvt);
  addEventListener('storage', onEvt);
  return () => {
    setsListeners.delete(cb);
    removeEventListener('stuti:set-changed', onEvt);
    removeEventListener('storage', onEvt);
  };
}
