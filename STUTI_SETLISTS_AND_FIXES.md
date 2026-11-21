# Stuti: Live-Site Audit Fixes + Set Lists 2.0 (Add-on v1.3)

> Priority: **this file > STUTI_DESKTOP_ADDON.md > STUTI_FIXES_AND_LAUNCH.md > STUTI_BUILD_SPEC.md**.
> Based on a walkthrough of the live site on 20 Nov 2026 (desktop 1440×900 + mobile 390×844).

## Phase 4c

1. Fix bugs B1–B14 with regression tests.
2. Replace set lists with Set Lists 2.0 (data model, routes, editor, calendar, share, set mode).
3. Apply screen fixes and content checks.
4. Add tests; run validate / unit / e2e / build.

## B1–B14 (summary)

| ID | Issue |
|---|---|
| B1 | Set mode: no Prev/Next / toolbar on song from set |
| B2 | Panel shows 0 songs while singing |
| B3 | Saved set click does nothing until reload |
| B4 | Own saved set opens read-only |
| B5 | New set leaves old songs in panel |
| B6 | No date picker |
| B7 | Desktop keyboard digits do not fill keypad |
| B8 | Set panel action buttons broken layout |
| B9 | Desktop cannot reach Sets / Offline / Settings |
| B10 | Duplicate Browse/Number/Words on desktop home |
| B11 | Duplicate Keep awake |
| B12 | Keypad display jumps |
| B13 | Chorus marker before full chorus |
| B14 | Lang chips must come from published books |

## Set Lists 2.0 (summary)

- Store: `stuti:sets:v2` with `WorshipSet` (songs + headings, keys, verses, service type, date).
- Routes: `/sets/`, `/sets/edit/?id=`, `/sets/view/#s=`, `/sets/print/?id=`; `/set/` redirects.
- Active set drives + Set and desktop panel.
- Set mode: `/song/<id>/?set=<id>&i=` (mine) or `?shared=<code>&i=`.
- Share: link, QR, WhatsApp text, .ics; print order of service.
- Migration from v1 draft + saved sets; backup `stuti:sets:v1-backup`.

## Independence

CI must fail if the word `clickup` appears in tracked files other than instruction files
(`STUTI_BUILD_SPEC.md`, `STUTI_FIXES_AND_LAUNCH.md`, `STUTI_SETLISTS_AND_FIXES.md`, `AGENTS.md`).
