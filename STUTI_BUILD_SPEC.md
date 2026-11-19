# Stuti: Digital Hymnal for Indian Churches
## Complete Build Specification v1.1 (for AI IDE / developers)

> **How to use this file:** put it in the repo root as `STUTI_BUILD_SPEC.md`. Give your AI IDE (Cursor, Windsurf, Copilot, Claude Code, etc.) the **Master Prompt** in §20, then run the **Phase Prompts** (§21) one at a time, in order. Don't let the IDE skip phases. Each phase ends with acceptance checks that must pass before you move on.
>
> Prepared 19 Nov 2026. Hosting limits and package versions change: the IDE must check current versions and free-tier limits at build time (see §3.3).

---

## Table of contents

1. Product summary
2. Decisions & defaults (change in `site.config.ts`)
3. Tech stack (and why)
4. Repository structure (every file)
5. Data model (books, songs, rights) + JSON Schema + Zod
6. Sample data (ready-to-use files)
7. Routes & pages
8. Feature specs v1 (with acceptance criteria)
9. UI design system (tokens, type, color, spacing, motion)
10. Screen-by-screen UI instructions
11. Search (number + words, fuzzy Roman)
12. Offline / PWA (service worker, downloads, updates)
13. Set lists (URL encoding, QR, follow mode)
14. Local storage & state
15. Content workflow (add / update / correct lyrics)
16. Tools: OCR, transliteration, AI translation, import
17. Admin / CMS (Decap) setup
18. Build, CI/CD, hosting (Cloudflare Pages, ₹0)
19. Quality: testing, accessibility, performance, SEO, security, privacy
20. Master prompt for the IDE
21. Phase prompts (step by step)
22. Content prompts (AI translation / transliteration / proofreading)
23. Editor guide & style rules
24. Rights policy
25. Roadmap v1.1 / v2 (data hooks included now)
26. Definition of done & launch checklist
27. Glossary

---

## 1. Product summary

**Stuti** (स्तुति / துதி / స్తుతి / ਉਸਤਤ: "praise") is a free, ad-free, offline-first **Progressive Web App** that replaces printed Christian hymnbooks for churches in India.

- **Languages (v1):** Hindi (Devanagari), Tamil, Telugu, Punjabi (Gurmukhi), English.
- **Every song has three layers:** original script (`n`), Roman transliteration (`r`), English meaning (`e`).
- **Same numbering as the printed hymnbook**, per book and edition. One song can appear in many books under different numbers.
- **Works with no internet** after a book is downloaded.
- **No login for readers.** No ads. No tracking cookies.
- **Hosting cost: ₹0/month** (Cloudflare Pages free tier + GitHub). Optional domain ~₹800/yr.

### 1.1 Users

| Role | Needs | Has account? |
|---|---|---|
| Believer (reader) | Find hymn by number fast, read big text, offline | No |
| Worship leader | Build Sunday set, share QR/link, step through set | No (sets live in URL + device) |
| Language editor | Add/edit songs, proofread layers | GitHub account (via CMS) |
| Moderator / Admin | Approve changes, check rights, manage books | GitHub account, repo maintainer |

### 1.2 Non-goals for v1

User accounts, comments, payments, native Play Store app, hosting audio files, chords (v1.1), projector/live-follow (v2), modern copyrighted songs without written permission.

---

## 2. Decisions & defaults

These were still open when this spec was written. The IDE must put them in **`src/site.config.ts`** so they're easy to change later. **Do not hard-code them anywhere else.**

| Decision | Default used in this spec | Where |
|---|---|---|
| App name | `Stuti` | `site.config.ts → name` |
| Production URL | `https://stuti.pages.dev` | `site.config.ts → url` + `astro.config.mjs → site` |
| First books | 5 **demo** books (EH, DH, DT, DTe, DP) until real books are chosen | `src/content/books/*.json` |
| Default book for keypad | `DT` | `site.config.ts → defaultBookId` |
| Report-a-mistake target | Google Form (prefilled URL) | `site.config.ts → report` |
| Analytics | Cloudflare Web Analytics (cookieless), off until a token is set | `site.config.ts → analyticsToken` |
| UI language | English UI chrome (v1); strings file ready for hi/ta/te/pa | `src/i18n/` |

**Real books to add first (once confirmed with pilot churches):** Tamil *Keethangalum Keerthanaigalum* (Vedanayagam Sastriar songs likely PD), Telugu *Andhra Kraisthava Keerthanalu* (verify each song), Punjabi *Punjabi Zaboor* (1908, Imam Din Shahbaz, likely PD; later editions may not be), Hindi: book TBD (*Masihi Geet Sangrah* / others need publisher permission).

---

## 3. Tech stack

### 3.1 Choices

| Layer | Choice | Why |
|---|---|---|
| Framework | **Astro 5.x** (`output: 'static'`, stay on major 5 for v1), TypeScript strict | Static HTML per song: fast, SEO-friendly, cheap to host, works without JS |
| Interactive islands | **Preact** via `@astrojs/preact` + `@preact/signals` | Tiny (~4 KB), React-like DX |
| Styling | **Plain CSS + custom properties** (no Tailwind) | Smallest output, full control of Indic typography |
| Content | **Astro Content Collections** (glob loader) over JSON files in Git | Git = history, review, free |
| Validation | **Zod** (via `astro:content`) + `scripts/validate.ts` | One schema for build + CI |
| Search | **MiniSearch** (prebuilt per-language index JSON) + custom normaliser | Fuzzy, prefix, offline, small |
| PWA | **@vite-pwa/astro** with `strategies: 'injectManifest'` + Workbox | Full control of offline logic |
| QR | **qrcode** (npm) → SVG, client-side | No server |
| Storage | `localStorage` (prefs, favs, sets) + Cache API (pages) | Simple, offline |
| Fonts | **@fontsource** packages, self-hosted: Noto Sans Devanagari / Tamil / Telugu / Gurmukhi, Instrument Sans, Domine | No Google Fonts calls; unicode-range so a page only downloads the scripts it uses |
| CMS | **Decap CMS** at `/admin` (GitHub backend, editorial workflow → PRs) | Free, Git-based, approval built-in |
| CMS auth | GitHub OAuth proxy on **Cloudflare Workers** (free) | Decap needs OAuth for GitHub |
| Hosting | **Cloudflare Pages** (Git integration) | Free, unlimited static requests, preview per PR |
| CI | **GitHub Actions** (public repo = free minutes) | Validate, test, Lighthouse on every PR |
| Unit tests | **Vitest** | Fast |
| E2E tests | **Playwright** | Offline mode, mobile viewports |
| Perf/a11y | **Lighthouse CI** (`@lhci/cli`) | Budgets enforced in CI |
| Tools (local) | **Python 3.11+**: `pytesseract`, `aksharamukha`, `pandas` | OCR + transliteration + imports |
| Node | **Node 22 LTS**, npm | |

### 3.2 Packages (latest stable compatible with Astro 5; **do not upgrade to Astro 6 for v1**, see docs/adr/0002)

```bash
npm create astro@latest stuti -- --template minimal --typescript strict --no-git
cd stuti
npm i astro@^5 @astrojs/preact@^4 @astrojs/sitemap@^3 preact
npm i @preact/signals minisearch qrcode zod@^3
npm i @fontsource/noto-sans-devanagari @fontsource/noto-sans-tamil @fontsource/noto-sans-telugu @fontsource/noto-sans-gurmukhi @fontsource/instrument-sans @fontsource/domine
npm i -D @vite-pwa/astro vite-plugin-pwa workbox-precaching workbox-routing workbox-strategies workbox-expiration workbox-window
npm i -D vitest @playwright/test @lhci/cli tsx @types/qrcode prettier eslint @axe-core/playwright wrangler
```
Commit `package-lock.json`. Keep `astro`, `@astrojs/preact` and `@astrojs/sitemap` on the majors that support Astro 5.

### 3.3 Verify before building (IDE must do this)

- Check current **Cloudflare Pages free limits** (at time of writing: 500 builds/month, 20,000 files per deployment, 25 MiB max file). **The 20,000-file limit matters**: see §18.4.
- Use the latest **Astro 5.x** (do not upgrade to 6 for v1: Astro 6 moves to Zod 4, where `z` comes from `astro/zod` and `.default({})` on objects no longer fills nested defaults, so data would silently come out wrong). For @vite-pwa/astro, Decap CMS and other packages, use the latest stable versions compatible with Astro 5. Record what you checked in `docs/adr/0001-versions.md`; the Astro 6 upgrade plan lives in `docs/adr/0002-stay-on-astro-5.md` (upgrade after v1 launch: import `z` from `astro/zod`, replace `.default({})` on objects with `.prefault({})`, run the full test suite).

---

## 4. Repository structure (every file)

```text
stuti/
├── STUTI_BUILD_SPEC.md              # this file
├── AGENTS.md                        # rules for AI coding agents (copy of §20 rules)
├── README.md                        # setup, scripts, deploy
├── CONTRIBUTING.md                  # editor guide (§23) + rights policy (§24)
├── LICENSE                          # code: MIT. Content licence per song (see rights)
├── package.json
├── tsconfig.json
├── astro.config.mjs
├── vitest.config.ts
├── playwright.config.ts
├── lighthouserc.json
├── .nvmrc                           # 22
├── .editorconfig
├── .prettierrc
├── .gitignore                       # node_modules, dist, public/search, public/dl, .astro, tools/**/out, .env
├── .env.example                     # PUBLIC_INCLUDE_DEMO=true (copy to .env for local runs)
├── .github/
│   ├── workflows/
│   │   ├── validate.yml             # PR: validate + test + build + lighthouse
│   │   └── e2e.yml                  # PR: playwright
│   ├── ISSUE_TEMPLATE/
│   │   ├── lyric-correction.yml     # issue form for corrections
│   │   └── missing-song.yml
│   ├── pull_request_template.md     # rights + proofreading checklist
│   ├── dependabot.yml               # npm updates; ignore astro major updates
│   └── CODEOWNERS                   # per-language reviewers
├── public/
│   ├── _headers                     # security + caching headers (Cloudflare)
│   ├── _redirects                   # optional short links
│   ├── robots.txt
│   ├── favicon.svg
│   ├── icons/                       # PWA icons: 192, 512, maskable-512, apple-touch-180
│   ├── admin/
│   │   ├── index.html               # Decap CMS loader
│   │   └── config.yml               # CMS collections (§17)
│   ├── search/                      # GENERATED (gitignored): numbers.json, idx-<lang>.json
│   └── dl/                          # GENERATED (gitignored): <bookId>.json download manifests
├── src/
│   ├── site.config.ts               # all decisions/defaults (§2)
│   ├── content.config.ts            # collections + Zod schemas (§5)
│   ├── env.d.ts
│   ├── sw.ts                        # service worker (§12)
│   ├── content/
│   │   ├── books/                   # one JSON per book
│   │   │   ├── EH.json
│   │   │   ├── DH.json
│   │   │   ├── DT.json
│   │   │   ├── DTe.json
│   │   │   └── DP.json
│   │   └── songs/
│   │       ├── en/amazing-grace.json
│   │       ├── en/jesus-loves-me.json
│   │       ├── hi/yeshu-mera-sahara.json
│   │       ├── ta/yesuve-en-thunai.json
│   │       ├── te/yesayya-neeve-naa-aadhaaram.json
│   │       └── pa/yisu-mera-sahara.json
│   ├── i18n/
│   │   ├── en.json                  # UI strings (v1)
│   │   └── index.ts                 # t('key') helper
│   ├── lib/
│   │   ├── normalize.ts             # fuzzy Roman + Indic normaliser (§11.2)
│   │   ├── search.ts                # MiniSearch loader/query (§11)
│   │   ├── numbers.ts               # book+number → song lookup
│   │   ├── setlist.ts               # encode/decode sets (§13)
│   │   ├── storage.ts               # typed localStorage wrapper (§14)
│   │   ├── prefs.ts                 # signals for prefs
│   │   ├── wakelock.ts              # Screen Wake Lock (§8.F4)
│   │   ├── offline.ts               # download/remove/update books (§12)
│   │   ├── share.ts                 # Web Share + clipboard fallback
│   │   ├── report.ts                # build prefilled report URL
│   │   ├── scripts.ts               # Unicode script ranges per language
│   │   └── songs.ts                 # helpers: firstLine, urls, publishable filter
│   ├── components/
│   │   ├── AppShell.astro           # header, bottom nav, theme bootstrap
│   │   ├── BottomNav.astro
│   │   ├── NumberBadge.astro        # gold-stamped book code + number
│   │   ├── SongRow.astro            # list row
│   │   ├── LyricSection.astro       # one section with lines + 3 layers
│   │   ├── SongMeta.astro           # author, book numbers, bible refs, rights badge
│   │   ├── RightsBadge.astro
│   │   ├── OfflineBadge.astro
│   │   └── islands/
│   │       ├── Keypad.tsx           # number search
│   │       ├── WordSearch.tsx       # text search
│   │       ├── SongToolbar.tsx      # layers, A−/A+, keep awake, fav, + set, share
│   │       ├── SetNavBar.tsx        # prev/next when opened from a set
│   │       ├── SetEditor.tsx        # build/reorder/share sets
│   │       ├── QrSheet.tsx          # QR bottom sheet
│   │       ├── ReportSheet.tsx      # report a mistake
│   │       ├── HomeLists.tsx        # continue, favourites, recent, saved sets
│   │       ├── DownloadsPanel.tsx   # download/remove books, storage used
│   │       ├── SettingsPanel.tsx
│   │       ├── InstallPrompt.tsx    # PWA install nudge
│   │       └── UpdateToast.tsx      # new version available
│   ├── layouts/
│   │   └── Base.astro               # <html>, meta, fonts, theme script, SW register
│   ├── pages/
│   │   ├── index.astro              # Home
│   │   ├── search.astro             # Number + Words tabs
│   │   ├── song/[id].astro          # canonical song page
│   │   ├── b/[book]/[number].astro  # number permalink → redirect to song
│   │   ├── books/index.astro        # all books
│   │   ├── books/[book].astro       # book index by number
│   │   ├── set.astro                # set editor/viewer (#s=...)
│   │   ├── downloads.astro
│   │   ├── settings.astro
│   │   ├── about.astro              # rights, credits, contact
│   │   ├── no-connection.astro      # offline fallback
│   │   └── 404.astro
│   └── styles/
│       ├── tokens.css               # design tokens (§9)
│       ├── base.css                 # reset, typography, layout
│       ├── components.css
│       └── lyrics.css               # layers, sizes, Indic line-height
├── scripts/                         # Node/TS build scripts (run with tsx)
│   ├── validate.ts                  # schema + rules + rights gate (§15.3)
│   ├── build-indexes.ts             # numbers.json, idx-<lang>.json, dl/<book>.json
│   ├── new-song.ts                  # scaffold a song file interactively
│   ├── report-stats.ts              # counts per book/status for README badge
│   ├── font-manifest.ts             # postbuild: dist/dl/fonts.json (Indic font URLs per language)
│   └── check-precache.ts            # CI: fail if precache > 1.5 MB
├── tools/                           # Python content tools (local only)
│   ├── requirements.txt             # pytesseract, pillow, aksharamukha, pandas
│   ├── ocr/ocr.py                   # scan → draft song JSON (§16.1)
│   ├── translit/translit.py         # native → Roman draft (§16.2)
│   ├── translate/translate.py       # optional AI English draft (§16.3); API key from env, never committed
│   └── import/sheet_to_json.py      # Google Form CSV → draft JSON (§16.4)
├── docs/
│   ├── prompts/translate.md         # §22.1
│   ├── prompts/transliterate.md     # §22.2
│   ├── prompts/proofread.md         # §22.3
│   └── adr/                         # architecture decisions: 0001-versions.md, 0002-stay-on-astro-5.md, …
└── tests/
    ├── fixtures/                    # bad song/book files, one per validation rule
    ├── unit/normalize.test.ts
    ├── unit/setlist.test.ts
    ├── unit/search.test.ts
    ├── unit/validate.test.ts
    ├── unit/wakelock.test.ts
    ├── unit/report.test.ts
    ├── unit/schema-defaults.test.ts # nested defaults are filled (Astro 5 / Zod 3)
    └── e2e/
        ├── admin.spec.ts            # /admin loads with no CSP errors
        ├── number-search.spec.ts
        ├── word-search.spec.ts
        ├── song-page.spec.ts
        ├── setlist.spec.ts
        ├── offline.spec.ts
        └── a11y.spec.ts
```

