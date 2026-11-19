import type { APIRoute } from 'astro';
import { site } from '../site.config';

// Built from site.url so a domain change only needs site.config.ts and astro.config.mjs.
export const GET: APIRoute = () =>
  new Response(
    [
      'User-agent: *',
      'Allow: /',
      'Disallow: /admin/',
      `Sitemap: ${new URL('/sitemap-index.xml', site.url).href}`,
      '',
    ].join('\n'),
    { headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
  );
