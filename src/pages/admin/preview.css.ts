import type { APIRoute } from 'astro';
import tokens from '../../styles/tokens.css?raw';
import lyrics from '../../styles/lyrics.css?raw';

// The CMS preview pane (public/admin/preview.js) uses the real lyric styles, so editors see what readers see.
// Fonts are left to the system here: the hashed @fontsource files aren't reachable from the CMS iframe.
const extra = `
body { margin: 0; padding: 16px; background: var(--paper); color: var(--ink);
  font-family: system-ui, sans-serif; line-height: var(--lh-latin); }
:lang(hi), :lang(ta), :lang(te), :lang(pa) { line-height: var(--lh-indic); }
.pv-nums { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }
.pv-num { padding: 2px 8px; border-radius: 6px; background: var(--leather); color: var(--gold-soft); font-weight: 700; }
.pv-title { margin: 0 0 4px; font-size: 1.6rem; }
.pv-sub { margin: 0 0 16px; color: var(--muted); }
.pv-warn { margin: 0 0 12px; padding: 8px 12px; border-radius: 8px; background: #fff3cd; color: #5c4400; }
`;

export const GET: APIRoute = () =>
  new Response(`${tokens}\n${lyrics}\n${extra}`, { headers: { 'Content-Type': 'text/css; charset=utf-8' } });