---

## 5. Data model

### 5.1 Concepts

- **Book**: a printed hymnbook/edition. Has an `id` (short code shown on badges, e.g. `DT`, `KK`), a language and an edition.
- **Song**: one hymn text. Belongs to one **language**, may appear in **many books** with different numbers.
- **Section**: verse / chorus / bridge / other, with ordered **lines**.
- **Line**: `{ n, r, e }`: native script, Roman transliteration, English meaning. For English songs only `n` is used.
- **Rights**: every song carries a rights status. **Only `public_domain` and `licensed` are published in production.** `demo` is allowed only when `PUBLIC_INCLUDE_DEMO=true`.

### 5.2 Book JSON

```json
{
  "id": "DT",
  "name": { "native": "டெமோ தமிழ் கீர்த்தனைகள்", "en": "Demo Tamil Keerthanai" },
  "lang": "ta",
  "edition": "Demo 2026",
  "publisher": "",
  "description": "Demo book for development. Replace with a real hymnbook.",
  "order": 3,
  "numbering": "numeric",
  "status": "demo"
}
```

Fields:
- `id`: `^[A-Za-z]{1,6}$`, unique, shown on badges. Case-sensitive in data, **case-insensitive in search** (`dt` = `DT`).
- `lang`: `en | hi | ta | te | pa`.
- `numbering`: `numeric` (1, 2, 3) or `alnum` (allows `117a`, `Z-23`).
- `status`: `demo | active | archived`.

### 5.3 Song JSON

```json
{
  "slug": "yesuve-en-thunai",
  "numbers": [{ "book": "DT", "number": "117" }],
  "title": { "native": "இயேசுவே என் துணை", "roman": "Yesuve En Thunai", "en": "Jesus, My Companion" },
  "aliases": ["yesuve", "thunai", "tunai"],
  "sections": [
    {
      "type": "chorus",
      "label": "Chorus",
      "lines": [
        { "n": "இயேசுவே என் துணை நீரே", "r": "Yesuve en thunai neere", "e": "Jesus, You are my companion" },
        { "n": "இருளில் என் ஒளி நீரே", "r": "Irulil en oli neere", "e": "You are my light in the darkness" }
      ]
    }
  ],
  "display": { "chorusAfterEachVerse": true },
  "author": { "name": "Demo text", "born": null, "died": null },
  "composer": null,
  "tune": null,
  "year": 2026,
  "bibleRefs": ["Isaiah 41:10"],
  "tags": ["comfort", "worship"],
  "rights": {
    "status": "demo",
    "basis": "Written for the prototype",
    "evidence": "",
    "holder": "",
    "checkedBy": "",
    "checkedOn": ""
  },
  "layers": { "roman": "reviewed", "en": "draft" },
  "source": { "scan": "", "page": null },
  "chords": null,
  "media": { "youtube": null },
  "updated": "2026-11-19",
  "publish": true
}
```

