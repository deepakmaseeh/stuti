/**
 * Feature flags for v3 rollout (STUTI_SONGS_COMPLETE_SPEC.md B1.3).
 * Admin UI is on; /api/admin/* still requires Cloudflare Access OTP
 * (Cf-Access-Authenticated-User-Email allowlist).
 */
export const FLAGS = {
  newSearch: true, // letter-grid search (Phase 2)
  newSetEditor: true, // compact editor (Phase 4)
  shareSheet: true, // icon share sheet (Phase 4)
  videos: true, // video button + sheet (Phase 5)
  admin: true, // Settings → Editor sign-in → /admin/
} as const;
