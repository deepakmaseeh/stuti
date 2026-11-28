/**
 * WorshipSet v2.1 — rows: section (h) | song (s) | item (i).
 * @see STUTI_UI_CORRECTIONS_v1.4.md §3
 */
import { z } from 'zod';

export const KEY_RE = /^[A-G]([♯♭#b])?m?$/;

export const ItemType = z.enum([
  'prayer',
  'scripture',
  'sermon',
  'offering',
  'announcements',
  'benediction',
  'communion',
  'custom',
]);
export type ItemType = z.infer<typeof ItemType>;

export const HeadingRow = z.object({
  k: z.literal('h'),
  id: z.string().min(1),
  label: z.string().min(1).max(40),
});

export const VerseNote = z.object({
  st: z.string().min(1),
  text: z.string().min(1).max(200),
  mode: z.enum(['inline', 'slide']),
});
export type VerseNote = z.infer<typeof VerseNote>;

export const SongRow = z.object({
  k: z.literal('s'),
  id: z.string().min(1),
  song: z.string().min(1),
  book: z.string().min(1).max(8),
  no: z.number().int().nonnegative().optional(),
  key: z.string().regex(KEY_RE).optional(),
  seq: z.array(z.string()).optional(),
  by: z.string().max(60).optional(),
  note: z.string().max(140).optional(),
  notes: z.array(VerseNote).optional(),
  minutes: z.number().positive().optional(),
});

export const ItemRow = z.object({
  k: z.literal('i'),
  id: z.string().min(1),
  type: ItemType,
  title: z.string().min(1).max(120),
  ref: z.string().max(80).optional(),
  by: z.string().max(60).optional(),
  minutes: z.number().positive().optional(),
});

export const SlideStyle = z.enum(['text', 'verse', 'announce', 'blank']);
export type SlideStyle = z.infer<typeof SlideStyle>;

export const SlideRow = z.object({
  k: z.literal('slide'),
  id: z.string().min(1),
  style: SlideStyle,
  title: z.string().max(120).optional(),
  body: z.string().max(1200).optional(),
  minutes: z.number().positive().optional(),
});
export type SlideRow = z.infer<typeof SlideRow>;

export const SetRow = z.discriminatedUnion('k', [HeadingRow, SongRow, ItemRow, SlideRow]);
export type SetRow = z.infer<typeof SetRow>;
export type HeadingRow = z.infer<typeof HeadingRow>;
export type SongRow = z.infer<typeof SongRow>;
export type ItemRow = z.infer<typeof ItemRow>;

export const WorshipSetV21 = z.object({
  v: z.literal(2.1),
  id: z.string().uuid().or(z.string().min(1)),
  title: z.string().min(1).max(120),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  service: z.string().min(1),
  leader: z.string().max(80).optional(),
  preacher: z.string().max(80).optional(),
  notes: z.string().max(2000).optional(),
  rows: z.array(SetRow),
  updatedAt: z.number(),
  createdAt: z.number().optional(),
  source: z.enum(['mine', 'shared']).optional(),
  sharedFrom: z.string().optional(),
});
export type WorshipSetV21 = z.infer<typeof WorshipSetV21>;

export const SetsStoreV21 = z.object({
  v: z.literal(2.1),
  activeId: z.string().optional(),
  sets: z.array(WorshipSetV21),
});
export type SetsStoreV21 = z.infer<typeof SetsStoreV21>;

function newId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function parseIsoMs(v: unknown, fallback = Date.now()): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const t = Date.parse(v);
    if (!Number.isNaN(t)) return t;
  }
  return fallback;
}

/** Legacy v2 item shape (kind: song | heading). */
type LegacyItem =
  | {
      kind: 'song';
      uid: string;
      songId: string;
      book?: string;
      key?: string;
      note?: string;
      verses?: number[];
      repeatChorus?: boolean;
    }
  | { kind: 'heading'; uid: string; text: string };

type LegacyV2Set = {
  v?: number;
  id?: string;
  title?: string;
  date?: string;
  time?: string;
  service?: string;
  leader?: string;
  preacher?: string;
  notes?: string;
  items?: LegacyItem[];
  rows?: unknown[];
  createdAt?: string | number;
  updatedAt?: string | number;
  source?: 'mine' | 'shared';
  sharedFrom?: string;
};

function versesToSeq(verses: number[] | undefined, repeatChorus: boolean | undefined): string[] | undefined {
  if (!verses?.length) return undefined;
  const seq: string[] = [];
  for (const i of verses) {
    seq.push(`v${i + 1}`);
    if (repeatChorus !== false) seq.push('c');
  }
  return seq.length ? seq : undefined;
}

