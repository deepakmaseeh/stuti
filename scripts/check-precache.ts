import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const LIMIT = 1.5 * 1024 * 1024;

/** Precache URLs injected into dist/sw.js by workbox (`{url:"…",revision:…}` or `"url":"…"`). */
export function precacheUrls(swSource: string): string[] {
  const urls = new Set<string>();
  for (const m of swSource.matchAll(/["']?url["']?\s*:\s*["']([^"']+)["']/g)) urls.add(m[1]!);
  return [...urls];
}

function main(): void {
  const dist = join(process.cwd(), 'dist');
  const sw = join(dist, 'sw.js');
  if (!existsSync(sw)) {
    console.error('check-precache: dist/sw.js not found. Run `npm run build` first.');
    process.exit(1);
  }
  const files = precacheUrls(readFileSync(sw, 'utf8')).map((u) => {
    const path = join(dist, decodeURI(u.replace(/^\//, '')));
    return { url: u, bytes: existsSync(path) ? statSync(path).size : 0, exists: existsSync(path) };
  });
  const missing = files.filter((f) => !f.exists);
  const total = files.reduce((s, f) => s + f.bytes, 0);
  const kb = (n: number) => `${(n / 1024).toFixed(1)} KB`;

  console.log(`Precache: ${files.length} files, ${kb(total)} (limit ${kb(LIMIT)})\n`);
  console.log('Biggest 10:');
  for (const f of [...files].sort((a, b) => b.bytes - a.bytes).slice(0, 10))
    console.log(`  ${kb(f.bytes).padStart(10)}  ${f.url}`);

  if (missing.length) {
    console.error(
      `\ncheck-precache: ${missing.length} precached URL(s) missing from dist: ${missing.map((f) => f.url).join(', ')}`,
    );
    process.exit(1);
  }
  if (files.length === 0) {
    console.error('\ncheck-precache: no precache entries found in dist/sw.js');
    process.exit(1);
  }
  if (total > LIMIT) {
    console.error(`\ncheck-precache: FAILED, precache is ${kb(total)} (> ${kb(LIMIT)})`);
    process.exit(1);
  }
  console.log('\ncheck-precache: OK');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
