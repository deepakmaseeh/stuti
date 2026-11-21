/**
 * Import CCF Hindi → TLBC (merge/enrich) + English Sunday School book + Christmas book.
 *
 *   npx tsx scripts/import-md-books.ts
 *   npx tsx scripts/import-md-books.ts --dry-run
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
  isChristmasTitle,
  lineCount,
  normalizeForMatch,
  parseCcfMarkdown,
  parseSundaySchoolMarkdown,
  slugifyTitle,
  type SectionOut,
} from '../src/lib/md-song-import';

const ROOT = process.cwd();
const DRY = process.argv.includes('--dry-run');
/** Keep on/before validate fixture "today" used in unit tests (not wall-clock future). */
const TODAY = '2026-11-19';

type SongFile = {
  path: string;
  rel: string;
  data: Record<string, unknown>;
};

function loadSongs(lang: string): SongFile[] {
  const dir = join(ROOT, 'src/content/songs', lang);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      const path = join(dir, f);
      return {
        path,
        rel: `${lang}/${f}`,
        data: JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>,
      };
    });
}

function writeJson(path: string, data: unknown) {
  if (DRY) return;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function tlbcNumber(data: Record<string, unknown>): number | null {
  const nums = (data.numbers as { book: string; number: string }[]) || [];
  for (const n of nums) {
    if (n.book === 'TLBC') {
      const v = Number.parseInt(n.number, 10);
      if (!Number.isNaN(v)) return v;
    }
  }
  return null;
}

function ensureTag(tags: string[], ...add: string[]) {
  const set = new Set(tags);
  for (const t of add) set.add(t);
  return [...set];
}

function findMatch(
  title: string,
  songs: SongFile[],
): SongFile | undefined {
  const key = normalizeForMatch(title);
  if (key.length < 6) return undefined;
  let best: SongFile | undefined;
  let bestScore = 0;
  for (const s of songs) {
    const t = (s.data.title as { native?: string })?.native || '';
    const slug = String(s.data.slug || '');
    const nk = normalizeForMatch(t);
    if (!nk) continue;
    let score = 0;
    if (nk === key) score = 1;
    else if (nk.startsWith(key.slice(0, 16)) || key.startsWith(nk.slice(0, 16))) score = 0.85;
    else if (nk.includes(key.slice(0, 12)) || key.includes(nk.slice(0, 12))) score = 0.7;
    else if (slug && slugifyTitle(title).startsWith(slug.slice(0, 12))) score = 0.65;
    if (score > bestScore) {
      bestScore = score;
      best = s;
    }
  }
  return bestScore >= 0.65 ? best : undefined;
}

function songPayload(opts: {
  slug: string;
  book: string;
  number: string;
  titleNative: string;
  titleEn?: string;
  sections: SectionOut[];
  tags: string[];
  sourceScan: string;
  extraNumbers?: { book: string; number: string }[];
}) {
  const numbers = [{ book: opts.book, number: opts.number }, ...(opts.extraNumbers || [])];
  return {
    slug: opts.slug,
    numbers,
    title: {
      native: opts.titleNative,
      roman: '',
      en: opts.titleEn || '',
    },
    aliases: [],
    sections: opts.sections,
    display: { chorusAfterEachVerse: false },
    author: { name: 'Unknown', born: null, died: null },
    composer: null,
    tune: null,
    year: null,
    bibleRefs: [],
    tags: opts.tags,
    rights: {
      status: 'licensed',
      basis: 'Church licensed collection for Stuti',
      evidence: opts.sourceScan,
      holder: '',
      checkedBy: 'import-md-books',
      checkedOn: TODAY,
    },
    layers: { roman: 'missing', en: 'missing' },
    source: { scan: opts.sourceScan, page: null },
    chords: null,
    media: { youtube: null },
    updated: TODAY,
    publish: true,
  };
}

function uniqueSlug(base: string, used: Set<string>): string {
  let slug = base || 'song';
  if (!slug || slug.length < 2) slug = `song-${used.size + 1}`;
  let candidate = slug.slice(0, 80);
  let i = 2;
  while (used.has(candidate)) {
    const suffix = `-${i++}`;
    candidate = `${slug.slice(0, 80 - suffix.length)}${suffix}`;
  }
  used.add(candidate);
  return candidate;
}

function main() {
  const ccfPath = join(ROOT, 'ccf-hindi-song-book.md');
  const ssPath = join(ROOT, '147343845-sunday-school-song-lyrics.md');
  const ccfMd = readFileSync(ccfPath, 'utf8');
  const ssMd = readFileSync(ssPath, 'utf8');

  const hiSongs = loadSongs('hi');
  const enSongs = loadSongs('en');
  const usedHiSlugs = new Set(hiSongs.map((s) => String(s.data.slug || s.rel.replace(/^hi\/|\.json$/g, ''))));
  const usedEnSlugs = new Set(enSongs.map((s) => String(s.data.slug || s.rel.replace(/^en\/|\.json$/g, ''))));

  let maxTlbc = 0;
  for (const s of hiSongs) {
    const n = tlbcNumber(s.data);
    if (n && n > maxTlbc) maxTlbc = n;
  }

  const stats = {
    ccfMatched: 0,
    ccfEnriched: 0,
    ccfNew: 0,
    ccfSkipped: 0,
    ssNew: 0,
    ssSkipped: 0,
    xmasTagged: 0,
  };

  // --- CCF → TLBC ---
  const ccfSongs = parseCcfMarkdown(ccfMd);
  for (const song of ccfSongs) {
    const catTag =
      song.category === 'आराधना' ? 'worship' : song.category === 'समर्पण' ? 'dedication' : 'praise';
    const match = findMatch(song.title, hiSongs);
    if (match) {
      stats.ccfMatched += 1;
      const data = match.data;
      const existingSections = (data.sections as SectionOut[]) || [];
      const tags = ensureTag((data.tags as string[]) || [], 'tlbc', 'bhajan', catTag, `ccf-${song.number}`);
      let changed = false;
      if (JSON.stringify(tags) !== JSON.stringify(data.tags)) {
        data.tags = tags;
        changed = true;
      }
      if (lineCount(song.sections) > lineCount(existingSections) + 2) {
        data.sections = song.sections;
        stats.ccfEnriched += 1;
        changed = true;
      }
      if (isChristmasTitle(song.title, String(data.slug || ''))) {
        data.tags = ensureTag(tags, 'christmas');
        changed = true;
      }
      const src = (data.source as { scan?: string }) || {};
      if (!src.scan?.includes('ccf-hindi-song-book')) {
        data.source = { ...src, scan: `ccf-hindi-song-book.md#${song.number}` };
        changed = true;
      }
      data.updated = TODAY;
      if (changed) writeJson(match.path, data);
      continue;
    }

    maxTlbc += 1;
    const slug = uniqueSlug(slugifyTitle(song.title) || `tlbc-${maxTlbc}`, usedHiSlugs);
    const tags = ['tlbc', 'bhajan', catTag, `ccf-${song.number}`];
    if (isChristmasTitle(song.title, slug)) tags.push('christmas');
    const payload = songPayload({
      slug,
      book: 'TLBC',
      number: String(maxTlbc),
      titleNative: song.title,
      sections: song.sections,
      tags,
      sourceScan: `ccf-hindi-song-book.md#${song.number}`,
    });
    const path = join(ROOT, 'src/content/songs/hi', `${slug}.json`);
    writeJson(path, payload);
    hiSongs.push({ path, rel: `hi/${slug}.json`, data: payload });
    stats.ccfNew += 1;
  }

  // --- Sunday School book ---
  const ssBook = {
    id: 'SS',
    name: { native: 'Sunday School', en: 'Sunday School Songs' },
    lang: 'en',
    edition: '',
    publisher: 'Jehovah Jireh Prayer House',
    description: 'English Sunday-school songs (regional lyrics omitted).',
    order: 3,
    numbering: 'numeric',
    status: 'active',
  };
  writeJson(join(ROOT, 'src/content/books/SS.json'), ssBook);

  const ssSongs = parseSundaySchoolMarkdown(ssMd);
  const usedSsNumbers = new Set<string>();
  for (const song of ssSongs) {
    let num = song.number;
    if (usedSsNumbers.has(num)) num = `${num}a`;
    usedSsNumbers.add(num);
    const slug = uniqueSlug(slugifyTitle(song.title) || `ss-${num}`, usedEnSlugs);
    const match = findMatch(song.title, enSongs);
    if (match) {
      const data = match.data;
      const numbers = (data.numbers as { book: string; number: string }[]) || [];
      if (!numbers.some((n) => n.book === 'SS')) {
        numbers.push({ book: 'SS', number: num });
        data.numbers = numbers;
      }
      data.tags = ensureTag((data.tags as string[]) || [], 'sunday-school', 'children');
      if (lineCount(song.sections) > lineCount((data.sections as SectionOut[]) || []) + 2) {
        data.sections = song.sections;
      }
      data.updated = TODAY;
      writeJson(match.path, data);
      stats.ssNew += 1;
      continue;
    }
    const payload = songPayload({
      slug,
      book: 'SS',
      number: num,
      titleNative: song.title,
      titleEn: song.title,
      sections: song.sections,
      tags: ['sunday-school', 'children'],
      sourceScan: `147343845-sunday-school-song-lyrics.md#${song.number}`,
    });
    const path = join(ROOT, 'src/content/songs/en', `${slug}.json`);
    writeJson(path, payload);
    enSongs.push({ path, rel: `en/${slug}.json`, data: payload });
    stats.ssNew += 1;
  }
  stats.ssSkipped = 168 - ssSongs.length;

  // --- Christmas book XMAS ---
  const xmasBook = {
    id: 'XMAS',
    name: { native: 'क्रिसमस गीत', en: 'Christmas Songs' },
    lang: 'hi',
    edition: '',
    publisher: 'The Lucknow Baptist Church',
    description: 'Christmas and nativity songs from the TLBC collection.',
    order: 4,
    numbering: 'numeric',
    status: 'active',
  };
  writeJson(join(ROOT, 'src/content/books/XMAS.json'), xmasBook);

  // Reload hi songs after CCF writes
  const hiAfter = DRY ? hiSongs : loadSongs('hi');
  let xmasN = 0;
  for (const s of hiAfter) {
    const title = (s.data.title as { native?: string })?.native || '';
    const slug = String(s.data.slug || '');
    const tags = (s.data.tags as string[]) || [];
    if (!isChristmasTitle(title, slug) && !tags.includes('christmas')) continue;
    xmasN += 1;
    const numbers = (s.data.numbers as { book: string; number: string }[]) || [];
    if (!numbers.some((n) => n.book === 'XMAS')) {
      numbers.push({ book: 'XMAS', number: String(xmasN) });
      s.data.numbers = numbers;
    }
    s.data.tags = ensureTag(tags, 'christmas', 'tlbc');
    s.data.updated = TODAY;
    writeJson(s.path, s.data);
    stats.xmasTagged += 1;
  }

  console.log(JSON.stringify({ dry: DRY, maxTlbc, ...stats, ccfParsed: ccfSongs.length, ssParsed: ssSongs.length }, null, 2));
}

main();
