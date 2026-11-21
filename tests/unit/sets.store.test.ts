/**
 * @vitest-environment happy-dom
 */
import { beforeEach, describe, expect, it } from 'vitest';
import {
  addHeading,
  addSongToSet,
  createSet,
  decodeWorshipSet,
  deleteSet,
  encodeWorshipSet,
  getActiveSet,
  getSet,
  hydrateSets,
  insertIndexForSection,
  migrateFromV1,
  moveItemInSet,
  nextChristmas,
  nextEaster,
  SETS_KEY,
  setActive,
  templateHeadings,
  undoDeleteSet,
  updateSet,
} from '../../src/lib/sets';

beforeEach(() => {
  localStorage.clear();
  hydrateSets();
});

describe('sets v2 store', () => {
  it('creates a set and makes it active', () => {
    const s = createSet({ service: 'sunday_morning', date: '2026-12-06' });
    expect(s.v).toBe(2.1);
    expect(getActiveSet()?.id).toBe(s.id);
    expect(getSet(s.id)?.title).toContain('Sunday Morning');
  });

  it('inserts multi-add songs into the target section (C18/C19)', () => {
    const s = createSet({
      date: '2026-11-22',
      items: templateHeadings('sunday_morning'),
    });
    const praise = getSet(s.id)!.items.find((x) => x.kind === 'heading' && x.text === 'Praise')!;
    const closing = getSet(s.id)!.items.find((x) => x.kind === 'heading' && x.text === 'Closing')!;
    expect(insertIndexForSection(getSet(s.id)!.items, praise.uid)).toBeGreaterThan(
      getSet(s.id)!.items.findIndex((x) => x.uid === praise.uid),
    );
    addSongToSet(s.id, { songId: 'hi-a', book: 'TLBC' }, { afterHeadingUid: praise.uid });
    addSongToSet(s.id, { songId: 'hi-b', book: 'TLBC' }, { afterHeadingUid: praise.uid });
    addSongToSet(s.id, { songId: 'hi-c', book: 'TLBC' }, { afterHeadingUid: closing.uid });
    const items = getSet(s.id)!.items;
    const praiseIdx = items.findIndex((x) => x.uid === praise.uid);
    const sermonIdx = items.findIndex((x) => x.kind === 'heading' && x.text === 'Sermon');
    const inPraise = items.slice(praiseIdx + 1, sermonIdx).filter((x) => x.kind === 'song');
    expect(inPraise.map((x) => (x.kind === 'song' ? x.songId : ''))).toEqual(['hi-a', 'hi-b']);
    expect(items.filter((x) => x.kind === 'song' && x.songId === 'hi-c').length).toBe(1);
  });

  it('adds songs, headings, reorders, updates key/note/verses', () => {
    const s = createSet({ date: '2026-12-06' });
    expect(addSongToSet(s.id, { songId: 'hi-aadi-aur-ant-tu-hi-hai', book: 'TLBC' })).toBe(true);
    expect(addSongToSet(s.id, { songId: 'hi-aaradhna-ho-aaradhna', book: 'TLBC' })).toBe(true);
    addHeading(s.id, 'Offering');
    let cur = getSet(s.id)!;
    expect(cur.items).toHaveLength(3);
    moveItemInSet(s.id, 2, 0);
    cur = getSet(s.id)!;
    expect(cur.items[0]?.kind).toBe('heading');
    const songUid = cur.items.find((x) => x.kind === 'song')!.uid;
    updateSet(s.id, {
      items: cur.items.map((it) =>
        it.uid === songUid && it.kind === 'song'
          ? { ...it, key: 'G', verses: [0, 2], note: 'slow' }
          : it,
      ),
    });
    const song = getSet(s.id)!.items.find((x) => x.uid === songUid);
    expect(song).toMatchObject({ kind: 'song', key: 'G', verses: [0, 2], note: 'slow' });
  });

  it('delete + undo and setActive', () => {
    const a = createSet({ title: 'A', date: '2026-12-06' });
    const b = createSet({ title: 'B', date: '2026-12-13' });
    setActive(a.id);
    deleteSet(b.id);
    expect(getSet(b.id)).toBeUndefined();
    undoDeleteSet();
    expect(getSet(b.id)?.title).toBe('B');
  });

  it('migrates v1 draft + saved sets', () => {
    localStorage.clear();
    localStorage.setItem(
      'stuti:draftSet',
      JSON.stringify({
        v: 1,
        t: 'Draft Sunday',
        d: '2026-11-22',
        s: [{ id: 'hi-aadi-aur-ant-tu-hi-hai', book: 'TLBC' }],
      }),
    );
    localStorage.setItem(
      'stuti:sets',
      JSON.stringify({
        v: 1,
        items: [
          {
            v: 1,
            t: 'Saved',
            d: '2026-11-15',
            s: [{ id: 'hi-aaradhna-ho-aaradhna' }],
            code: 'x',
            savedAt: '2026-11-01T00:00:00.000Z',
          },
        ],
      }),
    );
    localStorage.removeItem(SETS_KEY);
    const store = migrateFromV1();
    expect(store.sets.length).toBeGreaterThanOrEqual(1);
    expect(store.sets.some((s) => s.items.some((i) => i.kind === 'song'))).toBe(true);
  });

  it('share encode/decode round-trips headings and keys', () => {
    const s = createSet({ date: '2026-12-25', service: 'christmas', title: 'Christmas' });
    addHeading(s.id, 'Carols');
    addSongToSet(s.id, { songId: 'hi-aadi-aur-ant-tu-hi-hai', book: 'TLBC' });
    updateSet(s.id, {
      items: getSet(s.id)!.items.map((it) =>
        it.kind === 'song' ? { ...it, key: 'D', verses: [0, 1] } : it,
      ),
    });
    const code = encodeWorshipSet(getSet(s.id)!);
    const decoded = decodeWorshipSet(code);
    expect(decoded?.title).toBe('Christmas');
    expect(decoded?.items.some((i) => i.kind === 'heading' && i.text === 'Carols')).toBe(true);
    const song = decoded?.items.find((i) => i.kind === 'song');
    expect(song).toMatchObject({ kind: 'song', songId: 'hi-aadi-aur-ant-tu-hi-hai', key: 'D' });
  });

  it('v1 share codes still decode', async () => {
    const { encodeSet } = await import('../../src/lib/setlist');
    const code = encodeSet({
      v: 1,
      t: 'Old',
      d: '2026-11-22',
      s: [{ id: 'hi-aadi-aur-ant-tu-hi-hai' }],
    });
    const decoded = decodeWorshipSet(code);
    expect(decoded?.items[0]).toMatchObject({ kind: 'song', songId: 'hi-aadi-aur-ant-tu-hi-hai' });
  });

  it('computes Christmas and Easter defaults', () => {
    expect(nextChristmas(new Date(2026, 10, 20))).toBe('2026-12-25');
    expect(nextEaster(new Date(2026, 0, 1))).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
