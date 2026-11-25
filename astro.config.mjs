import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';
import sitemap from '@astrojs/sitemap';
import AstroPWA from '@vite-pwa/astro';

// Keep `site` equal to site.config.ts → url (spec §2).
export default defineConfig({
  site: 'https://stuti.deepakmaseeh121.workers.dev',
  output: 'static',
  trailingSlash: 'always',
  build: { format: 'directory' },
  redirects: {
    '/song/hi-aao-pyaaron-sharan-maish-ki': '/song/hi-aao-pyaaron-sharan-masih-ki/',
    '/song/hi-aao-pyaaron-sharan-maish-ki/': '/song/hi-aao-pyaaron-sharan-masih-ki/',
  },
  integrations: [
    preact(),
    sitemap({
      filter: (p) => !p.includes('/admin/') && !p.includes('/no-connection/') && !p.includes('/settings/'),
    }),
    AstroPWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'prompt',
      injectRegister: false, // registered manually in Base.astro via workbox-window
      manifest: {
        name: 'Stuti Songs – Christian Hymnal',
        short_name: 'Stuti Songs',
        description: 'Christian songs in Hindi, Tamil, Telugu, Punjabi and English. Offline.',
        lang: 'en',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#fbf8f8',
        theme_color: '#4a1820',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          { name: 'Search songs', url: '/search/' },
          { name: 'Sunday set', url: '/sets/' },
        ],
      },
      injectManifest: {
        // Latin subsets only; Indic fonts come with their book (dl/fonts.json, scripts/font-manifest.ts).
        // Do not precache app HTML shells — NetworkFirst navigation keeps deploys fresh.
        // Keep offline fallback + shell data/assets only.
        globPatterns: [
          '_astro/**/*.{js,css}',
          '_astro/**/instrument-sans-latin-{400,600,700}-normal.*.woff2',
          '_astro/**/domine-latin-700-normal.*.woff2',
          'no-connection/index.html',
          'search/numbers.json',
          'search/meta.json',
          'icons/*.png',
          'favicon.svg',
        ],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
      },
      devOptions: { enabled: false },
    }),
  ],
});
