import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { buildIndexes, type IndexOutput } from '../../scripts/build-indexes';
import { readContent } from '../../scripts/validate';
import {
  loadIndexJson,
  lookupNumber,
  numberVariants,
  parseBookNumber,
  runQuery,
  type NumbersMap,
} from '../../src/lib/search';

let out: IndexOutput;
const search = (q: string) =>
  runQuery(q, Object.values(out.shards).map(loadIndexJson), out.meta, out.numbers).map((h) => h.id);

beforeAll(() => {
  out = buildIndexes({ ...readContent(join(process.cwd(), 'src', 'content')), includeDemo: true });
});

describe('F1 number lookup', () => {
  it('finds DT 117 case-insensitively', () => {
    expect(lookupNumber(out.numbers, 'DT', '117')).toBe('ta-yesuve-en-thunai');
    expect(lookupNumber(out.numbers, 'dt', '117')).toBe('ta-yesuve-en-thunai');
    expect(lookupNumber(out.numbers, 'dte', '45')).toBe('te-yesayya-neeve-naa-aadhaaram');
  });

  it('returns undefined for a wrong number or book', () => {
    expect(lookupNumber(out.numbers, 'DT', '999')).toBeUndefined();
    expect(lookupNumber(out.numbers, 'ZZ', '1')).toBeUndefined();
  });

  it('lists alnum variants', () => {
    const map: NumbersMap = { XB: { '117': 'a', '117a': 'b', '1170': 'c', '11': 'd' } };
    expect(numberVariants(map, 'xb', '117')).toEqual(['117', '117a']);
  });

  it('parses book + number queries', () => {
    expect(parseBookNumber('dt117')).toEqual({ book: 'dt', number: '117' });
    expect(parseBookNumber('DT 117')).toEqual({ book: 'DT', number: '117' });
    expect(parseBookNumber('EH 1a')).toEqual({ book: 'EH', number: '1a' });
    expect(parseBookNumber('yeshu')).toBeNull();
  });
});

describe('F2 word search acceptance', () => {
  it.each(['yeshu', 'yesu', 'yisu'])('%s finds the Hindi and Punjabi demo songs', (q) => {
    const ids = search(q);
    expect(ids).toContain('hi-yeshu-mera-sahara');
    expect(ids).toContain('pa-yisu-mera-sahara');
  });

  it.each(['thunai', 'tunai'])('%s finds DT 117', (q) => {
    expect(search(q)[0]).toBe('ta-yesuve-en-thunai');
  });

  it('వెలుగు finds DTe 45', () => {
    expect(search('వెలుగు')).toContain('te-yesayya-neeve-naa-aadhaaram');
  });

  it('grace finds EH 1', () => {
    expect(search('grace')[0]).toBe('en-amazing-grace');
  });

  it('pins a direct number hit first ("dt117", "DT 117")', () => {
    expect(search('dt117')[0]).toBe('ta-yesuve-en-thunai');
    expect(search('DT 117')[0]).toBe('ta-yesuve-en-thunai');
  });

  it('returns nothing for empty or nonsense queries', () => {
    expect(search('   ')).toEqual([]);
    expect(search('zzqqxx')).toEqual([]);
  });
});

describe('generated files', () => {
  it('meta rows carry title, roman, lang and badge', () => {
    expect(out.meta['ta-yesuve-en-thunai']).toEqual(['இயேசுவே என் துணை', 'Yesuve En Thunai', 'ta', 'DT 117']);
  });

  it('book manifests list book page, song pages and number permalinks', () => {
    const dt = out.manifests.DT!;
    expect(dt.urls).toEqual(['/books/dt/', '/song/ta-yesuve-en-thunai/', '/b/dt/117/']);
    expect(dt.searchIndex).toBe('/search/idx-ta.json');
    expect(dt.version).toMatch(/^[0-9a-f]{12}$/);
    expect(dt.bytes).toBeGreaterThan(0);
  });

  it('excludes non-publishable songs when demo is off', () => {
    const prod = buildIndexes({ ...readContent(join(process.cwd(), 'src', 'content')), includeDemo: false });
    expect(Object.keys(prod.meta)).not.toContain('ta-yesuve-en-thunai');
    expect(lookupNumber(prod.numbers, 'DT', '117')).toBeUndefined();
    expect(prod.manifests.DT).toBeUndefined();
  });
});
