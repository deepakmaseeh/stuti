# Stuti: Fixes (v1.1) + Build-to-Publish Instructions

> **Give this file to your IDE together with `STUTI_BUILD_SPEC.md`.** This file **overrides** the build spec wherever they disagree.
> Order: 1) paste the prompt in §0, 2) the IDE applies fixes F1-F14 to the spec, 3) the IDE builds phases 0-7, 4) you follow §3 to publish, 5) run the checks in §4 and §5.

---

## 0. Prompt to paste into the IDE (first message)

```text
Read STUTI_BUILD_SPEC.md and STUTI_FIXES_AND_LAUNCH.md completely before doing anything.
STUTI_FIXES_AND_LAUNCH.md overrides the build spec where they differ.

Step 1: Apply fixes F1 to F14 (section 1 of the fixes file) directly inside STUTI_BUILD_SPEC.md,
so the spec becomes v1.1. Change the title to "Complete Build Specification v1.1". At the end of the spec,
add a "Changelog v1.1" section listing each fix in one line. Make sure the file is saved as UTF-8 (no BOM),
and that Hindi/Tamil/Telugu/Punjabi text displays correctly.

Step 2: Follow the Master Prompt (spec §20) and build Phase 0 to Phase 7 (spec §21) one phase at a time.
After each phase: run validate, unit tests, build (and e2e once available), fix failures, commit
"phase N: <summary>", and give me a short report (done / not done / deviations).
Stop and ask me only when you need an account login, a secret, or a decision that is not in either file.

Step 3: Follow section 2 (independence rules) at all times. The app must not reference, call, link to,
or depend on ClickUp in any way.

Step 4: When Phase 7 is green, walk me through section 3 (publishing) step by step, telling me exactly
what to click in GitHub, Cloudflare and Google, one step at a time, and wait for me to confirm each step.
```

---

## 1. Fixes to apply (F1-F14)

### F1. Admin panel blocked by the site-wide security header
**Problem:** Cloudflare Pages applies *all* matching `_headers` rules. On `/admin/` pages, the strict site-wide `Content-Security-Policy` and the `/admin/*` one are both sent, and the browser enforces the strictest, which blocks the Decap CMS script.
**Fix:** in spec §18.5, replace the `/admin/*` block with this (the `!` line removes the inherited header first):

```text
/admin/*
  ! Content-Security-Policy
  ! X-Frame-Options
  Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://unpkg.com; style-src 'self' 'unsafe-inline' https://unpkg.com; img-src 'self' data: blob: https:; font-src 'self' data: https://unpkg.com; connect-src 'self' https://api.github.com https://*.workers.dev https://unpkg.com; frame-src 'self' https://*.workers.dev; worker-src 'self' blob:; base-uri 'self'
  X-Frame-Options: SAMEORIGIN
  X-Robots-Tag: noindex
```
Also in `public/admin/index.html`, **pin an exact Decap version** (e.g. `decap-cms@3.x.y`, the latest 3.x at build time) instead of `^3`.
**Test:** add `tests/e2e/admin.spec.ts`: load `/admin/` on the built site (`astro preview` + `_headers` emulation via `wrangler pages dev dist`) and assert there are no CSP errors in the console and the Decap login screen renders.

### F2. Songs opened from a set (and search deep links) fail offline
**Problem:** songs opened from a set use `/song/<id>/?set=…&i=2`. The Cache API matches the full URL including `?…`, so the downloaded copy saved as `/song/<id>/` isn't found offline. Same for `/search/?book=DT&n=117` (precached as `/search/`).
**Fix:** in spec §12.2 `src/sw.ts`:

```ts
// 1) Precache: ignore ALL query params when matching precached pages (/search/?book=..., /set/?..)
precacheAndRoute(self.__WB_MANIFEST, { ignoreURLParametersMatching: [/.*/] });

// 2) Pages cache: ignore the query string when reading from cache
registerRoute(
  ({ request, url }) => request.mode === 'navigate' && !url.pathname.startsWith('/admin/'),
  new NetworkFirst({
    cacheName: 'stuti-pages',
    networkTimeoutSeconds: 3,
    matchOptions: { ignoreSearch: true },
  })
);
```
Keep `downloadBook()` saving clean URLs without query strings (`/song/<id>/`).
**Test:** extend `tests/e2e/offline.spec.ts`: download DT → set offline → open `/song/ta-yesuve-en-thunai/?set=<code>&i=0` → song renders **and** SetNavBar shows; open `/search/?book=DT&n=117` offline → opens the song.

