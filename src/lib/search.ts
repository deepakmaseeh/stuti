import MiniSearch, { type Options, type SearchResult } from 'minisearch';
import { normalizeToken } from './normalize';
import type { SongData } from './schema';

/** One document per song in the MiniSearch index (§11.3). */
export type SearchDoc = {
  id: string;
  title: string;
  first: string;
  lines: string;
  aliases: string;
  nums: string;
};
/** meta.json value: [native title, roman title, lang, "BOOK NUM"]. */
export type MetaRow = [string, string, string, string];
export type NumbersMap = Record<string, Record<string, string>>;
export type Hit = { id: string; title: string; roman: string; lang: string; badge: string; score: number };

export const MS_OPTIONS: Options<SearchDoc> = {
  idField: 'id',
  fields: ['title', 'first', 'lines', 'aliases', 'nums'],
  storeFields: ['id'],
  tokenize: (text: string) => text.split(/[\s\p{P}\p{S}]+/u),
  processTerm: (term: string) => normalizeToken(term) || null,
  searchOptions: {
    prefix: true,
    fuzzy: 0.2,
    boost: { title: 3, first: 2, aliases: 2, nums: 2 },
    combineWith: 'AND',
  },
};

export function songToDoc(
  song: Pick<SongData, 'title' | 'sections' | 'aliases' | 'numbers'> & { id: string },
): SearchDoc {
  const first = song.sections[0]?.lines[0];
  return {
    id: song.id,
    title: [song.title.native, song.title.roman, song.title.en].filter(Boolean).join(' '),
    first: [first?.n, first?.r].filter(Boolean).join(' '),
    lines: song.sections
      .flatMap((s) => s.lines)
      .flatMap((l) => [l.n, l.r, l.e])
      .filter(Boolean)
      .join(' '),
    aliases: song.aliases.join(' '),
    nums: song.numbers
      .map((n) => `${n.book} ${n.number} ${n.book}${n.number} ${(n.book + n.number).toLowerCase()}`)
      .join(' '),
  };
}

export function buildIndex(docs: SearchDoc[]): MiniSearch<SearchDoc> {
  const ms = new MiniSearch<SearchDoc>(MS_OPTIONS);
  ms.addAll(docs);
  return ms;
}

export const loadIndexJson = (json: string): MiniSearch<SearchDoc> => MiniSearch.loadJSON(json, MS_OPTIONS);

/** Case-insensitive `numbers.json` lookup: lookupNumber(map, 'dt', '117') → song id. */
export function lookupNumber(map: NumbersMap, book: string, number: string): string | undefined {
  const key = Object.keys(map).find((k) => k.toLowerCase() === book.toLowerCase());
  return key ? map[key]?.[number.toLowerCase()] : undefined;
}

/** Number variants in a book that start with the typed digits: 117 → ["117", "117a"] (for alnum books). */
export function numberVariants(map: NumbersMap, book: string, digits: string): string[] {
  const key = Object.keys(map).find((k) => k.toLowerCase() === book.toLowerCase());
  if (!key || !digits) return [];
  const re = new RegExp(`^${digits}[a-z]?$`);
  return Object.keys(map[key] ?? {})
    .filter((n) => re.test(n))
    .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
}

const BOOK_NUM_RE = /^([A-Za-z]{1,6})\s?(\d+[a-z]?)$/;

/** "dt117" / "DT 117" → { book, number } for the direct number lookup that is pinned first. */
export function parseBookNumber(q: string): { book: string; number: string } | null {
  const m = BOOK_NUM_RE.exec(q.trim());
  return m ? { book: m[1]!, number: m[2]!.toLowerCase() } : null;
}

const toHit = (id: string, score: number, meta: Record<string, MetaRow>): Hit | null => {
  const row = meta[id];
  return row ? { id, title: row[0], roman: row[1], lang: row[2], badge: row[3], score } : null;
};

/** Query every loaded shard, merge by score, map ids through meta.json, pin a direct number hit first. */
export function runQuery(
  q: string,
  shards: MiniSearch<SearchDoc>[],
  meta: Record<string, MetaRow>,
  numbers: NumbersMap,
): Hit[] {
  const text = q.trim();
  if (!text) return [];
  const results: SearchResult[] = shards.flatMap((ms) => ms.search(text));
  results.sort((a, b) => b.score - a.score);

  const out: Hit[] = [];
  const seen = new Set<string>();
  const bn = parseBookNumber(text);
  const pinned = bn ? lookupNumber(numbers, bn.book, bn.number) : undefined;
  if (pinned) {
    const hit = toHit(pinned, Infinity, meta);
    if (hit) {
      out.push(hit);
      seen.add(pinned);
    }
  }
  for (const r of results) {
    const id = String(r.id);
    if (seen.has(id)) continue;
    const hit = toHit(id, r.score, meta);
    if (hit) {
      out.push(hit);
      seen.add(id);
    }
  }
  return out;
}

/* ---------- Browser side: lazy shard loading ---------- */

const shardCache = new Map<string, Promise<MiniSearch<SearchDoc> | null>>();
let metaPromise: Promise<Record<string, MetaRow>> | undefined;
let numbersPromise: Promise<NumbersMap> | undefined;

const getJson = <T>(url: string): Promise<T> =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`${url}: ${r.status}`);
    return r.json() as Promise<T>;
  });

export const loadMeta = () => (metaPromise ??= getJson<Record<string, MetaRow>>('/search/meta.json'));
export const loadNumbers = () => (numbersPromise ??= getJson<NumbersMap>('/search/numbers.json'));

/** Fetches idx-<lang>.json once; resolves null when the shard is missing or offline-and-not-downloaded. */
export function loadIndex(lang: string): Promise<MiniSearch<SearchDoc> | null> {
  let p = shardCache.get(lang);
  if (!p) {
    p = fetch(`/search/idx-${lang}.json`)
      .then((r) => (r.ok ? r.text() : null))
      .then((t) => (t ? loadIndexJson(t) : null))
      .catch(() => null);
    shardCache.set(lang, p);
    // Retry next time if it failed (e.g. came back online).
    p.then((ms) => ms || shardCache.delete(lang));
  }
  return p;
}

export async function query(q: string, langs: readonly string[]): Promise<Hit[]> {
  const [meta, numbers, ...shards] = await Promise.all([loadMeta(), loadNumbers(), ...langs.map(loadIndex)]);
  return runQuery(
    q,
    shards.filter((s): s is MiniSearch<SearchDoc> => !!s),
    meta,
    numbers,
  );
}
