# 0007 — Fresh HTML on every online navigation

## Context

Users saw yesterday’s UI until a hard refresh: toolbar icons missing, old Browse
layout, double search. Root cause: `precacheAndRoute` CacheFirst for HTML shells
plus a manual “Update” toast that many never clicked.

## Decision

1. Precache assets + offline page only — not `index.html` / `search/index.html`.
2. Navigations use NetworkFirst; new SW auto `skipWaiting` + reload.
3. Clear `stuti-pages` on activate; song links use `data-astro-reload`.
4. HTML responses: `Cache-Control: no-cache`.

## Consequences

Online users always get the latest deploy. Offline still works from `stuti-pages`
after a book download / prior visit.
