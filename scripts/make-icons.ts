/**
 * One-off generator for the PWA icons in public/icons/ (committed, not run in CI).
 * Renders the gold "स्तु" mark on leather with the app's own Noto Sans Devanagari font,
 * so the result does not depend on fonts installed on this computer.
 *   npx tsx scripts/make-icons.ts
 */
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const root = process.cwd();
const font = readFileSync(
  join(
    root,
    'node_modules/@fontsource/noto-sans-devanagari/files/noto-sans-devanagari-devanagari-700-normal.woff2',
  ),
).toString('base64');

const LEATHER = '#4a1820';
const GOLD = '#e3b85c';

/** `scale` = mark size relative to the canvas; maskable icons keep the mark inside the 80% safe zone. */
const html = (size: number, scale: number, rounded: boolean) => `<!doctype html><html><head><style>
@font-face { font-family: Mark; src: url(data:font/woff2;base64,${font}) format('woff2'); font-weight: 700; }
html, body { margin: 0; width: ${size}px; height: ${size}px; background: transparent; }
.tile { width: ${size}px; height: ${size}px; display: grid; place-items: center; background: ${LEATHER};
  border-radius: ${rounded ? size * 0.22 : 0}px; }
.mark { font-family: Mark; font-weight: 700; color: ${GOLD}; font-size: ${Math.round(size * scale)}px; line-height: 1;
  transform: translateY(-${Math.round(size * 0.04)}px); }
</style></head><body><div class="tile"><span class="mark">स्तु</span></div></body></html>`;

const targets = [
  { file: 'icon-192.png', size: 192, scale: 0.42, rounded: false },
  { file: 'icon-512.png', size: 512, scale: 0.42, rounded: false },
  { file: 'maskable-512.png', size: 512, scale: 0.32, rounded: false },
  { file: 'apple-touch-icon.png', size: 180, scale: 0.42, rounded: false },
];

const out = join(root, 'public', 'icons');
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
for (const t of targets) {
  const page = await browser.newPage({ viewport: { width: t.size, height: t.size } });
  await page.setContent(html(t.size, t.scale, t.rounded));
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: join(out, t.file), omitBackground: true });
  await page.close();
  console.log(`icons/${t.file}`);
}
await browser.close();
