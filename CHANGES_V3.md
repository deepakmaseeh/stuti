# Stuti Songs v3 UI Migration — Baseline & Changes

**Branch:** `v3-ui`  
**Started:** 2026-11-27

## Baseline (B1.1)

Recorded before Phase 1 changes:
- **`npm run build`**: Passed (1134 pages built, precache 67 entries / 994.00 KiB).
- **`npm test` (Vitest)**: Passed (24 test files, 134 tests).
- **`npm run check-precache`**: Passed (67 files, 977.9 KB / 1536.0 KB limit).
- **`npm run check-safety`**: Passed (text-only content, no third-party scripts/styles/fonts).
- **`npm run check-budgets`**: `song/ta-yesuve-en-thunai/index.html` missing when `PUBLIC_INCLUDE_DEMO=false` (home 86.7 KB, search 83.5 KB).
- **`npx playwright test --project=pixel5 --project=desktop`**: 54 passed, 50 failed, 2 skipped (failures are pre-existing mismatches with v1.4/uncommitted changes, e.g. `contrast` theme removal, `number-search`, `browse-mobile`, `songs-list`, `sets-home`, `song-page` selectors).

## Must Still Work List

1. **Routes**: `/`, `/search/`, `/books/`, `/books/tlbc/`, `/b/tlbc/1/`, `/song/<id>/`, `/sets/`, `/sets/edit/`, `/sets/view/`, `/sets/print/`, `/set/`, `/present/`, `/print/`, `/downloads/`, `/settings/`, `/guide/`, `/about/`, `/offline/`, `/no-connection/`.
2. **Theme**: System / Light / Dark persists across `ClientRouter` page swaps and reloads without light flash.
3. **Song page**: Static HTML renders without JS; text size, favourites, Present, PPT, PDF, Report a mistake (`/api/report` → Google Form), Keep screen on.
4. **Sets**: Create, edit, save to IndexedDB/localStorage, share link `/sets/view/#s=…`, Order of Service (`/sets/print/`), PowerPoint export, Present mode.
5. **Offline**: Download book bundles, precache offline shell, serve cached songs offline.

## Feature Flags (`src/config/flags.ts`)

- `newSearch`: `false` until Phase 2
- `newSetEditor`: `false` until Phase 4
- `shareSheet`: `false` until Phase 4
- `videos`: `false` until Phase 5
- `admin`: `false` until Phase 6 (owner confirms Cloudflare Access)

## Phase Log

- **Baseline**: Recorded on `v3-ui`.
- **Phase 1 (Shell, tokens, Settings)**:
  - Added `src/config/flags.ts` (all future phase flags `false`).
  - Added `src/styles/v3/tokens.css` and `src/styles/v3/app.css` scoped under `.v3` (and `[data-scheme='dark'] .v3` / `[data-theme='dark'] .v3`).
  - Updated `src/layouts/Base.astro`, `src/components/AppShell.astro`, `src/components/TopBar.astro`, `src/components/BottomNav.astro`, `src/pages/books/[book].astro`, `src/pages/books/index.astro`.
  - Added `src/components/islands/SettingsSheet.tsx` (bottom sheet on phone, 400px right drawer on `>=1024px`, 7 settings groups, `Editor sign-in` hidden when `!FLAGS.admin`).
  - Added `tests/e2e/v3-phase1.spec.ts` (4/4 passed on `pixel5` + `desktop`).

