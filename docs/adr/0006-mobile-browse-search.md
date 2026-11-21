# 0006 — Mobile browse + header search icon

## Context

Desktop Finder already had Browse-by-letter. Mobile `/search/` only had Number and Words
(`STUTI_DESKTOP_ADDON.md` kept mobile unchanged). Users need Hindi/English letter browse on
phones, clearer song-page Present access, and a magnifier instead of the home “rectangle” CTA.

## Decision

1. Add a third mobile Search tab **Browse** with हिन्दी / English toggles that expand a letter
   grid; tapping a letter lists songs and collapses the grid.
2. Put a magnifier menu in the mobile header (and song header) linking to Number / Words / Browse.
3. Show **Present** on song pages at all widths (not only ≥900px).

## Consequences

- Relaxes “mobile unchanged” for search entry and browse parity; desktop Finder is unchanged.
- New i18n: `search.browsePickAlphabet`; `home.howTip` updated.
