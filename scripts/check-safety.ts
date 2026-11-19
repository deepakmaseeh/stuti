/**
 * Guards two project rules in CI:
 *  1. Content is text only: no HTML-injection APIs in src/ (the one allowed exception is
 *     `set:html={safeJsonLd(...)}` for JSON-LD, docs/adr/0003-json-ld-set-html.md).
 *  2. No trackers, ads, external fonts or CDNs: the built site loads scripts, styles and fonts from
 *     its own origin only (optional Cloudflare Web Analytics excepted). /admin/ is exempt (Decap from unpkg).
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';

export type Finding = { file: string; line: number; message: string };
type TextFile = { path: string; text: string };

const SOURCE_RULES: { re: RegExp; message: string }[] = [
  {
    re: /set:html(?!=\{safeJsonLd\()/,
    message: 'set:html renders HTML; content must be text (only safeJsonLd is allowed)',
  },
  { re: /dangerouslySetInnerHTML/, message: 'dangerouslySetInnerHTML renders HTML; content must be text' },
  {
    re: /\.(innerHTML|outerHTML)\s*[+]?=/,
    message: 'innerHTML/outerHTML assignment; build DOM nodes or use textContent',
  },
  {
    re: /insertAdjacentHTML|document\.write\s*\(/,
    message: 'HTML-injection API; use DOM nodes or textContent',
  },
];

const TRACKERS =
  /googletagmanager|google-analytics|doubleclick|facebook\.net|connect\.facebook|hotjar|mixpanel|segment\.(io|com)|clarity\.ms|fonts\.googleapis|fonts\.gstatic|cdn\.jsdelivr|cdnjs\.cloudflare|unpkg\.com/i;

const ALLOWED_EXTERNAL = ['https://static.cloudflareinsights.com/'];

function lines(text: string, re: RegExp, file: string, message: string): Finding[] {
  const out: Finding[] = [];
  text.split('\n').forEach((l, i) => {
    if (re.test(l)) out.push({ file, line: i + 1, message });
  });
  return out;
}

/** Source files under src/ (and public/, minus /admin/) */
export function scanSource(files: TextFile[]): Finding[] {
  const out: Finding[] = [];
  for (const f of files) {
    const p = f.path.replace(/\\/g, '/');
    // /admin is allowed Decap from unpkg (public shell + Astro route for `astro dev`).
    if (p.startsWith('public/admin/') || p.startsWith('src/pages/admin/') || p === 'public/_headers') continue;
    if (p.startsWith('src/')) for (const r of SOURCE_RULES) out.push(...lines(f.text, r.re, p, r.message));
    out.push(...lines(f.text, TRACKERS, p, 'third-party tracker, font or CDN host'));
  }
  return out;
}

const EXTERNAL_REFS = [
  /<script\b[^>]*\bsrc=["']?(https?:)?\/\/([^"'\s>]+)/gi,
  /<link\b[^>]*\bhref=["']?(https?:)?\/\/([^"'\s>]+)/gi,
  /@import\s+(?:url\()?["']?(https?:)?\/\/([^"')\s]+)/gi,
  /url\(\s*["']?(https?:)?\/\/([^"')\s]+)/gi,
];

/** Built HTML/CSS/JS in dist/ (minus /admin/): every script, stylesheet, font or import must be same-origin. */
export function scanDist(files: TextFile[]): Finding[] {
  const out: Finding[] = [];
  for (const f of files) {
    const p = f.path.replace(/\\/g, '/');
    if (p.startsWith('admin/')) continue;
    for (const re of EXTERNAL_REFS) {
      for (const m of f.text.matchAll(re)) {
        const url = `https://${m[2]}`;
        // <link rel="canonical"/"alternate"> point at our own site URL, they load nothing.
        if (
          /^<link\b/i.test(m[0]) &&
          !/rel=["']?(stylesheet|preload|modulepreload|icon|manifest|prefetch)/i.test(m[0])
        )
          continue;
        if (ALLOWED_EXTERNAL.some((a) => url.startsWith(a))) continue;
        const line = f.text.slice(0, m.index).split('\n').length;
        out.push({ file: `dist/${p}`, line, message: `loads from another origin: ${url}` });
      }
    }
  }
  return out;
}

function walk(dir: string, exts: RegExp, base = dir, out: TextFile[] = []): TextFile[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, exts, base, out);
    else if (exts.test(name)) out.push({ path: relative(base, full), text: readFileSync(full, 'utf8') });
  }
  return out;
}

function main(): void {
  const tracked = execFileSync('git', ['ls-files', 'src', 'public'], { encoding: 'utf8' })
    .split('\n')
    .filter((p) => /\.(astro|tsx?|jsx?|mjs|css|html|json|webmanifest|txt)$/.test(p) && existsSync(p));
  const findings = scanSource(tracked.map((path) => ({ path, text: readFileSync(path, 'utf8') })));
  if (existsSync('dist')) findings.push(...scanDist(walk('dist', /\.(html|css|js)$/)));
  else console.log('check-safety: no dist/ yet, checked sources only (run after npm run build in CI)');

  for (const f of findings) console.error(`${f.file}:${f.line}  ${f.message}`);
  if (findings.length) {
    console.error(`\ncheck-safety: ${findings.length} problem(s)`);
    process.exitCode = 1;
  } else console.log('check-safety: OK (text-only content, no third-party scripts, styles or fonts)');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
