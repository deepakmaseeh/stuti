import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

/** Which @fontsource family each language's lyrics use (see --font-indic in tokens.css). */
const FAMILY: Record<string, string> = {
  hi: 'noto-serif-devanagari',
  ta: 'noto-sans-tamil',
  te: 'noto-sans-telugu',
  pa: 'noto-sans-gurmukhi',
};

/**
 * Map each Indic language to its built woff2 files (400 + 700), e.g.
 * { "ta": ["/_astro/noto-sans-tamil-tamil-400-normal.cIr4vgaa.woff2", ...] }.
 * Downloads cache these with the book so lyrics render in the right font offline.
 */
export function fontManifest(files: string[]): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [lang, family] of Object.entries(FAMILY)) {
    const re = new RegExp(`^${family}-[a-z-]+-(400|700)-normal\\.[\\w-]+\\.woff2$`);
    out[lang] = files
      .filter((f) => re.test(f))
      .sort()
      .map((f) => `/_astro/${f}`);
  }
  return out;
}

function main(): void {
  const dist = join(process.cwd(), 'dist');
  const manifest = fontManifest(readdirSync(join(dist, '_astro')));
  const missing = Object.entries(manifest).filter(([, urls]) => urls.length === 0);
  if (missing.length) {
    console.error(`font-manifest: no font files found for ${missing.map(([l]) => l).join(', ')}`);
    process.exit(1);
  }
  mkdirSync(join(dist, 'dl'), { recursive: true });
  writeFileSync(join(dist, 'dl', 'fonts.json'), JSON.stringify(manifest));
  console.log(
    `font-manifest: ${Object.entries(manifest)
      .map(([l, u]) => `${l}=${u.length}`)
      .join(' ')} → dist/dl/fonts.json`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
