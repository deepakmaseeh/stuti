import { createHash } from 'node:crypto';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildBookBundle } from '../src/lib/book-bundle';
import { buildBrowseIndex } from '../src/lib/browse';
import { BookSchema, SongSchema, songIdFromPath, type Book, type Lang, type Song } from '../src/lib/schema';
import { buildIndex, songToDoc, type MetaRow, type NumbersMap } from '../src/lib/search';
import { isPublishable, langOf, numberUrl, songUrl } from '../src/lib/songs';
import { readContent, type FileEntry } from './validate';

const LANGS: Lang[] = ['hi', 'ta', 'te', 'pa', 'en'];

export type BookManifest = {
  book: string;
  version: string;
  updated: string;
  bytes: number;
  urls: string[];
  searchIndex: string;
};

export type IndexOutput = {
  numbers: NumbersMap;
  meta: Record<string, MetaRow>;
  /** lang → serialized MiniSearch JSON */
  shards: Record<string, string>;
  manifests: Record<string, BookManifest>;
  /** bookId → lyric bundle JSON string */
  bookBundles: Record<string, string>;
  /** lang → browse index JSON string */
  browse: Record<string, string>;
};

const sha12 = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 12);

/**
 * Build every generated search/download file from raw content entries.
 * Run after `validate`, so entries are assumed valid; invalid ones throw.
 */
export function buildIndexes(input: {
  books: FileEntry[];
  songs: FileEntry[];
  includeDemo: boolean;
}): IndexOutput {
  const books: Book[] = input.books.map((b) => BookSchema.parse(JSON.parse(b.raw)));
  const songs: (Song & { raw: string })[] = input.songs
    .map((e) => {
      const id = songIdFromPath(e.relPath);
      return { ...SongSchema.parse(JSON.parse(e.raw)), id, lang: langOf(id), raw: e.raw };
    })
    .filter((s) => isPublishable(s, input.includeDemo))
    .sort((a, b) => a.id.localeCompare(b.id));

  const numbers: NumbersMap = {};
  const meta: Record<string, MetaRow> = {};
  for (const s of songs) {
    for (const n of s.numbers) (numbers[n.book] ??= {})[n.number.toLowerCase()] = s.id;
    const first = s.numbers[0]!;
    const firstLine = s.sections[0]?.lines[0]?.n ?? '';
    meta[s.id] = [
      s.title.native,
      s.title.roman ?? '',
      s.lang,
      `${first.book} ${first.number}`,
      firstLine,
      [...s.tags],
    ];
  }

  const shards: Record<string, string> = {};
  for (const lang of [...new Set(songs.map((s) => s.lang))].sort()) {
    shards[lang] = JSON.stringify(buildIndex(songs.filter((s) => s.lang === lang).map(songToDoc)));
  }

  const browse: Record<string, string> = {};
  for (const lang of LANGS) {
    const langSongs = songs.filter((s) => s.lang === lang);
    if (!langSongs.length) continue;
    browse[lang] = JSON.stringify(buildBrowseIndex(langSongs, lang));
  }

  const manifests: Record<string, BookManifest> = {};
  const bookBundles: Record<string, string> = {};
  for (const book of books.filter((b) => b.status !== 'archived')) {
    const inBook = songs.filter((s) => s.numbers.some((n) => n.book === book.id));
    if (!inBook.length) continue;
    const shard = shards[book.lang] ?? '';
    const version = sha12(JSON.stringify(book) + inBook.map((s) => s.raw).join('\n') + shard);
    const bundle = buildBookBundle(book.id, version, inBook);
    const bundleJson = JSON.stringify(bundle);
    bookBundles[book.id] = bundleJson;

    const urls = [
      `/books/${book.id.toLowerCase()}/`,
      `/data/books/${book.id}.json`,
      ...inBook.map((s) => songUrl(s.id)),
      ...inBook.flatMap((s) =>
        s.numbers.filter((n) => n.book === book.id).map((n) => numberUrl(n.book, n.number)),
      ),
    ];
    manifests[book.id] = {
      book: book.id,
      version,
      updated: inBook
        .map((s) => s.updated)
        .sort()
        .at(-1)!,
      bytes:
        inBook.reduce((sum, s) => sum + Buffer.byteLength(s.raw), 0) +
        Buffer.byteLength(shard) +
        Buffer.byteLength(bundleJson),
      urls,
      searchIndex: `/search/idx-${book.lang}.json`,
    };
  }

  return { numbers, meta, shards, manifests, bookBundles, browse };
}

export function writeIndexes(out: IndexOutput, publicDir: string): string[] {
  const searchDir = join(publicDir, 'search');
  const dlDir = join(publicDir, 'dl');
  const dataBooks = join(publicDir, 'data', 'books');
  // Start clean so removed books/languages don't leave stale files behind.
  for (const d of [searchDir, dlDir, dataBooks]) {
    rmSync(d, { recursive: true, force: true });
    mkdirSync(d, { recursive: true });
  }
  const files: [string, string][] = [
    [join(searchDir, 'numbers.json'), JSON.stringify(out.numbers)],
    [join(searchDir, 'meta.json'), JSON.stringify(out.meta)],
    ...Object.entries(out.shards).map(([lang, json]): [string, string] => [
      join(searchDir, `idx-${lang}.json`),
      json,
    ]),
    ...Object.entries(out.browse).map(([lang, json]): [string, string] => [
      join(searchDir, `browse-${lang}.json`),
      json,
    ]),
    ...Object.entries(out.manifests).map(([id, m]): [string, string] => [
      join(dlDir, `${id}.json`),
      JSON.stringify(m),
    ]),
    ...Object.entries(out.bookBundles).map(([id, json]): [string, string] => [
      join(dataBooks, `${id}.json`),
      json,
    ]),
  ];
  for (const [path, body] of files) writeFileSync(path, body);
  return files.map(
    ([p, body]) => `${p.slice(publicDir.length + 1).replace(/\\/g, '/')} (${Buffer.byteLength(body)} B)`,
  );
}

function main(): void {
  const includeDemo = process.env.PUBLIC_INCLUDE_DEMO === 'true';
  const out = buildIndexes({ ...readContent(join(process.cwd(), 'src', 'content')), includeDemo });
  const written = writeIndexes(out, join(process.cwd(), 'public'));
  console.log(`Search indexes (PUBLIC_INCLUDE_DEMO=${includeDemo}): ${Object.keys(out.meta).length} songs`);
  for (const f of written) console.log(`  ${f}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
