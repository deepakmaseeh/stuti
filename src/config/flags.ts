/**
 * Feature flags for v3 rollout (STUTI_SONGS_COMPLETE_SPEC.md B1.3).
 * Keep admin off until Cloudflare Access is configured and verified.
 */
export const FLAGS = {
  newSearch: true, // letter-grid search (Phase 2)
  newSetEditor: false, // compact editor (Phase 4)
  shareSheet: false, // icon share sheet (Phase 4)
  videos: false, // video button + sheet (Phase 5)
  admin: false, // turn on only after Cloudflare Access is set up (Phase 6)
} as const;
