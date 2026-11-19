# 0002: Stay on Astro 5 for v1

Date: 2026-11-19 · Status: accepted

## Decision

Build and launch v1 on Astro 5.x. Upgrade only after v1 launch.

## Why

Newer Astro majors move content collections to Zod 4. In Zod 4, `z` is imported from `astro/zod`, and `.default({})` on an object no longer fills the nested defaults, so song data (`layers`, `display`, `author`) would silently come out wrong.

## When upgrading

1. Import `z` from `astro/zod` instead of `astro:content`.
2. Replace `.default({})` on objects with `.prefault({})`.
3. Upgrade @astrojs/preact, @vite-pwa/astro and vite-plugin-pwa to the matching majors.
4. Run the full test suite, including `tests/unit/schema-defaults.test.ts`.
