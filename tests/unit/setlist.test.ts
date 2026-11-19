import { describe, expect, it } from 'vitest';
import { decodeSet, encodeSet, moveItem, newDraft, nextSunday, type SetList } from '../../src/lib/setlist';

const b64url = (obj: unknown) =>
  Buffer.from(JSON.stringify(obj), 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

describe('encodeSet / decodeSet', () => {
  const set: SetList = {
    v: 1,
    t: 'ஞாயிறு ஆராதனை · रविवार',
    d: '2026-11-22',
    s: [
      { id: 'ta-yesuve-en-thunai', book: 'DT', note: 'key of G' },
      { id: 'hi-yeshu-mera-sahara' },
      { id: 'en-amazing-grace', note: 'verse 1 & 3 only' },
    ],
  };

  it('round-trips, including Indic titles', () => {
    const code = encodeSet(set);
    expect(code).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeSet(code)).toEqual(set);
  });

  it('returns null for tampered or junk codes', () => {
    const code = encodeSet(set);
    expect(decodeSet(code.slice(0, -5) + '!!!!!')).toBeNull();
    expect(decodeSet('')).toBeNull();
    expect(decodeSet('bm90IGpzb24')).toBeNull(); // "not json"
    expect(decodeSet(b64url({ v: 2, t: 'x', s: [] }))).toBeNull();
    expect(decodeSet(b64url({ v: 1, t: 5, s: [] }))).toBeNull();
    expect(decodeSet(b64url([1, 2]))).toBeNull();
  });

  it('truncates to 30 songs and an 80-character title', () => {
    const many = {
      v: 1,
      t: 'x'.repeat(500),
      s: Array.from({ length: 45 }, (_, i) => ({ id: `en-song-${i}` })),
    };
    const out = decodeSet(b64url(many))!;
    expect(out.s).toHaveLength(30);
    expect(out.t).toHaveLength(80);
  });

  it('cuts a 5,000-character note to 200 and drops non-text notes and bad books', () => {
    const out = decodeSet(
      b64url({
        v: 1,
        t: 'x',
        s: [
          { id: 'en-a', note: 'n'.repeat(5000), book: 'EH' },
          { id: 'en-b', note: { evil: true }, book: '<script>' },
          { id: 'en-c', note: 42, book: 'TOOLONGBOOK' },
        ],
      }),
    )!;
    expect(out.s[0]).toEqual({ id: 'en-a', note: 'n'.repeat(200), book: 'EH' });
    expect(out.s[1]).toEqual({ id: 'en-b' });
    expect(out.s[2]).toEqual({ id: 'en-c' });
  });

  it('drops items with invalid ids and extra fields', () => {
    const out = decodeSet(
      b64url({
        v: 1,
        t: 'x',
        d: 'not-a-date',
        s: [{ id: 'xx-bad' }, { id: '../../etc' }, { id: 'ta-ok', extra: 1 }, null],
      }),
    )!;
    expect(out.s).toEqual([{ id: 'ta-ok' }]);
    expect(out.d).toBeUndefined();
  });
});

describe('helpers', () => {
  it('nextSunday is today on a Sunday and the coming Sunday otherwise', () => {
    expect(nextSunday(new Date(2026, 10, 22))).toBe('2026-11-22'); // Sunday
    expect(nextSunday(new Date(2026, 10, 19))).toBe('2026-11-22'); // Thursday
    expect(nextSunday(new Date(2026, 10, 23))).toBe('2026-11-29'); // Monday
  });

  it('newDraft titles the set with the date', () => {
    const d = newDraft(new Date(2026, 10, 19));
    expect(d.t).toMatch(/^Sunday, 22 Nov 2026$/);
    expect(d.s).toEqual([]);
  });

  it('moveItem reorders and ignores out-of-range moves', () => {
    expect(moveItem(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a']);
    expect(moveItem(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b']);
    expect(moveItem(['a', 'b'], 0, 5)).toEqual(['a', 'b']);
  });
});