function legacyItemToRow(it: LegacyItem): SetRow {
  if (it.kind === 'heading') {
    return { k: 'h', id: it.uid || newId(), label: (it.text || 'Section').slice(0, 40) };
  }
  const key = it.key && KEY_RE.test(it.key) ? it.key : undefined;
  return {
    k: 's',
    id: it.uid || newId(),
    song: it.songId,
    book: (it.book || 'TLBC').toUpperCase().slice(0, 8),
    ...(key ? { key } : {}),
    ...(it.note ? { note: it.note.slice(0, 140) } : {}),
    ...(versesToSeq(it.verses, it.repeatChorus) ? { seq: versesToSeq(it.verses, it.repeatChorus) } : {}),
  };
}

function coerceRow(raw: unknown): SetRow | null {
  const parsed = SetRow.safeParse(raw);
  if (parsed.success) return parsed.data;
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  // Tolerate kind-based rows mixed into rows arrays
  if (o.kind === 'heading' || o.k === 'h') {
    return {
      k: 'h',
      id: String(o.id ?? o.uid ?? newId()),
      label: String(o.label ?? o.text ?? 'Section').slice(0, 40),
    };
  }
  if (o.kind === 'song' || o.k === 's') {
    const song = String(o.song ?? o.songId ?? '');
    if (!song) return null;
    const key = typeof o.key === 'string' && KEY_RE.test(o.key) ? o.key : undefined;
    return {
      k: 's',
      id: String(o.id ?? o.uid ?? newId()),
      song,
      book: String(o.book ?? 'TLBC')
        .toUpperCase()
        .slice(0, 8),
      ...(typeof o.no === 'number' ? { no: o.no } : {}),
      ...(key ? { key } : {}),
      ...(Array.isArray(o.seq) ? { seq: o.seq.map(String) } : {}),
      ...(typeof o.by === 'string' ? { by: o.by.slice(0, 60) } : {}),
      ...(typeof o.note === 'string' ? { note: o.note.slice(0, 140) } : {}),
      ...(typeof o.minutes === 'number' ? { minutes: o.minutes } : {}),
    };
  }
  if (o.k === 'i' || o.kind === 'item') {
    const typeParsed = ItemType.safeParse(o.type ?? 'custom');
    return {
      k: 'i',
      id: String(o.id ?? o.uid ?? newId()),
      type: typeParsed.success ? typeParsed.data : 'custom',
      title: String(o.title ?? 'Item').slice(0, 120),
      ...(typeof o.ref === 'string' ? { ref: o.ref.slice(0, 80) } : {}),
      ...(typeof o.by === 'string' ? { by: o.by.slice(0, 60) } : {}),
      ...(typeof o.minutes === 'number' ? { minutes: o.minutes } : {}),
    };
  }
  return null;
}

/** Convert v2.1 rows back to legacy items for UI that still expects kind/uid. */
export function rowsToLegacyItems(rows: SetRow[]): LegacyItem[] {
  const out: LegacyItem[] = [];
  for (const r of rows) {
    if (r.k === 'h') out.push({ kind: 'heading', uid: r.id, text: r.label });
    else if (r.k === 's') {
      const verses = r.seq
        ?.filter((x) => /^v\d+$/i.test(x))
        .map((x) => Math.max(0, Number(x.slice(1)) - 1))
        .filter((n) => Number.isFinite(n));
      out.push({
        kind: 'song',
        uid: r.id,
        songId: r.song,
        book: r.book,
        ...(r.key ? { key: r.key } : {}),
        ...(r.note ? { note: r.note } : {}),
        ...(verses?.length ? { verses } : {}),
        ...(r.seq?.includes('c') ? { repeatChorus: true } : {}),
      });
    }
    // item rows have no legacy equivalent — skipped in legacy bridge
  }
  return out;
}

export function legacyItemsToRows(items: LegacyItem[]): SetRow[] {
  return items.map(legacyItemToRow);
}

/**
 * Migrate any stored set (v1 list shape, v2 items, or partial v2.1) to WorshipSet v2.1.
 * Headings stay; every song keeps its position. Item rows preserved when present.
 */
