import { z } from 'zod';
import { LANGS, type Lang } from './langs';

export { LANGS, type Lang };
export const LangSchema = z.enum(LANGS);

export const BOOK_ID_RE = /^[A-Za-z]{1,6}$/;
export const SLUG_RE = /^[a-z0-9-]{2,80}$/;
export const SONG_ID_RE = /^(en|hi|ta|te|pa)-[a-z0-9-]{2,80}$/;

export const BookSchema = z.object({
  id: z.string().regex(BOOK_ID_RE),
  name: z.object({ native: z.string().min(1), en: z.string().min(1) }),
  lang: LangSchema,
  edition: z.string().default(''),
  publisher: z.string().default(''),
  description: z.string().default(''),
  order: z.number().int().default(100),
  numbering: z.enum(['numeric', 'alnum']).default('numeric'),
  status: z.enum(['demo', 'active', 'archived']).default('active'),
});

const LineSchema = z.object({
  n: z.string().min(1),
  r: z.string().default(''),
  e: z.string().default(''),
});

const SectionSchema = z.object({
  type: z.enum(['verse', 'chorus', 'bridge', 'refrain', 'other']),
  label: z.string().min(1),
  lines: z.array(LineSchema).min(1),
});

const LayerState = z.enum(['missing', 'draft', 'reviewed']);

export const RIGHTS_STATUSES = [
  'public_domain',
  'licensed',
  'permission_pending',
  'demo',
  'rejected',
] as const;

// Decap saves a cleared optional number field as "", so treat "" like "not set".
const optInt = z.preprocess((v) => (v === '' ? null : v), z.number().int().nullable()).default(null);

// Song id and language are NOT in the JSON: they come from the file path (spec §5.3).
export const SongSchema = z.object({
  slug: z.string().regex(SLUG_RE).optional(),
  numbers: z.array(z.object({ book: z.string(), number: z.string().regex(/^[0-9A-Za-z-]{1,8}$/) })).min(1),
  title: z.object({
    native: z.string().min(1),
    roman: z.string().default(''),
    en: z.string().default(''),
  }),
  aliases: z.array(z.string()).default([]),
  sections: z.array(SectionSchema).min(1),
  display: z.object({ chorusAfterEachVerse: z.boolean().default(false) }).default({}),
  author: z
    .object({
      name: z.string().default('Unknown'),
      born: optInt,
      died: optInt,
    })
    .default({}),
  composer: z.string().nullable().default(null),
  tune: z.string().nullable().default(null),
  year: optInt,
  bibleRefs: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  rights: z.object({
    status: z.enum(RIGHTS_STATUSES),
    basis: z.string().default(''),
    evidence: z.string().default(''),
    holder: z.string().default(''),
    checkedBy: z.string().default(''),
    checkedOn: z.string().default(''),
  }),
  layers: z.object({ roman: LayerState.default('missing'), en: LayerState.default('missing') }).default({}),
  source: z.object({ scan: z.string().default(''), page: optInt }).default({}),
  chords: z.string().nullable().default(null),
  media: z.object({ youtube: z.string().nullable().default(null) }).default({}),
  updated: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  publish: z.boolean().default(false),
});

export type Book = z.infer<typeof BookSchema>;
export type SongData = z.infer<typeof SongSchema>;
export type Song = SongData & { id: string; lang: Lang };

/** `ta/yesuve-en-thunai.json` → `ta-yesuve-en-thunai`. Accepts Windows separators. */
export function songIdFromPath(relPath: string): string {
  return relPath
    .replace(/\\/g, '/')
    .replace(/\.json$/, '')
    .replace('/', '-');
}
