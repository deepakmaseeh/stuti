export const SCRIPT_RE: Record<'hi' | 'ta' | 'te' | 'pa', RegExp> = {
  hi: /[\u0900-\u097F]/, // Devanagari
  ta: /[\u0B80-\u0BFF]/, // Tamil
  te: /[\u0C00-\u0C7F]/, // Telugu
  pa: /[\u0A00-\u0A7F]/, // Gurmukhi
};
export const INDIC_ANY = /[\u0900-\u0DFF]/;
export const LATIN_ONLY = /^[\p{Script=Latin}\p{N}\p{P}\p{Zs}'’-]*$/u;
export const LANG_LABEL = { en: 'English', hi: 'Hindi', ta: 'Tamil', te: 'Telugu', pa: 'Punjabi' } as const;
export const LANG_NATIVE = { en: 'English', hi: 'हिन्दी', ta: 'தமிழ்', te: 'తెలుగు', pa: 'ਪੰਜਾਬੀ' } as const;
export const LANG_TAG = {
  // for lang="" attributes
  n: { en: 'en', hi: 'hi', ta: 'ta', te: 'te', pa: 'pa' },
  r: { en: 'en', hi: 'hi-Latn', ta: 'ta-Latn', te: 'te-Latn', pa: 'pa-Latn' },
} as const;
