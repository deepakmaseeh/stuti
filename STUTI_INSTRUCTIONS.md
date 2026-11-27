# Stuti Songs — Complete Application Instructions (Handoff)

**Purpose:** Single source of truth so another IDE / developer can continue work without tribal knowledge.  
**Last verified:** 2026-11-28  
**App name:** Stuti Songs  
**Package name:** `stuti` (`package.json` version `0.1.0`)  
**License:** MIT  
**Active UI branch:** `v3-ui` (Phases 1–7 + admin finish). Production deploy from this branch via Wrangler.

---

## 0. What this product is

Stuti Songs is a **free, ad-free, offline-first digital hymnal** for Indian churches. Songs show:

- **Native script** (Hindi Devanagari today; Tamil / Telugu / Punjabi folders exist but are empty)
- **Roman transliteration**
- **English meaning**

Same hymn numbers as the printed books. Progressive Web App (installable, offline).

**Not part of the product:** ClickUp (CI fails if `clickup` appears in tracked code outside allowed spec markdown). No ads, no third-party fonts/CDNs on the public app (except Decap on `/admin/cms/` from unpkg, and optional Cloudflare Web Analytics).

---

## 1. Live URLs and accounts

| What | Value |
|------|--------|
| **Live site** | https://stuti.deepakmaseeh121.workers.dev |
| **API report endpoint** | `POST https://stuti.deepakmaseeh121.workers.dev/api/report` |
| **v3 Admin** | https://stuti.deepakmaseeh121.workers.dev/admin/ (`FLAGS.admin = true`) |
| **Legacy Decap CMS** | https://stuti.deepakmaseeh121.workers.dev/admin/cms/ |
| **CMS OAuth Worker (Decap)** | https://stuti-cms-auth.deepakmaseeh121.workers.dev |
| **GitHub repo** | https://github.com/deepakmaseeh/stuti |
| **Git remote** | `origin` → `https://github.com/deepakmaseeh/stuti.git` |
| **Default branch** | `main` (feature work on `v3-ui`) |
| **Cloudflare login** | `deepakmaseeh121@gmail.com` |
| **Cloudflare Account ID** | `50f1a53b9c2e02de2d6c73eaa199a2eb` |
| **Wrangler credentials file** | `C:\Users\Asus\AppData\Roaming\xdg.config\.wrangler\config\default.toml` (machine-local) |
| **Maker / credits** | Excel Tech Solutions — see `src/site.config.ts` → `maker` |
| **Maker site** | https://exceltechsolutions.com/ |

### Google Form / Sheet (reports) — church account

| What | Value |
|------|--------|
| **Google account used for Form** | `godisourlord8874@gmail.com` (Chrome profile `/u/3/` when editing) |
| **Form title** | Stuti Songs – Corrections |
| **Published form (view)** | https://docs.google.com/forms/d/e/1FAIpQLSdRQ6H1NP4BwxxJYYrl2otDt1YDa3AaPvE8R2jIkDH9KVhfzQ/viewform |
| **Form action (Worker POST)** | `https://docs.google.com/forms/d/e/1FAIpQLSdRQ6H1NP4BwxxJYYrl2otDt1YDa3AaPvE8R2jIkDH9KVhfzQ/formResponse` |
| **Form must allow** | Anyone with the link can respond (Publish). No sign-in required. Limit to 1 response = off. Collect email = Do not collect. |
| **Linked Sheet** | Created/linked from Form → Responses → Sheets (name typically **Stuti Songs – Corrections**) |

> Older Sheet ID `1KbZZjf5b6_EFYMa8zKIqxT2KZuqisx_u_3hpQYosn84` was referenced during setup and may be gone; always open the Sheet from the Form’s **Responses** tab.

---

## 2. Spec / docs override order (read before coding UI)