### F3. Offline download too big (fonts)
**Problem:** the precache pattern `_astro/**/*.woff2` grabs every font file for every script and weight (several MB).
**Fix:**
1. **Weights:** Indic fonts load only **400 and 700** (drop 500). Lyrics native text uses 400; titles 700. Instrument Sans 400/600/700, Domine 700 only.
2. **Precache only Latin fonts.** In spec §12.1 replace `'_astro/**/*.{js,css,woff2}'` with:
   ```js
   '_astro/**/*.{js,css}',
   '_astro/**/instrument-sans-latin-*.woff2',
   '_astro/**/domine-latin-*.woff2',
   ```
   (Check the real file names Astro outputs for @fontsource and adjust the patterns.)
3. **Indic fonts on demand.** Add `scripts/font-manifest.ts` and run it **after** `astro build` (`"postbuild": "tsx scripts/font-manifest.ts"`). It scans `dist/_astro/` and writes `dist/dl/fonts.json`: `{ "hi": [urls of noto-sans-devanagari 400/700 woff2], "ta": [...], "te": [...], "pa": [...] }`. In `downloadBook()` (spec §12.4), also fetch that language's font URLs into the `stuti-fonts` cache.
4. Add `scripts/check-precache.ts` (run in CI after build): reads the precache manifest from `dist/sw.js`, sums file sizes, **fails if > 1.5 MB**, prints the 10 biggest files.
**Test:** CI fails when precache > 1.5 MB; offline e2e shows Tamil text in Noto Sans Tamil after downloading DT (check `document.fonts.check('16px "Noto Sans Tamil"')`).

### F4. Text-size conflict (px vs rem)
**Problem:** F4 says to respect the phone's font-size setting, but lyric sizes are fixed px.
**Fix:** in spec §9.1 and §8 F4, use rem everywhere for text (keep `html { font-size: 100%; }`):
```css
html[data-size="0"] { --lyric-size: 1rem; }      /* 16px at default */
html[data-size="1"] { --lyric-size: 1.125rem; }  /* 18 */
html[data-size="2"] { --lyric-size: 1.25rem; }   /* 20 (default) */
html[data-size="3"] { --lyric-size: 1.4375rem; } /* 23 */
html[data-size="4"] { --lyric-size: 1.625rem; }  /* 26 */
html[data-size="5"] { --lyric-size: 1.875rem; }  /* 30 */
```
Also: `--lyric-size: 1.25rem` default in `:root`; touch targets stay in px (48px).
And fill the `html[data-theme="system"]` media query with the full dark values (spec §9.1 left a placeholder comment).
**Test:** Playwright with `page.addStyleTag({ content: 'html{font-size:200%}' })` at size 5: no line overlaps (bounding boxes) and no horizontal scroll.

### F5. Song file name vs ID mismatch (editors would break the build)
**Problem:** editors type the ID by hand, and the CMS names the file from the title, so they won't match.
**Fix (IDs come from the file path; editors never type them):**
1. **Remove `id` and `lang` from every song JSON file and from the song schema.**
2. In `src/content.config.ts`, songs loader:
   ```ts
   loader: glob({
     pattern: '**/*.json',
     base: './src/content/songs',
     generateId: ({ entry }) => entry.replace(/\.json$/, '').replace('/', '-'), // ta/yesuve-en-thunai.json → ta-yesuve-en-thunai
   }),
   ```
   Song language = `id.split('-')[0]`. Add helper `langOf(id)` in `src/lib/songs.ts`. Update every place that used `song.lang` / `song.id` to use the entry id + `langOf`.
