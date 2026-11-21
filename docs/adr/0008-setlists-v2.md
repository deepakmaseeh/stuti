# 0008 — Set Lists 2.0 store and routes

## Context

v1 used a draft set plus saved share-codes. The desktop panel only read the draft, `#s=` always
opened read-only, and set-mode song pages hid Prev/Next on desktop. Leaders need dated services,
inline song adding, and a single active set everywhere.

## Decision

- Persist `{ v: 2, activeId?, sets: WorshipSet[] }` at `stuti:sets:v2`.
- Migrate v1 draft/saved once; keep `stuti:sets:v1-backup`.
- Routes: `/sets/`, `/sets/edit/?id=`, `/sets/view/#s=`, `/sets/print/?id=`; `/set/` redirects.
- Sync via BroadcastChannel `stuti-sets` + `stuti:set-changed`.
- Share codes remain base64url JSON (v2 fields; v1 still decodes).

## Consequences

+ Set panel, editor, and song set-mode share one source of truth.
− Larger localStorage; max 200 sets / 60 items per set.