| Priority | File | Role |
|----------|------|------|
| 1 (wins) | `STUTI_MASTER_SPEC.md` | UI + build steps §0–§25 |
| 2 | `STUTI_SETLISTS_AND_FIXES.md` | Sets / PPT / Present fixes |
| 3 | `STUTI_DESKTOP_ADDON.md` | Desktop panes ≥900 / ≥1280 |
| 4 | `STUTI_FIXES_AND_LAUNCH.md` | Launch, independence, hosting notes |
| 5 | `STUTI_BUILD_SPEC.md` | Full product/build spec v1.1 |
| Agent rules | `AGENTS.md` | Hard rules for AI agents |
| Reports ops | `docs/REPORTS_SETUP.md` | Form → Sheet → Worker secrets |
| Visual ref (Order of Service / PPT / Present only) | `docs/design/stuti-ui-recommendations-v1.4.html` | Master spec wins on conflict |
| ADRs | `docs/adr/*.md` | Decisions (stay on Astro 5, setlists, fonts, etc.) |
| Contributing | `CONTRIBUTING.md` | Song editing / rights |
| This file | `STUTI_INSTRUCTIONS.md` | Ops + handoff truth |

**Superseded patch specs (do not treat as current UI source):**  
`STUTI_FINAL_UI_SPEC.md`, `STUTI_UI_CORRECTIONS_v1.4.md`, `STUTI_THEME_ICONS_REPORTS.md`, `STUTI_RESPONSIVE_FIXES.md`, `STUTI_AUDIT_24NOV.md`.

---

## 3. Stack — what and why

| Layer | Choice | Why |
|-------|--------|-----|
| Framework | **Astro 5.x** (`output: 'static'`) | Song pages = static HTML; no JS required to read lyrics. Do **not** upgrade to Astro 6 (ADR 0002). |
| Islands | **Preact** + `@astrojs/preact` | Small interactive bits (search, sets, report, theme). |
| CSS | Plain CSS under `src/styles/` | No Tailwind/CSS-in-JS; design tokens / `[data-scheme]` theme. |
| Search | **MiniSearch** + prebuilt JSON indexes | Client search without a server. |
| PWA | `@vite-pwa/astro` **injectManifest** + `src/sw.ts` | Offline shell; register via workbox-window in layout. |
| Validation | **Zod** in `src/lib/schema.ts` | Song/book schema at content boundary. |
| CMS | **Decap CMS** at `/admin/` | Editors edit JSON via GitHub PRs. |
| Hosting (actual) | **Cloudflare Worker** `stuti` + **Workers Assets** from `dist/` | `workers/report.ts` serves static assets **and** `POST /api/report`. |
| Deploy tool | **Wrangler** ≥4.165 | `npx wrangler deploy` after `npm run build`. |
| Icons | Lucide (`lucide-preact` / `astro-icon` + `@iconify-json/lucide`); WhatsApp via `simple-icons` only. |
| Fonts | `@fontsource/*` self-hosted | No Google Fonts CDN. |
| PPT export | `pptxgenjs` | Share / set export. |
| QR | `qrcode` | Share / QR sheet. |

**README still mentions Cloudflare Pages Git connect.** That is the *original* free-hosting plan in `STUTI_FIXES_AND_LAUNCH.md` §3. **Current production** is the Worker named `stuti` on `*.workers.dev` (assets + API). Prefer documenting Worker deploy unless/until you migrate to Pages + separate API.

---

## 4. Local development

### Requirements

- **Node ≥ 22** (`.nvmrc` = `22`)
- npm (lockfile: `package-lock.json` — use `npm ci`)
- Optional: Python 3 for `tools/` content scripts and CI `tools/tests`
- Cloudflare login for deploy: `npx wrangler login` (account above)

### First-time setup

```bash
cd "D:\sstuti song"   # or your clone path
npm ci
cp .env.example .env
# Edit .env as needed (see §6). Do NOT set PUBLIC_INCLUDE_DEMO=true for production catalog.
npm run dev           # builds indexes then http://localhost:4321
```

### Everyday commands

| Command | What / why |
|---------|------------|
| `npm run validate` | Schema, numbers, scripts, rights on all books/songs |
| `npm run indexes` | Writes `public/search/*`, `public/dl/*`, `public/data/*` (gitignored generated) |
| `npm run build` | `prebuild` = validate + indexes → `astro build` → `postbuild` font-manifest |
| `npm run preview` | Serve `dist/` (service worker runs here, **not** in `dev`) |
| `npm test` | Vitest unit tests |
| `npm run test:e2e` | Playwright (build first); Pixel 5, iPhone 12, desktop |
| `npm run check` | `astro check` |
| `npm run lint` / `format` | ESLint / Prettier |
| `npm run check-precache` | Offline shell ≤ 1.5 MB |
| `npm run check-budgets` | Song HTML/JS / first-load gzip budgets |
| `npm run check-safety` | Ban `set:html` / third-party script/font leaks |
| `npm run lhci` | Lighthouse CI (`lighthouserc.json`) |
| `npm run new-song` | Scaffold a draft song JSON that validates |