3. Validation (spec §15.3): replace rules 2 and 3 with: file must be `songs/<lang>/<slug>.json`, `<lang>` ∈ en|hi|ta|te|pa, `<slug>` matches `^[a-z0-9-]{2,80}$`, ids unique. Remove the "id must equal" check.
4. CMS (spec §17.2): remove the `id` and `lang` fields from `song_fields`. Add a top-level field and use it for the file name:
   ```yaml
   - { label: "URL name (lowercase-with-hyphens, e.g. yesuve-en-thunai). Never change after publishing.", name: slug, widget: string, pattern: ['^[a-z0-9-]{2,80}$', "lowercase letters, numbers, hyphens"] }
   ```
   and on every song collection: `identifier_field: slug`, `slug: "{{slug}}"`. The `slug` field is stored in the JSON for editors' reference; the build ignores it (the id comes from the file name). Validation warns if `slug` ≠ file name.
5. Update the 6 sample song files in spec §6.2: remove `"id"` and `"lang"`, add `"slug"` equal to the file name.
**Test:** `validate.test.ts` fixtures: wrong folder, bad file name, duplicate file → each fails with a clear message; a CMS-created file (fixture without id/lang) passes.

### F6. Framework version risk (Astro 6 / Zod 4)
**Problem:** Astro 6 moves to Zod 4: `z` should be imported from `astro/zod`, and `.default({})` on objects no longer fills nested defaults (data would silently come out wrong).
**Fix:** **stay on Astro 5 for v1.**
- `package.json`: `"astro": "^5"` (major 5 only), and matching majors for `@astrojs/preact`, `@astrojs/sitemap`. Commit `package-lock.json`.
- Keep `import { defineCollection, z } from 'astro:content'` as in the spec.
- Add `docs/adr/0002-stay-on-astro-5.md`: "Upgrade to Astro 6 only after v1 launch. When upgrading: import z from 'astro/zod', replace `.default({})` on objects with `.prefault({})`, run the full test suite."
- Change the Master Prompt rule 10 to: "Use the latest **Astro 5.x** (do not upgrade to 6). For other packages use the latest stable versions compatible with Astro 5."
- Dependabot: ignore `astro` major updates.
**Test:** unit test that parsing a song JSON without `display`/`layers`/`author` gives the full nested defaults (`display.chorusAfterEachVerse === false`, `layers.roman === 'missing'`, `author.name === 'Unknown'`).

### F7. Missing files and packages
Add to spec §4 file tree and create them:
- `tests/unit/wakelock.test.ts`, `tests/unit/report.test.ts`, `tests/unit/schema-defaults.test.ts` (F6)
- `tests/fixtures/` (bad song files for each validation rule)
- `tests/e2e/admin.spec.ts` (F1)
- `scripts/font-manifest.ts`, `scripts/check-precache.ts` (F3)
- `tools/translate/translate.py` (optional AI translation helper; reads the API key from an environment variable, never committed)
- `.github/dependabot.yml`
- `docs/adr/0001-versions.md`, `docs/adr/0002-stay-on-astro-5.md`
Add to spec §3.2 installs: `npm i -D @axe-core/playwright wrangler`

### F8. Independence from ClickUp (new rule)
Add to the Master Prompt (spec §20) as rule 13:
"13. The app is fully independent. No ClickUp code, SDK, API, links, logos, logins, webhooks, analytics or file URLs anywhere in the repo or the running app. CI must fail if the word 'clickup' appears in any tracked file other than the instruction files (STUTI_BUILD_SPEC.md, STUTI_FIXES_AND_LAUNCH.md, AGENTS.md), see STUTI_FIXES_AND_LAUNCH.md §2."

### F9. Validation fails on the demo songs outside Cloudflare
**Problem:** the 4 demo songs have `"publish": true` with `rights.status: "demo"`, which the rights gate (spec §15.3 rule 7) only allows when `PUBLIC_INCLUDE_DEMO=true`. Cloudflare sets it, but the CI `npm run validate` step, the e2e workflow and local runs (Phase 1) don't, so the first check fails.
**Fix:**
1. In spec §18.3, set the variable for the **whole job** in both `validate.yml` and `e2e.yml` (not only on the build step):
   ```yaml
   jobs:
     validate:
       runs-on: ubuntu-latest
       env: { PUBLIC_INCLUDE_DEMO: "true" }
   ```
