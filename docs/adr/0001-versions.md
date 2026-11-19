# 0001: Package versions and hosting limits

Date: 2026-11-19 · Status: accepted

## Checked

| Package          | Chosen  | Latest overall | Why                                                          |
| ---------------- | ------- | -------------- | ------------------------------------------------------------ |
| astro            | 5.18.2  | 7.4.13         | Last 5.x release. Spec v1.1 keeps v1 on Astro 5 (see 0002).  |
| @astrojs/preact  | 4.1.3   | 6.1.6          | Last major that supports Astro 5 (Vite 6).                   |
| preact           | 10.29.x | 11.2.0         | @astrojs/preact 4 requires `preact ^10`.                     |
| @astrojs/sitemap | 3.7.6   | 3.7.6          | No Astro peer restriction.                                   |
| @vite-pwa/astro  | 1.2.0   | 2.0.3          | 2.x needs Rolldown/Vite 8 (Astro 7). 1.2.0 supports Astro 5. |
| vite-plugin-pwa  | 1.3.0   | 2.0.0          | Peer of @vite-pwa/astro 1.x.                                 |
| zod              | 3.25.x  | 4.x            | Astro 5 content collections use Zod 3.                       |

Local development ran on Node 26; `.nvmrc` and Cloudflare use Node 22 (`engines: >=22`).

## Cloudflare Pages free tier (to re-check before launch)

Spec values: 500 builds/month, 20,000 files per deployment, 25 MiB max file size. The 20,000-file limit caps the static site at roughly 8,000 songs (spec §18.4).

## Risk

Astro 5 is two majors behind the current release. It may receive only limited security fixes. The app is a static site with no server code, which keeps the exposure low, but plan the upgrade soon after v1 launch (0002).
