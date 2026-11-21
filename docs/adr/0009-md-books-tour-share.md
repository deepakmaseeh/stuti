# ADR 0009 — CCF→TLBC import, SS/XMAS books, tour, compact share

## Status

Accepted — 2026-11-21

## Context

Fixed markdown exports of the CCF Hindi song book and a Sunday-school lyric PDF needed to land in Stuti. Users also asked for Christmas / Sunday-school filters, shorter set share links, a first-visit tip, and clearer offline download behaviour. Spec forbids inventing features without ADR when they sit outside the written roadmap; occasion browse is already on the v1.1 roadmap.

## Decision

1. **CCF merges into TLBC** — no separate CCF book. New songs get the next TLBC numbers; matches enrich thin chorus-only entries and add tags (`bhajan`, `ccf-N`).
2. **New books** — `SS` (English Sunday school only; regional/Telugu skipped) and `XMAS` (Christmas-tagged songs, dual-numbered with TLBC when applicable).
3. **Stanza split** — blank-line gaps and `कोरस`/`chorus`/numbered lines become `verse`/`chorus` sections (`src/lib/md-song-import.ts`).
4. **Browse topics** — expose Christmas / Sunday-school chips from existing `byTopic` index data.
5. **Share links** — keep fully offline `#s=` encoding; omit empty optional fields and default `svc`; warn at 1800 chars; truncate display in QR sheet.
6. **First-visit tour** — optional progressive enhancement on home only (`stuti:tour`), three steps, no third-party tour library; InstallPrompt still waits for engagement.
7. **Offline** — book page download CTA; copy clarifies one download caches every song in that book’s list.

## Consequences

- TLBC grows by ~100+ songs; validate/build indexes must stay green.
- Dual book numbers (`TLBC` + `XMAS`) are intentional for Christmas songs.
- Tour and topic filters are documented here so they are not “invented” without acceptance.
