# 0003: JSON-LD is the only `set:html` in the app

Date: 2026-11-19 · Status: accepted

## Context

The spec bans rendering content with `set:html` / `dangerouslySetInnerHTML`. The song page also needs a
`<script type="application/ld+json">` block (§19.5). Astro HTML-escapes expressions inside elements, which
would turn the JSON's quotes into `&quot;` and break it, so the JSON has to be written raw.

## Decision

- Song lyrics, titles and every other piece of content are rendered as text only. No exceptions.
- The single allowed `set:html` is the JSON-LD script, and its value must come from `safeJsonLd()` in
  `src/lib/jsonld.ts`, which escapes `<`, `>`, `&`, U+2028 and U+2029 so no content can close the script tag.
- The CI content-safety grep (Phase 7) allows `set:html={safeJsonLd(` and fails on any other `set:html`.

## Consequences

A song whose text contains `</script>` still produces valid, inert JSON-LD (covered by a unit test).