### Deploy to live (current process)

```bash
npm run build
npx wrangler deploy
```

- `wrangler.toml` → Worker name `stuti`, `main = workers/report.ts`, assets from `./dist`
- `run_worker_first = ["/api/*"]` so report API is not served as static files
- After code changes to the Worker or static site: **build + deploy**
- After secret-only changes: `wrangler secret put …` updates live without a full asset rebuild (still redeploy if Worker code changed)

### Git habit from specs

UI rebuild used commit tags `v3-shell` … `v3-tests` (`STUTI_MASTER_SPEC.md` §1). Prefer conventional short messages; do not invent features beyond the master spec.

---

## 5. Repository layout (what lives where)

```
stuti/
├── AGENTS.md                 # AI agent hard rules
├── STUTI_*.md                # Specs (see §2)
├── STUTI_INSTRUCTIONS.md     # THIS file
├── README.md                 # Quick start (Pages wording may lag reality)
├── CONTRIBUTING.md
├── package.json / package-lock.json
├── astro.config.mjs          # site URL, PWA, redirects
├── wrangler.toml             # Worker + assets + APP_ORIGIN + rate limit
├── tsconfig.json, vitest.config.ts, playwright.config.ts, eslint.config.js
├── .env.example              # Public env template (committed)
├── .env                      # Local only (gitignored)
├── workers/
│   └── report.ts             # ASSETS fetch + POST /api/report → Google Form
├── src/
│   ├── site.config.ts        # ALL configurable names/URLs/layout (no hardcodes elsewhere)
│   ├── content.config.ts     # Astro content collections
│   ├── content/
│   │   ├── books/*.json      # TLBC, TLBE, XMAS, SS
│   │   └── songs/{en,hi,ta,te,pa}/*.json
│   ├── pages/                # Routes (§7)
│   ├── components/islands/   # Preact islands
│   ├── layouts/, styles/, i18n/, lib/, sw.ts
│   └── env.d.ts
├── public/
│   ├── admin/                # Decap CMS (config.yml, index.html, preview.js)
│   ├── icons/, favicon.svg
│   ├── _headers, _redirects  # CSP, cache (used when hosting understands them)
│   ├── search/, dl/, data/   # GENERATED by indexes (gitignored)
│   └── uploads/              # CMS media
├── scripts/                  # Node/tsx build & content tools
├── tests/                    # unit + e2e + fixtures
├── tools/                    # Python digitisation helpers
├── docs/                     # ADR, design HTML, REPORTS_SETUP.md
└── .github/workflows/        # validate.yml, e2e.yml
```

**Generated / ignored:** `dist/`, `node_modules/`, `.astro/`, `.wrangler/`, `public/search/`, `public/dl/`, `public/data/`, `.env`.

---

## 6. Environment variables and secrets

### Public / build-time (`.env` or host env) — end up in client bundles if `PUBLIC_*`

| Variable | Purpose | Production stance |
|----------|---------|-------------------|
| `PUBLIC_INCLUDE_DEMO` | Publish `rights.status === 'demo'` songs | **Do not enable** for real TLBC catalog |
| `PUBLIC_REPORT_FORM_URL` | Legacy client prefill URL | Optional; **Send does not use this** — Worker posts `formResponse` |
| `PUBLIC_CF_ANALYTICS_TOKEN` | Cloudflare Web Analytics | Empty = no analytics |

Copy from `.env.example`. Never commit `.env`.

### v3 Admin (`FLAGS.admin = true`)