2. Add a committed `.env.example` with `PUBLIC_INCLUDE_DEMO=true`; the README says to copy it to `.env` (gitignored).
3. In spec §18.1, make the Node scripts read `.env` when it exists (`--env-file-if-exists` needs Node 22.9+):
   ```json
   "validate": "tsx --env-file-if-exists=.env scripts/validate.ts",
   "indexes": "tsx --env-file-if-exists=.env scripts/build-indexes.ts"
   ```
4. Remove `PUBLIC_INCLUDE_DEMO` from the workflows together with the Cloudflare variable at real launch (§3.7).
**Test:** `validate.test.ts`: a demo song with `publish:true` fails when the variable is unset and passes when it is `"true"`.

### F10. Removing a book deletes pages another downloaded book still uses
**Problem:** a song can be in two books. `removeBook()` (spec §12.4) deletes every page in the book's list, so the song also disappears from the other downloaded book. The spec's note says to check, but the code doesn't.
**Fix:** save each book's page list locally when it is downloaded (so removal also works offline), and only delete pages no other downloaded book needs:
```ts
// in downloadBook(), when saving the download record, also store the URL list:
storage.downloads.set({ ...storage.downloads.get(), [bookId]: { version: m.version, updated: m.updated, bytes: m.bytes, at: new Date().toISOString(), urls: m.urls } });

export async function removeBook(bookId: string) {
  const d = { ...storage.downloads.get() };
  const mine = d[bookId]?.urls ?? (await fetchManifest(bookId).catch(() => null))?.urls ?? [];
  delete d[bookId];
  const keep = new Set(Object.values(d).flatMap((x) => x.urls ?? []));
  const pages = await caches.open(PAGES);
  await Promise.all(mine.filter((u) => !keep.has(u)).map((u) => pages.delete(u)));
  storage.downloads.set(d);
}
```
Add `urls: string[]` to the `stuti:downloads` shape in spec §14.
**Test:** e2e: put one song in two demo books (test fixture), download both, remove one, go offline → the shared song still opens.

### F11. Book codes that differ only by capital letters collide
**Problem:** book codes are lowercased in URLs (`/b/dt/117/`), so `DT` and `Dt` would both become `dt`.
**Fix:** add to spec §15.3 errors: "Book `id` must be unique ignoring case."
**Test:** `validate.test.ts` fixture with books `DT` and `Dt` → fails with a clear message.

### F12. Shared set links don't check notes
**Problem:** `decodeSet()` (spec §13.1) checks song ids, but not `note` or `book`, so a shared link could carry a huge or non-text note.
**Fix:** replace the filter line in `decodeSet()` with:
```ts
obj.s = obj.s
  .filter((x: any) => typeof x?.id === 'string' && /^(en|hi|ta|te|pa)-[a-z0-9-]+$/.test(x.id))
  .slice(0, 30)
  .map((x: any) => ({
    id: x.id,
    ...(typeof x.note === 'string' && x.note ? { note: x.note.slice(0, 200) } : {}),
    ...(typeof x.book === 'string' && /^[A-Za-z]{1,6}$/.test(x.book) ? { book: x.book } : {}),
  }));
```
**Test:** `setlist.test.ts`: a 5,000-character note is cut to 200; a number as note is dropped; a bad `book` is dropped.

### F13. The independence check fails on itself
**Problem:** the CI step in §2 searches for the word "clickup", but that word is written inside the step itself (in `.github/workflows/validate.yml`), so it always finds it and fails. The one-line command in §4 had the opposite problem: it printed "FAIL" but still passed.
**Fix:** split the word so the workflow file never contains it whole, and keep it out of the message. The corrected versions are in §2 point 4 and §4 below.
**Test:** the check passes on a clean repo; adding a file containing the word makes it fail.

### F14. A solo owner can't merge their own pull requests
**Problem:** §3.1 requires 1 approval on `main`, but GitHub doesn't let you approve your own pull request, so working alone you'd be locked out.
**Fix:** in §3.1, require **0 approvals** (keep the required checks) until there is at least one language editor. Then turn on "Require 1 approval" and "Require review from Code Owners".
**Test:** none (a GitHub setting). The §5 checklist covers it.

