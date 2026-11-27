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

- `newSearch`: `true` (Phase 2)
- `newSetEditor`: `true` (Phase 4)
- `shareSheet`: `true` (Phase 4)
- `videos`: `true` (Phase 5)
- `admin`: `true` (Phase 6 — UI on; `/api/admin/*` still needs Cloudflare Access OTP)

## Phase Log

- **Baseline**: Recorded on `v3-ui`.
- **Phase 1 (Shell, tokens, Settings)**:
  - Added `src/config/flags.ts`, `src/styles/v3/tokens.css`, `src/styles/v3/app.css`.
  - Updated `Base.astro`, `AppShell.astro`, `TopBar.astro`, `BottomNav.astro`, `books/[book].astro`, `books/index.astro`.
  - Added `src/components/islands/SettingsSheet.tsx` (bottom sheet on phone, 400px right drawer on `>=1024px`, 7 groups, `Editor sign-in` hidden when `!FLAGS.admin`).
  - Added `tests/e2e/v3-phase1.spec.ts` (4/4 passed).
- **Phase 2 (Home, Search, Book page)**:
  - Updated `HomeLists.tsx` and `src/pages/index.astro` (This Sunday ribbon card, Your songs Recent/Favourites tabs, full-width Hymnbooks rows with offline status).
  - Updated `LetterBrowser.tsx` and `SearchTabs.tsx` (no text input, URL hash `#lang=...&book=...&l=...` sync, scroll restore, Book/Topic filters).
  - Updated `src/pages/books/[book].astro` (Home back link, sticky `1 · 50 · 100…` jump bar).
  - Added `tests/e2e/v3-phase2.spec.ts` (3/3 passed).
- **Phase 3 (Song page)**:
  - Updated `src/pages/song/[id].astro` (removed `<SongMeta />` below lyrics, added `⋮` More menu + Present icon in songbar, 760px max lyrics width).
  - Added `src/components/islands/SongMoreSheet.tsx` (Lyrics PDF, PowerPoint, Share, Song info sheet, Report a mistake, Settings).
  - Updated `ReportSheet.tsx` (long-press line trigger, `Your name` remembered in `localStorage`).
  - Added `tests/e2e/v3-phase3.spec.ts` (4/4 passed).
- **Phase 4 (Sets, Set editor, Share sheet)**:
  - Updated `SetEditorV2.tsx` (plain-text `.shead` section rows, collapsed `.srow` song rows, musician-gated key chips, single expanded `.exp` row).
  - Verified `ShareSheet.tsx` (QR + WhatsApp, Copy link, Share…, QR image, Order of service, PowerPoint, Lyrics PDF, Calendar, Open in Present).
  - Added `tests/e2e/v3-phase4.spec.ts` (1/1 passed).
- **Phase 5 (Videos)**:
  - Extended `SongSchema` in `src/lib/schema.ts` with `MediaItemSchema` (backwards-compatible `{ youtube: null }` default).
  - Added `src/components/islands/VideoSheet.tsx` (tap-to-load `youtube-nocookie.com` embed, offline message, Like on YouTube link).
  - Added `CirclePlay` button in `SongToolbar.tsx` (disabled `opacity: 0.3` `"No video yet"` when no working videos).
  - Added `tests/e2e/v3-phase5.spec.ts` (1/1 passed).
- **Phase 6 (Editor sign-in & Admin)**:
  - Added `src/lib/paste-split.ts` + `tests/unit/paste-split.test.ts`.
  - Added Cloudflare Access header guard (`/api/admin/*` → 403 without `Cf-Access-Authenticated-User-Email`) + `/api/admin/me` + `/api/admin/oembed` in `workers/report.ts`.
  - Enabled `FLAGS.admin = true`; `/admin/` serves v3 AdminApp; Decap kept at `/admin/cms/`.
  - Save draft (localStorage + JSON download), Publish (`POST /api/admin/publish` → GitHub when `GITHUB_TOKEN` set), Mark fixed (local overlay + Sheet Status), CSV file picker.
- **Phase 7 (About & Guide)**:
  - Updated `src/pages/guide/index.astro` with sticky `.toc`, numbered `.step` circles, and generated screenshots in `public/guide/*.png`.
  - Added `tests/e2e/guide.spec.ts` (1/1 passed).

