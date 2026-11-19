# 0005: Noto Serif Devanagari for Hindi lyrics

Date: 2026-11-19 · Status: accepted

## Context

STUTI_BUILD_SPEC §9 lists **Noto Sans Devanagari** for Indic text. TLBC hymns read more clearly in a traditional Sanskrit-style Devanagari face, especially on Present slides and lyric pages.

## Decision

Use **Noto Serif Devanagari** (self-hosted via `@fontsource/noto-serif-devanagari`, unicode-range) as the primary Hindi/Devanagari face (`--font-lyric-hi` / `:lang(hi)`). Keep Noto Sans Devanagari as a fallback. UI chrome stays Instrument Sans + Domine. Tamil/Telugu/Gurmukhi remain Noto Sans.

## Consequences

- Slightly larger font payload for Hindi pages (serif + optional sans fallback).
- `scripts/font-manifest.ts` maps `hi` → `noto-serif-devanagari` for offline book downloads.
- Spec §9 table is overridden here for Hindi lyric body only.