---

## 2. Independence rules (app must have NO connection to ClickUp)

These files were drafted in a ClickUp workspace, but **the app itself must have nothing to do with ClickUp.** After you copy these .md files into your repo, ClickUp is out of the picture.

1. **Accounts:** create everything with **your own email** (not a work or ClickUp-linked login): GitHub account + repo, Cloudflare account, Google account (for the report form), domain registrar. Turn on 2-factor login on each.
2. **No ClickUp in code:** no ClickUp API, SDK, Zapier/Make bridges to ClickUp, ClickUp forms, embeds, links, or images. Report-a-mistake goes to **your Google Form**, editing goes through **your GitHub**, nothing else.
3. **No ClickUp file links:** never paste ClickUp attachment or doc URLs into the repo. Download any files you need and commit them as normal files.
4. **CI guard:** add this step to `.github/workflows/validate.yml` (after checkout):
   ```yaml
   - name: Independence check (no ClickUp references)
     run: |
       if git grep -n -i "click""up" -- . ':!STUTI_FIXES_AND_LAUNCH.md' ':!STUTI_BUILD_SPEC.md' ':!AGENTS.md'; then
         echo "Found a reference to the drafting tool. The app must be independent."; exit 1
       fi
   ```
   (`"click""up"` is joined by the shell into one word when the check runs, but the workflow file itself never contains the whole word, so the check doesn't find itself.)
   (The three instruction files are excluded only because they contain these rules. You can delete the two STUTI_*.md files from the repo after launch; then remove them from the exclude list.)
5. **Network check before launch:** open the live site with browser DevTools → Network tab → reload Home, a song, Search, Set list. Every request must go only to **your domain** (plus `static.cloudflareinsights.com` only if you turned on Cloudflare Web Analytics). On `/admin/` only: `unpkg.com`, `api.github.com`, your `*.workers.dev` auth worker.
6. **Secrets:** OAuth client secret only in **Cloudflare Worker secrets**. Nothing secret in the repo or the browser.
7. **Ownership:** you (your GitHub account) are the repo owner; add editors as collaborators, never transfer ownership to a shared/work account.
8. **The research doc and files in ClickUp** are just notes. Delete them whenever you like; nothing in the app depends on them.

---

## 3. Publishing (step by step, ₹0)

### 3.1 GitHub
1. Create a **public** repo `stuti` under your personal account (public = free GitHub Actions minutes).
2. Push the code. Default branch `main`.
3. Settings → Branches → protect `main`: require PR, require checks `validate` and `e2e`, block force pushes. Set required approvals to **0** while you work alone (GitHub doesn't let you approve your own PR). When you add a language editor, change it to **1 approval + review from Code Owners**.
4. Settings → Actions → allow GitHub Actions. Settings → Code security → enable Dependabot alerts.
5. Add `CODEOWNERS` usernames for each language editor (or yourself until you have editors).

### 3.2 Cloudflare Pages (hosting)
1. Sign up at Cloudflare with your own email (free plan).
2. Workers & Pages → Create → Pages → **Connect to Git** → choose the `stuti` repo.
3. Build settings: Framework preset **Astro**, build command `npm run build`, output directory `dist`.
4. Environment variables (Production and Preview):
   - `NODE_VERSION` = `22`
   - `PUBLIC_INCLUDE_DEMO` = `true` (**remove before real launch**)
   - `PUBLIC_REPORT_FORM_URL` = your Google Form prefill URL (step 3.4)
   - `PUBLIC_CF_ANALYTICS_TOKEN` = (optional, step 3.6)
5. Save and deploy. Your site is live at `https://<project>.pages.dev`. Update `site.config.ts` → `url` and `astro.config.mjs` → `site` to this exact URL, commit.
6. Every PR now gets a preview URL. Use it for proofreading on your phone.

### 3.3 Editor login for `/admin` (GitHub OAuth via a free Cloudflare Worker)
1. GitHub → Settings → Developer settings → **OAuth Apps** → New: Homepage = your site URL, Callback URL = `https://stuti-cms-auth.<your-subdomain>.workers.dev/callback`.
2. Deploy the auth worker (e.g. `sveltia-cms-auth`, check it supports Decap; or a Decap OAuth worker) with `npx wrangler deploy`.
3. `npx wrangler secret put GITHUB_CLIENT_ID` and `npx wrangler secret put GITHUB_CLIENT_SECRET` (values from step 1). If the worker supports an allowed-domains setting, set it to your site domain only.
4. Put the worker URL in `public/admin/config.yml` → `backend.base_url`, and your repo in `backend.repo`. Commit.
5. Open `https://<site>/admin/` → Login with GitHub → you should see Books + Songs collections.
6. Add each editor as a repo collaborator (Write access) so they can log in.

### 3.4 Report-a-mistake form (Google Forms)
1. Create a Google Form with fields: Song ID, Song title, Line, Correction, Page URL, (optional) Your name.
2. ⋮ → Get pre-filled link → fill dummy values → copy the link. The `entry.XXXX` numbers in it are the field IDs.
3. Put those IDs in `site.config.ts → report.fields`, and the base URL in `PUBLIC_REPORT_FORM_URL` (Cloudflare env var).
4. Responses → link to a Google Sheet. Moderators check it weekly.

### 3.5 Domain (optional, ~₹800/yr)
Cloudflare → Domain Registration → buy e.g. `stuti.in` (at-cost pricing) → Pages project → Custom domains → add it. Update `site.config.ts` `url`, `astro.config.mjs` `site`, `robots.txt` sitemap URL, `config.yml site_url`, and the OAuth app Homepage. Redeploy.

### 3.6 Analytics (optional, cookieless)
Cloudflare → Web Analytics → add site → copy token → set `PUBLIC_CF_ANALYTICS_TOKEN`. Leave empty to have no analytics at all.

### 3.7 Going live with real songs
1. Add the real books (spec §15.2) and at least 100 reviewed songs per launch language with rights recorded.
2. Set demo books to `"status": "archived"`, delete demo songs or set `publish:false`.
3. Remove `PUBLIC_INCLUDE_DEMO` from Cloudflare env vars, from both GitHub workflows (`validate.yml`, `e2e.yml`) and from `.env.example` → redeploy.
4. Run the full checklist in §5.

---

## 4. Final test commands (the IDE runs these before saying "done")

```bash
npm ci
cp .env.example .env     # sets PUBLIC_INCLUDE_DEMO=true for local runs (F9)
npm run validate
npm test
npm run build            # includes postbuild font manifest
npx tsx scripts/check-precache.ts
npx playwright install --with-deps chromium
npm run test:e2e
npx lhci autorun
npx wrangler pages dev dist   # local check that _headers work (admin CSP, caching)
if git grep -n -i "click""up" -- . ':!STUTI_FIXES_AND_LAUNCH.md' ':!STUTI_BUILD_SPEC.md' ':!AGENTS.md'; then echo "FAIL: reference found"; exit 1; else echo "OK: independent"; fi
```

---

## 5. Launch checklist (you tick these)

- [ ] F1-F14 applied; spec says v1.1 with changelog; file shows Indic text correctly
- [ ] All CI checks green on `main` (validate, unit, e2e, Lighthouse, precache ≤ 1.5 MB, independence check)
- [ ] `/admin/` login works; creating a song in the CMS opens a PR that passes validation
- [ ] Offline test on a real Android phone: download a book → airplane mode → open by number, by words, and from a shared set
- [ ] iPhone Safari: Add to Home Screen → opens and reads songs offline
- [ ] Largest text size readable by an elderly tester; phone font size at max still looks right
- [ ] Report-a-mistake opens your Google Form with the song and line filled in
- [ ] DevTools Network shows requests only to your own domain (+ optional Cloudflare analytics)
- [ ] `PUBLIC_INCLUDE_DEMO` removed, demo books archived, real books live with rights recorded
- [ ] About page has your contact email for takedown requests
- [ ] All accounts (GitHub, Cloudflare, Google, domain) are in **your** name with 2-factor login on
