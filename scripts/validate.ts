import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { ZodError } from 'zod';
import {
  BookSchema,
  LANGS,
  SLUG_RE,
  SongSchema,
  songIdFromPath,
  type Book,
  type Lang,
  type SongData,
} from '../src/lib/schema';
import { LATIN_ONLY, SCRIPT_RE } from '../src/lib/scripts';
import { isPublishable } from '../src/lib/songs';

export type FileEntry = { relPath: string; raw: string };
export type Issue = { file: string; rule: string; message: string };
export type BookSummary = {
  book: string;
  songs: number;
  published: number;
  pending: number;
  draftLayers: number;
};
export type ValidationResult = { errors: Issue[]; warnings: Issue[]; summary: BookSummary[] };

const MAX_LINE = 200;
const MAX_LINES = 300;
const HTML_RE = /<[^>]+>/;

type ParsedSong = { file: string; id: string; lang: Lang; slug: string; data: SongData };

function zodMessages(err: ZodError): string[] {
  return err.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`);
}

function parseJson(entry: FileEntry, errors: Issue[]): unknown {
  try {
    return JSON.parse(entry.raw);
  } catch (e) {
    errors.push({ file: entry.relPath, rule: '1-schema', message: `Invalid JSON: ${(e as Error).message}` });
    return undefined;
  }
}

function collectStrings(value: unknown, path: string, out: { path: string; text: string }[]): void {
  if (typeof value === 'string') out.push({ path, text: value });
  else if (Array.isArray(value)) value.forEach((v, i) => collectStrings(v, `${path}[${i}]`, out));
  else if (value && typeof value === 'object')
    for (const [k, v] of Object.entries(value)) collectStrings(v, path ? `${path}.${k}` : k, out);
}

function isValidDate(s: string): boolean {
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/** Validate books and songs (spec §15.3). Paths are relative to `src/content/books` and `src/content/songs`. */
export function validateEntries(input: {
  books: FileEntry[];
  songs: FileEntry[];
  includeDemo: boolean;
  today?: string;
}): ValidationResult {
  const errors: Issue[] = [];
  const warnings: Issue[] = [];
  const today = input.today ?? new Date().toISOString().slice(0, 10);
  const currentYear = Number(today.slice(0, 4));
  const err = (file: string, rule: string, message: string) => errors.push({ file, rule, message });
  const warn = (file: string, rule: string, message: string) => warnings.push({ file, rule, message });

  // ---- Books ----
  const books = new Map<string, Book>();
  const booksLower = new Map<string, string>();
  for (const entry of input.books) {
    const file = `books/${entry.relPath}`;
    const json = parseJson({ ...entry, relPath: file }, errors);
    if (json === undefined) continue;
    const parsed = BookSchema.safeParse(json);
    if (!parsed.success) {
      zodMessages(parsed.error).forEach((m) => err(file, '1-schema', m));
      continue;
    }
    const book = parsed.data;
    if (entry.relPath !== `${book.id}.json`)
      err(file, '1-schema', `Book file must be named "${book.id}.json"`);
    const lower = book.id.toLowerCase();
    const clash = booksLower.get(lower);
    if (clash !== undefined) {
      err(
        file,
        '3-book-id',
        `Book id "${book.id}" clashes with "${clash}" (book ids must be unique ignoring case)`,
      );
      continue;
    }
    booksLower.set(lower, book.id);
    books.set(book.id, book);
  }

  // ---- Songs ----
  const songs: ParsedSong[] = [];
  const ids = new Map<string, string>();
  for (const entry of input.songs) {
    const rel = entry.relPath.replace(/\\/g, '/');
    const file = `songs/${rel}`;
    const parts = rel.split('/');
    const [folder, fileName] = parts;
    const slug = fileName?.replace(/\.json$/, '') ?? '';
    if (parts.length !== 2 || !folder || !fileName) {
      err(file, '2-path', 'Song files must be at songs/<lang>/<slug>.json');
      continue;
    }
    if (!(LANGS as readonly string[]).includes(folder)) {
      err(file, '2-path', `Folder "${folder}" is not a language (use one of ${LANGS.join(', ')})`);
      continue;
    }
    if (!fileName.endsWith('.json') || !SLUG_RE.test(slug)) {
      err(
        file,
        '2-path',
        `File name "${fileName}" must be lowercase letters, numbers and hyphens (2-80) + .json`,
      );
      continue;
    }
    const id = songIdFromPath(rel);
    const dup = ids.get(id.toLowerCase());
    if (dup) {
      err(file, '2-path', `Duplicate song id "${id}" (also ${dup})`);
      continue;
    }
    ids.set(id.toLowerCase(), file);

    const json = parseJson({ ...entry, relPath: file }, errors);
    if (json === undefined) continue;
    if (json && typeof json === 'object' && ('id' in json || 'lang' in json))
      warn(file, '2-path', 'Remove "id"/"lang" from the JSON: they come from the file path');
    const parsed = SongSchema.safeParse(json);
    if (!parsed.success) {
      zodMessages(parsed.error).forEach((m) => err(file, '1-schema', m));
      continue;
    }

    // Rule 9: no HTML in any text field
    const strings: { path: string; text: string }[] = [];
    collectStrings(json, '', strings);
    for (const s of strings)
      if (HTML_RE.test(s.text))
        err(file, '9-html', `HTML is not allowed (${s.path}: "${s.text.slice(0, 40)}")`);

    songs.push({ file, id, lang: folder as Lang, slug, data: parsed.data });
  }

  // ---- Per-song rules ----
  const numberOwners = new Map<string, string>();
  const firstLines = new Map<string, string>();
  for (const s of songs) {
    const { file, data, lang } = s;

    // Rule 4: numbers
    for (const num of data.numbers) {
      const book = books.get(num.book);
      if (!book) {
        const hint = booksLower.get(num.book.toLowerCase());
        err(
          file,
          '4-numbers',
          `Book "${num.book}" does not exist${hint ? ` (did you mean "${hint}"?)` : ''}`,
        );
        continue;
      }
      const key = `${num.book.toLowerCase()}|${num.number.toLowerCase()}`;
      const owner = numberOwners.get(key);
      if (owner) err(file, '4-numbers', `${num.book} ${num.number} is already used by ${owner}`);
      else numberOwners.set(key, file);
      if (book.lang !== lang) {
        if (book.lang === 'en')
          warn(file, '4-numbers', `Song language "${lang}" differs from English book ${book.id}`);
        else
          err(file, '4-numbers', `Book ${book.id} is "${book.lang}" but the song is in the "${lang}" folder`);
      }
    }

    // Rule 5: scripts. Rule 10: sizes. Rule 6: layer completeness.
    const lines = data.sections.flatMap((sec) => sec.lines.map((l) => ({ ...l, label: sec.label })));
    if (lines.length > MAX_LINES) err(file, '10-size', `${lines.length} lines (max ${MAX_LINES})`);
    if (lang !== 'en') {
      const re = SCRIPT_RE[lang];
      if (!re.test(data.title.native)) err(file, '5-script', `title.native is not in the ${lang} script`);
    }
    for (const field of ['roman', 'en'] as const) {
      const t = data.title[field];
      if (t && !LATIN_ONLY.test(t)) err(file, '5-script', `title.${field} must use Latin letters only`);
    }
    lines.forEach((l, i) => {
      const where = `${l.label}, line ${i + 1}`;
      if (lang !== 'en' && !SCRIPT_RE[lang].test(l.n))
        err(file, '5-script', `${where}: "n" is not in the ${lang} script`);
      if (l.r && !LATIN_ONLY.test(l.r)) err(file, '5-script', `${where}: "r" must use Latin letters only`);
      if (l.e && !LATIN_ONLY.test(l.e)) err(file, '5-script', `${where}: "e" must use Latin letters only`);
      for (const k of ['n', 'r', 'e'] as const)
        if (l[k].length > MAX_LINE)
          err(file, '10-size', `${where}: "${k}" is ${l[k].length} chars (max ${MAX_LINE})`);
      if (data.layers.roman !== 'missing' && !l.r)
        err(file, '6-layers', `${where}: missing "r" (layers.roman is "${data.layers.roman}")`);
      if (data.layers.en !== 'missing' && !l.e)
        err(file, '6-layers', `${where}: missing "e" (layers.en is "${data.layers.en}")`);
    });

    // Rule 7: rights gate
    const r = data.rights;
    const publishable = isPublishable(data, input.includeDemo);
    if (data.publish && !publishable) {
      const why =
        r.status === 'demo'
          ? 'demo songs can be published only when PUBLIC_INCLUDE_DEMO=true (copy .env.example to .env for local runs)'
          : `rights.status is "${r.status}" (must be public_domain or licensed)`;
      err(file, '7-rights', `publish is true but ${why}`);
    }
    if (r.status === 'public_domain') {
      const died = data.author.died;
      const oldEnough = died !== null && died <= currentYear - 61;
      if (!oldEnough && !r.basis.trim())
        err(
          file,
          '7-rights',
          'public_domain needs author.died ≤ current year − 61 or a rights.basis explaining why',
        );
    }
    if (r.status === 'licensed' && (!r.holder.trim() || !r.evidence.trim()))
      err(file, '7-rights', 'licensed needs rights.holder and rights.evidence');

    // Rule 8: updated
    if (!isValidDate(data.updated)) err(file, '8-updated', `"${data.updated}" is not a valid date`);
    else if (data.updated > today) err(file, '8-updated', `"${data.updated}" is in the future`);

    // Warnings
    if (publishable && data.layers.en === 'draft') warn(file, 'w-draft', 'English layer is still a draft');
    if (data.aliases.length === 0) warn(file, 'w-aliases', 'No aliases (extra search words)');
    if (data.bibleRefs.length === 0) warn(file, 'w-bible', 'No Bible references');
    if (data.slug !== undefined && data.slug !== s.slug)
      warn(file, 'w-slug', `slug "${data.slug}" differs from the file name "${s.slug}"`);
    const fl = lines[0]?.n.trim().toLowerCase();
    if (fl) {
      const other = firstLines.get(fl);
      if (other) warn(file, 'w-duplicate', `Same first line as ${other} (possible duplicate)`);
      else firstLines.set(fl, file);
    }
  }

  // ---- Summary per book ----
  const summary: BookSummary[] = [...books.values()].map((b) => {
    const inBook = songs.filter((s) => s.data.numbers.some((n) => n.book === b.id));
    return {
      book: b.id,
      songs: inBook.length,
      published: inBook.filter((s) => isPublishable(s.data, input.includeDemo)).length,
      pending: inBook.filter((s) => s.data.rights.status === 'permission_pending').length,
      draftLayers: inBook.filter((s) => s.data.layers.roman === 'draft' || s.data.layers.en === 'draft')
        .length,
    };
  });

  return { errors, warnings, summary };
}

function readTree(dir: string, base = dir): FileEntry[] {
  let out: FileEntry[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out = out.concat(readTree(full, base));
    else if (name.endsWith('.json'))
      out.push({ relPath: relative(base, full).replace(/\\/g, '/'), raw: readFileSync(full, 'utf8') });
  }
  return out;
}

/** Read src/content (or another content root) from disk. */
export function readContent(contentDir: string): { books: FileEntry[]; songs: FileEntry[] } {
  return { books: readTree(join(contentDir, 'books')), songs: readTree(join(contentDir, 'songs')) };
}

function main(): void {
  const asJson = process.argv.includes('--json');
  const includeDemo = process.env.PUBLIC_INCLUDE_DEMO === 'true';
  const result = validateEntries({ ...readContent(join(process.cwd(), 'src', 'content')), includeDemo });

  if (asJson) {
    console.log(JSON.stringify({ includeDemo, ...result }, null, 2));
  } else {
    console.log(`Stuti content validation (PUBLIC_INCLUDE_DEMO=${includeDemo})\n`);
    console.table(result.summary);
    for (const w of result.warnings) console.log(`warn  ${w.file} [${w.rule}] ${w.message}`);
    for (const e of result.errors) console.log(`ERROR ${e.file} [${e.rule}] ${e.message}`);
    console.log(`\n${result.errors.length} error(s), ${result.warnings.length} warning(s)`);
  }
  if (process.env.GITHUB_ACTIONS)
    for (const e of result.errors)
      console.log(`::error file=src/content/${e.file}::[${e.rule}] ${e.message}`);
  process.exitCode = result.errors.length ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