Field rules:
- **The song id and language come from the file path, not from the JSON.** `src/content/songs/<lang>/<slug>.json` → id `<lang>-<slug>` (e.g. `ta/yesuve-en-thunai.json` → `ta-yesuve-en-thunai`); language = `langOf(id)` = the part before the first `-`. Editors never type the id. `<lang>` ∈ `en|hi|ta|te|pa`, `<slug>` matches `^[a-z0-9-]{2,80}$`. The id **never changes after publishing** (URLs depend on it), so never rename a published file. The slug comes from the Roman title.
- `slug`: copy of the file name kept for editors' reference (the CMS uses it to name the file). The build ignores it; validation **warns** if it differs from the file name.
- `numbers[]`: at least 1 entry. `book` must exist in books. (`book`,`number`) pair must be unique across all songs.
- `sections[]`: at least 1. `type`: `verse | chorus | bridge | refrain | other`. `label` is free text shown above the section (e.g. "Verse 2", "Pallavi", "Anupallavi", "Charanam 1").
- `lines[]`: at least 1. For `lang != en`: `n` required, `r` required when `layers.roman != "missing"`, `e` required when `layers.en != "missing"`.
- **Script check:** `n` must contain characters of the song's script (Devanagari for hi, Tamil for ta, Telugu for te, Gurmukhi for pa). `r` and `e` must be Latin only.
- `layers.roman` / `layers.en`: `missing | draft | reviewed`. **Draft layers are shown with a small "draft" label** in the UI.
- `display.chorusAfterEachVerse`: when true, render a compact "↻ Chorus" marker after each verse (don't repeat the full text).
- `rights.status`: `public_domain | licensed | permission_pending | demo | rejected`.
  - `public_domain` requires `author.died` ≤ (current year − 61) **or** `rights.basis` explaining why (e.g. "anonymous traditional, pre-1900 publication: <source>").
  - `licensed` requires `rights.holder` + `rights.evidence` (link/file ref to the written permission).
- `publish`: editor's switch. Published in prod only if `publish && status ∈ {public_domain, licensed}`.
- `chords`, `media`: reserved for v1.1 (keep `null` in v1).

### 5.4 Zod schema (`src/content.config.ts`)

```ts
import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

export const LANGS = ['en', 'hi', 'ta', 'te', 'pa'] as const;
const Lang = z.enum(LANGS);

const books = defineCollection({
  loader: glob({ pattern: '*.json', base: './src/content/books' }),
  schema: z.object({
    id: z.string().regex(/^[A-Za-z]{1,6}$/),
    name: z.object({ native: z.string().min(1), en: z.string().min(1) }),
    lang: Lang,
    edition: z.string().default(''),
    publisher: z.string().default(''),
    description: z.string().default(''),
    order: z.number().int().default(100),
    numbering: z.enum(['numeric', 'alnum']).default('numeric'),
    status: z.enum(['demo', 'active', 'archived']).default('active'),
  }),
});

const Line = z.object({
  n: z.string().min(1),
  r: z.string().default(''),
  e: z.string().default(''),
});

const Section = z.object({
  type: z.enum(['verse', 'chorus', 'bridge', 'refrain', 'other']),
  label: z.string().min(1),
  lines: z.array(Line).min(1),
});

const LayerState = z.enum(['missing', 'draft', 'reviewed']);

const songs = defineCollection({
  loader: glob({
    pattern: '**/*.json',
    base: './src/content/songs',
    // ta/yesuve-en-thunai.json → ta-yesuve-en-thunai (id + language come from the path)
    generateId: ({ entry }) => entry.replace(/\\/g, '/').replace(/\.json$/, '').replace('/', '-'),
  }),
  schema: z.object({
    slug: z.string().regex(/^[a-z0-9-]{2,80}$/).optional(),
    numbers: z.array(z.object({ book: z.string(), number: z.string().regex(/^[0-9A-Za-z-]{1,8}$/) })).min(1),
    title: z.object({ native: z.string().min(1), roman: z.string().default(''), en: z.string().default('') }),
    aliases: z.array(z.string()).default([]),
    sections: z.array(Section).min(1),
    display: z.object({ chorusAfterEachVerse: z.boolean().default(false) }).default({}),
    author: z.object({
      name: z.string().default('Unknown'),
      born: z.number().int().nullable().default(null),
      died: z.number().int().nullable().default(null),
    }).default({}),
    composer: z.string().nullable().default(null),
    tune: z.string().nullable().default(null),
    year: z.number().int().nullable().default(null),
    bibleRefs: z.array(z.string()).default([]),
    tags: z.array(z.string()).default([]),
    rights: z.object({
      status: z.enum(['public_domain', 'licensed', 'permission_pending', 'demo', 'rejected']),
      basis: z.string().default(''),
      evidence: z.string().default(''),
      holder: z.string().default(''),
      checkedBy: z.string().default(''),
      checkedOn: z.string().default(''),
    }),
    layers: z.object({ roman: LayerState.default('missing'), en: LayerState.default('missing') }).default({}),
    source: z.object({ scan: z.string().default(''), page: z.number().int().nullable().default(null) }).default({}),
    chords: z.string().nullable().default(null),
    media: z.object({ youtube: z.string().nullable().default(null) }).default({}),
    updated: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    publish: z.boolean().default(false),
  }),
});

export const collections = { books, songs };
```

### 5.5 Script ranges (`src/lib/scripts.ts`)

```ts
export const SCRIPT_RE: Record<'hi' | 'ta' | 'te' | 'pa', RegExp> = {
  hi: /[\u0900-\u097F]/, // Devanagari
  ta: /[\u0B80-\u0BFF]/, // Tamil
  te: /[\u0C00-\u0C7F]/, // Telugu
  pa: /[\u0A00-\u0A7F]/, // Gurmukhi
};
export const INDIC_ANY = /[\u0900-\u0DFF]/;
export const LATIN_ONLY = /^[\p{Script=Latin}\p{N}\p{P}\p{Zs}'’\-]*$/u;
export const LANG_LABEL = { en: 'English', hi: 'Hindi', ta: 'Tamil', te: 'Telugu', pa: 'Punjabi' } as const;
export const LANG_TAG = { // for lang="" attributes
  n: { en: 'en', hi: 'hi', ta: 'ta', te: 'te', pa: 'pa' },
  r: { en: 'en', hi: 'hi-Latn', ta: 'ta-Latn', te: 'te-Latn', pa: 'pa-Latn' },
} as const;
```

### 5.6 `src/site.config.ts`

```ts
export const site = {
  name: 'Stuti',
  tagline: 'Digital hymnal for Indian churches',
  url: 'https://stuti.pages.dev',
  languages: ['hi', 'ta', 'te', 'pa', 'en'] as const,
  defaultBookId: 'DT',
  includeDemo: import.meta.env.PUBLIC_INCLUDE_DEMO === 'true',
  report: {
    // Google Form prefill. Get entry IDs via Form → ⋮ → "Get pre-filled link".
    formUrl: import.meta.env.PUBLIC_REPORT_FORM_URL ?? '',
    fields: { songId: 'entry.1000001', songTitle: 'entry.1000002', line: 'entry.1000003', correction: 'entry.1000004', url: 'entry.1000005' },
    // Fallback when formUrl is empty: GitHub issue form
    githubIssueUrl: 'https://github.com/OWNER/stuti/issues/new?template=lyric-correction.yml',
  },
  analyticsToken: import.meta.env.PUBLIC_CF_ANALYTICS_TOKEN ?? '',
  contactEmail: '',
} as const;
```

---

## 6. Sample data (create these files exactly)

> Hindi/Tamil/Telugu/Punjabi samples are **demo text written for the prototype**, not real hymns (`rights.status: "demo"`). English samples are real public-domain hymns.

### 6.1 Books

`src/content/books/EH.json`
```json
{ "id": "EH", "name": { "native": "English Hymns", "en": "English Hymns" }, "lang": "en", "edition": "Public domain selection", "order": 5, "numbering": "numeric", "status": "active" }
```
`src/content/books/DH.json`
```json
{ "id": "DH", "name": { "native": "डेमो हिंदी गीत", "en": "Demo Hindi Geet" }, "lang": "hi", "edition": "Demo 2026", "order": 1, "numbering": "numeric", "status": "demo" }
```
`src/content/books/DT.json`
```json
{ "id": "DT", "name": { "native": "டெமோ தமிழ் கீர்த்தனைகள்", "en": "Demo Tamil Keerthanai" }, "lang": "ta", "edition": "Demo 2026", "order": 2, "numbering": "numeric", "status": "demo" }
```
`src/content/books/DTe.json`
```json
{ "id": "DTe", "name": { "native": "డెమో తెలుగు కీర్తనలు", "en": "Demo Telugu Keerthanalu" }, "lang": "te", "edition": "Demo 2026", "order": 3, "numbering": "numeric", "status": "demo" }
```
`src/content/books/DP.json`
```json
{ "id": "DP", "name": { "native": "ਡੈਮੋ ਪੰਜਾਬੀ ਗੀਤ", "en": "Demo Punjabi Geet" }, "lang": "pa", "edition": "Demo 2026", "order": 4, "numbering": "numeric", "status": "demo" }
```

### 6.2 Songs

`src/content/songs/en/amazing-grace.json`
```json
{
  "slug": "amazing-grace",
  "numbers": [{ "book": "EH", "number": "1" }],
  "title": { "native": "Amazing Grace", "roman": "", "en": "" },
  "aliases": ["how sweet the sound"],
  "sections": [
    { "type": "verse", "label": "Verse 1", "lines": [
      { "n": "Amazing grace! How sweet the sound" },
      { "n": "That saved a wretch like me!" },
      { "n": "I once was lost, but now am found;" },
      { "n": "Was blind, but now I see." }
    ]}
  ],
  "author": { "name": "John Newton", "born": 1725, "died": 1807 },
  "year": 1779, "bibleRefs": ["Ephesians 2:8"], "tags": ["grace"],
  "rights": { "status": "public_domain", "basis": "Author died 1807" },
  "layers": { "roman": "missing", "en": "missing" },
  "updated": "2026-11-19", "publish": true
}
```

`src/content/songs/en/jesus-loves-me.json`
```json
{
  "slug": "jesus-loves-me",
  "numbers": [{ "book": "EH", "number": "2" }],
  "title": { "native": "Jesus Loves Me", "roman": "", "en": "" },
  "aliases": ["this i know"],
  "sections": [
    { "type": "verse", "label": "Verse 1", "lines": [
      { "n": "Jesus loves me! This I know," },
      { "n": "For the Bible tells me so;" },
      { "n": "Little ones to Him belong;" },
      { "n": "They are weak, but He is strong." }
    ]},
    { "type": "chorus", "label": "Chorus", "lines": [
      { "n": "Yes, Jesus loves me!" },
      { "n": "Yes, Jesus loves me!" },
      { "n": "Yes, Jesus loves me!" },
      { "n": "The Bible tells me so." }
    ]}
  ],
  "author": { "name": "Anna B. Warner", "born": 1827, "died": 1915 },
  "year": 1860, "bibleRefs": ["Mark 10:14"], "tags": ["children"],
  "rights": { "status": "public_domain", "basis": "Author died 1915" },
  "layers": { "roman": "missing", "en": "missing" },
  "updated": "2026-11-19", "publish": true
}
```

`src/content/songs/hi/yeshu-mera-sahara.json`
```json
{
  "slug": "yeshu-mera-sahara",
  "numbers": [{ "book": "DH", "number": "12" }],
  "title": { "native": "यीशु मेरा सहारा", "roman": "Yeshu Mera Sahara", "en": "Jesus, My Support" },
  "aliases": ["yesu", "yisu", "sahara"],
  "sections": [
    { "type": "chorus", "label": "Chorus", "lines": [
      { "n": "यीशु मेरा सहारा है", "r": "Yeshu mera sahara hai", "e": "Jesus is my support" },
      { "n": "अंधेरे में उजियारा है", "r": "Andhere mein ujiyara hai", "e": "He is light in the darkness" }
    ]},
    { "type": "verse", "label": "Verse 1", "lines": [
      { "n": "जब राह न सूझे, वह हाथ थामे", "r": "Jab raah na soojhe, voh haath thaame", "e": "When I cannot see the way, He holds my hand" },
      { "n": "हर डर को वह दूर भगाए", "r": "Har dar ko voh door bhagaaye", "e": "He drives every fear away" }
    ]},
    { "type": "verse", "label": "Verse 2", "lines": [
      { "n": "सुबह-शाम मैं उसके गीत गाऊँ", "r": "Subah-shaam main uske geet gaaoon", "e": "Morning and evening I sing His songs" },
      { "n": "उसके प्रेम में जीवन बिताऊँ", "r": "Uske prem mein jeevan bitaaoon", "e": "I spend my life in His love" }
    ]}
  ],
  "display": { "chorusAfterEachVerse": true },
  "author": { "name": "Demo text" }, "year": 2026, "bibleRefs": ["Psalm 23:4"], "tags": ["comfort"],
  "rights": { "status": "demo", "basis": "Written for the prototype" },
  "layers": { "roman": "reviewed", "en": "draft" },
  "updated": "2026-11-19", "publish": true
}
```

`src/content/songs/ta/yesuve-en-thunai.json`
```json
{
  "slug": "yesuve-en-thunai",
  "numbers": [{ "book": "DT", "number": "117" }],
  "title": { "native": "இயேசுவே என் துணை", "roman": "Yesuve En Thunai", "en": "Jesus, My Companion" },
  "aliases": ["yesu", "thunai", "tunai"],
  "sections": [
    { "type": "chorus", "label": "Chorus", "lines": [
      { "n": "இயேசுவே என் துணை நீரே", "r": "Yesuve en thunai neere", "e": "Jesus, You are my companion" },
      { "n": "இருளில் என் ஒளி நீரே", "r": "Irulil en oli neere", "e": "You are my light in the darkness" }
    ]},
    { "type": "verse", "label": "Verse 1", "lines": [
      { "n": "வழி தெரியாத நேரத்தில்", "r": "Vazhi theriyaadha nerathil", "e": "In the hour I could not see the way" },
      { "n": "என் கரம் பிடித்தீரே", "r": "En karam piditheere", "e": "You held my hand" }
    ]},
    { "type": "verse", "label": "Verse 2", "lines": [
      { "n": "காலையும் மாலையும் உம்மைப் பாடுவேன்", "r": "Kaalaiyum maalaiyum ummai paaduven", "e": "Morning and evening I will sing of You" },
      { "n": "உம் அன்பில் வாழுவேன்", "r": "Um anbil vaazhuven", "e": "I will live in Your love" }
    ]}
  ],
  "display": { "chorusAfterEachVerse": true },
  "author": { "name": "Demo text" }, "year": 2026, "bibleRefs": ["Isaiah 41:10"], "tags": ["comfort"],
  "rights": { "status": "demo", "basis": "Written for the prototype" },
  "layers": { "roman": "reviewed", "en": "draft" },
  "updated": "2026-11-19", "publish": true
}
```

`src/content/songs/te/yesayya-neeve-naa-aadhaaram.json`
```json
{
  "slug": "yesayya-neeve-naa-aadhaaram",
  "numbers": [{ "book": "DTe", "number": "45" }],
  "title": { "native": "యేసయ్యా నీవే నా ఆధారం", "roman": "Yesayya Neeve Naa Aadhaaram", "en": "Jesus, You Are My Foundation" },
  "aliases": ["yesu", "adharam"],
  "sections": [
    { "type": "chorus", "label": "Chorus", "lines": [
      { "n": "యేసయ్యా నీవే నా ఆధారం", "r": "Yesayya neeve naa aadhaaram", "e": "Jesus, You are my foundation" },
      { "n": "చీకటిలో నీవే నా వెలుగు", "r": "Cheekatilo neeve naa velugu", "e": "You are my light in the darkness" }
    ]},
    { "type": "verse", "label": "Verse 1", "lines": [
      { "n": "దారి తెలియని వేళలో", "r": "Daari teliyani velalo", "e": "In the hour I did not know the way" },
      { "n": "నా చేయి పట్టావు", "r": "Naa cheyi pattaavu", "e": "You held my hand" }
    ]},
    { "type": "verse", "label": "Verse 2", "lines": [
      { "n": "ఉదయం సాయంత్రం నిన్నే పాడెదను", "r": "Udayam saayantram ninne paadedanu", "e": "Morning and evening I will sing of You" },
      { "n": "నీ ప్రేమలో జీవించెదను", "r": "Nee premalo jeevinchedanu", "e": "I will live in Your love" }
    ]}
  ],
  "display": { "chorusAfterEachVerse": true },
  "author": { "name": "Demo text" }, "year": 2026, "bibleRefs": ["Psalm 18:2"], "tags": ["worship"],
  "rights": { "status": "demo", "basis": "Written for the prototype" },
  "layers": { "roman": "reviewed", "en": "draft" },
  "updated": "2026-11-19", "publish": true
}
```

`src/content/songs/pa/yisu-mera-sahara.json`
```json
{
  "slug": "yisu-mera-sahara",
  "numbers": [{ "book": "DP", "number": "23" }],
  "title": { "native": "ਯਿਸੂ ਮੇਰਾ ਸਹਾਰਾ", "roman": "Yisu Mera Sahara", "en": "Jesus, My Support" },
  "aliases": ["yesu", "yeshu", "sahara"],
  "sections": [
    { "type": "chorus", "label": "Chorus", "lines": [
      { "n": "ਯਿਸੂ ਮੇਰਾ ਸਹਾਰਾ ਹੈ", "r": "Yisu mera sahara hai", "e": "Jesus is my support" },
      { "n": "ਹਨੇਰੇ ਵਿੱਚ ਚਾਨਣ ਹੈ", "r": "Hanere vich chanan hai", "e": "He is light in the darkness" }
    ]},
    { "type": "verse", "label": "Verse 1", "lines": [
      { "n": "ਜਦ ਰਾਹ ਨਾ ਲੱਭੇ, ਉਹ ਹੱਥ ਫੜੇ", "r": "Jad raah na labbhe, oh hath phade", "e": "When I can't find the way, He holds my hand" },
      { "n": "ਹਰ ਡਰ ਨੂੰ ਦੂਰ ਕਰੇ", "r": "Har dar nu door kare", "e": "He removes every fear" }
    ]},
    { "type": "verse", "label": "Verse 2", "lines": [
      { "n": "ਸਵੇਰੇ ਸ਼ਾਮ ਮੈਂ ਉਸਦੇ ਗੀਤ ਗਾਵਾਂ", "r": "Savere shaam main usde geet gaavan", "e": "Morning and evening I sing His songs" },
      { "n": "ਉਸਦੇ ਪਿਆਰ ਵਿੱਚ ਜੀਵਨ ਬਿਤਾਵਾਂ", "r": "Usde pyaar vich jeevan bitaavan", "e": "I spend my life in His love" }
    ]}
  ],
  "display": { "chorusAfterEachVerse": true },
  "author": { "name": "Demo text" }, "year": 2026, "bibleRefs": ["Psalm 23:1"], "tags": ["comfort"],
  "rights": { "status": "demo", "basis": "Written for the prototype" },
  "layers": { "roman": "reviewed", "en": "draft" },
  "updated": "2026-11-19", "publish": true
}
```

---

## 7. Routes & pages

`astro.config.mjs` must set `trailingSlash: 'always'` and `build.format: 'directory'` so every URL ends in `/` (the offline cache keys depend on this).

| Route | File | Purpose | JS islands |
|---|---|---|---|
| `/` | `index.astro` | Home: continue, Sunday set, favourites, recent, books | `HomeLists`, `InstallPrompt` |
| `/search/` | `search.astro` | Tabs: **Number** (default) / **Words**. Query params: `?tab=words&q=…`, `?book=DT&n=117` | `Keypad`, `WordSearch` |
| `/song/<id>/` | `song/[id].astro` | Canonical song page (static HTML with all layers) | `SongToolbar`, `SetNavBar`, `ReportSheet`, `QrSheet` (share song) |
| `/b/<book>/<number>/` | `b/[book]/[number].astro` | Permalink by printed number → redirects to `/song/<id>/` (meta refresh 0 + `location.replace` + `<link rel=canonical>`). Book code lowercased in URL. | none |
| `/books/` | `books/index.astro` | All books grouped by language | none |
| `/books/<book>/` | `books/[book].astro` | Book index: numbers + titles, jump-to-number | `Keypad` (compact) |
| `/set/` | `set.astro` | Set editor and viewer. Shared set in hash: `/set/#s=<code>` | `SetEditor`, `QrSheet` |
| `/downloads/` | `downloads.astro` | Offline books + storage | `DownloadsPanel` |
| `/settings/` | `settings.astro` | Layers default, size, theme, keep-awake default, languages | `SettingsPanel` |
| `/about/` | `about.astro` | Mission, rights policy summary, credits per book, contact, version | none |
| `/no-connection/` | `no-connection.astro` | Offline fallback for pages not downloaded | none |
| `/admin/` | `public/admin/index.html` | Decap CMS (noindex) | CMS |
| `404` | `404.astro` | Not found + search box + "Report missing song" | none |

**Song page can be reached with set context:** `/song/<id>/?set=<code>&i=<index>` → `SetNavBar` shows Prev / "2 of 5" / Next.

---

## 8. Feature specs v1 ("Sunday-ready")

Each feature: **What**, **Rules**, **Acceptance** (must be covered by tests in §19).

### F1. Search by hymn number (highest priority)
- **What:** `/search/` opens on the Number tab: a book chip row (sorted by `order`, last used first), a big display (book name, digits, live match title), and a 3×4 keypad: `1-9`, `⌫`, `0`, `Open`.
- **Rules:**
  - Last-used book is remembered (`prefs.lastBookId`), default `site.defaultBookId`.
  - Live match: as digits are typed, look up `numbers.json[bookId][digits]` and show the song title (native script) under the digits. No match → "No song with this number in <Book>".
  - `Open` is enabled only when there's a match. Physical keyboard: digits, Backspace, Enter work.
  - For `alnum` books, if variants exist (`117`, `117a`), show them as chips under the display.
  - Max 4 digits (configurable).
  - Number lookup needs no network: `numbers.json` is precached.
- **Acceptance:** from Home, tap Search → type `117` → Open shows DT 117 in **under 1 s** on a mid-range Android, **offline**. Wrong number shows the no-match message. Enter key opens.

### F2. Search by words (any script, any spelling)
- **What:** Words tab: one input, results update as you type (debounce 120 ms). Searches title (all layers), first line, every line (all layers), aliases, book codes + numbers ("dt 117").
- **Rules:** fuzzy Roman normalisation (§11.2), prefix matching, fuzzy distance 0.2, title boost ×3, first line ×2, aliases ×2. Results show NumberBadge + native title + Roman title. Max 30 results, "Show more" loads next 30.
  - Searches only languages in `prefs.searchLangs` (default: all). Index shards load lazily per language.
  - Empty state: "Type a title or any line. Try: yeshu, thunai, grace". No results: "No match" + "Report a missing song" link.
- **Acceptance:** `yeshu`, `yesu`, `yisu` all find the Hindi and Punjabi demo songs; `thunai`/`tunai` find DT 117; `వెలుగు` finds DTe 45; `grace` finds EH 1. Works offline for downloaded languages.

### F3. Three-layer song page
- **What:** Header: back, NumberBadge (primary book number), favourite star. Title (native), subtitle (Roman · English). Layer chips: **[Language] · Roman · English** (multi-select, at least one stays on). Lyrics sections. Meta block. Report button.
- **Rules:**
  - The page is **static HTML with all 3 layers present**; visibility is controlled by `data-layers` on `<html>` (e.g. `data-layers="n r"`), set from localStorage by an inline script in `<head>` **before first paint** (no flash).
  - Each line renders as: native (`lang="ta"`), Roman (`lang="ta-Latn"`, smaller, muted), English (`lang="en"`, smaller, italic, muted).
  - If a layer is `draft`, show a tiny "draft" pill next to the chip; if `missing`, hide its chip.
  - Chorus sections have a left ribbon-red rule + tinted background. When `display.chorusAfterEachVerse`, show a compact "↻ Chorus" marker after each verse.
  - English songs: no layer chips.
  - All book numbers for this song are listed in the meta block ("DT 117 · KK 45").
- **Acceptance:** layer choice persists across songs and reloads; no layout jump on load (CLS < 0.05); Indic vowel signs never clip at any size (test with the largest size).

### F4. Readability
- **What:** A− / A+ (6 steps), theme (Light / Dark / High contrast / System), **Keep screen on** toggle.
- **Rules:**
  - Lyric sizes (rem): `[1, 1.125, 1.25, 1.4375, 1.625, 1.875]` (16-30 px at the default root size), default index 2 (1.25rem). Stored as `prefs.size`. Applied via `data-size` on `<html>` → CSS var.
  - Respect OS font scaling: all text sizes use `rem` (never px); keep `html { font-size: 100% }`.
  - Keep awake uses the **Screen Wake Lock API** (`src/lib/wakelock.ts`), turned back on after `visibilitychange` when it was on. If unsupported, the toggle shows "Not supported on this browser" and is disabled. Show state "☀ Screen on".
  - Default for keep awake: on when the song page is opened from a set; otherwise remember the last choice.
- **Acceptance:** largest size readable at arm's length on a 5.5" phone; settings persist; wake lock re-acquired after switching apps (manual test + unit test with mocked API).

```ts
// src/lib/wakelock.ts
type Listener = (on: boolean) => void;
let sentinel: WakeLockSentinel | null = null;
let wanted = false;
const listeners = new Set<Listener>();
const notify = () => listeners.forEach((l) => l(!!sentinel));
export const wakeLockSupported = () => typeof navigator !== 'undefined' && 'wakeLock' in navigator;
async function acquire() {
  if (!wakeLockSupported()) throw new Error('unsupported');
  sentinel = await navigator.wakeLock.request('screen');
  sentinel.addEventListener('release', () => { sentinel = null; notify(); });
  notify();
}
export async function setKeepAwake(on: boolean) {
  wanted = on;
  if (on) await acquire();
  else { await sentinel?.release(); sentinel = null; notify(); }
}
export function onWakeChange(l: Listener) { listeners.add(l); return () => listeners.delete(l); }
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (wanted && document.visibilityState === 'visible' && !sentinel) acquire().catch(() => {});
  });
}
```

### F5. Offline + install (PWA)
- **What:** Installable app. App shell, fonts, `numbers.json` precached. **Download a book** (per book) caches all its song pages + the language search index. Downloads screen shows size, date, status, Remove.
- **Rules:** see §12. Show an **Offline badge** in the header when `navigator.onLine === false`. Show "Last updated <date>" per book. Update check on app start (if online): compare manifest `version`; show "Update available · Update" per book.
- Install prompt: show the custom `InstallPrompt` **only after** the user has opened ≥ 2 songs or saved a favourite/set; never on first visit; dismiss = hide for 14 days.
- **Acceptance:** after downloading DT, airplane mode → open DT 117 by number and by words, both work; a non-downloaded song shows `/no-connection/` with "Download this book" guidance.

### F6. Sunday set list + QR share
- **What:** `/set/`: title (default "Sunday, <date>"), ordered songs, reorder (drag handle + ▲▼ buttons for accessibility), remove, optional note per song (e.g. "key of G", "verse 1 & 3 only"). Buttons: **Start singing**, **Share** (link + QR + Web Share), **Save**.
- **Rules:**
  - Add from any song page via "+ Set" (adds to the **current draft set**).
  - Sets are encoded in the URL (§13), no server. Saved sets stored locally (max 20).
  - Opening a shared link shows a read-only view with "Save to my sets" and "Start singing".
  - Start singing → `/song/<id>/?set=<code>&i=0` with SetNavBar.
  - Max 30 songs per set; code length check (warn if URL > 1,800 chars).
- **Acceptance:** build a 3-song set, share, open the link in a fresh browser profile → same 3 songs in order; Prev/Next work; works offline if those songs are downloaded.

### F7. Favourites, recent, continue
- Star toggles favourite (stores a snapshot `{id, title, lang, badge}` so Home renders without fetching). Recent = last 10 opened songs. Home shows **Continue** (last song) first.
- **Acceptance:** star persists after reload; Home shows the item instantly offline.

### F8. Report a mistake
- **What:** button at the bottom of every song → bottom sheet: line picker (select of all lines, prefixed by section label), correction textarea, Send.
- **Rules:** Send opens the prefilled Google Form in a new tab (`src/lib/report.ts`), or the GitHub issue form if `formUrl` is empty. Offline: disable Send, show "You're offline. Copy your correction" + Copy button.
- **Acceptance:** generated URL contains songId, title, line, correction, page URL, properly encoded.

### F9. Share a song
- Share button uses `navigator.share({ title, text: firstLine, url })`, falls back to copy link + toast "Link copied". Clean URL: `/song/<id>/`; number URL `/b/dt/117/` also shareable.

### F10. Books index
- `/books/` grouped by language (native label + English). `/books/<book>/`: list of numbers with titles (virtualised if > 500), sticky "Go to number" mini keypad.

### F11. Settings
- Default layers, lyric size, theme, keep-awake default, search languages, "Clear my data" (favourites, sets, downloads) with a confirm dialog, app version + content version.

### F12. Rules that apply everywhere
- **No ads. No login for readers. No third-party scripts** except optional Cloudflare Web Analytics.
- Everything must work with **JS disabled** for reading (song pages, book index, number permalinks). Islands are enhancement.

---

## 9. UI design system

Concept: **the printed hymnbook, digitised**: oxblood leather cover, gold-stamped numbers, thin white paper pages, a red ribbon bookmark. The signature element is the **ribbon** (the "This Sunday" card and the set nav) and the **gold-stamped NumberBadge**.

### 9.1 Tokens (`src/styles/tokens.css`)

```css
:root {
  /* Color: every color has one job */
  --leather: oklch(0.36 0.11 15);       /* primary: badges, active chips, primary surfaces */
  --leather-deep: oklch(0.27 0.08 15);  /* header/cover, app frame */
  --gold: oklch(0.80 0.12 82);          /* numbers on leather, star */
  --gold-soft: oklch(0.90 0.07 85);     /* text on leather */
  --ribbon: oklch(0.55 0.19 25);        /* CTA (Open, Start singing), chorus rule, section labels */
  --ok: oklch(0.55 0.09 175);           /* offline-ready, saved, keep-awake on */
  --warn: oklch(0.62 0.15 60);          /* draft layer, permission pending */
  --paper: oklch(0.985 0.004 15);       /* app background */
  --page: oklch(0.995 0.002 15);        /* cards/sheets */
  --ink: oklch(0.27 0.02 15);           /* text */
  --muted: oklch(0.48 0.03 15);         /* secondary text (≥ 4.5:1 on paper) */
  --line: oklch(0.91 0.012 15);         /* borders */
  --card: oklch(0.97 0.006 15);         /* key/tool backgrounds */

  /* Type */
  --font-ui: "Instrument Sans", system-ui, sans-serif;
  --font-display: "Domine", Georgia, serif;           /* titles + numbers */
  --font-indic: "Noto Sans Devanagari", "Noto Sans Tamil", "Noto Sans Telugu", "Noto Sans Gurmukhi", var(--font-ui);
  --text-sm: 0.875rem;  /* 14px: interface minimum */
  --text-base: 1.0625rem; /* 17px */
  --text-lg: 1.25rem;
  --text-xl: 1.625rem;
  --text-2xl: 2rem;
  --lyric-size: 1.25rem; /* 20px at default; set by data-size */
  --lh-indic: 1.75;
  --lh-latin: 1.5;

  /* Space (4px base) */
  --s1: 4px; --s2: 8px; --s3: 12px; --s4: 16px; --s6: 24px; --s8: 32px; --s12: 48px;

  /* Shape & motion */
  --r-sm: 8px; --r-md: 12px; --r-lg: 14px; --r-xl: 22px; --r-pill: 999px;
  --tap: 48px;                       /* minimum touch target */
  --ease: cubic-bezier(.2,.8,.2,1);
  --dur: 220ms;
}
html[data-theme="dark"] {
  --paper: oklch(0.19 0.015 15); --page: oklch(0.22 0.015 15); --card: oklch(0.24 0.02 15);
  --ink: oklch(0.93 0.01 60); --muted: oklch(0.74 0.02 40); --line: oklch(0.32 0.02 15);
}
html[data-theme="contrast"] {
  --paper: #fff; --page: #fff; --card: #f2f2f2; --ink: #000; --muted: #222; --line: #000;
  --ribbon: oklch(0.45 0.2 25); --leather: oklch(0.3 0.1 15);
}
/* rem so lyric sizes grow with the phone's font setting (keep html { font-size: 100% }) */
html[data-size="0"] { --lyric-size: 1rem; }      /* 16px at default */
html[data-size="1"] { --lyric-size: 1.125rem; }  /* 18 */
html[data-size="2"] { --lyric-size: 1.25rem; }   /* 20 (default) */
html[data-size="3"] { --lyric-size: 1.4375rem; } /* 23 */
html[data-size="4"] { --lyric-size: 1.625rem; }  /* 26 */
html[data-size="5"] { --lyric-size: 1.875rem; }  /* 30 */
@media (prefers-color-scheme: dark) {
  html[data-theme="system"] {
    --paper: oklch(0.19 0.015 15); --page: oklch(0.22 0.015 15); --card: oklch(0.24 0.02 15);
    --ink: oklch(0.93 0.01 60); --muted: oklch(0.74 0.02 40); --line: oklch(0.32 0.02 15);
  }
}
@media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }
```

> Implementation note: the `data-theme="system"` media query duplicates the dark values (CSS can't reference another selector's values); keep both blocks in sync. Text sizes use `rem`; touch targets stay in px (48px).

### 9.2 Typography rules
- UI text ≥ 14 px; body 17 px; never thin weights (min 400; lyrics native 400, titles 700).
- Indic text always uses `--font-indic` with `line-height: 1.75` and `padding-block: 0.1em` on lines so vowel marks/ascenders don't clip.
- Roman layer: 0.82em of lyric size, `--muted`. English layer: 0.74em, italic, `--muted`.
- Numbers (badges, keypad display): Domine 700, tabular feel; gold on leather.
- Section labels: 12 px, uppercase, letter-spacing .12em, `--ribbon` (this is the one allowed exception to the 14 px rule because it's a label, not reading text; make it 13 px if contrast checks fail).

### 9.3 Components (visual spec)
- **NumberBadge:** 52×48 (list) / 76×64 (song header); `--leather` bg, radius 8; book code 12 px gold-soft above number 19/28 px gold.
- **SongRow:** min-height 56; badge + (native title 16 px semibold, Roman subtitle 14 px muted); bottom border `--line`; whole row is the tap target.
- **Chip:** height ≥ 40, pill, 1.5 px border `--line`; active = `--leather` bg + `--gold-soft` text.
- **Keypad key:** height 58, radius 12, `--card`, 24 px digits; `Open` = `--ribbon` bg white text; disabled 35% opacity.
- **Ribbon card ("This Sunday"):** ribbon gradient bg (`--ribbon` → darker), white text, gold ribbon tail (14×58, notched bottom) on the left.
- **Bottom sheet:** radius 22 top, grab handle 40×5, slides up 280 ms `--ease`, scrim 45% ink.
- **Bottom nav:** 4 items: Home ⌂, Search #, Set list ≡, Offline ↓. 52 px tall items, active = `--card` bg + `--ribbon` icon. Settings and About live under a header ⋮ menu on Home.
- **Toast:** bottom, above nav, 3 s, `role="status"`.
- Icons: inline SVG (Lucide-style, 2 px stroke), no icon font.

### 9.4 Motion
Ribbon on Home sways ±1.6° over 6 s (ambient, disabled for reduced motion). Sheets slide up. Keypad keys scale .97 on press. Nothing else animates.

---

## 10. Screen-by-screen UI instructions

All screens: mobile-first (design at 360×740, test 320 → 430 wide; tablet/desktop centres a 480 px column with the paper background around it). Bottom nav fixed; content scrolls; safe-area insets respected (`env(safe-area-inset-bottom)`).

### 10.1 Home `/`
1. Header: app name (Domine 20 px) left; Offline badge (when offline) + ⋮ menu (Settings, About) right.
2. Status pill: "● Offline ready · N books · updated <date>" (green) or "Download a book to use offline" (link to /downloads/).
3. **Continue** card: big NumberBadge + "CONTINUE" label + native title. Hidden if no history.
4. **This Sunday** ribbon card: "N songs in your set" → `/set/`. If no draft set: "Plan Sunday's songs".
5. **Favourites** list (SongRow), empty state: "Tap ☆ on any song to keep it here."
6. **Recent** (max 5).
7. **Hymnbooks**: SongRow-style rows with the book code in the badge, name, "Language · N songs".
- Rendering: book list is static; personal lists render from localStorage in `HomeLists` (render a skeleton of fixed height to avoid layout shift).

### 10.2 Search `/search/`
1. Segmented control: **Number** | **Words** (remember last tab).
2. Number tab: book chips (scroll horizontally) → display card (book name 13 px, digits 52 px Domine leather/gold, match line) → keypad → hint "Type the number from your printed book".
3. Words tab: search input (autofocus, 52 px tall, `inputmode="search"`, `enterkeyhint="search"`) → helper text → results list.
4. Deep links: `/search/?book=DT&n=117` auto-opens the song if found.

### 10.3 Song `/song/<id>/`
1. Sticky header (56 px): back (48 px circle), NumberBadge centre (primary number = the book the user came from, else first in `numbers`), star.
2. Title (Domine/Indic 25 px, centred) + subtitle (Roman · English, 14 px muted).
3. Layer chips (centred).
4. Tool row: A−, A+, ☀ Keep awake, + Set, Share (icons + short labels, each ≥ 44 px tall).
5. Lyrics: sections with 20 px gap; chorus tinted with left ribbon rule; lines 12 px apart.
6. Meta: Author (+ years), Books ("DT 117 · KK 45" each linking to `/b/…/`), Bible refs, Rights badge (Public domain / Licensed / Demo).
7. "Report a mistake in this song" dashed button.
8. When `?set=` present: SetNavBar fixed above bottom nav: "‹ Prev | 2 of 5 · <next title> | Next ›". Swipe left/right on lyrics also navigates (threshold 60 px, ignore vertical scrolls).
- No controls overlap the lyrics. The bottom nav hides on scroll down, shows on scroll up (song page only).

### 10.4 Set list `/set/`
1. Title (editable inline, Domine 26 px), date chip.
2. Rows: order number (ribbon colour), SongRow, note (tap to edit), drag handle + ▲▼✕.
3. Empty: "Add songs with + Set on any song page" + "Search songs" button.
4. Action bar: **Start singing** (primary, ribbon) · **Share** (secondary).
5. Share sheet: QR (180 px, dark leather on white), short link (monospace), "Copy link", "Share…" (Web Share), note "Opens read-only. Works offline after first open."
6. Shared view (`#s=` present and not one of my sets): banner "Shared set from <title>" + "Save to my sets".
7. "My sets" list below (saved sets, newest first, delete with undo toast).

### 10.5 Downloads `/downloads/`
1. Intro: "Download a book once. It works in church with no signal."
2. Book rows: name, language, size (from manifest `bytes`), status: Download / progress bar % / ✓ Saved <date> / Update available. Overflow: Remove.
3. Storage used (`navigator.storage.estimate()`), "Ask to keep my downloads safe" → `navigator.storage.persist()`.

### 10.6 Settings `/settings/`
Groups: Reading (default layers, size slider with preview line in each script, theme), Singing (keep awake default), Search (languages), Data (export my sets as JSON, import, clear data), About (version, content version = git short SHA + date).

### 10.7 No connection `/no-connection/`
"You're offline and this song isn't downloaded yet." Buttons: "Go to downloaded books" (Downloads), "Search downloaded songs".

### 10.8 States checklist (every screen)
Loading (skeleton, fixed heights), empty, error ("Something went wrong. Try again" + retry), offline, very long titles (2-line clamp), 1-line songs, 40-line songs, alnum numbers, RTL not needed.

### 10.9 UI strings (`src/i18n/en.json`), required keys
```json
{
  "nav.home": "Home", "nav.search": "Search", "nav.set": "Set list", "nav.offline": "Offline",
  "home.continue": "Continue", "home.sunday": "This Sunday", "home.sundayEmpty": "Plan Sunday's songs",
  "home.favourites": "Favourites", "home.favEmpty": "Tap ☆ on any song to keep it here.",
  "home.recent": "Recent", "home.books": "Hymnbooks", "home.offlineReady": "Offline ready",
  "search.number": "Number", "search.words": "Words", "search.typeNumber": "Type the number from your printed book",
  "search.noNumber": "No song with this number in {book}", "search.open": "Open",
  "search.placeholder": "Title, first line or any line", "search.hint": "Any script or spelling. Try: yeshu, thunai, grace",
  "search.none": "No match", "search.reportMissing": "Report a missing song",
  "song.keepAwake": "Keep awake", "song.screenOn": "Screen on", "song.addSet": "+ Set", "song.inSet": "✓ In set",
  "song.share": "Share", "song.report": "Report a mistake in this song", "song.draft": "draft",
  "song.author": "Author", "song.books": "Books", "song.bible": "Bible", "song.rights": "Rights",
  "rights.public_domain": "Public domain", "rights.licensed": "Licensed", "rights.demo": "Demo text",
  "set.title": "Sunday set", "set.start": "Start singing", "set.share": "Share", "set.save": "Save to my sets",
  "set.empty": "Add songs with + Set on any song page.", "set.scan": "Scan to follow this set",
  "set.of": "{i} of {n} in set", "set.prev": "Prev", "set.next": "Next",
  "dl.intro": "Download a book once. It works in church with no signal.", "dl.download": "Download",
  "dl.saved": "Saved", "dl.update": "Update available", "dl.remove": "Remove",
  "report.title": "What's wrong?", "report.line": "Line", "report.correction": "Correction",
  "report.send": "Send to editors", "report.offline": "You're offline. Copy your correction and send it later.",
  "toast.copied": "Link copied", "offline.badge": "Offline", "update.available": "A new version is ready", "update.reload": "Update"
}
```

---

## 11. Search

### 11.1 Generated files (by `scripts/build-indexes.ts`, run before `astro build`)
- `public/search/numbers.json`: `{ "DT": { "117": "ta-yesuve-en-thunai" }, "EH": { "1": "en-amazing-grace" } }` (book keys as in data; lookup is case-insensitive in code). **Precached.**
- `public/search/meta.json`: `{ "<id>": ["<native title>", "<roman title>", "<lang>", "<BOOK NUM>"] }` small display data. **Precached.**
- `public/search/idx-<lang>.json`: serialized MiniSearch index for that language (fields below). Loaded lazily, cached when a book of that language is downloaded.
- `public/dl/<bookId>.json`: `{ "book": "DT", "version": "<sha256 of contents, 12 chars>", "updated": "2026-11-19", "bytes": 123456, "urls": ["/song/ta-yesuve-en-thunai/", "/b/dt/117/"], "searchIndex": "/search/idx-ta.json" }`.
- All generated files exclude non-publishable songs (§5.3).

### 11.2 Normaliser (`src/lib/normalize.ts`), used at **index time and query time**

```ts
import { INDIC_ANY } from './scripts';
const ZW = /[\u200B-\u200D\uFEFF]/g;

/** Normalise one token for matching. Indic: NFC + drop zero-width. Latin: fuzzy Indian-romanisation rules. */
export function normalizeToken(token: string): string {
  if (!token) return '';
  if (INDIC_ANY.test(token)) return token.normalize('NFC').replace(ZW, '');
  let s = token.toLowerCase().normalize('NFKD').replace(/\p{M}/gu, ''); // strip diacritics (ā → a)
  s = s.replace(/[^a-z0-9]/g, '');
  s = s
    .replace(/sh/g, 's').replace(/zh/g, 'l').replace(/th/g, 't').replace(/dh/g, 'd')
    .replace(/ph/g, 'f').replace(/bh/g, 'b').replace(/kh/g, 'k').replace(/gh/g, 'g')
    .replace(/ch/g, 'c').replace(/w/g, 'v').replace(/q/g, 'k').replace(/x/g, 'ks')
    .replace(/aa/g, 'a').replace(/ee|ii/g, 'i').replace(/oo|uu/g, 'u')
    .replace(/yi/g, 'ye')
    .replace(/([a-z])\1+/g, '$1'); // collapse doubles: labbhe → labe, pattaavu → patavu
  return s;
}

export function normalizeText(text: string): string[] {
  return text.split(/[\s\p{P}\p{S}]+/u).map(normalizeToken).filter(Boolean);
}
```

Tests (must pass): `yeshu`,`yesu`,`yisu` → same token `yesu`; `Thunai`,`tunai` → `tunai`; `aadhaaram`,`adharam` → `adaram`; `neere`→`nire`; `ā`→`a`; Tamil/Telugu tokens unchanged except NFC/zero-width removal.

### 11.3 MiniSearch config (same in build and client)

```ts
export const MS_OPTIONS = {
  idField: 'id',
  fields: ['title', 'first', 'lines', 'aliases', 'nums'],
  storeFields: ['id'],
  tokenize: (text: string) => text.split(/[\s\p{P}\p{S}]+/u),
  processTerm: (term: string) => normalizeToken(term) || null,
  searchOptions: { prefix: true, fuzzy: 0.2, boost: { title: 3, first: 2, aliases: 2, nums: 2 }, combineWith: 'AND' as const },
};
// Document per song:
// title  = native + roman + en titles
// first  = first line n + r
// lines  = all lines n + r + e joined
// aliases= aliases joined
// nums   = "DT 117 DT117 dt117" for every number entry
```

Client `search.ts`: `loadIndex(lang)` fetches `idx-<lang>.json` → `MiniSearch.loadJSON(json, MS_OPTIONS)`; `query(q)` runs across loaded shards, merges by score, maps ids via `meta.json`. If query is `^[A-Za-z]{1,6}\s?\d+[a-z]?$` (e.g. "dt117"), also do a direct number lookup and pin it first.

---

## 12. Offline / PWA

### 12.1 `astro.config.mjs`

```js
import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';
import sitemap from '@astrojs/sitemap';
import AstroPWA from '@vite-pwa/astro';

export default defineConfig({
  site: 'https://stuti.pages.dev',
  output: 'static',
  trailingSlash: 'always',
  build: { format: 'directory' },
  integrations: [
    preact(),
    sitemap({ filter: (p) => !p.includes('/admin/') && !p.includes('/no-connection/') }),
    AstroPWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'prompt',
      injectRegister: false, // we register manually in Base.astro via workbox-window
      manifest: {
        name: 'Stuti: Digital Hymnal', short_name: 'Stuti',
        description: 'Christian songs in Hindi, Tamil, Telugu, Punjabi and English. Offline.',
        lang: 'en', start_url: '/', scope: '/', display: 'standalone', orientation: 'portrait',
        background_color: '#fbf8f8', theme_color: '#4a1820',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ],
        shortcuts: [
          { name: 'Search by number', url: '/search/' },
          { name: 'Sunday set', url: '/set/' }
        ]
      },
      injectManifest: {
        globPatterns: [
          '_astro/**/*.{js,css}',
          '_astro/**/instrument-sans-latin-*.woff2',
          '_astro/**/domine-latin-*.woff2',
          'index.html', 'search/index.html', 'set/index.html', 'downloads/index.html',
          'settings/index.html', 'about/index.html', 'no-connection/index.html', 'books/index.html',
          'search/numbers.json', 'search/meta.json', 'icons/*.png', 'favicon.svg', 'manifest.webmanifest'
        ],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024
      },
      devOptions: { enabled: false }
    })
  ]
});
```

> Fonts: precache only the **Latin** subsets of Instrument Sans/Domine (check the real file names Astro outputs for @fontsource and adjust the patterns). Indic fonts are fetched **with their book** (§12.4) using `dist/dl/fonts.json`, written after the build by `scripts/font-manifest.ts` (`"postbuild"`): `{ "hi": [woff2 urls], "ta": [...], "te": [...], "pa": [...] }`. Runtime CacheFirst handles anything else. `scripts/check-precache.ts` runs in CI after the build: it reads the precache manifest from `dist/sw.js`, sums file sizes, prints the 10 biggest files and **fails if the total is > 1.5 MB**.
>
> Font weights: Indic fonts load only **400 and 700**; Instrument Sans 400/600/700; Domine 700.

### 12.2 Service worker (`src/sw.ts`)

```ts
/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches, matchPrecache } from 'workbox-precaching';
import { registerRoute, setCatchHandler } from 'workbox-routing';
import { NetworkFirst, StaleWhileRevalidate, CacheFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';

declare let self: ServiceWorkerGlobalScope;

// Ignore ALL query params when matching precached pages (/search/?book=..., /set/?..)
precacheAndRoute(self.__WB_MANIFEST, { ignoreURLParametersMatching: [/.*/] });
cleanupOutdatedCaches();

// Song + book pages: network first (fresh when online), cache when offline.
// "Download book" puts pages into this same cache name, saved under clean URLs (no query).
// ignoreSearch: /song/<id>/?set=…&i=2 must find the copy saved as /song/<id>/.
registerRoute(
  ({ request, url }) => request.mode === 'navigate' && !url.pathname.startsWith('/admin/'),
  new NetworkFirst({ cacheName: 'stuti-pages', networkTimeoutSeconds: 3, matchOptions: { ignoreSearch: true } })
);

// Search shards + download manifests
registerRoute(
  ({ url }) => url.pathname.startsWith('/search/') || url.pathname.startsWith('/dl/'),
  new StaleWhileRevalidate({ cacheName: 'stuti-data' })
);

// Fonts
registerRoute(
  ({ request }) => request.destination === 'font',
  new CacheFirst({ cacheName: 'stuti-fonts', plugins: [new ExpirationPlugin({ maxEntries: 60 })] })
);

setCatchHandler(async ({ request }) => {
  if (request.mode === 'navigate') {
    return (await matchPrecache('/no-connection/index.html')) ?? Response.error();
  }
  return Response.error();
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
```

### 12.3 Register + update toast (in `Base.astro`)
Use `workbox-window`: `new Workbox('/sw.js')`; on `waiting` show `UpdateToast` ("A new version is ready · Update") → `wb.messageSkipWaiting()` → reload on `controlling`.

### 12.4 Book downloads (`src/lib/offline.ts`)

```ts
import { storage } from './storage';
const PAGES = 'stuti-pages';
const DATA = 'stuti-data';
const FONTS = 'stuti-fonts';
export type BookManifest = { book: string; version: string; updated: string; bytes: number; urls: string[]; searchIndex: string };

export async function fetchManifest(bookId: string): Promise<BookManifest> {
  const r = await fetch(`/dl/${bookId}.json`, { cache: 'no-store' });
  if (!r.ok) throw new Error(`manifest ${r.status}`);
  return r.json();
}

export async function downloadBook(bookId: string, lang: string, onProgress: (p: number) => void) {
  const m = await fetchManifest(bookId);
  const pages = await caches.open(PAGES);
  const data = await caches.open(DATA);
  await data.add(m.searchIndex);
  const fontUrls: string[] = await fetch('/dl/fonts.json').then((r) => r.json()).then((f) => f[lang] ?? []).catch(() => []);
  if (fontUrls.length) await (await caches.open(FONTS)).addAll(fontUrls);
  let done = 0;
  for (let i = 0; i < m.urls.length; i += 6) {
    const chunk = m.urls.slice(i, i + 6);
    await Promise.all(chunk.map(async (u) => {
      const res = await fetch(u, { credentials: 'same-origin' });
      if (res.ok) await pages.put(u, res);
    }));
    done += chunk.length;
    onProgress(done / m.urls.length);
  }
  storage.downloads.set({ ...storage.downloads.get(), [bookId]: { version: m.version, updated: m.updated, bytes: m.bytes, at: new Date().toISOString(), urls: m.urls } });
  await navigator.storage?.persist?.();
}

// Only delete pages no other downloaded book still needs. Uses the stored URL list so it works offline.
export async function removeBook(bookId: string) {
  const d = { ...storage.downloads.get() };
  const mine = d[bookId]?.urls ?? (await fetchManifest(bookId).catch(() => null))?.urls ?? [];
  delete d[bookId];
  const keep = new Set(Object.values(d).flatMap((x) => x.urls ?? []));
  const pages = await caches.open(PAGES);
  await Promise.all(mine.filter((u) => !keep.has(u)).map((u) => pages.delete(u)));
  storage.downloads.set(d);
}

export async function checkUpdates(): Promise<string[]> {
  const d = storage.downloads.get();
  const out: string[] = [];
  for (const id of Object.keys(d)) {
    try { const m = await fetchManifest(id); if (m.version !== d[id].version) out.push(id); } catch { /* offline */ }
  }
  return out;
}
```

Edge cases: songs shared by two downloaded books are only fetched once (Cache API overwrites). Removing a book does **not** delete pages also listed by another downloaded book (`removeBook` above). Downloads always save clean URLs without query strings (`/song/<id>/`). Handle `QuotaExceededError` with a clear message.

---

## 13. Set lists

### 13.1 Encoding (`src/lib/setlist.ts`)

```ts
export type SetItem = { id: string; note?: string; book?: string };
export type SetList = { v: 1; t: string; d?: string; s: SetItem[] };

export function encodeSet(set: SetList): string {
  const bytes = new TextEncoder().encode(JSON.stringify(set));
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeSet(code: string): SetList | null {
  try {
    const b64 = code.replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '==='.slice((b64.length + 3) % 4);
    const bin = atob(padded);
    const obj = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))));
    if (obj?.v !== 1 || !Array.isArray(obj.s) || typeof obj.t !== 'string') return null;
    obj.s = obj.s
      .filter((x: any) => typeof x?.id === 'string' && /^(en|hi|ta|te|pa)-[a-z0-9-]+$/.test(x.id))
      .slice(0, 30)
      .map((x: any) => ({
        id: x.id,
        ...(typeof x.note === 'string' && x.note ? { note: x.note.slice(0, 200) } : {}),
        ...(typeof x.book === 'string' && /^[A-Za-z]{1,6}$/.test(x.book) ? { book: x.book } : {}),
      }));
    obj.t = obj.t.slice(0, 80);
    return obj as SetList;
  } catch { return null; }
}
```

- Share URL: `${site.url}/set/#s=${code}` (hash = never sent to server, works offline).
- Song URLs inside a set: `/song/<id>/?set=<code>&i=<n>`.
- Unknown ids in a shared set (song removed) → show "This song is no longer available" row.
- Tests: round-trip with Indic titles; tampered code returns null; > 30 items truncated; a 5,000-character note is cut to 200; a non-text note and a bad `book` are dropped.

### 13.2 QR
`QRCode.toString(url, { type: 'svg', errorCorrectionLevel: 'M', margin: 1, color: { dark: '#3b1a1f', light: '#ffffff' } })` → inject SVG. Provide "Download QR" (SVG → PNG via canvas) for printing on church bulletins.

### 13.3 Follow mode (v2 hook)
Not in v1. Keep `SetList` versioned (`v`) so v2 can add `live: <room-id>`.

---

## 14. Local storage & state (`src/lib/storage.ts`)

All keys prefixed `stuti:` and JSON-encoded with a `v` field for migrations. Wrap in try/catch (private mode / quota).

| Key | Shape | Max |
|---|---|---|
| `stuti:prefs` | `{ v:1, layers:{n:boolean,r:boolean,e:boolean}, size:0-5, theme:'system'|'light'|'dark'|'contrast', keepAwake:boolean, lastBookId:string, lastTab:'number'|'words', searchLangs:string[] }` | |
| `stuti:favs` | `{ v:1, items: {id,title,lang,badge}[] }` | 500 |
| `stuti:recent` | `{ v:1, items: {id,title,lang,badge,at}[] }` | 10 |
| `stuti:draftSet` | `SetList` | 30 songs |
| `stuti:sets` | `{ v:1, items: (SetList & {code:string, savedAt:string})[] }` | 20 |
| `stuti:downloads` | `{ [bookId]: {version,updated,bytes,at,urls:string[]} }` | |
| `stuti:installNudge` | `{ dismissedAt?: string, songOpens: number }` | |

Inline head script in `Base.astro` (runs before paint):
```html
<script is:inline>
  try {
    var p = JSON.parse(localStorage.getItem('stuti:prefs') || '{}');
    var l = p.layers || { n: true, r: true, e: false };
    var h = document.documentElement;
    h.dataset.layers = ['n','r','e'].filter(function (k) { return l[k]; }).join(' ') || 'n';
    h.dataset.size = String(p.size == null ? 2 : p.size);
    h.dataset.theme = p.theme || 'system';
  } catch (e) {}
</script>
```
CSS: `html:not([data-layers~="r"]) .line .r { display:none }` (same for `n`, `e`).

---

## 15. Content workflow (add / update / correct)

### 15.1 Roles & tools
- **Editors** use Decap CMS at `/admin` (§17). Every save = a branch + Pull Request (editorial workflow: Draft → In review → Ready).
- **Volunteers without GitHub** submit through a Google Form (title, number, book, lyrics, their name). Admin imports with `tools/import/sheet_to_json.py` into a PR.
- **Moderators** (CODEOWNERS per language folder) review PRs. Cloudflare Pages builds a **preview URL per PR** for proofreading on a phone.

### 15.2 Adding a new hymnbook (digitising a printed book)
1. Admin creates `src/content/books/<ID>.json` (status `active`).
2. Scan pages (phone camera, flat, good light, 300 dpi equivalent). Store scans **outside** the public repo (e.g. Google Drive); reference in `source.scan`.
3. Run OCR (§16.1) → draft song JSON files with `layers.roman:"missing"`, `layers.en:"missing"`, `rights.status:"permission_pending"`, `publish:false`.
4. Run transliteration (§16.2) → fills `r`, sets `layers.roman:"draft"`.
5. Run AI translation draft (§22.1) → fills `e`, sets `layers.en:"draft"`.
6. Native-speaker editor proofreads in CMS against the scan (side-by-side): fixes `n`, then `r`, then `e`; sets layers to `reviewed`.
7. Rights check (§24): set `rights.*`; only then `publish:true`.
8. PR review by language moderator → merge → auto-deploy (~2 min).

### 15.3 Validation rules (`scripts/validate.ts`, runs in CI and `prebuild`)
Errors (fail build):
1. Zod schema passes for every file.
2. File must be `songs/<lang>/<slug>.json` with `<lang>` ∈ `en|hi|ta|te|pa` and `<slug>` matching `^[a-z0-9-]{2,80}$`; the id `<lang>-<slug>` is unique. (No `id`/`lang` in the JSON: both come from the path, §5.3.)
3. Book `id` must be unique **ignoring case** (`DT` and `Dt` would both become `/b/dt/`).
4. Every `numbers[].book` exists; (book, number) unique; book `lang` === song language from the path (warn instead if `book.lang === 'en'` mixed books are allowed later).
5. Script check: `n` contains the song script (§5.5) for non-en; `r`/`e` Latin only.
6. Layer completeness: if `layers.roman !== 'missing'` every line has `r`; same for `e`.
7. Rights gate: `publish:true` requires `status ∈ {public_domain, licensed}` (or `demo` when `PUBLIC_INCLUDE_DEMO=true`). `public_domain` requires `author.died <= currentYear - 61` or non-empty `rights.basis`. `licensed` requires `holder` and `evidence`.
8. `updated` is a valid date not in the future.
9. No HTML in text fields (`/<[^>]+>/`).
10. Line length ≤ 200 chars; ≤ 300 lines per song.
Warnings (print, don't fail): `layers.en === 'draft'` on published songs, missing aliases, missing bibleRefs, duplicate first lines across songs (possible duplicates), `slug` field differs from the file name.

`PUBLIC_INCLUDE_DEMO` must be set wherever validate runs while demo songs are published: CI sets it for the whole job (§18.3), local runs read it from `.env` (copy `.env.example`), Cloudflare sets it as an env var (§18.2). Remove it everywhere at real launch.

Output: a summary table per book (songs, published, pending, draft layers). `npm run validate -- --json` for CI annotations.

### 15.4 Corrections
"Report a mistake" → Google Form → responses Sheet. Weekly: moderator triages; for each valid report, edit in CMS → PR → merge. Optional: a Google Apps Script that turns each form response into a GitHub issue (labels `correction`, `lang:<x>`). GitHub issue form `.github/ISSUE_TEMPLATE/lyric-correction.yml` exists for technical users.

### 15.5 Versioning
Git history = full version history. `updated` field changes on every content edit (CMS sets it automatically: `widget: datetime`, `format: YYYY-MM-DD`, `default: '{{now}}'`). Download manifests change `version` hash → users see "Update available".

---

## 16. Tools

`tools/requirements.txt`
```text
pytesseract>=0.3.10
pillow>=10
aksharamukha>=2.1
pandas>=2.2
```
System: install Tesseract 5 with `hin`, `tam`, `tel`, `pan` traineddata (`tessdata_best` for accuracy).

### 16.1 `tools/ocr/ocr.py`
- CLI: `python tools/ocr/ocr.py --lang ta --book KK --start 1 --images scans/kk/*.jpg --out tools/ocr/out/`
- Steps: load image → grayscale → deskew (OpenCV optional) → `pytesseract.image_to_string(img, lang='tam', config='--psm 4')` → split into songs by detecting hymn numbers at line start (`^\s*(\d{1,4})[.)]`) → split sections by blank lines and labels (`பல்லவி`, `அனுபல்லவி`, `சரணங்கள்`, `Chorus`, `कोरस`, `टेक`) → write draft JSON per song (§5.3) with `publish:false`, `rights.status:"permission_pending"`, `source.scan` = image filename.
- Lang map: `hi→hin`, `ta→tam`, `te→tel`, `pa→pan`, `en→eng`.
- Print a report: songs found, low-confidence lines (use `image_to_data` conf < 70).

### 16.2 `tools/translit/translit.py`
- CLI: `python tools/translit/translit.py src/content/songs/ta/*.json --scheme readable --only-missing`
- Uses Aksharamukha: `from aksharamukha import transliterate; transliterate.process(SRC, 'RomanReadable', text)` with `SRC = {'hi':'Devanagari','ta':'Tamil','te':'Telugu','pa':'Gurmukhi'}`.
- Post-process to match common church spellings (configurable per language in `tools/translit/rules/<lang>.json`, e.g. Tamil `yEsu → Yesu`, remove capitals used for long vowels, `zh` kept for ழ, Hindi schwa deletion at word end: "yeshu mera sahaara" style).
- Writes `r` only where empty (unless `--overwrite`), sets `layers.roman:"draft"`. Never touches `n`.

### 16.3 AI translation draft
- Use the prompt in §22.1 with any LLM, one song at a time, JSON in → JSON out. Script optional: `tools/translate/translate.py` reading `OPENAI_API_KEY`/other key from env (not committed). Output only fills `e`, sets `layers.en:"draft"`.

### 16.4 `tools/import/sheet_to_json.py`
- Input: CSV export of the Google Form responses (columns: Timestamp, Name, Language, Book, Number, Title, Lyrics, Source/Permission, Email). Splits lyrics into sections by blank lines → draft JSON → `src/content/songs/<lang>/<slug>.json` (slug from Roman title or translit of native title). Never overwrites existing files (writes `.new.json` and prints a diff hint).

---

## 17. Admin / CMS (Decap)

### 17.1 `public/admin/index.html`
```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex" />
  <title>Stuti Admin</title>
  <!-- Pin the exact latest 3.x version at build time (no ^ ranges) -->
  <script src="https://unpkg.com/decap-cms@3.x.y/dist/decap-cms.js"></script>
</head>
<body></body>
</html>
```

### 17.2 `public/admin/config.yml`
```yaml
backend:
  name: github
  repo: OWNER/stuti            # change
  branch: main
  base_url: https://stuti-cms-auth.OWNER.workers.dev   # GitHub OAuth proxy on Cloudflare Workers
  squash_merges: true
publish_mode: editorial_workflow
media_folder: "public/uploads"
public_folder: "/uploads"
site_url: https://stuti.pages.dev
locale: en

song_fields: &song_fields
  - { label: "URL name (lowercase-with-hyphens, e.g. yesuve-en-thunai). Never change after publishing.", name: slug, widget: string, pattern: ['^[a-z0-9-]{2,80}$', "lowercase letters, numbers, hyphens"] }
  - label: "Hymn numbers"
    name: numbers
    widget: list
    fields:
      - { label: "Book", name: book, widget: relation, collection: books, search_fields: [id, "name.en"], value_field: id, display_fields: [id, "name.en"] }
      - { label: "Number", name: number, widget: string }
  - label: "Title"
    name: title
    widget: object
    fields:
      - { label: "Native script", name: native, widget: string }
      - { label: "Roman", name: roman, widget: string, required: false }
      - { label: "English", name: en, widget: string, required: false }
  - { label: "Extra search words", name: aliases, widget: list, required: false }
  - label: "Sections"
    name: sections
    widget: list
    summary: "{{fields.label}}"
    fields:
      - { label: "Type", name: type, widget: select, options: [verse, chorus, bridge, refrain, other] }
      - { label: "Label (e.g. Verse 1, Pallavi)", name: label, widget: string }
      - label: "Lines"
        name: lines
        widget: list
        summary: "{{fields.n}}"
        fields:
          - { label: "Native", name: n, widget: string }
          - { label: "Roman", name: r, widget: string, required: false }
          - { label: "English", name: e, widget: string, required: false }
  - label: "Display"
    name: display
    widget: object
    fields:
      - { label: "Show '↻ Chorus' after each verse", name: chorusAfterEachVerse, widget: boolean, default: false }
  - label: "Author"
    name: author
    widget: object
    fields:
      - { label: "Name", name: name, widget: string, default: "Unknown" }
      - { label: "Born (year)", name: born, widget: number, value_type: int, required: false }
      - { label: "Died (year)", name: died, widget: number, value_type: int, required: false }
  - { label: "Composer", name: composer, widget: string, required: false }
  - { label: "Tune", name: tune, widget: string, required: false }
  - { label: "Year written", name: year, widget: number, value_type: int, required: false }
  - { label: "Bible references", name: bibleRefs, widget: list, required: false }
  - { label: "Tags", name: tags, widget: list, required: false }
  - label: "Rights (required before publishing)"
    name: rights
    widget: object
    fields:
      - { label: "Status", name: status, widget: select, options: [permission_pending, public_domain, licensed, demo, rejected], default: permission_pending }
      - { label: "Basis (why)", name: basis, widget: text, required: false }
      - { label: "Evidence (link / file ref)", name: evidence, widget: string, required: false }
      - { label: "Rights holder", name: holder, widget: string, required: false }
      - { label: "Checked by", name: checkedBy, widget: string, required: false }
      - { label: "Checked on", name: checkedOn, widget: datetime, format: "YYYY-MM-DD", date_format: "YYYY-MM-DD", time_format: false, required: false }
  - label: "Layer status"
    name: layers
    widget: object
    fields:
      - { label: "Roman", name: roman, widget: select, options: [missing, draft, reviewed], default: missing }
      - { label: "English", name: en, widget: select, options: [missing, draft, reviewed], default: missing }
  - label: "Source scan"
    name: source
    widget: object
    required: false
    fields:
      - { label: "Scan file/link", name: scan, widget: string, required: false }
      - { label: "Page", name: page, widget: number, value_type: int, required: false }
  - { label: "Updated", name: updated, widget: datetime, format: "YYYY-MM-DD", date_format: "YYYY-MM-DD", time_format: false, default: "{{now}}" }
  - { label: "Publish", name: publish, widget: boolean, default: false }

collections:
  - name: books
    label: Books
    folder: src/content/books
    extension: json
    format: json
    create: true
    identifier_field: id
    slug: "{{id}}"
    fields:
      - { label: ID, name: id, widget: string }
      - label: Name
        name: name
        widget: object
        fields:
          - { label: Native, name: native, widget: string }
          - { label: English, name: en, widget: string }
      - { label: Language, name: lang, widget: select, options: [en, hi, ta, te, pa] }
      - { label: Edition, name: edition, widget: string, required: false }
      - { label: Publisher, name: publisher, widget: string, required: false }
      - { label: Description, name: description, widget: text, required: false }
      - { label: Order, name: order, widget: number, value_type: int, default: 100 }
      - { label: Numbering, name: numbering, widget: select, options: [numeric, alnum], default: numeric }
      - { label: Status, name: status, widget: select, options: [demo, active, archived], default: active }
  - { name: songs_hi, label: "Songs · Hindi", folder: src/content/songs/hi, extension: json, format: json, create: true, identifier_field: slug, slug: "{{slug}}", summary: "{{title.native}} · {{title.roman}}", fields: *song_fields }
  - { name: songs_ta, label: "Songs · Tamil", folder: src/content/songs/ta, extension: json, format: json, create: true, identifier_field: slug, slug: "{{slug}}", summary: "{{title.native}} · {{title.roman}}", fields: *song_fields }
  - { name: songs_te, label: "Songs · Telugu", folder: src/content/songs/te, extension: json, format: json, create: true, identifier_field: slug, slug: "{{slug}}", summary: "{{title.native}} · {{title.roman}}", fields: *song_fields }
  - { name: songs_pa, label: "Songs · Punjabi", folder: src/content/songs/pa, extension: json, format: json, create: true, identifier_field: slug, slug: "{{slug}}", summary: "{{title.native}} · {{title.roman}}", fields: *song_fields }
  - { name: songs_en, label: "Songs · English", folder: src/content/songs/en, extension: json, format: json, create: true, identifier_field: slug, slug: "{{slug}}", summary: "{{title.native}}", fields: *song_fields }
```
> Note: the `song_fields` anchor key at the root is a YAML helper; if the Decap version in use rejects unknown root keys, inline the list into each collection. Verify the `select` defaults and the `relation` nested `display_fields` with the installed version.

### 17.3 Auth
Deploy a GitHub OAuth proxy on Cloudflare Workers (free). Option: `sveltia-cms-auth` (designed for Sveltia CMS, also documented as Decap-compatible; verify) or any "decap-cms-oauth" worker. Steps: create a GitHub OAuth App (callback `https://<worker>/callback`), set `GITHUB_CLIENT_ID`/`GITHUB_CLIENT_SECRET` as Worker secrets, put the worker URL in `base_url`. Editors need **write access** to the repo (or use fork-based "open authoring": `backend.open_authoring: true` for public contributors).

### 17.4 CMS preview
Register a preview template (`CMS.registerPreviewTemplate('songs_ta', …)`) that shows the 3 layers stacked using the same CSS (`/admin/preview.css` copied from `lyrics.css`). Optional in v1, recommended.

---

## 18. Build, CI/CD, hosting

### 18.1 `package.json` scripts
```json
{
  "scripts": {
    "dev": "npm run indexes && astro dev",
    "validate": "tsx --env-file-if-exists=.env scripts/validate.ts",
    "indexes": "tsx --env-file-if-exists=.env scripts/build-indexes.ts",
    "prebuild": "npm run validate && npm run indexes",
    "build": "astro build",
    "postbuild": "tsx scripts/font-manifest.ts",
    "check-precache": "tsx scripts/check-precache.ts",
    "preview": "astro preview",
    "test": "vitest run",
    "test:e2e": "playwright test",
    "lhci": "lhci autorun",
    "new-song": "tsx scripts/new-song.ts",
    "format": "prettier -w ."
  },
  "engines": { "node": ">=22" }
}
```

### 18.2 Cloudflare Pages
- Connect GitHub repo → Framework preset: Astro → Build command `npm run build` → Output `dist` → Env: `NODE_VERSION=22`, `PUBLIC_INCLUDE_DEMO=true` (until real books are live; then remove), `PUBLIC_REPORT_FORM_URL=…`, `PUBLIC_CF_ANALYTICS_TOKEN=…`.
- Production branch `main`; every PR gets a preview URL (use it for proofreading).
- Custom domain later (Cloudflare Registrar at cost).

### 18.3 GitHub Actions `.github/workflows/validate.yml`
```yaml
name: validate
on: [pull_request]
jobs:
  validate:
    runs-on: ubuntu-latest
    env: { PUBLIC_INCLUDE_DEMO: "true" }   # whole job; remove at real launch
    steps:
      - uses: actions/checkout@v4
      - name: Independence check (no references to the drafting tool)
        run: |
          if git grep -n -i "click""up" -- . ':!STUTI_FIXES_AND_LAUNCH.md' ':!STUTI_BUILD_SPEC.md' ':!AGENTS.md'; then
            echo "Found a reference to the drafting tool. The app must be independent."; exit 1
          fi
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: npm run validate
      - run: npm test
      - run: npm run build
      - run: npm run check-precache
      - run: npx lhci autorun
```
(`"click""up"` is joined by the shell into one word when the check runs, but this file never contains the whole word, so the check doesn't find itself.)

`e2e.yml`: same setup, including the job-level `env: { PUBLIC_INCLUDE_DEMO: "true" }`, + `npx playwright install --with-deps chromium` + `npm run build` + `npm run test:e2e`.

Branch protection on `main`: require `validate` + `e2e`. While one person maintains the repo, require **0** approvals (GitHub doesn't let you approve your own PR); once there is a language editor, require 1 approving review from CODEOWNERS.

`.github/dependabot.yml`: weekly npm updates; ignore `astro` major updates (stay on 5 for v1).

`.github/CODEOWNERS`
```text
/src/content/songs/hi/ @hindi-editor-github
/src/content/songs/ta/ @tamil-editor-github
/src/content/songs/te/ @telugu-editor-github
/src/content/songs/pa/ @punjabi-editor-github
/src/ @maintainer-github
```

### 18.4 Scale limits (important)
Pages per song: 1 song page + 1 permalink per number. Cloudflare Pages free allows **20,000 files** per deployment (verify). Budget: ~ (songs × (1 + numbers)) + assets < 18,000. Roughly **8,000 songs** with 1 number each is safe. Beyond that (v2): stop generating `/b/` permalink pages (resolve numbers client-side on `/b/` via a single `404`-style SPA route or a Cloudflare Pages Function), then move to Cloudflare D1 + Workers rendering. Keep the code structured so the song renderer is a pure function (`renderSong(song) → HTML`) reusable in a Worker.

### 18.5 `public/_headers`
```text
/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=(), screen-wake-lock=(self)
  X-Frame-Options: DENY
  Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' https://cloudflareinsights.com; manifest-src 'self'; worker-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self' https://docs.google.com

/_astro/*
  Cache-Control: public, max-age=31536000, immutable

/search/*
  Cache-Control: public, max-age=300

/dl/*
  Cache-Control: no-cache

/sw.js
  Cache-Control: no-cache

/admin/*
  ! Content-Security-Policy
  ! X-Frame-Options
  Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://unpkg.com; style-src 'self' 'unsafe-inline' https://unpkg.com; img-src 'self' data: blob: https:; font-src 'self' data: https://unpkg.com; connect-src 'self' https://api.github.com https://*.workers.dev https://unpkg.com; frame-src 'self' https://*.workers.dev; worker-src 'self' blob:; base-uri 'self'
  X-Frame-Options: SAMEORIGIN
  X-Robots-Tag: noindex
```
(If you replace the inline head script with a hashed one, drop `'unsafe-inline'` from `script-src`.)
Cloudflare Pages applies **every** matching `_headers` rule, so `/admin/*` must remove the inherited `Content-Security-Policy` and `X-Frame-Options` with `!` lines before setting its own (otherwise the browser enforces the strict site-wide policy and blocks Decap).

`public/robots.txt`
```text
User-agent: *
Allow: /
Disallow: /admin/
Sitemap: https://stuti.pages.dev/sitemap-index.xml
```

---

## 19. Quality

### 19.1 Unit tests (Vitest)
- `normalize.test.ts`: all cases in §11.2.
- `setlist.test.ts`: round trip, Indic titles, tampered input, truncation.
- `search.test.ts`: build index from sample songs; assert F2 queries; "dt117" pins DT 117.
- `validate.test.ts`: each rule in §15.3 with a failing fixture (fixtures in `tests/fixtures/`).
- `wakelock.test.ts`: mocked `navigator.wakeLock`, visibility re-acquire.
- `report.test.ts`: prefilled report URL contains songId, title, line, correction, page URL, properly encoded.
- `schema-defaults.test.ts`: a song without `display`/`layers`/`author` parses with full nested defaults.

### 19.2 E2E (Playwright, Pixel 5 + iPhone 12 viewports + desktop)
- `number-search.spec.ts`: Home → Search → type 117 (clicks + keyboard) → DT 117 visible; wrong number message.
- `word-search.spec.ts`: queries from F2.
- `song-page.spec.ts`: toggle layers, reload persists; A+ to max, check no clipping (bounding boxes of `.line .n` don't overlap next line); chorus marker visible.
- `setlist.spec.ts`: add 3 → share → open link in new context → same order → Start → Next/Prev.
- `offline.spec.ts`: visit `/`, wait SW `activated`, download DT, `context.setOffline(true)`, open `/b/dt/117/` and `/song/ta-yesuve-en-thunai/` → render; open a non-downloaded song → `/no-connection/` content.
- `a11y.spec.ts`: `@axe-core/playwright` on Home, Search, Song, Set: zero serious/critical violations.
- `admin.spec.ts`: against `npx wrangler pages dev dist` (real `_headers`), `/admin/` has no CSP console errors and shows the Decap login.
- `offline.spec.ts` also covers: a song opened from a set (`?set=…&i=0`) and `/search/?book=DT&n=117` offline; Tamil rendered in Noto Sans Tamil after downloading DT (a `document.fonts` entry for "Noto Sans Tamil" has `status === 'loaded'`); a song shared by two downloaded books still opens after one book is removed.
- `song-page.spec.ts` also covers: root font size 200% at lyric size 5, no overlapping lines and no horizontal scroll.

### 19.3 Lighthouse CI budgets (`lighthouserc.json`)
```json
{
  "ci": {
    "collect": { "staticDistDir": "./dist", "url": ["/", "/search/", "/song/ta-yesuve-en-thunai/", "/set/"], "settings": { "preset": "mobile" } },
    "assert": {
      "assertions": {
        "categories:performance": ["error", { "minScore": 0.9 }],
        "categories:accessibility": ["error", { "minScore": 0.95 }],
        "categories:best-practices": ["error", { "minScore": 0.95 }],
        "categories:seo": ["error", { "minScore": 0.95 }],
        "largest-contentful-paint": ["error", { "maxNumericValue": 2500 }],
        "cumulative-layout-shift": ["error", { "maxNumericValue": 0.05 }],
        "total-byte-weight": ["warn", { "maxNumericValue": 350000 }]
      }
    }
  }
}
```
Budgets: song page HTML ≤ 30 KB gzip; JS on song page ≤ 40 KB gzip; first load (excluding fonts) ≤ 150 KB.

### 19.4 Accessibility rules
- Touch targets ≥ 48×48 px (keypad, nav, chips ≥ 40 px tall with spacing).
- Contrast ≥ 4.5:1 for text (check `--muted` on `--paper` and dark theme).
- Every lyric line has the correct `lang` attribute (screen readers switch voice).
- Keypad: buttons have `aria-label`; display is `aria-live="polite"`.
- Sheets: `role="dialog"`, `aria-modal="true"`, focus trap, Escape closes, focus returns to trigger.
- Reorder in set has button alternatives (no drag-only).
- Works with system font size 200%.
- Elderly-first defaults: lyric size 20 px, high-contrast theme one tap away in Settings.

### 19.5 SEO
- `<title>`: `<native title> lyrics · <Roman> · <English> | Stuti` (English songs: `<title> hymn lyrics | Stuti`).
- Meta description: first two lines (native + Roman).
- JSON-LD on song pages:
```json
{ "@context": "https://schema.org", "@type": "MusicComposition", "name": "இயேசுவே என் துணை", "alternateName": ["Yesuve En Thunai", "Jesus, My Companion"], "inLanguage": "ta", "lyricist": { "@type": "Person", "name": "Demo text" }, "lyrics": { "@type": "CreativeWork", "text": "<first section only>" }, "url": "https://stuti.pages.dev/song/ta-yesuve-en-thunai/" }
```
- `<link rel="canonical">` on song pages; `/b/` pages canonical to the song.
- Sitemap via `@astrojs/sitemap`. Book index pages are crawlable.

### 19.6 Security & privacy
- No cookies. No personal data collected by the app. Report form is a Google Form (state this on About).
- Admin secrets only in Cloudflare Worker secrets; never in repo or client code.
- Sanitize nothing-HTML: all content rendered as text (Astro escapes by default; never use `set:html` with content).
- Dependabot enabled for npm.

---

## 20. Master prompt for the IDE (paste first)

```text
You are building "Stuti", a free, offline-first PWA hymnal for Indian churches (Hindi, Tamil, Telugu, Punjabi, English). The full specification is in STUTI_BUILD_SPEC.md in the repo root. Read the whole file before writing code. It is the single source of truth.

Rules (also save them to AGENTS.md):
1. Follow the spec exactly: stack (Astro 5 static + Preact islands + plain CSS + MiniSearch + @vite-pwa/astro injectManifest + Decap CMS + Cloudflare Pages), file structure (§4), data schema (§5), routes (§7), features & acceptance (§8), design tokens (§9), screens (§10).
2. Work phase by phase (§21). Do only the current phase. At the end of each phase: run `npm run validate`, `npm test`, `npm run build` (and e2e when available), fix failures, then print a short report: files created/changed, commands run + results, what is NOT done yet, and any deviation from the spec with the reason.
3. Never invent features beyond the spec. If something is ambiguous, choose the simplest option that satisfies the acceptance criteria and note it in docs/adr/.
4. Song pages must render fully as static HTML without JavaScript. Islands are progressive enhancement.
5. All decisions/configurable values live in src/site.config.ts. No hard-coded URLs, names or book IDs elsewhere.
6. TypeScript strict. No `any` except at JSON boundaries with validation. Small pure functions in src/lib with unit tests.
7. Accessibility and performance budgets (§19) are requirements, not nice-to-haves.
8. Content is text only: never render content with set:html / dangerouslySetInnerHTML.
9. Never publish songs whose rights status is not public_domain or licensed (demo only when PUBLIC_INCLUDE_DEMO=true).
10. Use the latest Astro 5.x (do not upgrade to 6). For other packages use the latest stable versions compatible with Astro 5. Check Cloudflare Pages free-tier limits before starting; record what you checked in docs/adr/0001-versions.md.
11. Do not add analytics, ads, trackers, external fonts or CDNs (except Decap CMS script on /admin and optional Cloudflare Web Analytics).
12. Commit after each phase with message "phase N: <summary>".
13. The app is fully independent. No ClickUp code, SDK, API, links, logos, logins, webhooks, analytics or file URLs anywhere in the repo or the running app. CI must fail if the word 'clickup' appears in any tracked file other than the instruction files (STUTI_BUILD_SPEC.md, STUTI_FIXES_AND_LAUNCH.md, AGENTS.md), see STUTI_FIXES_AND_LAUNCH.md §2.
```

---

## 21. Phase prompts (run one at a time)

### Phase 0: Project setup
```text
Phase 0. Create the Astro project per §3.2 and §4 (empty files are fine where content comes later). Add tsconfig strict, prettier, eslint, .nvmrc (22), .gitignore, AGENTS.md (rules from §20), README.md (setup + scripts), src/site.config.ts (§5.6), src/styles/tokens.css (§9.1) + base.css with a reset and font imports via @fontsource (Instrument Sans 400/600/700, Domine 700, Noto Sans Devanagari/Tamil/Telugu/Gurmukhi 400/700). Add .env.example (PUBLIC_INCLUDE_DEMO=true), docs/adr/0001-versions.md and docs/adr/0002-stay-on-astro-5.md. Configure astro.config.mjs per §12.1 but keep AstroPWA disabled until Phase 5 (comment it out). Create a placeholder index page that shows the app name in Domine on --paper.
Acceptance: `npm run dev` and `npm run build` succeed; Lighthouse accessibility ≥ 95 on the placeholder.
```

### Phase 1: Data layer
```text
Phase 1. Implement src/content.config.ts (§5.4), src/lib/scripts.ts (§5.5), the 5 book files and 6 song files exactly as §6. Implement scripts/validate.ts with every rule in §15.3 (errors + warnings + summary table + --json flag) and unit tests with failing fixtures for each rule (tests/fixtures/). Implement src/lib/songs.ts helpers: langOf(id), isPublishable(song, includeDemo), firstLine(song), songUrl(id), numberUrl(book, number), primaryNumber(song, preferredBook?). Song id and language come from the file path (§5.3); never read `id`/`lang` from the JSON. Add tests/unit/schema-defaults.test.ts: parsing a song without display/layers/author gives display.chorusAfterEachVerse === false, layers.roman === 'missing', author.name === 'Unknown'.
Acceptance: `npm run validate` passes on sample data (with PUBLIC_INCLUDE_DEMO=true from .env) and fails on each fixture with a clear message (including wrong folder, bad file name, duplicate id, book ids differing only by case, demo song published without the variable); a CMS-style file without id/lang passes; `npm test` green.
```

### Phase 2: Layout, design system, song page
```text
Phase 2. Build Base.astro (meta, inline prefs script §14, fonts, theme), AppShell, BottomNav, NumberBadge, SongRow, LyricSection, SongMeta, RightsBadge (§9.3) and styles (tokens.css, base.css, components.css, lyrics.css). Build /song/[id]/ (static paths from publishable songs) per §8 F3 and §10.3 without islands first: all 3 layers in HTML, lang attributes per line, chorus styling, "↻ Chorus" marker, meta block, report button placeholder, JSON-LD + title/description (§19.5). Build /b/[book]/[number]/ redirect pages (§7), /books/ and /books/[book]/.
Then add the SongToolbar island: layer chips (multi-select, ≥1 on, persist to prefs + data-layers), A−/A+ (data-size), favourite star (snapshot to stuti:favs), share (§8 F9), keep awake (src/lib/wakelock.ts §8 F4, with unit test).
Acceptance: song pages work with JS disabled; toggles persist across reload with no flash; no clipping at size 5, also with the root font size at 200% (no overlapping lines, no horizontal scroll); Lighthouse mobile ≥ 90 perf / ≥ 95 a11y on a song page.
```

### Phase 3: Search
```text
Phase 3. Implement src/lib/normalize.ts (§11.2) with the unit tests listed there. Implement scripts/build-indexes.ts generating public/search/numbers.json, meta.json, idx-<lang>.json and public/dl/<book>.json (§11.1) using MS_OPTIONS (§11.3) shared from src/lib/search.ts. Build /search/ with Number tab (Keypad island, §8 F1, §10.2: book chips, live match, keyboard support, deep links ?book=&n=) and Words tab (WordSearch island, §8 F2: debounce 120ms, lazy shard loading, "dt117" pinning, empty/no-result states, show more).
Acceptance: all F1/F2 acceptance queries pass in unit tests (index built from sample data) and in Playwright (number-search.spec.ts, word-search.spec.ts).
```

### Phase 4: Home, set lists, settings, report
```text
Phase 4. Implement src/lib/storage.ts (§14, versioned keys, try/catch) and prefs signals. Build Home (§10.1) with HomeLists island (continue, Sunday ribbon card, favourites, recent, books). Implement src/lib/setlist.ts (§13.1) with tests; build /set/ (§10.4) with SetEditor (add/reorder with buttons + drag, notes, title, save, my sets, shared read-only view), QrSheet (§13.2, download QR as PNG), and SetNavBar on song pages (?set=&i=, prev/next, swipe). Add "+ Set" to SongToolbar. Build ReportSheet (§8 F8, src/lib/report.ts with URL-building tests) and Settings (§10.6, including export/import sets and clear data with confirm). Build /about/ and 404.
Acceptance: setlist.spec.ts passes; report URL test passes; home renders personal lists offline from storage with no layout shift.
```

### Phase 5: PWA & offline
```text
Phase 5. Enable AstroPWA with injectManifest (§12.1) and implement src/sw.ts (§12.2). Register via workbox-window in Base.astro with UpdateToast (§12.3). Implement scripts/font-manifest.ts (postbuild → dist/dl/fonts.json) and scripts/check-precache.ts (§12.1). Implement src/lib/offline.ts (§12.4, including Indic fonts per book, shared-page-safe removal from the stored URL lists, and quota errors) and /downloads/ with DownloadsPanel (§10.5: progress, saved date, update available, remove, storage estimate, persist). Build /no-connection/ (§10.7). Add OfflineBadge (navigator.onLine + events) and InstallPrompt (§8 F5 rules). Create PWA icons (leather background, gold "स्तु"/"S" mark; 192, 512, maskable 512, apple-touch 180).
Acceptance: offline.spec.ts passes (download DT, go offline, open by number and words, open /song/ta-yesuve-en-thunai/?set=<code>&i=0 with SetNavBar showing, open /search/?book=DT&n=117, Tamil text rendered in Noto Sans Tamil, a song shared by two downloaded books still opens after one is removed, non-downloaded → no-connection page); Lighthouse "installable" passes; `npm run check-precache` passes (< 1.5 MB).
```

### Phase 6: CMS & content tools
```text
Phase 6. Add public/admin/index.html and config.yml (§17.2) with books + 5 song collections; optional preview template using lyrics.css. Write docs for the OAuth worker setup (§17.3) in README (do not commit secrets). Add .github/ISSUE_TEMPLATE (lyric-correction.yml, missing-song.yml), pull_request_template.md (rights + proofreading checklist), CODEOWNERS (§18.3). Add scripts/new-song.ts (interactive scaffold that writes a valid draft JSON). Add tools/ (§16): requirements.txt, ocr/ocr.py, translit/translit.py (+ rules/<lang>.json), import/sheet_to_json.py, each with --help, dry-run mode and a README section. Add docs/prompts/*.md from §22. Write CONTRIBUTING.md from §23 + §24.
Acceptance: /admin loads (login can be mocked locally with `local_backend: true` + `npx decap-server`); tests/e2e/admin.spec.ts passes against `npx wrangler pages dev dist` (real `_headers`): no CSP errors in the console and the Decap login screen renders; creating a song in the CMS produces a JSON file (named from the URL name, no id/lang) that passes validate; each Python tool runs on a sample input.
```

### Phase 7: CI/CD, hardening, launch
```text
Phase 7. Add .github/workflows/validate.yml and e2e.yml (§18.3, with the job-level PUBLIC_INCLUDE_DEMO, the independence check and check-precache), lighthouserc.json (§19.3), public/_headers and robots.txt (§18.5), .github/dependabot.yml (ignore astro majors). Add a11y.spec.ts with axe. Run the full test suite on Pixel 5, iPhone 12 and desktop projects. Fix every budget/a11y failure. Write the deploy section in README (Cloudflare Pages settings §18.2) and the launch checklist (§26) as a GitHub issue template.
Acceptance: all workflows green on a PR; preview deploy works on Cloudflare Pages; every item in §26 "Definition of done" is checked.
```

---

## 22. Content prompts (for editors using any AI chat)

### 22.1 English meaning (translation) draft (`docs/prompts/translate.md`)
```text
You are helping translate an Indian Christian hymn for a free church hymnal app.
Language: {{Tamil|Telugu|Hindi|Punjabi}}. Input is JSON with sections and lines (n = original script, r = Roman).
Task: write an English MEANING for every line in field "e".
Rules:
- Faithful, simple, reverent English a 12-year-old understands. Not poetic, no rhyme, no added theology.
- One English line per original line. Keep line count identical. Do not merge or split lines.
- Keep names as commonly used in Indian churches (Yesu/Yeshu → "Jesus", Karthar/Prabhu → "Lord", Devan/Parameshwar → "God" unless context says otherwise).
- Capitalise pronouns for God (He, You, His) consistently.
- If a line is unclear, translate literally and add "[?]" at the end. Never guess silently.
- Do NOT change n or r. Return the same JSON with only "e" filled.
Input:
{{paste song JSON}}
```

### 22.2 Transliteration review (`docs/prompts/transliterate.md`)
```text
Review the Roman transliteration ("r") of this {{language}} Christian hymn for an Indian church app.
Goal: how ordinary believers would TYPE and SING it in Roman letters (WhatsApp style), not academic ISO.
Rules:
- No diacritics. Use common spellings: aa for long a only where people usually write it (e.g. "aaradhana"), ee/oo for long i/u where common.
- Tamil: ழ → "zh", ள/ல → "l", ண/ன/ந → "n", ற → "r"; keep church spellings (Yesu, Karthar, Devan, Sthothiram).
- Hindi/Punjabi: drop the silent final "a" (Yeshu, Prabhu, mera, not merA); ं → "n"/"m" as spoken.
- Telugu: keep final "u" (velugu), "aa" for long a in names as commonly written (Yesayya).
- Keep punctuation and capitalise the first word of each line.
- One Roman line per original line. Do not touch "n" or "e".
Return the same JSON with corrected "r" and a short list of changes you made.
Input:
{{paste song JSON}}
```

### 22.3 Proofreading checklist prompt (`docs/prompts/proofread.md`)
```text
Compare this OCR'd hymn text (n) with the scan description / my typed check below. List every probable OCR error:
broken conjuncts, wrong vowel signs, missing anusvara/bindu/virama, swapped similar letters (Tamil ல/ள/ழ, ன/ண/ந; Telugu ు/ూ; Gurmukhi ਿ/ੀ), merged or split words, missing lines, numbers in text.
Output a table: line number | OCR text | suggested correction | confidence (high/medium/low).
Do not rewrite lines that look correct. Do not "improve" the wording.
OCR text:
{{paste n lines}}
```

---

## 23. Editor guide & style rules (`CONTRIBUTING.md`)

1. **Accuracy first.** The printed book (edition stated in Book) is the reference. Don't modernise wording.
2. **One line = one sung line.** Follow the printed line breaks.
3. **Section labels:** use what the book uses (Pallavi / Anupallavi / Charanam, Chorus, Verse 1, टेक/कोरस). Type = chorus for any repeated refrain.
4. **Chorus repeats:** write the chorus once; enable "Show ↻ Chorus after each verse" instead of duplicating text.
5. **Roman layer:** follow §22.2 rules. Consistency matters more than perfection: same word, same spelling across the whole book.
6. **English layer:** meaning, not poetry (§22.1). Mark unclear lines with [?] and leave layer status as draft.
7. **Status honesty:** set layers to `reviewed` only after a native speaker has checked every line.
8. **Numbers:** exactly as printed, including letters (117a). Add every book this song appears in.
9. **Aliases:** add common alternate titles and spellings people search for (first words of chorus, popular names).
10. **Never** copy lyrics from other websites or apps. Source = printed book scan you are allowed to use, or written permission.
11. **Rights:** fill the rights section before switching Publish on (§24). If unsure → `permission_pending`.
12. **Review on phone:** open the PR preview link on your phone and read the song at size A+ before approving.

---

## 24. Rights policy (publish only if one of these is true)

| Status | When | Required fields |
|---|---|---|
| `public_domain` | Author died ≥ 61 years ago (India: life + 60 years, counted from the year after death), or anonymous/traditional with publication ≥ 61 years ago and evidence | `author.died` or `rights.basis` with source |
| `licensed` | Written permission from the author/heirs/publisher/ministry covering: web + app display, offline storage, transliteration, translation, sharing links | `rights.holder`, `rights.evidence` (stored privately; reference only), `checkedBy`, `checkedOn` |
| `permission_pending` | Default for every new song | none; **never published** |
| `rejected` | Permission refused / takedown | **never published**; keep file for history or delete |
| `demo` | Prototype text written by the team | published only with `PUBLIC_INCLUDE_DEMO=true` |

Notes:
- Translations and transliterations of a protected lyric need permission too.
- A **new edition** of an old hymnbook can have new copyrighted material (new songs, revised wording, translations). Check each song, not the book.
- Bible text: use only openly licensed translations (e.g. Hindi IRV, CC BY-SA 4.0) for v2 verse popups; BSI texts need permission.
- Takedown: About page shows a contact email; on a valid request set `rights.status: rejected`, `publish: false`, deploy within 48 hours.
- This is not legal advice. Get a lawyer's review before adding modern songs at scale.

---

## 25. Roadmap (data hooks already in v1)

### v1.1: Musicians
- `chords`: ChordPro text per song (`[G]Yesuve en [C]thunai`). Render chords above the Roman/native line; **Transpose** −6…+6 semitones (pure function `transpose(chordpro, n)` with tests), capo, key display; "Hide chords" toggle; chords only for `licensed`/PD arrangements.
- `media.youtube`: reference tune via `youtube-nocookie.com` embed, loaded only on tap (click-to-load facade), never autoplay; hidden offline.
- Occasions/tags browse (Christmas, Easter, Lent, Holy Communion, Wedding, Funeral, Harvest festival), "Song of the day" on Home.

### v2: Church
- **Projector mode** `/present/?set=`: full-screen, 16:9, huge text, one section per screen, black/white or leather theme, keyboard/clicker (←/→), wake lock on.
- **Follow the leader live**: leader creates a room; followers' screens jump to the current song/section. Free stack: Cloudflare Durable Objects free tier or PartyKit-style WebSocket (verify free limits); room id in `SetList.live`. Offline fallback = normal set.
- **Church accounts**: a church's own book (their numbering), shared sets, editors per church (needs auth: Cloudflare Access / Supabase, re-check free tiers).
- **Bible verse popups** (Hindi IRV etc., licence permitting), more languages (Malayalam, Kannada, Bengali, Marathi, Odia), UI translated into all languages.
- Scale beyond ~8k songs: D1 + Worker rendering (§18.4).

---

## 26. Definition of done & launch checklist

**v1 is done when:**
- [ ] All F1-F12 acceptance criteria pass (automated where listed).
- [ ] Unit + E2E + Lighthouse CI green on `main`.
- [ ] Works offline on a real low-end Android (Chrome) and an iPhone (Safari) after downloading one book.
- [ ] Install to home screen works on Android; iOS "Add to Home Screen" works.
- [ ] Keypad search → song open < 1 s on a mid-range phone.
- [ ] Largest text readable by an elderly tester at arm's length.
- [ ] 2-3 pilot churches used it for a real Sunday; feedback logged as issues.
- [ ] At least one real book per launch language with ≥ 100 songs, all `reviewed` native + Roman, rights recorded.
- [ ] `PUBLIC_INCLUDE_DEMO` removed in production; demo books set to `archived`.
- [ ] About page: mission, rights policy summary, contact email for takedowns, credits per book/editor.
- [ ] Report-a-mistake form live; moderator assigned per language.
- [ ] Custom domain (optional) + Cloudflare Web Analytics (optional) configured.
- [ ] README explains: add a book, add a song, run tools, deploy, rotate OAuth secret.

---

## 27. Glossary
- **Layer:** one representation of a line: native (n), Roman (r), English (e).
- **Book:** a printed hymnbook edition; songs carry its numbers.
- **Set / set list:** ordered songs for a service, shared by URL/QR.
- **PWA:** web app installable to home screen with offline support.
- **Precache:** files stored at install time by the service worker.
- **Shard:** per-language search index file.
- **PD:** public domain.
- **Pallavi / Anupallavi / Charanam:** chorus / second refrain / verse in South Indian song structure.

---

## Changelog v1.1
- F1: `/admin/*` headers remove the inherited CSP and X-Frame-Options before setting their own; Decap version pinned exactly (§17.1, §18.5).
- F2: service worker ignores query strings when reading cached pages, so set songs and search deep links work offline (§12.2).
- F3: only Latin fonts precached; Indic fonts (400/700) download with their book via `dl/fonts.json`; CI fails if precache > 1.5 MB (§12.1, §12.4, §9.2).
- F4: lyric sizes in rem so they follow the phone's font setting; "System" theme has the full dark values (§8 F4, §9.1).
- F5: song id and language come from the file path; editors type only a URL name; validation rules updated (§5.3, §5.4, §6.2, §15.3, §17.2).
- F6: stay on Astro 5 for v1; Astro 6 upgrade plan in docs/adr/0002 (§3, §20 rule 10).
- F7: missing files and packages added (§3.2, §4, §19).
- F8: independence rule: no ClickUp anywhere; CI check (§20 rule 13, §18.3).
- F9: PUBLIC_INCLUDE_DEMO set for whole CI jobs and read from `.env` locally (§15.3, §18.1, §18.3).
- F10: removing a book keeps pages another downloaded book uses, using stored URL lists (§12.4, §14).
- F11: book ids must be unique ignoring case (§15.3).
- F12: shared sets cut notes to 200 characters and drop bad notes/book codes (§13.1).
- F13: independence check spells the word in two pieces so it doesn't find itself (§18.3).
- F14: 0 required approvals while working alone; 1 from CODEOWNERS once editors join (§18.3).