| Item | Detail |
|------|--------|
| UI | `src/components/islands/AdminApp.tsx` at `/admin/` (also `/admin/v3/`) |
| Flag | `src/config/flags.ts` → `admin: true` (Settings shows **Editor sign-in**) |
| API guard | Cloudflare Access email **or** free `ADMIN_PASSWORD` cookie (no Zero Trust required) |
| Endpoints | `POST /api/admin/login`, `POST /api/admin/logout`, `GET /api/admin/me`, `GET /api/admin/reports`, `POST /api/admin/oembed`, `POST /api/admin/publish` |
| Save draft | localStorage + JSON download |
| Publish | GitHub Contents API when `GITHUB_TOKEN` set; else downloads JSON |
| Mark fixed | Browser overlay + remind editor to set Sheet Status=Fixed |
| **Setup** | `npx wrangler secret put ADMIN_PASSWORD` then open `/admin/` and sign in |

### Worker secrets (Cloudflare — **not** in git)

Set only via Wrangler on Worker `stuti`:

```bash
npx wrangler secret put GOOGLE_FORM_ACTION_URL
npx wrangler secret put GOOGLE_FORM_ENTRIES
npx wrangler secret put GOOGLE_SHEET_CSV_URL
npx wrangler secret put ADMIN_PASSWORD
# optional:
npx wrangler secret put GOOGLE_SHEET_URL
npx wrangler secret put GITHUB_TOKEN
```

**Currently configured (names only):** `GOOGLE_FORM_ACTION_URL`, `GOOGLE_FORM_ENTRIES`, `GOOGLE_SHEET_CSV_URL`, plus `ADMIN_PASSWORD` after free-password setup.

**Form entry map (2026-11-25):**

`GOOGLE_FORM_ACTION_URL`:

```text
https://docs.google.com/forms/d/e/1FAIpQLSdRQ6H1NP4BwxxJYYrl2otDt1YDa3AaPvE8R2jIkDH9KVhfzQ/formResponse
```

`GOOGLE_FORM_ENTRIES` (JSON map app field → Form entry id). Assumes prefilled-link order matched Form question order top→bottom:

```json
{
  "id": "entry.194365707",
  "status": "entry.665216194",
  "book": "entry.293833546",
  "no": "entry.424351053",
  "title": "entry.961242051",
  "layer": "entry.1569295586",
  "stanzaLabel": "entry.523501437",
  "lineIndex": "entry.1689110231",
  "kind": "entry.454287372",
  "current": "entry.1020309537",
  "suggested": "entry.1737743709",
  "note": "entry.963707612",
  "name": "entry.882149451",
  "church": "entry.514585824",
  "contact": "entry.238181495",
  "appVersion": "entry.19711714",
  "dataVersion": "entry.535866620",
  "url": "entry.2040071090"
}
```

Verify listing:

```bash
npx wrangler secret list
```

**Removed / do not use:** `SHEET_WEBHOOK_URL`, `SHEET_TOKEN`, Apps Script web app. Reports are **Form silent POST only**.

### Worker vars (`wrangler.toml` `[vars]`)

| Var | Value |
|-----|--------|
| `APP_ORIGIN` | `https://stuti.deepakmaseeh121.workers.dev` (CORS allowlist for `/api/report`) |

### Rate limit

`[[ratelimits]]` binding `REPORT_LIMIT` — 20 requests / 60s per IP (optional; Worker checks `env.REPORT_LIMIT` if present).

### CMS OAuth Worker (`stuti-cms-auth`) — separate Worker

Secrets typically:

- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- Allowed domains / site host = live hostname

Configured in `public/admin/config.yml` → `backend.base_url`.

---

## 7. Routes (app surface)

| Path | Role |
|------|------|
| `/` | Home (books, letter browser entry, sets tease) |
| `/search/` | Letter-browser search (not free-text-only; see master spec §6) |
| `/books/`, `/books/[book]/` | Book list / book |
| `/b/[book]/[number]/` | Jump by printed number |
| `/song/[id]/` | Song page (static HTML + islands: toolbar, report, share…) |
| `/sets/`, `/sets/edit/`, `/sets/view/`, `/sets/print/` | Order of Service / setlists |
| `/set/` | Set deep link / share target |
| `/present/` | Present mode |
| `/print/` | Print |
| `/downloads/` | Offline book / font downloads |
| `/settings/` | Theme, prefs |
| `/guide/`, `/about/` | Guide / about (maker credits) |
| `/offline/`, `/no-connection/` | Offline UX |
| `/admin/` | Decap CMS |
| `/api/report` | Worker only (not a static page) |

