# STUTI_UI_CORRECTIONS_v1.4.md (Phase 4d)

Audit of the live build on 21 Nov 2026 (desktop 1440×900, phone 390×844). Visual reference: [`docs/design/stuti-ui-recommendations-v1.4.html`](docs/design/stuti-ui-recommendations-v1.4.html). **This file overrides earlier specs where they conflict.**

Precedence: **UI_CORRECTIONS_v1.4** > SETLISTS_AND_FIXES > DESKTOP_ADDON > FIXES_AND_LAUNCH > BUILD_SPEC.

## Implementation order (commit after each)

1. **DATA** (C19, C23): `src/lib/sets/schema.ts` WorshipSet v2.1 (`rows`: h | s | i); `migrate()` from v1/v2; Vitest.
2. **RUN SHEET**: `src/lib/sets/runsheet.ts` — `buildRunSheet()`, `autoSequence()`, `buildSlides()`. OOS / Present / PPT must use these only.
3. **EDITOR** (C18–C26): `parseAdd()` multi-number; target section; Add song/item here; drag + Alt↑↓; key/verse chips; meta row; 96px spacer; hide TabBar on edit phones.
4. **ORDER OF SERVICE** (C30, C31): `OrderOfService.astro` + print CSS; `?copy=` / `?lyrics=`.
5. **PPT** (C32–C38): rewrite export via `buildSlides()`.
6. **PRESENT** (C39, C40): v2.1 payload; B W L C N 1–9 Esc.
7. **SHELL & SCREENS** (C01–C17, C27–C29, C41–C47).
8. **CONTENT LINT** (C36, C42, C43).
9. **TESTS**: Playwright T1–T12 + axe.

## P0 must-fix first within steps

- C13 calendar phone overflow  
- C18 multi-add `12, 46, 103`  
- C19 insert into target section  
- C24 action bar covering list  
- C30 Order of Service table  
- C33–C36 PPT welcome/sections/chorus/normalise  
- C36 content lint for `(2)` / joined lines  

## Data model v2.1 (summary)

Rows: `h` section | `s` song (key, seq, by, note, minutes) | `i` item (prayer|scripture|sermon|offering|announcements|benediction|communion|custom).  
`migrate(v2)` keeps heading/song order; UI `target` section is not stored.

## parseAdd

`12, 46, 103` → default book numbers; `TLBC 12, SS 5` → book+number; newlines OK; report misses.

## Rules

Keep design tokens. No new runtime deps except existing pptxgenjs (lazy). Offline after book download. No trackers/ads. Commit messages: `4d-<step>: <summary>`.
