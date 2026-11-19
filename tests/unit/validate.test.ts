import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readContent, validateEntries, type FileEntry } from '../../scripts/validate';

const FIX = join(__dirname, '..', 'fixtures');
const TODAY = '2026-11-19';
const base = readContent(join(FIX, 'base'));
const bad = (name: string) => readFileSync(join(FIX, 'bad', `${name}.json`), 'utf8');

function run(opts: { songs?: FileEntry[]; books?: FileEntry[]; includeDemo?: boolean } = {}) {
  return validateEntries({
    books: [...base.books, ...(opts.books ?? [])],
    songs: [...base.songs, ...(opts.songs ?? [])],
    includeDemo: opts.includeDemo ?? false,
    today: TODAY,
  });
}

function rulesOf(result: ReturnType<typeof run>) {
  return result.errors.map((e) => e.rule);
}

describe('validate: base fixtures', () => {
  it('passes with no errors', () => {
    const r = run();
    expect(r.errors).toEqual([]);
    expect(r.summary.find((s) => s.book === 'TB')).toMatchObject({ songs: 1, published: 1 });
  });

  it('accepts a CMS-created file without id/lang', () => {
    const raw = readFileSync(join(FIX, 'cms-created-song.json'), 'utf8');
    const r = run({ songs: [{ relPath: 'ta/cms-created-song.json', raw }] });
    expect(r.errors).toEqual([]);
    expect(r.warnings.filter((w) => w.rule === 'w-slug')).toEqual([]);
  });

  it('accepts a new song exactly as Decap CMS 3.18 writes it (minimal form)', () => {
    const raw = readFileSync(join(FIX, 'cms-written-song.json'), 'utf8');
    const r = run({ songs: [{ relPath: 'ta/cms-written-song.json', raw }] });
    expect(r.errors).toEqual([]);
  });

  it('accepts a CMS save where optional fields were left empty ("" numbers)', () => {
    const raw = readFileSync(join(FIX, 'cms-empty-optionals.json'), 'utf8');
    const r = run({ songs: [{ relPath: 'ta/cms-empty-optionals.json', raw }] });
    expect(r.errors).toEqual([]);
  });

  it('warns when slug differs from the file name', () => {
    const raw = readFileSync(join(FIX, 'cms-created-song.json'), 'utf8');
    const r = run({ songs: [{ relPath: 'ta/renamed-file.json', raw }] });
    expect(r.errors).toEqual([]);
    expect(r.warnings.map((w) => w.rule)).toContain('w-slug');
  });
});

