/**
 * Replace thin site songs with richer Song.zip lyrics (stanza/chorus formatted).
 *
 *   npx tsx scripts/enrich-from-zip.ts
 *   npx tsx scripts/enrich-from-zip.ts --dry-run
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { inflateRawSync } from 'node:zlib';
import {
  blocksToSections,
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
  // Minimal ZIP central/local parse via inflate of word/document.xml
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
          method === 0
            ? data.toString('utf8')
            : inflateRawSync(data).toString('utf8');
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

function stripChordsAndJunk(text: string): string {
  const lines = text.split(/\n/).map((l) => l.trimEnd());
  const out: string[] = [];
  for (const line of lines) {
    const t = line.trim();
    if (!t) {
      out.push('');
      continue;
    }
    if (CHORD_LINE.test(t)) continue;
    if (/^\d{6,}$/.test(t)) continue; // phone / numeric garbage
    if (/^[A-G]\s*$/.test(t)) continue;
    if (/lucknow baptist|the lucknow|sheet\s*[A-G]|chords?/i.test(t) && t.length < 80) continue;
    // Drop lines that are mostly chord tokens mixed with spaces
    const words = t.split(/\s+/);
    const chordish = words.filter((w) => /^[A-G](#|b)?(m|maj|min|dim|aug|sus|add)?[0-9]*(\/[A-G](#|b)?)?$/.test(w));
    if (words.length >= 2 && chordish.length / words.length >= 0.6) continue;
    out.push(t.replace(/\t+/g, ' ').replace(/ {2,}/g, ' '));
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function walkDocx(dir: string): string[] {
  const out: string[] = [];
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, name.name);
    if (name.isDirectory()) out.push(...walkDocx(p));
    else if (name.name.toLowerCase().endsWith('.docx')) out.push(p);
  }
  return out;
}

type SongFile = { path: string; id: string; data: Record<string, unknown> };

function loadHiSongs(): SongFile[] {
  const dir = join(ROOT, 'src/content/songs/hi');
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      const path = join(dir, f);
      const data = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
      return { path, id: `hi-${f.replace(/\.json$/, '')}`, data };
    });
}

function siteLineCount(data: Record<string, unknown>): number {
  return lineCount((data.sections as SectionOut[]) || []);
}

function isWeak(data: Record<string, unknown>): boolean {
  const secs = (data.sections as SectionOut[]) || [];
  if (secs.length <= 1) return true;
  if (secs.every((s) => s.type === 'chorus')) return true;
  return siteLineCount(data) < 12 && secs.length < 3;
}

function tokenSet(s: string): Set<string> {
  return new Set(
    s
      .split('-')
      .map((t) => t.trim())
      .filter((t) => t.length > 2 && !['hai', 'the', 'and', 'ke', 'ki', 'ko', 'mein', 'main', 'par', 'se'].includes(t)),
  );
}

function findMatch(titleHint: string, fileSlug: string, songs: SongFile[]): SongFile | undefined {
  const key = normalizeForMatch(titleHint);
  const fslug = slugifyTitle(fileSlug.replace(/\.docx$/i, '').replace(/\(.*?\)/g, ''));
  const ftokens = tokenSet(fslug);
  let best: SongFile | undefined;
  let score = 0;
  for (const s of songs) {
    const native = (s.data.title as { native?: string })?.native || '';
    const slug = String(s.data.slug || s.id.replace(/^hi-/, ''));
    const nk = normalizeForMatch(native);
    const stokens = tokenSet(slug);
    let sc = 0;
    if (key && nk && key.length >= 8 && (nk === key || (nk.startsWith(key.slice(0, 16)) && key.startsWith(nk.slice(0, 12)))))
      sc = 1;
    else if (fslug && slug === fslug) sc = 0.95;
    else if (fslug && slug.startsWith(fslug.slice(0, 16)) && fslug.startsWith(slug.slice(0, 16))) sc = 0.9;
    else if (ftokens.size && stokens.size) {
      let inter = 0;
      for (const t of ftokens) if (stokens.has(t)) inter += 1;
      const ratio = inter / Math.min(ftokens.size, stokens.size);
      if (ratio >= 0.7 && inter >= 2) sc = 0.75 + ratio * 0.1;
    }
    if (sc > score) {
      score = sc;
      best = s;
    }
  }
  return score >= 0.75 ? best : undefined;
}

function main() {
  const songs = loadHiSongs();
  const files = walkDocx(ZIP_DIR);
  let enriched = 0;
  let skipped = 0;
  const report: string[] = [];

  for (const file of files) {
    const raw = extractDocxText(file);
    if (raw.length < 80) {
      skipped += 1;
      continue;
    }
    const cleaned = stripChordsAndJunk(raw);
    if (cleaned.length < 60) {
      skipped += 1;
      continue;
    }
    const first = cleaned.split(/\n/).map((l) => l.trim()).find(Boolean) || '';
    const base = file.split(/[/\\]/).pop() || '';
    const match = findMatch(first, base, songs);
    if (!match) {
      skipped += 1;
      continue;
    }
    const sections = blocksToSections(cleaned);
    if (!sections.length) {
      skipped += 1;
      continue;
    }
    const zipLines = lineCount(sections);
    const siteLines = siteLineCount(match.data);
    const weak = isWeak(match.data);
    const richer = zipLines >= siteLines + 4 || (weak && zipLines > siteLines);
    const betterStructure = weak && sections.length >= 2 && zipLines >= siteLines;
    if (!richer && !betterStructure) {
      skipped += 1;
      continue;
    }

    match.data.sections = sections;
    match.data.updated = TODAY;
    const src = (match.data.source as { scan?: string; page?: number | null }) || {};
    match.data.source = {
      ...src,
      scan: `enrich-from-zip:${base}`,
      page: src.page ?? null,
    };
    if (!DRY) writeFileSync(match.path, `${JSON.stringify(match.data, null, 2)}\n`, 'utf8');
    enriched += 1;
    report.push(`${match.id}: ${siteLines}→${zipLines} lines, ${sections.length} sections ← ${base}`);
  }

  console.log(JSON.stringify({ dry: DRY, files: files.length, enriched, skipped }, null, 2));
  for (const line of report.slice(0, 40)) console.log(' ', line);
  if (report.length > 40) console.log(`  …and ${report.length - 40} more`);
}

main();
