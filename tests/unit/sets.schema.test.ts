import { describe, expect, it } from 'vitest';
import {
  bridgeSet,
  migrateSet,
  migrateStore,
  rowsToLegacyItems,
} from '../../src/lib/sets/schema';
import { isParseAddHit, parseAdd } from '../../src/lib/sets/parseAdd';

describe('migrateSet → v2.1', () => {
  it('migrates v1 draft shape (fixture A)', () => {
    const set = migrateSet({
      v: 1,
      t: 'Draft Sunday',
      d: '2026-11-22',
      s: [{ id: 'hi-aadi-aur-ant-tu-hi-hai', book: 'TLBC' }],
    });
    expect(set.v).toBe(2.1);
    expect(set.date).toBe('2026-11-22');
    expect(set.rows).toHaveLength(1);
    expect(set.rows[0]).toMatchObject({ k: 's', song: 'hi-aadi-aur-ant-tu-hi-hai', book: 'TLBC' });
  });

  it('migrates v2 items preserving heading/song order (fixture B)', () => {
    const set = migrateSet({
      v: 2,
      id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      title: 'Sunday Morning · 22 Nov',
      date: '2026-11-22',
      time: '10:00',
      service: 'sunday_morning',
      leader: 'Asha',
      items: [
        { kind: 'heading', uid: 'h1', text: 'Opening' },
        { kind: 'song', uid: 's1', songId: 'hi-song-a', book: 'TLBC', key: 'G', verses: [0, 1] },
        { kind: 'heading', uid: 'h2', text: 'Closing' },
        { kind: 'song', uid: 's2', songId: 'hi-song-b', book: 'TLBC', note: 'slow' },
      ],
      createdAt: '2026-11-01T00:00:00.000Z',
      updatedAt: '2026-11-20T00:00:00.000Z',
    });
    expect(set.v).toBe(2.1);
    expect(set.rows.map((r) => r.k)).toEqual(['h', 's', 'h', 's']);
    expect(set.rows[0]).toMatchObject({ k: 'h', label: 'Opening', id: 'h1' });
    expect(set.rows[1]).toMatchObject({ k: 's', song: 'hi-song-a', key: 'G' });
    expect(set.rows[1]?.k === 's' && set.rows[1].seq).toEqual(['v1', 'c', 'v2', 'c']);
    expect(set.rows[3]).toMatchObject({ k: 's', note: 'slow' });
    expect(set.leader).toBe('Asha');
  });

  it('preserves v2.1 item rows and coerces store (fixture C)', () => {
    const store = migrateStore({
      v: 2,
      activeId: 'set-1',
      sets: [
        {
          v: 2.1,
          id: 'set-1',
          title: 'Evening',
          date: '2026-11-29',
          service: 'sunday_evening',
          rows: [
            { k: 'h', id: 'h1', label: 'Praise' },
            {
              k: 'i',
              id: 'i1',
              type: 'sermon',
              title: 'Sermon',
              ref: 'Luke 2:8–14',
              minutes: 20,
            },
            { k: 's', id: 's1', song: 'hi-x', book: 'XMAS', no: 3 },
          ],
          updatedAt: 1_700_000_000_000,
        },
      ],
    });
    expect(store.v).toBe(2.1);
    expect(store.activeId).toBe('set-1');
    expect(store.sets[0]?.rows.map((r) => r.k)).toEqual(['h', 'i', 's']);
    const bridged = bridgeSet(store.sets[0]!);
    expect(bridged.items).toHaveLength(2); // item row skipped in legacy bridge
    expect(rowsToLegacyItems(store.sets[0]!.rows).map((x) => x.kind)).toEqual(['heading', 'song']);
  });
});

describe('parseAdd (C18)', () => {
  it('parses comma lists with default book', () => {
    const toks = parseAdd('12, 46, 103', 'TLBC');
    expect(toks.filter(isParseAddHit)).toEqual([
      { book: 'TLBC', no: 12, raw: '12' },
      { book: 'TLBC', no: 46, raw: '46' },
      { book: 'TLBC', no: 103, raw: '103' },
    ]);
  });

  it('parses book prefixes and newlines', () => {
    const toks = parseAdd('TLBC 12, SS 5\nXMAS7', 'TLBC');
    expect(toks.filter(isParseAddHit)).toEqual([
      { book: 'TLBC', no: 12, raw: 'TLBC12' },
      { book: 'SS', no: 5, raw: 'SS5' },
      { book: 'XMAS', no: 7, raw: 'XMAS7' },
    ]);
  });

  it('flags bad tokens', () => {
    const toks = parseAdd('12, nope, 3', 'TLBC');
    expect(toks[1]).toEqual({ raw: 'nope', error: 'format' });
  });
});