describe('validate: each rule fails with a clear message', () => {
  const cases: { name: string; path: string; rule: string; text: RegExp }[] = [
    { name: 'invalid-json', path: 'ta/invalid-json.json', rule: '1-schema', text: /Invalid JSON/ },
    { name: 'schema-missing-title', path: 'ta/missing-title.json', rule: '1-schema', text: /title/ },
    {
      name: 'schema-bad-section-type',
      path: 'ta/bad-section.json',
      rule: '1-schema',
      text: /sections\.0\.type/,
    },
    {
      name: 'numbers-unknown-book',
      path: 'ta/unknown-book.json',
      rule: '4-numbers',
      text: /Book "ZZ" does not exist/,
    },
    {
      name: 'numbers-duplicate',
      path: 'ta/duplicate-number.json',
      rule: '4-numbers',
      text: /TB 1 is already used/,
    },
    {
      name: 'numbers-wrong-lang-book',
      path: 'hi/wrong-lang.json',
      rule: '4-numbers',
      text: /Book TB is "ta"/,
    },
    {
      name: 'script-native-not-tamil',
      path: 'ta/latin-native.json',
      rule: '5-script',
      text: /"n" is not in the ta script/,
    },
    {
      name: 'script-roman-not-latin',
      path: 'ta/tamil-roman.json',
      rule: '5-script',
      text: /"r" must use Latin/,
    },
    { name: 'layers-missing-roman', path: 'ta/missing-roman.json', rule: '6-layers', text: /missing "r"/ },
    {
      name: 'rights-pending-published',
      path: 'ta/pending.json',
      rule: '7-rights',
      text: /permission_pending/,
    },
    {
      name: 'rights-demo-published',
      path: 'ta/demo.json',
      rule: '7-rights',
      text: /PUBLIC_INCLUDE_DEMO=true/,
    },
    { name: 'rights-pd-no-basis', path: 'ta/pd-no-basis.json', rule: '7-rights', text: /author\.died/ },
    {
      name: 'rights-licensed-no-evidence',
      path: 'ta/licensed.json',
      rule: '7-rights',
      text: /rights\.evidence/,
    },
    { name: 'updated-future', path: 'ta/future.json', rule: '8-updated', text: /in the future/ },
    { name: 'updated-invalid', path: 'ta/bad-date.json', rule: '8-updated', text: /not a valid date/ },
    { name: 'html-in-line', path: 'ta/html.json', rule: '9-html', text: /HTML is not allowed/ },
    { name: 'size-line-too-long', path: 'ta/long-line.json', rule: '10-size', text: /max 200/ },
  ];

  for (const c of cases) {
    it(`${c.name} → ${c.rule}`, () => {
      const r = run({ songs: [{ relPath: c.path, raw: bad(c.name) }] });
      const hit = r.errors.find((e) => e.rule === c.rule);
      expect(hit, JSON.stringify(r.errors)).toBeDefined();
      expect(hit!.message).toMatch(c.text);
    });
  }

  it('2-path: wrong folder', () => {
    const r = run({ songs: [{ relPath: 'xx/song.json', raw: bad('numbers-duplicate') }] });
    expect(r.errors[0]).toMatchObject({ rule: '2-path', message: expect.stringMatching(/not a language/) });
  });

  it('2-path: bad file name', () => {
    const r = run({ songs: [{ relPath: 'ta/Bad_Name.json', raw: bad('numbers-duplicate') }] });
    expect(r.errors[0]).toMatchObject({ rule: '2-path', message: expect.stringMatching(/lowercase/) });
  });

  it('2-path: nested folder', () => {
    const r = run({ songs: [{ relPath: 'ta/extra/song.json', raw: bad('numbers-duplicate') }] });
    expect(r.errors[0]).toMatchObject({
      rule: '2-path',
      message: expect.stringMatching(/songs\/<lang>\/<slug>\.json/),
    });
  });

  it('2-path: duplicate id', () => {
    const dup = base.songs.find((s) => s.relPath === 'ta/nalla-paadal.json')!;
    const r = run({ songs: [dup] });
    expect(rulesOf(r)).toContain('2-path');
    expect(r.errors.find((e) => e.rule === '2-path')!.message).toMatch(/Duplicate song id "ta-nalla-paadal"/);
  });

  it('3-book-id: ids that differ only by case clash', () => {
    const r = run({ books: [{ relPath: 'Tb.json', raw: bad('book-case-clash') }] });
    expect(r.errors.find((e) => e.rule === '3-book-id')!.message).toMatch(/unique ignoring case/);
  });

  it('1-schema: book file name must match its id', () => {
    const raw = readFileSync(join(FIX, 'base', 'books', 'EB.json'), 'utf8');
    const r = run({ books: [{ relPath: 'other.json', raw }] });
    expect(r.errors.some((e) => e.message.includes('"EB.json"'))).toBe(true);
  });

  it('10-size: more than 300 lines', () => {
    const song = JSON.parse(bad('numbers-duplicate'));
    song.numbers = [{ book: 'TB', number: '99' }];
    const line = song.sections[0].lines[0];
    song.sections[0].lines = Array.from({ length: 301 }, () => line);
    const r = run({ songs: [{ relPath: 'ta/huge.json', raw: JSON.stringify(song) }] });
    expect(r.errors.find((e) => e.rule === '10-size')!.message).toMatch(/301 lines/);
  });
});

describe('validate: PUBLIC_INCLUDE_DEMO (F9)', () => {
  it('demo song with publish:true fails without the variable and passes with it', () => {
    const songs = [{ relPath: 'ta/demo.json', raw: bad('rights-demo-published') }];
    expect(rulesOf(run({ songs, includeDemo: false }))).toContain('7-rights');
    expect(run({ songs, includeDemo: true }).errors).toEqual([]);
  });

  it('the real sample content passes only with demo mode on', () => {
    const real = readContent(join(__dirname, '..', '..', 'src', 'content'));
    expect(validateEntries({ ...real, includeDemo: true, today: TODAY }).errors).toEqual([]);
    const off = validateEntries({ ...real, includeDemo: false, today: TODAY });
    expect(off.errors.filter((e) => e.rule === '7-rights')).toHaveLength(4);
  });
});
