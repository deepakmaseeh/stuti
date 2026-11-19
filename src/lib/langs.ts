/** Zod-free so browser islands can import it without pulling the schema library into the bundle. */
export const LANGS = ['en', 'hi', 'ta', 'te', 'pa'] as const;
export type Lang = (typeof LANGS)[number];
