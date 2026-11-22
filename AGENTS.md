# Rules for AI coding agents

The full product/build specification is `STUTI_BUILD_SPEC.md` (v1.1). **UI override order:** `STUTI_FINAL_UI_SPEC.md` > `STUTI_SETLISTS_AND_FIXES.md` > `STUTI_DESKTOP_ADDON.md` > `STUTI_FIXES_AND_LAUNCH.md` > `STUTI_BUILD_SPEC.md`. Older patch files (`STUTI_UI_CORRECTIONS_v1.4.md`, `STUTI_THEME_ICONS_REPORTS.md`, `STUTI_RESPONSIVE_FIXES.md`) are replaced by `STUTI_FINAL_UI_SPEC.md`. Read the active override before writing code. `docs/design/stuti-ui-recommendations-v1.4.html` is the visual reference for Order of Service, PPT, Present and set cards only — where it differs, `STUTI_FINAL_UI_SPEC.md` wins.

1. Follow the stack (Astro 5 static + Preact islands + plain CSS + MiniSearch + @vite-pwa/astro injectManifest + Decap CMS + Cloudflare), file structure, data schema, routes, features, design tokens. UI work follows `STUTI_FINAL_UI_SPEC.md` §0–§21.
2. Work the v2 build order (§1): commit after each step with `v2-shell` … `v2-tests`. At the end of each step: `npm run validate`, `npm test`, `npm run build` (and e2e when available), fix failures, short report.
3. Never invent features beyond the spec. Ambiguity → simplest option that meets acceptance; note in `docs/adr/`.
4. Song pages render fully as static HTML without JavaScript. Islands are progressive enhancement.
5. Configurable values live in `src/site.config.ts`. No hard-coded URLs, names or book IDs elsewhere.
6. TypeScript strict. No `any` except at JSON boundaries with validation. Small pure functions in `src/lib` with unit tests.
7. Accessibility and performance budgets are requirements.
8. Content is text only: never `set:html` / `dangerouslySetInnerHTML`.
9. Never publish songs whose rights status is not `public_domain` or `licensed` (demo only when `PUBLIC_INCLUDE_DEMO=true`).
10. Latest Astro 5.x (do not upgrade to 6). Other packages: latest stable compatible with Astro 5.
11. No analytics, ads, trackers, external fonts or CDNs (except Decap on `/admin` and optional Cloudflare Web Analytics).
12. Commit after each v2 step with the names in `STUTI_FINAL_UI_SPEC.md` §1.
13. Fully independent of ClickUp. CI fails if `clickup` appears in tracked files other than instruction/spec markdown listed in `STUTI_FIXES_AND_LAUNCH.md` §2 (include `STUTI_FINAL_UI_SPEC.md` and `AGENTS.md` as allowed).
14. Icons: Lucide (`lucide-preact` / `astro-icon` + `@iconify-json/lucide`); WhatsApp only via `simple-icons`. Theme uses `[data-scheme]` (§3).
