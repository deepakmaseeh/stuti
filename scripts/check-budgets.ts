/**
 * Size budgets from STUTI_BUILD_SPEC.md §19.3 + STUTI_DESKTOP_ADDON.md §10,
 * measured on dist/ (gzip level 9):
 *  - every song page HTML ≤ 30 KB
 *  - JS loaded by a song page (scripts + islands + static imports) ≤ 60 KB
 *    (pptxgenjs is dynamic-import only and must not count)
 *  - first load of the key pages (HTML + CSS + JS, excluding fonts) ≤ 150 KB
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';

export const BUDGETS = { songHtml: 30_000, songJs: 60_000, firstLoad: 150_000 };
const KEY_PAGES = [
  'index.html',
  'search/index.html',
  'song/ta-yesuve-en-thunai/index.html',
  'set/index.html',
];

const gz = (s: string | Buffer) => gzipSync(s, { level: 9 }).length;
const kb = (n: number) => `${(n / 1000).toFixed(1)} KB`;

/** Same-origin asset paths a page loads up front: scripts, island components/renderers, modulepreloads, stylesheets. */
export function pageAssets(html: string): { js: string[]; css: string[] } {
  const js = new Set<string>();
  const css = new Set<string>();
  for (const m of html.matchAll(/<script\b[^>]*\bsrc="(\/[^"]+\.js)"/g)) js.add(m[1]!);
  for (const m of html.matchAll(/\b(?:component-url|renderer-url)="(\/[^"]+\.js)"/g)) js.add(m[1]!);
  for (const m of html.matchAll(/<link\b[^>]*rel="modulepreload"[^>]*href="(\/[^"]+\.js)"/g)) js.add(m[1]!);
  for (const m of html.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*href="(\/[^"]+\.css)"/g)) css.add(m[1]!);
  return { js: [...js], css: [...css] };
}

/** Static imports of an ES module (`import"./x.js"`, `from"./x.js"`); dynamic `import()` is excluded. */
export function staticImports(code: string): string[] {
  return [...code.matchAll(/(?:\bfrom\s*|\bimport\s*)["'](\.{1,2}\/[^"']+\.js)["']/g)].map((m) => m[1]!);
}

function resolveJs(dist: string, entries: string[]): Map<string, number> {
  const seen = new Map<string, number>();
  const queue = [...entries];
  while (queue.length) {
    const url = queue.pop()!;
    if (seen.has(url)) continue;
    const file = join(dist, url);
    if (!existsSync(file)) continue;
    const code = readFileSync(file, 'utf8');
    seen.set(url, gz(code));
    const dir = url.slice(0, url.lastIndexOf('/') + 1);
    for (const rel of staticImports(code)) queue.push(new URL(rel, `http://x${dir}`).pathname);
  }
  return seen;
}

function main(dist = 'dist'): void {
  if (!existsSync(dist)) {
    console.error('check-budgets: run npm run build first');
    process.exit(1);
  }
  const problems: string[] = [];

  let largest = { page: '', size: 0 };
  for (const slug of readdirSync(join(dist, 'song'))) {
    const file = join(dist, 'song', slug, 'index.html');
    if (!existsSync(file)) continue;
    const size = gz(readFileSync(file));
    if (size > largest.size) largest = { page: `/song/${slug}/`, size };
    if (size > BUDGETS.songHtml) problems.push(`/song/${slug}/ HTML ${kb(size)} > ${kb(BUDGETS.songHtml)}`);
  }
  console.log(`song HTML (largest ${largest.page}): ${kb(largest.size)} / ${kb(BUDGETS.songHtml)}`);

  for (const page of KEY_PAGES) {
    const html = readFileSync(join(dist, page), 'utf8');
    const { js, css } = pageAssets(html);
    const jsTotal = [...resolveJs(dist, js).values()].reduce((a, b) => a + b, 0);
    const cssTotal = css.reduce((a, c) => a + gz(readFileSync(join(dist, c))), 0);
    const total = gz(html) + jsTotal + cssTotal;
    const url = `/${page.replace(/index\.html$/, '')}`;
    console.log(`${url.padEnd(30)} first load ${kb(total)} (JS ${kb(jsTotal)}, CSS ${kb(cssTotal)})`);
    if (total > BUDGETS.firstLoad) problems.push(`${url} first load ${kb(total)} > ${kb(BUDGETS.firstLoad)}`);
    if (page.startsWith('song/') && jsTotal > BUDGETS.songJs)
      problems.push(`${url} JS ${kb(jsTotal)} > ${kb(BUDGETS.songJs)}`);
  }

  if (problems.length) {
    for (const p of problems) console.error(`over budget: ${p}`);
    process.exit(1);
  }
  console.log('check-budgets: OK');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
