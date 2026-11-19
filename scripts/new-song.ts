/**
 * Create a new draft song file that already passes validation.
 *
 *   npm run new-song                       # asks questions
 *   npm run new-song -- --lang ta --book DT --number 118 --title "இயேசுவே" \
 *     --roman "Yesuve" --line "இயேசுவே என் துணை" --line "இருளில் என் ஒளி" [--dry-run]
 *
 * The draft is never published: rights = permission_pending, publish = false.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import { LANGS, type Lang } from '../src/lib/langs';
import { SLUG_RE } from '../src/lib/schema';
import { readContent, validateEntries, type Issue } from './validate';

export type DraftInput = {
  lang: Lang;
  book: string;
  number: string;
  native: string;
  roman?: string;
  en?: string;
  lines: string[];
  slug?: string;
  today: string;
};

/** "Yesuve En Thunai!" → "yesuve-en-thunai" (Latin letters and digits only). */
export function slugify(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/, '');
}

/** Same minimal shape the CMS writes; schema defaults fill the rest at build time. */
export function buildDraft(input: DraftInput) {
  const slug = input.slug || slugify(input.roman || input.en || '');
  return {
    slug,
    numbers: [{ book: input.book, number: input.number }],
    title: {
      native: input.native,
      ...(input.roman ? { roman: input.roman } : {}),
      ...(input.en ? { en: input.en } : {}),
    },
    sections: [{ type: 'verse', label: 'Verse 1', lines: input.lines.map((n) => ({ n })) }],
    display: { chorusAfterEachVerse: false },
    author: { name: 'Unknown' },
    rights: { status: 'permission_pending' },
    layers: { roman: 'missing', en: 'missing' },
    updated: input.today,
    publish: false,
  };
}

export type Plan = { relPath: string; json: string; errors: Issue[] };

/** Build the file and check it against everything already in `contentDir` (number clashes, script, schema). */
export function planNewSong(input: DraftInput, contentDir: string, includeDemo: boolean): Plan {
  const draft = buildDraft(input);
  const relPath = `${input.lang}/${draft.slug}.json`;
  const json = `${JSON.stringify(draft, null, 2)}\n`;
  const errors: Issue[] = [];
  if (!SLUG_RE.test(draft.slug))
    errors.push({
      file: relPath,
      rule: 'slug',
      message: 'URL name must be 2-80 lowercase letters, numbers or hyphens (give --slug or a Roman title)',
    });
  if (existsSync(join(contentDir, 'songs', relPath)))
    errors.push({ file: relPath, rule: 'exists', message: 'a song with this URL name already exists' });
  const content = readContent(contentDir);
  const result = validateEntries({
    books: content.books,
    songs: [...content.songs, { relPath, raw: json }],
    includeDemo,
    today: input.today,
  });
  // Only report problems caused by the new file.
  errors.push(...result.errors.filter((e) => e.file.endsWith(relPath)));
  return { relPath, json, errors };
}

const HELP = `Create a draft song (never published until rights are checked).

Options (anything missing is asked interactively):
  --lang <en|hi|ta|te|pa>   song language
  --book <ID>               hymnbook id, e.g. DT
  --number <n>              number exactly as printed, e.g. 117 or 117a
  --title <text>            title in the original script
  --roman <text>            title in Roman letters (also used for the URL name)
  --en <text>               English title
  --line <text>             a line in the original script (repeat for more lines)
  --slug <url-name>         URL name, if not derived from --roman
  --dry-run                 print the file instead of writing it
  --help                    show this help`;

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      lang: { type: 'string' },
      book: { type: 'string' },
      number: { type: 'string' },
      title: { type: 'string' },
      roman: { type: 'string' },
      en: { type: 'string' },
      line: { type: 'string', multiple: true },
      slug: { type: 'string' },
      'dry-run': { type: 'boolean' },
      help: { type: 'boolean' },
    },
  });
  if (values.help) return console.log(HELP);

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const ask = async (q: string, current?: string) => current ?? (await rl.question(`${q}: `)).trim();
  try {
    const lang = (await ask(`Language (${LANGS.join('/')})`, values.lang)) as Lang;
    if (!LANGS.includes(lang)) throw new Error(`unknown language "${lang}"`);
    const book = await ask('Book id (e.g. DT)', values.book);
    const number = await ask('Number as printed', values.number);
    const native = await ask('Title (original script)', values.title);
    const roman = await ask(
      'Title in Roman letters (optional)',
      values.roman ?? (values.title ? '' : undefined),
    );
    let lines = values.line ?? [];
    if (!lines.length) {
      console.log('Type the first verse, one line at a time. Empty line to finish.');
      for (let l = await rl.question('> '); l.trim(); l = await rl.question('> ')) lines.push(l.trim());
    }
    lines = lines.filter(Boolean);

    const today = new Date().toISOString().slice(0, 10);
    const contentDir = join(process.cwd(), 'src', 'content');
    const plan = planNewSong(
      { lang, book, number, native, roman, en: values.en, lines, slug: values.slug, today },
      contentDir,
      process.env.PUBLIC_INCLUDE_DEMO === 'true',
    );
    if (plan.errors.length) {
      for (const e of plan.errors) console.error(`ERROR [${e.rule}] ${e.message}`);
      process.exitCode = 1;
      return;
    }
    if (values['dry-run']) {
      console.log(`Would write src/content/songs/${plan.relPath}:\n${plan.json}`);
      return;
    }
    const target = join(contentDir, 'songs', plan.relPath);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, plan.json, { flag: 'wx' });
    console.log(`Created src/content/songs/${plan.relPath}. Add the other verses in the CMS or your editor.`);
  } finally {
    rl.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e: unknown) => {
    console.error(`new-song: ${e instanceof Error ? e.message : String(e)}`);
    process.exitCode = 1;
  });
}
