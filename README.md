# Stuti

A free, ad-free, offline-first digital hymnal for Indian churches: Hindi, Tamil, Telugu, Punjabi and English. Every song shows the original script, a Roman transliteration and an English meaning, with the same number as the printed hymnbook.

- Specification: [`STUTI_BUILD_SPEC.md`](STUTI_BUILD_SPEC.md) (v1.1)
- Fixes, independence rules and publishing steps: [`STUTI_FIXES_AND_LAUNCH.md`](STUTI_FIXES_AND_LAUNCH.md)
- Rules for AI coding agents: [`AGENTS.md`](AGENTS.md)
- Editing songs, style and rights rules: [`CONTRIBUTING.md`](CONTRIBUTING.md)

## Setup

Requires Node 22 or newer (`.nvmrc` pins 22 for hosting).

```bash
npm ci
cp .env.example .env   # PUBLIC_INCLUDE_DEMO=true while demo songs are published
npm run dev            # http://localhost:4321
```

## Scripts

| Command                  | What it does                                                                                                                        |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`            | Build search indexes, then the local dev server                                                                                     |
| `npm run validate`       | Check every book and song file (schema, numbers, scripts, rights)                                                                   |
| `npm run build`          | Validate, build indexes, static build into `dist/`, font list for downloads                                                         |
| `npm run preview`        | Serve the built site (the service worker only runs here, not in `dev`)                                                              |
| `npm run check-precache` | Fail if the offline app shell is over 1.5 MB                                                                                        |
| `npm run check-budgets`  | Fail if song HTML > 30 KB, song JS > 40 KB or first load > 150 KB (gzip)                                                            |
| `npm run check-safety`   | Fail on HTML-injection APIs or any third-party script, style or font                                                                |
| `npm run lhci`           | Lighthouse CI on the built site (`lighthouserc.json` budgets)                                                                       |
| `npm run check`          | Type-check Astro, TS and TSX (`astro check`)                                                                                        |
| `npm test`               | Unit tests (Vitest)                                                                                                                 |
| `npm run test:e2e`       | Browser tests (Playwright) on Pixel 5, iPhone 12, desktop + `_headers` checks under `wrangler pages dev`; run `npm run build` first |
| `npm run new-song`       | Create a draft song file that passes validation                                                                                     |
| `npm run lint`           | ESLint                                                                                                                              |
| `npm run format`         | Prettier                                                                                                                            |

Content tools for digitising hymnbooks (OCR, transliteration, form import) are Python scripts in
[`tools/`](tools/README.md).

## Stack

Astro 5 (static) + Preact islands, plain CSS, MiniSearch, PWA via @vite-pwa/astro, Decap CMS, Cloudflare Pages. Details and reasons: spec §3, `docs/adr/`.

## Deploy

Hosting is Cloudflare Pages (free plan), connected to this GitHub repo. Every push to `main` deploys the live
site; every pull request gets its own preview URL (use it to proofread on your phone). Full step-by-step guide:
`STUTI_FIXES_AND_LAUNCH.md` §3.

**Cloudflare Pages settings** (Workers & Pages → Create → Pages → Connect to Git → this repo):

| Setting                | Value           |
| ---------------------- | --------------- |
| Production branch      | `main`          |
| Framework preset       | Astro           |
| Build command          | `npm run build` |
| Build output directory | `dist`          |

**Environment variables** (set for both Production and Preview):

| Variable                    | Value                                                                                                |
| --------------------------- | ---------------------------------------------------------------------------------------------------- |
| `NODE_VERSION`              | `22`                                                                                                 |
| `PUBLIC_INCLUDE_DEMO`       | `true` until real books are live; **remove at launch** (also from both workflows and `.env.example`) |
| `PUBLIC_REPORT_FORM_URL`    | Your Google Form prefill base URL (field IDs go in `src/site.config.ts`)                             |
| `PUBLIC_CF_ANALYTICS_TOKEN` | Optional cookieless Cloudflare Web Analytics token. Empty = no analytics                             |

None of these are secrets: `PUBLIC_*` values end up in the built pages. The only secret (the GitHub OAuth client
secret) lives in the auth Worker, see below.

After the first deploy, put the exact site URL (e.g. `https://stuti.pages.dev`) in `src/site.config.ts` → `url` and
`astro.config.mjs` → `site` (sitemap, canonical links and `robots.txt` use it), and commit.

`public/_headers` sets the security headers (strict Content-Security-Policy site-wide, a relaxed one for `/admin/`
only) and caching (hashed `/_astro/` files cached for a year, `sw.js` and `/dl/` never cached). Check them locally
with `npx wrangler pages dev dist`; `tests/e2e/admin.spec.ts` does this automatically.

**Checks on every pull request** (`.github/workflows/`): `validate` (independence check, content validation, unit
and Python tests, lint, type check, build, precache/budget/safety checks, Lighthouse) and `e2e` (Playwright). Protect
`main` so both must pass. Dependabot opens weekly update PRs (Astro majors are ignored for v1).

Before launch, work through the **Launch checklist** issue template (Issues → New issue).

## Editor login for `/admin` (GitHub OAuth on a Cloudflare Worker)

The CMS at `/admin/` signs editors in with GitHub. GitHub needs a small server to finish the login, because the
**OAuth client secret must never be in this repo or in the browser**. We use a free Cloudflare Worker:
[`sveltia-cms-auth`](https://github.com/sveltia/sveltia-cms-auth). It speaks the same login protocol as Decap
(`/auth` and `/callback`, `authorization:github:success` message).

All accounts are your own (GitHub, Cloudflare), with two-factor authentication on.

1. **Deploy the worker.** Use the "Deploy to Cloudflare Workers" button in that repo's README, or clone it and run
   `npx wrangler deploy`. Note the Worker URL, e.g. `https://sveltia-cms-auth.<your-subdomain>.workers.dev`.
2. **Create a GitHub OAuth App:** GitHub → Settings → Developer settings → OAuth Apps → New OAuth App.
   - Homepage URL: your site, e.g. `https://stuti.pages.dev`
   - Authorization callback URL: `<Worker URL>/callback`
   - Generate a client secret. Copy the Client ID and the secret.
3. **Store them as Worker secrets** (never in a file):
   ```bash
   npx wrangler secret put GITHUB_CLIENT_ID
   npx wrangler secret put GITHUB_CLIENT_SECRET
   ```
   Also set `ALLOWED_DOMAINS` to your site's hostname only (e.g. `stuti.pages.dev`), in the Worker's settings.
4. **Point the CMS at it:** in [`public/admin/config.yml`](public/admin/config.yml) set `backend.repo` to
   `<your-github-user>/stuti` and `backend.base_url` to the Worker URL. Commit and deploy.
5. **Test:** open `https://<site>/admin/` → Login with GitHub → you should see Books and the five Songs
   collections. Create a test song, and check that it opens a pull request that passes the checks.

Editors need **write access** to the repo. To add someone: repo → Settings → Collaborators. Add their username to
[`.github/CODEOWNERS`](.github/CODEOWNERS) for their language folder.

If you ever leak the client secret: GitHub → your OAuth App → generate a new secret, delete the old one, and run
`npx wrangler secret put GITHUB_CLIENT_SECRET` again.

The Decap CMS script is loaded from unpkg on `/admin/` only, pinned to an exact version in
[`public/admin/index.html`](public/admin/index.html). To upgrade: change the version, then test `/admin/` (login,
edit, preview) before merging.
