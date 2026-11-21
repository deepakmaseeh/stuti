# Rules for AI coding agents

The full specification is `STUTI_BUILD_SPEC.md` (v1.1). Override order: `STUTI_SETLISTS_AND_FIXES.md` > `STUTI_DESKTOP_ADDON.md` > `STUTI_FIXES_AND_LAUNCH.md` > `STUTI_BUILD_SPEC.md`. Read the active override files before writing code.

1. Follow the spec exactly: stack (Astro 5 static + Preact islands + plain CSS + MiniSearch + @vite-pwa/astro injectManifest + Decap CMS + Cloudflare Pages), file structure (§4), data schema (§5), routes (§7), features & acceptance (§8), design tokens (§9), screens (§10).
2. Work phase by phase (§21). Do only the current phase. At the end of each phase: run `npm run validate`, `npm test`, `npm run build` (and e2e when available), fix failures, then print a short report: files created/changed, commands run + results, what is NOT done yet, and any deviation from the spec with the reason.
3. Never invent features beyond the spec. If something is ambiguous, choose the simplest option that satisfies the acceptance criteria and note it in docs/adr/.
4. Song pages must render fully as static HTML without JavaScript. Islands are progressive enhancement.
5. All decisions/configurable values live in src/site.config.ts. No hard-coded URLs, names or book IDs elsewhere.
6. TypeScript strict. No `any` except at JSON boundaries with validation. Small pure functions in src/lib with unit tests.
7. Accessibility and performance budgets (§19) are requirements, not nice-to-haves.
8. Content is text only: never render content with set:html / dangerouslySetInnerHTML.
9. Never publish songs whose rights status is not public_domain or licensed (demo only when PUBLIC_INCLUDE_DEMO=true).
10. Use the latest Astro 5.x (do not upgrade to 6). For other packages use the latest stable versions compatible with Astro 5. Check Cloudflare Pages free-tier limits before starting; record what you checked in docs/adr/0001-versions.md.
11. Do not add analytics, ads, trackers, external fonts or CDNs (except Decap CMS script on /admin and optional Cloudflare Web Analytics).
12. Commit after each phase with message "phase N: <summary>".
13. The app is fully independent. No ClickUp code, SDK, API, links, logos, logins, webhooks, analytics or file URLs anywhere in the repo or the running app. CI must fail if the word 'clickup' appears in any tracked file other than the instruction files (STUTI_BUILD_SPEC.md, STUTI_FIXES_AND_LAUNCH.md, STUTI_SETLISTS_AND_FIXES.md, AGENTS.md), see STUTI_FIXES_AND_LAUNCH.md §2.
