# 0004: Responsive tablet and desktop layouts

Date: 2026-11-19 · Status: accepted

## Decision

Add layouts beyond the original phone-only 480px column:

- **&lt;768px:** unchanged (bottom nav, 480px column).
- **768–1199px:** bottom nav becomes a top bar; content max-width 720px; lyric size one step larger.
- **≥1200px:** two panes. List pages (search, book index, set) keep the tool on the left and show the selected song on the right. Song pages show a number keypad on the left and lyrics on the right. Optional **Columns** layout places Original / Roman / English side by side.

Breakpoints and widths live in `site.config.ts` → `layout`.

## Why

Worship leaders plan sets on laptops; churches often drive a projector from a laptop. The phone column alone wastes that screen. Full projector mode stays in v2.

## How (constraints)

- Song pages remain complete static HTML without JavaScript.
- The right-hand preview fetches the static song page and **re-renders text with Preact** (`parseSongHtml`); it never injects HTML (`set:html` / `innerHTML` stay forbidden).
- Only **song row** clicks (search hits, book index, set items) open in the preview pane. Keypad **Open**, deep links (`?book=&n=`), and **Start singing** still navigate to the full song page (toolbar, wake lock, set bar).
- Without JS, song links navigate normally.
- Keyboard shortcuts (digits, `/`, ←/→, Esc) are progressive enhancement.
