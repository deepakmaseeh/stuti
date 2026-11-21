/**
 * Add unmatched Song.zip Hindi songs into TLBC.
 * Titles come from the first Devanagari lyric line (Hinglish filenames → Hindi titles).
 *
 *   npx tsx scripts/import-zip-new-tlbc.ts
 *   npx tsx scripts/import-zip-new-tlbc.ts --dry-run
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { inflateRawSync } from 'node:zlib';
import {
  blocksToSections,
  isChristmasTitle,
  lineCount,
  normalizeForMatch,
  slugifyTitle,
  type SectionOut,
} from '../src/lib/md-song-import';

const ROOT = process.cwd();
const ZIP_DIR = join(ROOT, '_import/song-zip/Song');
const DRY = process.argv.includes('--dry-run');
const TODAY = '2026-11-19';

const CHORD_LINE =
  /^(?:[A-G](?:#|b)?(?:m|maj|min|dim|aug|sus|add)?[0-9]*(?:\/[A-G](?:#|b)?)?(?:\s+|$)){2,}|^[A-G](?:#|b)?(?:m|maj|min|dim|aug|sus)?\d*(?:\s+[A-G](?:#|b)?(?:m|maj|min|dim|aug|sus)?\d*)+\s*$/;

function extractDocxText(path: string): string {
  const buf = readFileSync(path);
  const name = 'word/document.xml';
  let i = 0;
  while (i < buf.length - 30) {
    if (buf[i] === 0x50 && buf[i + 1] === 0x4b && buf[i + 2] === 0x03 && buf[i + 3] === 0x04) {
      const method = buf.readUInt16LE(i + 8);
      const compSize = buf.readUInt32LE(i + 18);
      const nameLen = buf.readUInt16LE(i + 26);
      const extraLen = buf.readUInt16LE(i + 28);
      const fname = buf.subarray(i + 30, i + 30 + nameLen).toString('utf8');
      const dataStart = i + 30 + nameLen + extraLen;
      const data = buf.subarray(dataStart, dataStart + compSize);
      if (fname === name) {
        const xml =
          method === 0 ? data.toString('utf8') : inflateRawSync(data).toString('utf8');
        return xml
          .replace(/<\/w:p>/g, '\n')
          .replace(/<[^>]+>/g, '')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/\n{3,}/g, '\n\n')
          .trim();
      }
      i = dataStart + compSize;
      continue;
    }
    i += 1;
  }
  return '';
}

function stripChords(text: string): string {
  const out: string[] = [];
  for (const line of text.split(/\n/)) {
    const t = line.trim();
    if (!t) {
      out.push('');
      continue;
    }
    if (CHORD_LINE.test(t)) continue;
    if (/^\d{6,}$/.test(t)) continue;
    if (/^[A-G]\s*$/.test(t)) continue;
    if (/lucknow baptist|the lucknow|sheet\s*[A-G]|chords?/i.test(t) && t.length < 80) continue;
    const words = t.split(/\s+/);
    const chordish = words.filter((w) =>
      /^[A-G](#|b)?(m|maj|min|dim|aug|sus|add)?[0-9]*(\/[A-G](#|b)?)?$/.test(w),
    );
    if (words.length >= 2 && chordish.length / words.length >= 0.6) continue;
    out.push(t.replace(/\t+/g, ' ').replace(/ {2,}/g, ' '));
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** Keep only lines that are mainly Hindi (for TLBC). */
function hindiOnlyBody(text: string): string {
  const out: string[] = [];
  for (const line of text.split(/\n/)) {
    const t = line.trim();
    if (!t) {
      out.push('');
      continue;
    }
    const hi = [...t].filter((c) => c >= '\u0900' && c <= '\u097F').length;
    if (hi < 2) continue;
    out.push(t);
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function firstHindiTitle(text: string): string {
  for (const line of text.split(/\n/)) {
    let t = line.trim();
    if (!t) continue;
    t = t
      .replace(/^(कोरस|chorus|पद)\s*[:-]?\s*/i, '')
      .replace(/^\d+[\.\)]\s*/, '')
      .replace(/^[-–]?\d{4,}[-–]?\d*/, '') // Word XML junk like -914400-347981
      .replace(/^\(+/, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (/^(sheet|chords?|ग\s*$|G\s*$)/i.test(t)) continue;
    if (/क्रिसमस गीत\s*[A-G]?$/i.test(t) && t.length < 20) continue;
    const hi = [...t].filter((c) => c >= '\u0900' && c <= '\u097F').length;
    if (hi >= 6 && t.length >= 8 && t.length <= 120) return t.replace(/[…|]+$/g, '').trim();
  }
  return '';
}

function hinglishRoman(filename: string): string {
  return filename
    .replace(/\.docx?$/i, '')
    .replace(/\(.*?\)/g, '')
    .replace(/chords?|file|copy|autorecovered|with\s*chords?/gi, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function walkDocx(dir: string): string[] {
  const out: string[] = [];
  if (!existsSync(dir)) return out;
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, ent.name);
    if (ent.isDirectory()) out.push(...walkDocx(p));
    else if (ent.name.toLowerCase().endsWith('.docx')) out.push(p);
  }
  return out;
}

function tokenSet(s: string): Set<string> {
  return new Set(
    s
      .split(/[-\s]+/)
      .map((t) => t.toLowerCase())
      .filter((t) => t.length > 2 && !['hai', 'the', 'and', 'ke', 'ki', 'ko', 'mein', 'main'].includes(t)),
  );
}

type SongFile = { path: string; id: string; data: Record<string, unknown>; slug: string };

function loadHi(): SongFile[] {
  const dir = join(ROOT, 'src/content/songs/hi');
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      const path = join(dir, f);
      const data = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
      const slug = String(data.slug || f.replace(/\.json$/, ''));
      return { path, id: `hi-${slug}`, data, slug };
    });
}

function alreadyExists(titleHi: string, fileSlug: string, songs: SongFile[]): boolean {
  const key = normalizeForMatch(titleHi);
  const ftokens = tokenSet(fileSlug);
  for (const s of songs) {
    const native = (s.data.title as { native?: string })?.native || '';
    const nk = normalizeForMatch(native);
    if (key.length >= 8 && nk.length >= 8) {
      if (nk === key || nk.startsWith(key.slice(0, 16)) || key.startsWith(nk.slice(0, 16))) return true;
    }
    const stokens = tokenSet(s.slug);
    if (ftokens.size && stokens.size) {
      let inter = 0;
      for (const t of ftokens) if (stokens.has(t)) inter += 1;
      if (inter >= 2 && inter / Math.min(ftokens.size, stokens.size) >= 0.7) return true;
    }
  }
  return false;
}

function uniqueSlug(base: string, used: Set<string>): string {
  let slug = (base || 'song').slice(0, 80);
  if (slug.length < 2) slug = `song-${used.size + 1}`;
  let candidate = slug;
  let i = 2;
  while (used.has(candidate)) {
    const suffix = `-${i++}`;
    candidate = `${slug.slice(0, 80 - suffix.length)}${suffix}`;
  }
  used.add(candidate);
  return candidate;
}

function writeJson(path: string, data: unknown) {
  if (DRY) return;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function main() {
  const songs = loadHi();
  const usedSlugs = new Set(songs.map((s) => s.slug));
  let maxTlbc = 0;
  for (const s of songs) {
    for (const n of (s.data.numbers as { book: string; number: string }[]) || []) {
      if (n.book === 'TLBC') {
        const v = Number.parseInt(n.number, 10);
        if (!Number.isNaN(v) && v > maxTlbc) maxTlbc = v;
      }
    }
  }

  const files = walkDocx(ZIP_DIR);
  // Prefer longer/richer file per slug
  const bySlug = new Map<string, { path: string; text: string; title: string; sections: SectionOut[]; roman: string }>();

  let skippedNoHindi = 0;
  let skippedExists = 0;
  let skippedThin = 0;

  for (const file of files) {
    const base = file.split(/[/\\]/).pop() || '';
    if (/^sheet\s*[a-g]/i.test(base) || /^mashup/i.test(base)) {
      skippedThin += 1;
      continue;
    }
    const raw = extractDocxText(file);
    if (raw.length < 60) continue;
    const cleaned = hindiOnlyBody(stripChords(raw));
    const title = firstHindiTitle(cleaned);
    if (!title) {
      skippedNoHindi += 1;
      continue;
    }
    const sections = blocksToSections(cleaned);
    // Drop empty / non-hindi lines inside sections
    const hiSections: SectionOut[] = sections
      .map((sec) => ({
        ...sec,
        lines: sec.lines.filter((ln) => [...ln.n].some((c) => c >= '\u0900' && c <= '\u097F')),
      }))
      .filter((sec) => sec.lines.length > 0);
    if (!hiSections.length || lineCount(hiSections) < 4) {
      skippedThin += 1;
      continue;
    }
    const fileSlug = slugifyTitle(base.replace(/\.docx$/i, '')) || slugifyTitle(title);
    const titleKey = normalizeForMatch(title).slice(0, 24);
    if (alreadyExists(title, fileSlug, songs)) {
      skippedExists += 1;
      continue;
    }
    // Prefer richer copy; also dedupe by Hindi title key across different Hinglish filenames
    const dedupeKey = titleKey.length >= 10 ? `t:${titleKey}` : fileSlug;
    const prev = bySlug.get(dedupeKey) || bySlug.get(fileSlug);
    if (!prev || lineCount(hiSections) > lineCount(prev.sections)) {
      if (prev && dedupeKey !== fileSlug) bySlug.delete(fileSlug);
      bySlug.set(dedupeKey, {
        path: file,
        text: cleaned,
        title,
        sections: hiSections,
        roman: hinglishRoman(base),
      });
    }
  }

  const added: string[] = [];
  for (const [, item] of bySlug) {
    maxTlbc += 1;
    const baseName = item.path.split(/[/\\]/).pop()?.replace(/\.docx$/i, '') || '';
    const slug = uniqueSlug(slugifyTitle(item.title) || slugifyTitle(baseName) || `tlbc-${maxTlbc}`, usedSlugs);
    const tags = ['tlbc', 'bhajan', 'imported-zip'];
    if (isChristmasTitle(item.title, slug) || /christmas/i.test(item.path)) tags.push('christmas');

    const payload = {
      slug,
      numbers: [{ book: 'TLBC', number: String(maxTlbc) }],
      title: {
        native: item.title.slice(0, 120),
        roman: item.roman.slice(0, 120),
        en: '',
      },
      aliases: item.roman ? [item.roman] : [],
      sections: item.sections,
      display: { chorusAfterEachVerse: false },
      author: { name: 'Unknown', born: null, died: null },
      composer: null,
      tune: null,
      year: null,
      bibleRefs: [],
      tags,
      rights: {
        status: 'licensed',
        basis: 'Used by The Lucknow Baptist Church',
        evidence: 'Song.zip church lyric sheet',
        holder: 'The Lucknow Baptist Church',
        checkedBy: 'import-zip-new-tlbc',
        checkedOn: TODAY,
      },
      layers: { roman: 'missing', en: 'missing' },
      source: { scan: `song-zip:${item.path.split(/[/\\]/).pop()}`, page: null },
      chords: null,
      media: { youtube: null },
      updated: TODAY,
      publish: true,
    };

    const outPath = join(ROOT, 'src/content/songs/hi', `${slug}.json`);
    writeJson(outPath, payload);
    songs.push({ path: outPath, id: `hi-${slug}`, data: payload, slug });
    added.push(`${maxTlbc}. ${item.title.slice(0, 50)} ← ${item.path.split(/[/\\]/).pop()}`);
  }

  // Tag XMAS book numbers for new christmas songs
  let xmasN = 0;
  for (const s of songs) {
    const nums = (s.data.numbers as { book: string; number: string }[]) || [];
    if (nums.some((n) => n.book === 'XMAS')) {
      const n = Number.parseInt(nums.find((x) => x.book === 'XMAS')!.number, 10);
      if (!Number.isNaN(n) && n > xmasN) xmasN = n;
    }
  }
  let xmasAdded = 0;
  for (const s of songs) {
    const tags = (s.data.tags as string[]) || [];
    if (!tags.includes('christmas')) continue;
    const nums = (s.data.numbers as { book: string; number: string }[]) || [];
    if (nums.some((n) => n.book === 'XMAS')) continue;
    if (!tags.includes('imported-zip')) continue;
    xmasN += 1;
    nums.push({ book: 'XMAS', number: String(xmasN) });
    s.data.numbers = nums;
    writeJson(s.path, s.data);
    xmasAdded += 1;
  }

  console.log(
    JSON.stringify(
      {
        dry: DRY,
        docxScanned: files.length,
        uniqueNew: bySlug.size,
        added: added.length,
        skippedExists,
        skippedNoHindi,
        skippedThin,
        maxTlbc,
        xmasAdded,
      },
      null,
      2,
    ),
  );
  for (const line of added.slice(0, 30)) console.log(' ', line);
  if (added.length > 30) console.log(`  …and ${added.length - 30} more`);
}

main();
