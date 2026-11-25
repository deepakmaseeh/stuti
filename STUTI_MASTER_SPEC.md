# STUTI_MASTER_SPEC.md (v3.0 · 25 Nov 2026)

**The only UI file the IDE needs.** Replaces STUTI_UI_CORRECTIONS_v1.4, STUTI_THEME_ICONS_REPORTS, STUTI_RESPONSIVE_FIXES, STUTI_FINAL_UI_SPEC, STUTI_AUDIT_24NOV.

**Precedence:** THIS FILE > STUTI_SETLISTS_AND_FIXES > STUTI_DESKTOP_ADDON > STUTI_FIXES_AND_LAUNCH > STUTI_BUILD_SPEC.

## Decisions (latest wins)
- App name: **Stuti Songs**
- Top bar: name + info (About/Guide) + settings (panel). Theme in Settings only.
- Themes: System / Light / Dark only (no contrast)
- Search: tap हिन्दी/English → letter → songs. No text box, no number search, no Songs/123/Browse tabs. Filters: Book + Topic.
- Hymnbooks: full-width rows; numbers via Book page + editor add-by-number
- Set cards: collapsed = date + title + icons; expand on tap
- Share: one icon sheet including PowerPoint
- PDF/PPT/Present fit every screen
- Report → Worker → Google Sheet (not GitHub sign-in)
- Theme survives ClientRouter; tokens on [data-scheme]
- B1: lyrics max-width 760px, no ch-based wrap

## Build order
v3-shell · v3-icons · v3-home-search · v3-song · v3-data · v3-sets · v3-exports · v3-offline-reports · v3-content · v3-audit · v3-guide · v3-tests

Full normative text: the v3.0 paste delivered 25 Nov 2026 (§0–§25). Implement that text.
