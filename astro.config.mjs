import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';
import sitemap from '@astrojs/sitemap';
// import AstroPWA from '@vite-pwa/astro'; // enabled in Phase 5

// Keep `site` equal to site.config.ts → url (spec §2).
export default defineConfig({
  site: 'https://stuti.pages.dev',
  output: 'static',
  trailingSlash: 'always',
  build: { format: 'directory' },
  integrations: [
    preact(),
    sitemap({ filter: (p) => !p.includes('/admin/') && !p.includes('/no-connection/') }),
    // Phase 5: AstroPWA (spec §12.1) goes here.
  ],
});
