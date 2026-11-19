# Stuti

A free, ad-free, offline-first digital hymnal for Indian churches: Hindi, Tamil, Telugu, Punjabi and English. Every song shows the original script, a Roman transliteration and an English meaning, with the same number as the printed hymnbook.

- Specification: [`STUTI_BUILD_SPEC.md`](STUTI_BUILD_SPEC.md) (v1.1)
- Fixes, independence rules and publishing steps: [`STUTI_FIXES_AND_LAUNCH.md`](STUTI_FIXES_AND_LAUNCH.md)
- Rules for AI coding agents: [`AGENTS.md`](AGENTS.md)

## Setup

Requires Node 22 or newer (`.nvmrc` pins 22 for hosting).

```bash
npm ci
cp .env.example .env   # PUBLIC_INCLUDE_DEMO=true while demo songs are published
npm run dev            # http://localhost:4321
```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Local dev server |
| `npm run build` | Static build into `dist/` |
| `npm run preview` | Serve the built site |
| `npm test` | Unit tests (Vitest) |
| `npm run lint` | ESLint |
| `npm run format` | Prettier |

More scripts (validate, indexes, e2e, Lighthouse, precache check) are added in later phases (spec §18.1).

## Stack

Astro 5 (static) + Preact islands, plain CSS, MiniSearch, PWA via @vite-pwa/astro, Decap CMS, Cloudflare Pages. Details and reasons: spec §3, `docs/adr/`.

## Deploy

Cloudflare Pages, connected to this GitHub repo. Step-by-step: `STUTI_FIXES_AND_LAUNCH.md` §3.
