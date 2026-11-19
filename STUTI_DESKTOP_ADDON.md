# Stuti: Desktop Layout + Present Mode + Export (Add-on v1.2)

> Priority when files disagree: **this file > STUTI_FIXES_AND_LAUNCH.md > STUTI_BUILD_SPEC.md**.
> Visual reference: `docs/design/stuti-desktop-demo.html` (demo only, not production code).
> Moves **Present mode** and **PDF/PPT export** from the v2 roadmap into v1.

## Breakpoints (override earlier 768 / 1200 rules)

| Width | Layout |
|---|---|
| **< 900px** | Mobile, unchanged: single column, bottom nav, sheets |
| **900–1279px** | Two panes: Finder (320px) + Song. Set list is a right drawer (340px). Bottom nav hidden. |
| **≥ 1280px** | Three panes: Finder (310px) · Song (fluid, content max 1120px) · Set panel (320px). Bottom nav hidden. |

Each pane scrolls on its own; page itself does not scroll on desktop. Height = `100dvh - top bar`.

## Steps (Phase 4b)

- **D1** Data: `public/data/books/<bookId>.json`, `public/search/browse-<lang>.json`, meta tags + first line
- **D2** Layout shell: Finder / main / SetPanel + TopBar + `html[data-desktop]` + ClientRouter
- **D3** Finder island: Number · Words · Browse
- **D4** Song desktop: large badge, Present, Columns, PDF/PPT, print CSS
- **D5** Set panel / drawer
- **D6** Present mode `/present/`
- **D7** Export: print PDF + pptxgenjs PPT
- **D8** Keyboard shortcuts
- **D9** Playwright (390 / 1024 / 1440) + Lighthouse

Mobile (<900px) must look and work exactly as before.