export function migrateSet(raw: unknown, fallbackId = newId()): WorshipSetV21 {
  if (!raw || typeof raw !== 'object') {
    const now = Date.now();
    return {
      v: 2.1,
      id: fallbackId,
      title: 'Service',
      date: new Date().toISOString().slice(0, 10),
      service: 'sunday_morning',
      rows: [],
      updatedAt: now,
      createdAt: now,
    };
  }

  const o = raw as LegacyV2Set & {
    t?: string;
    d?: string;
    s?: Array<{ id: string; book?: string; note?: string }>;
  };

  // Compact v1 share / draft: { v:1, t, d, s:[{id,book}] }
  if (o.v === 1 && Array.isArray(o.s)) {
    const date =
      typeof o.d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(o.d)
        ? o.d
        : new Date().toISOString().slice(0, 10);
    const now = Date.now();
    return {
      v: 2.1,
      id: fallbackId,
      title: (o.t || 'Service').slice(0, 120),
      date,
      service: 'other',
      rows: o.s.map((s) => ({
        k: 's' as const,
        id: newId(),
        song: s.id,
        book: (s.book || 'TLBC').toUpperCase().slice(0, 8),
        ...(s.note ? { note: s.note.slice(0, 140) } : {}),
      })),
      updatedAt: now,
      createdAt: now,
      source: 'mine',
    };
  }

  const date =
    typeof o.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(o.date)
      ? o.date
      : new Date().toISOString().slice(0, 10);
  const createdAt = parseIsoMs(o.createdAt);
  const updatedAt = parseIsoMs(o.updatedAt, createdAt);

  let rows: SetRow[] = [];
  if (Array.isArray(o.rows) && o.rows.length) {
    rows = o.rows.map(coerceRow).filter((r): r is SetRow => !!r);
  } else if (Array.isArray(o.items)) {
    rows = o.items.map(legacyItemToRow);
  }

  const set: WorshipSetV21 = {
    v: 2.1,
    id: typeof o.id === 'string' && o.id ? o.id : fallbackId,
    title: (typeof o.title === 'string' && o.title ? o.title : 'Service').slice(0, 120),
    date,
    ...(typeof o.time === 'string' && /^\d{2}:\d{2}$/.test(o.time) ? { time: o.time } : {}),
    service: typeof o.service === 'string' && o.service ? o.service : 'sunday_morning',
    ...(typeof o.leader === 'string' && o.leader ? { leader: o.leader.slice(0, 80) } : {}),
    ...(typeof o.preacher === 'string' && o.preacher ? { preacher: o.preacher.slice(0, 80) } : {}),
    ...(typeof o.notes === 'string' && o.notes ? { notes: o.notes.slice(0, 2000) } : {}),
    rows,
    updatedAt,
    createdAt,
    ...(o.source === 'mine' || o.source === 'shared' ? { source: o.source } : {}),
    ...(typeof o.sharedFrom === 'string' ? { sharedFrom: o.sharedFrom } : {}),
  };

  const checked = WorshipSetV21.safeParse(set);
  return checked.success ? checked.data : set;
}

/** Migrate a whole store blob to v2.1. */
export function migrateStore(raw: unknown): SetsStoreV21 {
  if (!raw || typeof raw !== 'object') return { v: 2.1, sets: [] };
  const o = raw as { v?: unknown; activeId?: string; sets?: unknown[] };
  const sets = Array.isArray(o.sets) ? o.sets.map((s) => migrateSet(s)) : [];
  return {
    v: 2.1,
    ...(typeof o.activeId === 'string' ? { activeId: o.activeId } : {}),
    sets,
  };
}

/** Bridge: v2.1 set → shape still used by current UI (items + ISO dates). */
export type BridgedWorshipSet = {
  v: 2.1;
  id: string;
  title: string;
  date: string;
  time?: string;
  service: string;
  leader?: string;
  preacher?: string;
  notes?: string;
  rows: SetRow[];
  /** @deprecated prefer rows — kept for existing islands during 4d migration */
  items: ReturnType<typeof rowsToLegacyItems>;
  createdAt: string;
  updatedAt: string;
  source?: 'mine' | 'shared';
  sharedFrom?: string;
};

export function bridgeSet(set: WorshipSetV21): BridgedWorshipSet {
  return {
    v: 2.1,
    id: set.id,
    title: set.title,
    date: set.date,
    ...(set.time ? { time: set.time } : {}),
    service: set.service,
    ...(set.leader ? { leader: set.leader } : {}),
    ...(set.preacher ? { preacher: set.preacher } : {}),
    ...(set.notes ? { notes: set.notes } : {}),
    rows: set.rows,
    items: rowsToLegacyItems(set.rows),
    createdAt: new Date(set.createdAt ?? set.updatedAt).toISOString(),
    updatedAt: new Date(set.updatedAt).toISOString(),
    ...(set.source ? { source: set.source } : {}),
    ...(set.sharedFrom ? { sharedFrom: set.sharedFrom } : {}),
  };
}