Song IDs come from path: `hi/foo-bar.json` → `hi-foo-bar` → URL `/song/hi-foo-bar/`.

---

## 8. Content model

### Books (`src/content/books/*.json`)

Active catalog IDs: **TLBC**, **TLBE**, **XMAS**, **SS**.  
Schema: `BookSchema` in `src/lib/schema.ts` (`id`, bilingual `name`, `lang`, `status`, …).

### Songs (`src/content/songs/<lang>/*.json`)

- **Languages folders:** `en`, `hi`, `ta`, `te`, `pa` (as of handoff: ~111 `en`, ~441 `hi`; `ta`/`te`/`pa` empty)
- **id / lang** are **not** inside JSON — derived from file path
- Must pass `SongSchema`: numbers, title layers, sections/lines (`n`/`r`/`e`, optional `x` repeat), rights, layers, `publish`, `updated`, …

### Rights gate (hard rule)

Only songs with `rights.status` of `public_domain` or `licensed` ship by default.  
`demo` only if `PUBLIC_INCLUDE_DEMO=true`. Never publish `permission_pending` / `rejected` as live content.

### Indexes

`scripts/build-indexes.ts` → MiniSearch / number / meta JSON under `public/search/` (and related `dl` / `data`). Always run via `dev` / `prebuild`.

---

## 9. Report-a-mistake feature (already live)

### User-facing UI

- Island: `src/components/islands/ReportSheet.tsx`
- Mounted from `src/pages/song/[id].astro`
- Button: Report → bottom sheet “What’s wrong?”
- Fields the **member** fills: What’s wrong (select), Line (select), Correction, Note (optional)
- Song book/number/title shown as context (auto)

**Kind options:** Spelling, Wrong words, Missing line or verse, Wrong order, Wrong hymn number, Roman, English, Other.

### Flow (why it is built this way)

1. Member stays in-app (no GitHub, no Google Form page).
2. `submitReport()` in `src/lib/report-queue.ts` → `POST /api/report` JSON body.
3. Worker `workers/report.ts` maps body → `application/x-www-form-urlencoded` Form entries → Google `formResponse`.
4. Linked Sheet gets one row per report.
5. Offline / failure → IndexedDB queue (`stuti-reports` / `reportQueue`); flush when online.
6. Honeypot field `website`: if filled, Worker returns fake success (spam).

### Payload fields (`MistakeReport`)

| App key | Sheet / Form title | Source |
|---------|-------------------|--------|
| `id` | Report ID | Generated UUID |
| *(status)* | Status | Worker always sends `New` |
| `book` | Book | Song page props |
| `no` | Number | Song page props |
| `title` | Title | Song page |
| `layer` | Layer | Currently hard-coded `'n'` in ReportSheet send |
| `stanzaLabel` | Stanza | From selected line |
| `lineIndex` | Line | 0-based in app; Worker sends **+1** for humans |
| `kind` | What's wrong | Label via `KIND_LABEL` |
| `current` | Current text | Original line text |
| `suggested` | Correct text | Correction textarea |
| `note` | Note | Optional |
| `name` | Name | **UI does not collect yet** (column empty) |
| `church` | Church | **UI does not collect yet** |
| `contact` | Contact | **UI does not collect yet** |
| `appVersion` | App version | `package.json` / `src/lib/version.ts` |
| `dataVersion` | Data version | Passed into island |
| `url` | Page URL | Current song URL |

### Smoke test

```powershell
$body = @{
  id = "test-$(Get-Date -Format 'yyyyMMddHHmmss')"
  book = "demo"; no = 1; title = "Test hymn"; layer = "hindi"
  stanzaLabel = "1"; lineIndex = 0; kind = "spelling"
  current = "old"; suggested = "new"; note = "smoke"
  name = "Auto"; church = "Test"; contact = "n/a"
  appVersion = "0.0.0"; dataVersion = "0"
  url = "https://stuti.deepakmaseeh121.workers.dev/"
} | ConvertTo-Json
Invoke-RestMethod -Uri "https://stuti.deepakmaseeh121.workers.dev/api/report" `
  -Method POST -ContentType "application/json" -Body $body
