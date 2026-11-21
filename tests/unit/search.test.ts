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
  out = buildIndexes({ ...readContent(join(process.cwd(), 'src', 'content')), includeDemo: false });
});

describe('F1 number lookup', () => {
  it('finds TLBC 1 case-insensitively', () => {
    expect(lookupNumber(out.numbers, 'TLBC', '1')).toBe('hi-aadi-aur-ant-tu-hi-hai');
    expect(lookupNumber(out.numbers, 'tlbc', '1')).toBe('hi-aadi-aur-ant-tu-hi-hai');
    expect(lookupNumber(out.numbers, 'TLBE', '1')).toBe('en-amazing-grace');
  });

  it('returns undefined for a wrong number or book', () => {
    expect(lookupNumber(out.numbers, 'TLBC', '9999')).toBeUndefined();
    expect(lookupNumber(out.numbers, 'ZZ', '1')).toBeUndefined();
  });

  it('lists alnum variants', () => {
    const map: NumbersMap = { XB: { '117': 'a', '117a': 'b', '1170': 'c', '11': 'd' } };
    expect(numberVariants(map, 'xb', '117')).toEqual(['117', '117a']);
  });

  it('parses book + number queries', () => {
    expect(parseBookNumber('tlbc1')).toEqual({ book: 'tlbc', number: '1' });
    expect(parseBookNumber('TLBC 1')).toEqual({ book: 'TLBC', number: '1' });
    expect(parseBookNumber('TLBE 1a')).toEqual({ book: 'TLBE', number: '1a' });
    expect(parseBookNumber('yeshu')).toBeNull();
  });
});

describe('F2 word search acceptance', () => {
  it('यीशु finds Hindi Yeshu songs', () => {
    const ids = search('यीशु');
    expect(ids.some((id) => id.startsWith('hi-'))).toBe(true);
  });

  it('हिरणी finds TLBC 92', () => {
    expect(search('हिरणी')).toContain('hi-jaise-hirni-jal-ki-pyasi');
  });

  it('grace finds Amazing Grace', () => {
    expect(search('grace')).toContain('en-amazing-grace');
    expect(search('amazing grace')[0]).toBe('en-amazing-grace');
  });

  it('pins a direct number hit first ("tlbc1", "TLBC 1")', () => {
    expect(search('tlbc1')[0]).toBe('hi-aadi-aur-ant-tu-hi-hai');
    expect(search('TLBC 1')[0]).toBe('hi-aadi-aur-ant-tu-hi-hai');
  });

  it('returns nothing for empty or nonsense queries', () => {
    expect(search('   ')).toEqual([]);
    expect(search('zzqqxx')).toEqual([]);
  });
});

describe('generated files', () => {
  it('meta rows carry title, roman, lang and badge', () => {
    expect(out.meta['hi-aadi-aur-ant-tu-hi-hai']?.slice(0, 4)).toEqual([
      'आदि और अन्त तू ही है अल्फा और ओमेगा तू ही है',
      '',
      'hi',
      'TLBC 1',
    ]);
    expect(out.meta['hi-aadi-aur-ant-tu-hi-hai']?.[4]).toBeTruthy();
    expect(Array.isArray(out.meta['hi-aadi-aur-ant-tu-hi-hai']?.[5])).toBe(true);
  });

  it('book manifests list book page, song pages and number permalinks', () => {
    const tlbc = out.manifests.TLBC!;
    expect(tlbc.urls).toContain('/books/tlbc/');
    expect(tlbc.urls).toContain('/data/books/TLBC.json');
    expect(tlbc.urls).toContain('/song/hi-aadi-aur-ant-tu-hi-hai/');
    expect(tlbc.urls).toContain('/b/tlbc/1/');
    expect(out.bookBundles.TLBC).toContain('hi-aadi-aur-ant-tu-hi-hai');
    expect(out.browse.hi).toBeTruthy();
    expect(tlbc.searchIndex).toBe('/search/idx-hi.json');
    expect(tlbc.version).toMatch(/^[0-9a-f]{12}$/);
    expect(tlbc.bytes).toBeGreaterThan(0);
  });

  it('keeps licensed TLBC songs when demo is off', () => {
    const prod = buildIndexes({ ...readContent(join(process.cwd(), 'src', 'content')), includeDemo: false });
    expect(Object.keys(prod.meta)).toContain('hi-aadi-aur-ant-tu-hi-hai');
    expect(lookupNumber(prod.numbers, 'TLBC', '1')).toBe('hi-aadi-aur-ant-tu-hi-hai');
    expect(prod.manifests.TLBC).toBeTruthy();
  });
});
