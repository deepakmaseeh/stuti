# ADR 0004: Desktop layout, Present mode, and export (Phase 4b)

## Context

`STUTI_DESKTOP_ADDON.md` (v1.2) moves Present mode and PDF/PPT export into v1 and
replaces the interim 768/1200 responsive layout with 900 / 1280 breakpoints.

## Decision

- Breakpoints: `<900` mobile (unchanged bottom nav); `900–1279` Finder + Song + Set drawer; `≥1280` three panes.
- Finder and SetPanel mount with `client:only` and only when `matchMedia(min-width: 900px)` matches, so mobile `/search/` keeps a single keypad.
- Present at `/present/`; book lyric bundles at `/data/books/<id>.json`; PPT via lazy `pptxgenjs`.
- Song-page JS gzip budget raised from 40 KB → 60 KB (addon §10); pptxgenjs stays out of the static graph.

## Consequences

- Mobile e2e stays green; desktop specs cover 390 / 1024 / 1440.
- Optional “second screen controller” via BroadcastChannel was deferred (time).
