# STUTI_FINAL_UI_SPEC.md (v2.0 · 22 Nov 2026)

**One file for the IDE.** Replaces `STUTI_UI_CORRECTIONS_v1.4.md`, `STUTI_THEME_ICONS_REPORTS.md`, `STUTI_RESPONSIVE_FIXES.md`.

**Precedence:** THIS FILE > STUTI_SETLISTS_AND_FIXES.md > STUTI_DESKTOP_ADDON.md > STUTI_FIXES_AND_LAUNCH.md > STUTI_BUILD_SPEC.md.

Visual reference for Order of Service / PPT / Present / set cards: `docs/design/stuti-ui-recommendations-v1.4.html`. Where it differs (Home finder chips, editor section boxes, text-only buttons, language chips in header), **this file wins**.

The full normative text is the v2.0 paste delivered 22 Nov 2026 (sections 0–21). Agents must implement:

## Build order (commit after each)
1. `v2-shell` — §2 breakpoints/header/tab bar/guardrails · §3 theme
2. `v2-icons` — §4 Lucide icon system
3. `v2-home-search` — §5 Home · §6 Search
4. `v2-song` — §7 Song page
5. `v2-data` — §12 schema v2.1 + run sheet
6. `v2-sets` — §8–§11 Sets list, calendar, new set, editor, share sheet
7. `v2-exports` — §13–§15 OOS, PPT, Present
8. `v2-offline-reports` — §16 Offline · §17 Report
9. `v2-content` — §18 Content lint + TLBC 12/46
10. `v2-tests` — §19 Tests

## Non-negotiables (§0)
- One way in per job (search only on Search tab / finder)
- Compact by default; no box-in-box; empty = one line
- Icons first (Lucide); icon+label for tabs, menus, primary CTAs
- Filters = native `<select>` dropdowns
- Feature parity at every size (§2.3); `data-feature` attributes
- One data path: `buildRunSheet()` for OOS / PPT / Present
- Tokens: leather/gold/ribbon/paper; Domine / Instrument Sans / Noto; body ≥16px, UI ≥14px, tap ≥44px

## Critical fixes
- **Theme (N1/§3):** `prefs.ts` + `astro:before-swap` apply on `e.newDocument`; tokens on `[data-scheme]` only; ThemeToggle on every page
- **Home (N5/§5):** Remove Browse/Number/Songs chips, tip line, header search icon (phone), offline pill. Home = This Sunday + Your songs (Recent|Favourites) + Hymnbooks
- **Search (§6):** One input + Language/Book/Topic selects + A–Z rail
- **Editor (§10):** Compact 44px section headers; collapsed song rows; add bar with section dropdown
- **Share (§11):** Icon tile sheet
- **Responsive R1–R13** as listed in the 22 Nov paste

See the conversation / agent transcript for the complete section text when implementing each step.