# Expect: {"ok":true,"status":200}
```

If `401` from Google: Form not published for anonymous responses.  
If `502` / `not_configured`: secrets missing.

### Re-mapping Form entries after Form edits

1. Form → Get pre-filled link → fill all fields → copy URL  
2. Rebuild `GOOGLE_FORM_ENTRIES` JSON in question/app-key order  
3. `npx wrangler secret put GOOGLE_FORM_ENTRIES`  
4. Retest POST  

Details: `docs/REPORTS_SETUP.md`.

---

## 10. Key interactive islands (Preact)

Under `src/components/islands/` — progressive enhancement only; songs readable without them.

Notable: `LetterBrowser`, `ReportSheet`, `ShareSheet`, `QrSheet`, `SetsHome`, `SetEditor` / `SetEditorV2`, `PresentApp`, `ThemeToggle`, `SongToolbar`, `Finder`, `WordSearch`, `Keypad`, `DownloadsPanel`, `SettingsPanel`, `InstallPrompt`, …

Logic helpers: `src/lib/*` (search, sets, pptx-export, offline, prefs, schema, report-queue, …). Prefer small pure functions + Vitest.

---

## 11. Theme, layout, a11y / performance rules

- Theme attribute: **`[data-scheme]`** (System / Light / Dark) — see master spec §3  
- Desktop breakpoints in `site.config.ts` → `layout`: `<900` mobile; `900–1279` Finder+Song; `≥1280` three panes  
- **No** `set:html` / `dangerouslySetInnerHTML` (text only)  
- Budgets enforced by `check-budgets`, `check-precache`, `check-safety`, LHCI  
- CSP / caching: `public/_headers` (form-action allows `https://docs.google.com` for Form posts from browser if ever used; Worker posts server-side)

---

## 12. CI / GitHub

| Workflow | Triggers | Does |
|----------|----------|------|
| `.github/workflows/validate.yml` | PR + push `main` | Independence grep, `validate`, unit tests, Python tools tests, lint, `astro check`, build, precache/budgets/safety, LHCI |
| `.github/workflows/e2e.yml` | PR + push `main` | `npm run build` + Playwright |

Independence: fail if `clickup` appears outside allowlisted markdown (`STUTI_FIXES_AND_LAUNCH.md`, `STUTI_BUILD_SPEC.md`, `STUTI_SETLISTS_AND_FIXES.md`, `AGENTS.md` — also keep `STUTI_MASTER_SPEC.md` / this instructions file free of ClickUp product coupling in app code).

Protect `main` so both workflows must pass before merge (recommended).

---

## 13. CMS / editorial workflow

1. Open `/admin/` → Login with GitHub (OAuth via `stuti-cms-auth` Worker).  
2. `public/admin/config.yml`: `repo: deepakmaseeh/stuti`, `publish_mode: editorial_workflow`, `site_url` = live Worker URL.  
3. Saves open a **branch + PR**; CI validates content.  
4. Editors need write access on the GitHub repo.  
5. Local CMS: `local_backend: true` + `npx decap-server` (see CONTRIBUTING).  

**Why a separate auth Worker:** GitHub OAuth client secret must never ship in the static site.

---

## 14. Config single source

**All** site name, URL, books default, search knobs, layout widths, maker contact, report GitHub fallbacks: `src/site.config.ts`.

Mirror site URL in:

- `astro.config.mjs` → `site`
- `wrangler.toml` → `APP_ORIGIN`
- `public/admin/config.yml` → `site_url`

If the hostname ever changes, update **all three** (plus OAuth allowed domains and optional custom domain docs).

---

## 15. Dependencies (from `package.json`)

### Runtime (selected)

`astro`, `@astrojs/preact`, `@astrojs/sitemap`, `preact`, `@preact/signals`, `minisearch`, `zod`, `lucide-preact`, `pptxgenjs`, `qrcode`, `@fontsource/domine`, `@fontsource/instrument-sans`, `@fontsource/noto-sans-devanagari`, `@fontsource/noto-serif-devanagari`, `@fontsource/noto-sans-gurmukhi`, `@fontsource/noto-sans-tamil`, `@fontsource/noto-sans-telugu`

### Dev (selected)

`wrangler`, `vitest`, `@playwright/test`, `@axe-core/playwright`, `@vite-pwa/astro`, `vite-plugin-pwa`, `workbox-*`, `astro-icon`, `@iconify-json/lucide`, `@iconify-json/simple-icons`, `tsx`, `typescript`, `eslint` + `eslint-plugin-astro`, `prettier` + `prettier-plugin-astro`, `@lhci/cli`, `docx`, `jszip`, `happy-dom`

Install: `npm ci` only (respect lockfile).

---

## 16. Scripts under `scripts/` (build / content)

| Script | Role |
|--------|------|
| `validate.ts` | Content validation gate |
| `build-indexes.ts` | Search / download indexes |
| `font-manifest.ts` | Postbuild font list for downloads |
| `check-precache.ts` / `check-budgets.ts` / `check-safety.ts` | Release gates |
| `new-song.ts` | Scaffold song |
| `import-md-books.ts`, `import-zip-new-tlbc.ts`, `enrich-from-zip.ts`, `fix-lyrics-c36.ts`, `export-songs-docx.ts`, `make-icons.ts` | Digitization / import helpers |

Python tools: `tools/` (+ `tools/README.md`, `tools/tests`).

---

## 17. Hard product rules (do not violate)

1. Song pages work **without JavaScript**.  
2. No invented features beyond master/build specs; ambiguity → simplest acceptable + ADR.  
3. No hard-coded church/site URLs outside `site.config.ts`.  
4. TypeScript strict; `any` only at validated JSON boundaries.  
5. Stay on **Astro 5**.  
6. No analytics/ads/trackers/external fonts except allowed admin/analytics exceptions.  
7. Rights filter always on.  
8. Icons: Lucide + WhatsApp simple-icons only.  
9. App display name: **Stuti Songs**.  
10. Search UX: letter-browser oriented (master §6).  

---

## 18. Known gaps / follow-ups

- Report UI does **not** yet ask Name / Church / Contact (Form columns exist).  
- `src/site.config.ts` still has placeholder `report.fields` entry IDs and optional `PUBLIC_REPORT_FORM_URL` — legacy client path; live Send uses Worker secrets.  
- README / `STUTI_FIXES_AND_LAUNCH.md` still describe **Pages** Git deploy; production is **Workers Assets** — update those docs when you next touch launch docs.  
- Tamil / Telugu / Punjabi song folders ready but empty.  
- Optional custom domain not required for current `workers.dev` URL.  

---

## 19. Quick “new IDE” checklist

1. Clone `https://github.com/deepakmaseeh/stuti.git`, Node 22, `npm ci`.  
2. Read `AGENTS.md` + `STUTI_MASTER_SPEC.md` §0–§1 before UI work.  
3. `cp .env.example .env` → `npm run dev`.  
4. Confirm live: open a TLBC song → Report → Send → row in Sheet.  
5. Deploy: `npm run build && npx wrangler deploy` (must be logged in as Cloudflare account above).  
6. Secrets: only touch Form secrets if Form questions/entry IDs change; retest POST.  
7. Never commit `.env`, OAuth secrets, or Apps Script tokens.  
8. Prefer `docs/adr/` for any architectural fork.  

---

## 20. Credential inventory (where secrets live)

| Secret / credential | Where stored | Notes |
|---------------------|--------------|-------|
| Cloudflare API / OAuth (wrangler) | Local wrangler config | `deepakmaseeh121@gmail.com` |
| `GOOGLE_FORM_ACTION_URL` | Cloudflare Worker secret `stuti` | Form POST URL |
| `GOOGLE_FORM_ENTRIES` | Cloudflare Worker secret `stuti` | JSON entry map |
| GitHub repo access | GitHub user/org for `deepakmaseeh/stuti` | CMS + CI |
| GitHub OAuth client id/secret | Worker `stuti-cms-auth` secrets | Not in this repo |
| Google Form ownership | `godisourlord8874@gmail.com` | Publish + Sheet link |
| `PUBLIC_*` in `.env` | Local gitignored file | Not Worker secrets |

---

*End of handoff document. Prefer updating this file when deploy host, Form IDs, or secrets change.*
